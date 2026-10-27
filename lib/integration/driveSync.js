/**
 * Sync ticket attachments to Google Drive (option A: native, link shown on the ticket).
 *
 * The attachment row is the queue: driveStatus pending -> synced | failed (after MAX_ATTEMPTS).
 * Rows created before the feature are marked "skipped" by the migration and only move when an
 * operator runs the backfill endpoint.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../prisma.js";
import { driveConfig, driveFileName, isDriveConfigured, mimeTypeForFilename, uploadDriveFile } from "./gdrive.js";

export const MAX_ATTEMPTS = 3;
const UPLOAD_URL_PREFIX = "/api/uploads/";

/** Unique on-disk name behind an /api/uploads/<name> URL, or null for external URLs. */
export function attachmentDiskName(url) {
  if (typeof url !== "string" || !url.startsWith(UPLOAD_URL_PREFIX)) return null;
  const raw = url.slice(UPLOAD_URL_PREFIX.length).split(/[?#]/)[0];
  let name;
  try {
    name = decodeURIComponent(raw);
  } catch {
    name = raw;
  }
  return /^[A-Za-z0-9._-]+$/.test(name) ? name : null;
}

/** Absolute path of a locally uploaded attachment. Never escapes the uploads directory. */
export function resolveUploadPath(url, cwd = process.cwd()) {
  const name = attachmentDiskName(url);
  if (!name) return null;
  const base = path.resolve(cwd, "public", "uploads");
  const full = path.resolve(base, name);
  return full.startsWith(base + path.sep) ? full : null;
}

/** One Drive folder per ticket, named after the tracking id. */
export function driveFolderName(ticket) {
  if (ticket?.trackingId) return String(ticket.trackingId);
  return `ticket-${ticket?.id ?? "unknown"}`;
}

function errorText(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

/**
 * Upload one attachment. Claims the row first so the inline hook and the cron sweep cannot
 * upload the same file twice.
 */
export async function syncAttachment(attachmentId, { config = driveConfig() } = {}) {
  if (!isDriveConfigured(config)) return { ok: false, skipped: true, reason: "not_configured" };

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { ticket: { select: { id: true, trackingId: true } } },
  });
  if (!attachment) return { ok: false, skipped: true, reason: "not_found" };
  if (attachment.driveStatus === "synced") return { ok: true, skipped: true, reason: "already_synced" };
  if (attachment.driveStatus === "skipped") return { ok: false, skipped: true, reason: "skipped" };
  if (attachment.driveAttempts >= MAX_ATTEMPTS) return { ok: false, skipped: true, reason: "max_attempts" };

  const claim = await prisma.attachment.updateMany({
    where: { id: attachmentId, driveStatus: "pending", driveAttempts: { lt: MAX_ATTEMPTS } },
    data: { driveAttempts: { increment: 1 } },
  });
  if (claim.count === 0) return { ok: false, skipped: true, reason: "claimed_elsewhere" };

  const attempts = attachment.driveAttempts + 1;
  try {
    const filePath = resolveUploadPath(attachment.url);
    if (!filePath) throw new Error("Lampiran bukan file lokal (/api/uploads); tidak dapat diarsipkan.");
    const buffer = await fs.readFile(filePath);
    const uploaded = await uploadDriveFile({
      name: driveFileName(attachment.ticket?.trackingId, attachment.filename),
      mimeType: mimeTypeForFilename(attachment.filename),
      buffer,
      folderName: driveFolderName(attachment.ticket),
      config,
    });
    await prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        driveStatus: "synced",
        driveFileId: uploaded.id,
        driveUrl: uploaded.webViewLink,
        driveFolderId: uploaded.folderId,
        driveSyncedAt: new Date(),
        driveError: null,
      },
    });
    return { ok: true, attachmentId, driveUrl: uploaded.webViewLink };
  } catch (error) {
    const message = errorText(error);
    await prisma.attachment
      .update({
        where: { id: attachmentId },
        data: {
          driveStatus: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          driveError: message,
        },
      })
      .catch(() => {});
    console.warn(`[drive-sync] attachment ${attachmentId} attempt ${attempts} failed: ${message}`);
    return { ok: false, attachmentId, attempts, error: message };
  }
}

/** Batch used by the cron sweep endpoint. */
export async function syncPendingAttachments({ limit = 10, config = driveConfig() } = {}) {
  if (!isDriveConfigured(config)) return { configured: false, processed: 0, results: [] };
  const pending = await prisma.attachment.findMany({
    where: { driveStatus: "pending", driveAttempts: { lt: MAX_ATTEMPTS } },
    orderBy: { id: "asc" },
    take: Math.max(1, Math.min(Number(limit) || 10, 25)),
    select: { id: true },
  });
  const results = [];
  for (const row of pending) results.push({ id: row.id, ...(await syncAttachment(row.id, { config })) });
  return { configured: true, processed: pending.length, results };
}

/**
 * Operator-triggered archive of legacy rows: `status` rows move to pending and upload now.
 * `id` forces a single attachment (retry after a failed attempt or a manual check).
 */
export async function backfillAttachments({ limit = 10, status = "skipped", id = null, config = driveConfig() } = {}) {
  if (!isDriveConfigured(config)) return { configured: false, processed: 0, results: [] };
  if (id) {
    const attachmentId = Number(id);
    const reset = await prisma.attachment.updateMany({
      where: { id: attachmentId, driveStatus: { not: "synced" } },
      data: { driveStatus: "pending", driveAttempts: 0, driveError: null },
    });
    if (reset.count === 0) return { configured: true, processed: 0, results: [] };
    return { configured: true, processed: 1, results: [{ id: attachmentId, ...(await syncAttachment(attachmentId, { config })) }] };
  }

  const batch = Math.max(1, Math.min(Number(limit) || 10, 50));
  const rows = await prisma.attachment.findMany({
    where: { driveStatus: status, driveAttempts: { lt: MAX_ATTEMPTS } },
    orderBy: { id: "asc" },
    take: batch,
    select: { id: true },
  });
  const results = [];
  for (const row of rows) {
    await prisma.attachment.updateMany({
      where: { id: row.id, driveStatus: status },
      data: { driveStatus: "pending", driveAttempts: 0, driveError: null },
    });
    results.push({ id: row.id, ...(await syncAttachment(row.id, { config })) });
  }
  return { configured: true, processed: rows.length, results };
}

/** Counts for monitoring/backfill planning. */
export async function driveAttachmentStats() {
  const grouped = await prisma.attachment.groupBy({ by: ["driveStatus"], _count: { _all: true } });
  return Object.fromEntries(grouped.map((group) => [group.driveStatus, group._count._all]));
}
