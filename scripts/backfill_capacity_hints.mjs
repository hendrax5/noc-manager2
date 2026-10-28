/**
 * One-off backfill: fill `Service.customData.bandwidthMbps` from ticket history.
 *
 * Usage (inside the app container, where DATABASE_URL and @prisma/client exist):
 *   node /app/_backfill_capacity_hints.mjs --customer=626 --dry-run
 *   node /app/_backfill_capacity_hints.mjs --customer=626 --apply
 *
 * Only unambiguous, non-approximate evidence is written (see capacityHints.js
 * `adoptableCapacity`). Ambiguous and missing services are listed for review.
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
import { adoptableCapacity, extractCapacityHints } from './_capacityHints.mjs';

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));
const customerId = Number(args.get('customer') || 0);
const apply = args.get('apply') === 'true';
const date = args.get('date') || new Date().toISOString().slice(0, 10);
if (!Number.isSafeInteger(customerId) || customerId < 1) {
  console.error('usage: --customer=<id> [--apply] [--dry-run]');
  process.exit(2);
}

const prisma = new PrismaClient();
const label = (candidate) => ({
  mbps: candidate.mbps,
  kind: candidate.kind,
  confidence: candidate.confidence,
  approximate: !!candidate.approximate,
  ticketId: candidate.source?.ticketId ?? null,
  trackingId: candidate.source?.trackingId || '',
  createdAt: candidate.source?.createdAt || '',
});

function hintsFor(service) {
  const texts = [];
  for (const ticket of service.tickets || []) {
    const source = { ticketId: ticket.id, trackingId: ticket.trackingId || '', createdAt: ticket.createdAt, singleService: (ticket._count?.services ?? 0) === 1 };
    if (ticket.title) texts.push({ ...source, text: ticket.title, kind: 'title' });
    if (ticket.description) texts.push({ ...source, text: ticket.description, kind: 'ticket' });
    for (const comment of ticket.comments || []) texts.push({ ...source, createdAt: comment.createdAt, text: comment.text, kind: 'comment' });
  }
  return extractCapacityHints({ cid: service.cid || '', aliases: (service.identifiers || []).map((item) => item.code), texts });
}

async function main() {
  const services = await prisma.service.findMany({
    where: { customerId },
    select: {
      id: true,
      cid: true,
      name: true,
      status: true,
      customData: true,
      template: { select: { name: true } },
      identifiers: { select: { code: true } },
      tickets: {
        select: {
          id: true,
          trackingId: true,
          title: true,
          description: true,
          createdAt: true,
          _count: { select: { services: true } },
          comments: { select: { text: true, createdAt: true }, orderBy: { id: 'desc' }, take: 200 },
        },
      },
    },
    orderBy: { id: 'asc' },
  });
  const plan = { customerId, generatedAt: new Date().toISOString(), applied: apply, ready: [], ambiguous: [], missing: [], skipped: [] };
  for (const service of services) {
    const existing = Number(service.customData?.bandwidthMbps);
    if (Number.isFinite(existing) && existing > 0) {
      plan.skipped.push({ serviceId: service.id, cid: service.cid, reason: 'bandwidth already set', mbps: existing });
      continue;
    }
    if (String(service.template?.name || '').trim().toUpperCase() === 'DARKFIBER') {
      plan.skipped.push({ serviceId: service.id, cid: service.cid, reason: 'DARKFIBER uses pair count' });
      continue;
    }
    const hints = hintsFor(service);
    const resolution = adoptableCapacity(hints.existing);
    const base = {
      serviceId: service.id,
      cid: service.cid,
      name: service.name,
      status: service.status,
      targetHints: hints.target.slice(0, 2).map(label),
    };
    if (resolution.status === 'ready') plan.ready.push({ ...base, mbps: resolution.mbps, source: label(resolution.candidate) });
    else if (resolution.status === 'ambiguous') plan.ambiguous.push({ ...base, candidates: resolution.candidates.map(label) });
    else plan.missing.push({ ...base, suggestions: hints.existing.slice(0, 3).map(label) });
  }

  if (apply && plan.ready.length) {
    let written = 0;
    for (const row of plan.ready) {
      const service = services.find((item) => item.id === row.serviceId);
      const customData = { ...(service?.customData || {}), bandwidthMbps: row.mbps };
      await prisma.$transaction(async (tx) => {
        await tx.service.update({ where: { id: row.serviceId }, data: { customData } });
        await tx.activityEvent.upsert({
          where: { idempotencyKey: `capacity-backfill-${date}-${row.serviceId}` },
          update: {},
          create: {
            actorId: null,
            source: 'import',
            type: 'service.capacity_from_ticket',
            entityType: 'service',
            entityId: row.serviceId,
            ticketId: null,
            idempotencyKey: `capacity-backfill-${date}-${row.serviceId}`,
            changes: [{ field: 'bandwidthMbps', before: null, after: row.mbps }],
          },
        });
      });
      written += 1;
    }
    plan.written = written;
  }

  const planPath = `/tmp/capacity-hint-backfill-customer-${customerId}-${date}.json`;
  writeFileSync(planPath, JSON.stringify(plan, null, 2));
  const summary = {
    customerId,
    apply,
    total: services.length,
    ready: plan.ready.length,
    ambiguous: plan.ambiguous.length,
    missing: plan.missing.length,
    skipped: plan.skipped.length,
    written: plan.written || 0,
    planPath,
  };
  console.log(JSON.stringify(summary, null, 2));
  console.log('READY_SAMPLE', JSON.stringify(plan.ready.slice(0, 5), null, 1));
  console.log('AMBIGUOUS_SAMPLE', JSON.stringify(plan.ambiguous.slice(0, 5), null, 1));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
