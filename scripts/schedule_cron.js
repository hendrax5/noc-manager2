/**
 * Container background jobs.
 *  - hourly: schedule auto-generation (Asia/Jakarta day/hour enforced by the API)
 *  - hourly: RFS activation sweep (Pending -> Active once the RFS date is reached)
 *  - every DRIVE_SYNC_INTERVAL_MS (default 5 minutes): Google Drive attachment archive sweep
 * Env: APP_INTERNAL_URL, SCHEDULE_CRON_SECRET, SCHEDULE_CRON_START_DELAY_MS,
 *      RFS_START_DELAY_MS, RFS_INTERVAL_MS, DRIVE_SYNC_START_DELAY_MS, DRIVE_SYNC_INTERVAL_MS
 */
const APP_URL = (process.env.APP_INTERNAL_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SECRET = process.env.SCHEDULE_CRON_SECRET || process.env.CRON_SECRET || "";
const START_DELAY_MS = parseInt(process.env.SCHEDULE_CRON_START_DELAY_MS || "60000", 10);
const RFS_START_DELAY_MS = parseInt(process.env.RFS_START_DELAY_MS || "120000", 10);
const RFS_INTERVAL_MS = Math.max(60_000, parseInt(process.env.RFS_INTERVAL_MS || String(60 * 60 * 1000), 10));
const DRIVE_START_DELAY_MS = parseInt(process.env.DRIVE_SYNC_START_DELAY_MS || "90000", 10);
const DRIVE_INTERVAL_MS = Math.max(60_000, parseInt(process.env.DRIVE_SYNC_INTERVAL_MS || "300000", 10));

const jsonHeaders = {
  "Content-Type": "application/json",
  ...(SECRET ? { "x-cron-secret": SECRET } : {}),
};

async function tick() {
  try {
    const res = await fetch(`${APP_URL}/api/schedules/auto-generate`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({}),
    });
    const text = await res.text();
    console.log(`[schedule-cron] ${new Date().toISOString()} ${res.status} ${text.slice(0, 300)}`);
  } catch (err) {
    console.error("[schedule-cron]", err.message);
  }
}

async function rfsTick() {
  try {
    const res = await fetch(`${APP_URL}/api/internal/rfs-activation/run`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({}),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[rfs-activation] ${res.status} ${text.slice(0, 300)}`);
      return;
    }
    let summary = null;
    try {
      summary = JSON.parse(text);
    } catch {
      summary = null;
    }
    if (summary?.activated > 0) {
      console.log(`[rfs-activation] activated=${summary.activated} due=${summary.due}`);
    }
  } catch (err) {
    console.error("[rfs-activation]", err.message);
  }
}

async function driveTick() {
  try {
    const res = await fetch(`${APP_URL}/api/internal/drive-sync/run`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({}),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[drive-sync] ${res.status} ${text.slice(0, 300)}`);
      return;
    }
    let summary = null;
    try {
      summary = JSON.parse(text);
    } catch {
      summary = null;
    }
    if (!summary || summary.configured === false) return; // dormant until Drive env is set
    if (summary.processed > 0) {
      const ok = (summary.results || []).filter((result) => result.ok).length;
      console.log(`[drive-sync] processed=${summary.processed} uploaded=${ok}`);
    }
  } catch (err) {
    console.error("[drive-sync]", err.message);
  }
}

console.log(`[schedule-cron] started → ${APP_URL} (first tick in ${START_DELAY_MS}ms)`);
setTimeout(() => {
  tick();
  setInterval(tick, 60 * 60 * 1000);
}, START_DELAY_MS);

setTimeout(() => {
  rfsTick();
  setInterval(rfsTick, RFS_INTERVAL_MS);
}, RFS_START_DELAY_MS);

setTimeout(() => {
  driveTick();
  setInterval(driveTick, DRIVE_INTERVAL_MS);
}, DRIVE_START_DELAY_MS);
