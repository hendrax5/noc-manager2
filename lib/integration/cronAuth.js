/** Shared secret check for container-internal cron calls (same header as schedule cron). */
export function isCronRequest(req) {
  const secret = process.env.SCHEDULE_CRON_SECRET || process.env.CRON_SECRET || "";
  if (!secret) return false;
  return req.headers.get("x-cron-secret") === secret;
}
