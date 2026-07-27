/**
 * Hourly checker (Asia/Jakarta day/hour enforced by API).
 * Env: APP_INTERNAL_URL, SCHEDULE_CRON_SECRET
 */
const APP_URL = (process.env.APP_INTERNAL_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SECRET = process.env.SCHEDULE_CRON_SECRET || process.env.CRON_SECRET || "";
const START_DELAY_MS = parseInt(process.env.SCHEDULE_CRON_START_DELAY_MS || "60000", 10);

async function tick() {
  try {
    const res = await fetch(`${APP_URL}/api/schedules/auto-generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SECRET ? { "x-cron-secret": SECRET } : {}),
      },
      body: JSON.stringify({}),
    });
    const text = await res.text();
    console.log(`[schedule-cron] ${new Date().toISOString()} ${res.status} ${text.slice(0, 300)}`);
  } catch (err) {
    console.error("[schedule-cron]", err.message);
  }
}

console.log(`[schedule-cron] started → ${APP_URL} (first tick in ${START_DELAY_MS}ms)`);
setTimeout(() => {
  tick();
  setInterval(tick, 60 * 60 * 1000);
}, START_DELAY_MS);
