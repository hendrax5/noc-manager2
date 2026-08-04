/**
 * Backfill historical create (+1) and reply (+1) points into TicketHistory.
 * Idempotent — safe to re-run.
 *
 * Usage: node scripts/backfill_ticket_points.js
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const CREATE_POINTS = 1;
const REPLY_POINTS = 1;
const BATCH = 500;

function isCreatePointsAction(action) {
  return typeof action === "string" && action.startsWith("Ticket created: [+1 Pts]");
}

function isReplyPointsAction(action) {
  return (
    typeof action === "string" &&
    (action.startsWith("Public reply: [+1 Pts]") ||
      action.startsWith("Internal reply: [+1 Pts]"))
  );
}

function commentIdFromAction(action) {
  const m = String(action).match(/\(backfill comment #(\d+)\)|\(comment #(\d+)\)/);
  if (!m) return null;
  return parseInt(m[1] || m[2], 10);
}

async function backfillCreates() {
  console.log("=== Create points backfill ===");

  const already = await prisma.ticketHistory.findMany({
    where: {
      awardedScore: CREATE_POINTS,
      action: { startsWith: "Ticket created: [+1 Pts]" },
    },
    select: { ticketId: true },
  });
  const hasCreatePts = new Set(already.map((r) => r.ticketId));
  console.log(`Tickets already with create pts: ${hasCreatePts.size}`);

  const createLogs = await prisma.ticketHistory.findMany({
    where: { action: { startsWith: "Ticket created" } },
    orderBy: [{ ticketId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { ticketId: true, actorId: true, createdAt: true, action: true },
  });

  const firstCreateByTicket = new Map();
  for (const row of createLogs) {
    if (!firstCreateByTicket.has(row.ticketId)) {
      firstCreateByTicket.set(row.ticketId, row);
    }
  }

  const toInsert = [];
  for (const [ticketId, row] of firstCreateByTicket) {
    if (hasCreatePts.has(ticketId)) continue;
    if (isCreatePointsAction(row.action)) {
      // Old path never had this; if present without awardedScore, still insert? skip.
      continue;
    }
    if (!row.actorId) continue;
    toInsert.push({
      ticketId,
      actorId: row.actorId,
      action: "Ticket created: [+1 Pts] (backfill)",
      awardedScore: CREATE_POINTS,
      createdAt: row.createdAt,
    });
  }

  // Tickets with no "Ticket created" history at all — skip (unknown creator)
  console.log(`Create backfill rows to insert: ${toInsert.length}`);

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH);
    await prisma.ticketHistory.createMany({ data: chunk });
    console.log(`  create inserted ${Math.min(i + BATCH, toInsert.length)}/${toInsert.length}`);
  }

  return toInsert.length;
}

async function backfillReplies() {
  console.log("=== Reply points backfill ===");

  const existingReplyPts = await prisma.ticketHistory.findMany({
    where: {
      awardedScore: REPLY_POINTS,
      OR: [
        { action: { startsWith: "Public reply: [+1 Pts]" } },
        { action: { startsWith: "Internal reply: [+1 Pts]" } },
      ],
    },
    select: { id: true, ticketId: true, actorId: true, action: true, createdAt: true },
    orderBy: [{ ticketId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  const claimedByCommentId = new Set();
  /** @type {Map<number, Array<{id:number, actorId:number|null, createdAt:Date, used:boolean}>>} */
  const livePoolByTicket = new Map();

  for (const row of existingReplyPts) {
    const cid = commentIdFromAction(row.action);
    if (cid) {
      claimedByCommentId.add(cid);
      continue;
    }
    if (!livePoolByTicket.has(row.ticketId)) livePoolByTicket.set(row.ticketId, []);
    livePoolByTicket.get(row.ticketId).push({
      id: row.id,
      actorId: row.actorId,
      createdAt: row.createdAt,
      used: false,
    });
  }

  console.log(`Existing reply point logs: ${existingReplyPts.length}`);
  console.log(`Already tied to comment ids: ${claimedByCommentId.size}`);

  let lastId = 0;
  let scanned = 0;
  let inserted = 0;
  const pending = [];

  async function flush() {
    if (pending.length === 0) return;
    await prisma.ticketHistory.createMany({ data: pending.splice(0, pending.length) });
  }

  for (;;) {
    const comments = await prisma.comment.findMany({
      where: { id: { gt: lastId } },
      orderBy: { id: "asc" },
      take: BATCH,
      select: {
        id: true,
        ticketId: true,
        authorId: true,
        isPublic: true,
        createdAt: true,
      },
    });
    if (comments.length === 0) break;

    for (const c of comments) {
      scanned += 1;
      lastId = c.id;
      if (claimedByCommentId.has(c.id)) continue;

      const pool = livePoolByTicket.get(c.ticketId) || [];
      const matchIdx = pool.findIndex(
        (p) => !p.used && p.actorId === c.authorId
      );
      if (matchIdx >= 0) {
        pool[matchIdx].used = true;
        continue;
      }

      const kind = c.isPublic ? "Public reply" : "Internal reply";
      pending.push({
        ticketId: c.ticketId,
        actorId: c.authorId,
        action: `${kind}: [+${REPLY_POINTS} Pts] (backfill comment #${c.id})`,
        awardedScore: REPLY_POINTS,
        createdAt: c.createdAt,
      });
      inserted += 1;

      if (pending.length >= BATCH) {
        await flush();
        console.log(`  reply scanned ${scanned}, inserted ${inserted}`);
      }
    }
  }

  await flush();
  console.log(`Reply scanned: ${scanned}, inserted: ${inserted}`);
  return inserted;
}

async function main() {
  const dry =
    process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";
  if (dry) {
    console.log("DRY RUN — counting only");
    const commentCount = await prisma.comment.count();
    const ticketCount = await prisma.ticket.count();
    const createPts = await prisma.ticketHistory.count({
      where: {
        awardedScore: CREATE_POINTS,
        action: { startsWith: "Ticket created: [+1 Pts]" },
      },
    });
    const replyPts = await prisma.ticketHistory.count({
      where: {
        awardedScore: REPLY_POINTS,
        OR: [
          { action: { startsWith: "Public reply: [+1 Pts]" } },
          { action: { startsWith: "Internal reply: [+1 Pts]" } },
        ],
      },
    });
    console.log({ ticketCount, commentCount, createPts, replyPts });
    return;
  }

  const created = await backfillCreates();
  const replies = await backfillReplies();
  console.log("DONE", { createRows: created, replyRows: replies });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
