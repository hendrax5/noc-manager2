import { isDriveConfigured } from "./gdrive.js";
import { syncAttachment } from "./driveSync.js";

/**
 * Best-effort archive used after a reply/ticket response has been sent
 * (scheduled with next/server after()). Failures stay on the attachment row
 * as pending/failed so the cron sweep can retry them.
 */
export async function archiveAttachments(attachmentIds) {
  if (!isDriveConfigured()) return [];
  const results = [];
  for (const value of attachmentIds || []) {
    const attachmentId = Number(value);
    if (!Number.isSafeInteger(attachmentId) || attachmentId <= 0) continue;
    try {
      results.push({ id: attachmentId, ...(await syncAttachment(attachmentId)) });
    } catch (error) {
      console.warn("[drive-sync]", attachmentId, error?.message || error);
    }
  }
  return results;
}
