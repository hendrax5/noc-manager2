/** Customer-facing SLA letter helpers (WIB). Matches ION bandwidth/SLA report layout. */

export const SLA_TARGET_PERCENT = 99.5;

export const SLA_LETTER_COMPANY = {
  name: "PT. PARSAORAN GLOBAL DATATRANS (ION NETWORK)",
  shortName: "ION Network",
  headOffice:
    "Head Office: Graha PGD - Jl. Taman Marga Satwa No. 3, Pasar Minggu Jakarta Selatan 12550",
  noc: "Network Operation Center: JL. Kelapa Dua Wetan No. 30 Jakarta Timur 13730 - Indonesia",
  phone: "021-3000-1555",
  email: "support@ionnetwork.co.id",
};

const MONTHS_ID = [
  "JANUARI",
  "FEBRUARI",
  "MARET",
  "APRIL",
  "MEI",
  "JUNI",
  "JULI",
  "AGUSTUS",
  "SEPTEMBER",
  "OKTOBER",
  "NOVEMBER",
  "DESEMBER",
];

export function wibParts(date) {
  const d = date instanceof Date ? date : new Date(date);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value])
  );
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour: parseInt(parts.hour, 10) % 24,
    minute: parseInt(parts.minute, 10),
  };
}

export function parseRangeWib(startYmd, endYmd) {
  const start = startYmd
    ? new Date(`${startYmd}T00:00:00+07:00`)
    : new Date(Date.now() - 30 * 86400000);
  const end = endYmd ? new Date(`${endYmd}T23:59:59.999+07:00`) : new Date();
  return { start, end };
}

export function ymdWib(date) {
  const p = wibParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function formatPeriodLabel(start, end) {
  const a = wibParts(start);
  const b = wibParts(end);
  const ma = MONTHS_ID[a.month - 1];
  const mb = MONTHS_ID[b.month - 1];
  if (a.year === b.year && a.month === b.month) return `${ma} ${a.year}`;
  if (a.year === b.year) return `${ma} – ${mb} ${a.year}`;
  return `${ma} ${a.year} – ${mb} ${b.year}`;
}

export function monthLabelFromKey(key) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_ID[m - 1]} ${y}`;
}

export function monthKeyWib(date) {
  const p = wibParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

export function formatDateWib(date) {
  if (!date) return "—";
  const p = wibParts(date);
  return `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}/${p.year}`;
}

export function formatTimeWib(date) {
  if (!date) return "—";
  const p = wibParts(date);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export function formatDurationHhMm(ms) {
  if (ms == null || ms < 0 || Number.isNaN(ms)) return "—";
  const totalMins = Math.round(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function stripHtml(html) {
  if (!html) return "";
  let text = String(html).replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<p\b[^>]*>/gi, "");
  text = text.replace(/&nbsp;/gi, " ");
  text = text.replace(/&amp;/gi, "&");
  text = text.replace(/&lt;/gi, "<");
  text = text.replace(/&gt;/gi, ">");
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/<\/?[^>]+(>|$)/g, "");
  return text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function truncate(text, max = 420) {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

export function availabilityPercents(periodMs, downtimeMs, slaTarget = SLA_TARGET_PERCENT) {
  const periodHours = periodMs / 3600000;
  const downHours = Math.max(0, downtimeMs / 3600000);
  const tdown = periodHours > 0 ? (downHours / periodHours) * 100 : 0;
  const avail = Math.max(0, 100 - tdown);
  return {
    slaPercent: slaTarget.toFixed(1),
    availPercent: avail.toFixed(1),
    tdownPercent: tdown.toFixed(1),
    periodHours: periodHours.toFixed(2),
    downtimeHours: downHours.toFixed(2),
  };
}

export function monthWindow(monthKey, rangeStart, rangeEnd) {
  const [y, m] = monthKey.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  const monthStart = new Date(`${y}-${mm}-01T00:00:00+07:00`);
  const monthEnd = new Date(`${y}-${mm}-${String(lastDay).padStart(2, "0")}T23:59:59.999+07:00`);
  const start = rangeStart > monthStart ? rangeStart : monthStart;
  const end = rangeEnd < monthEnd ? rangeEnd : monthEnd;
  return { start, end };
}

export function buildIntro(periodLabel) {
  return (
    `ION Network memberikan laporan ketersediaan jaringan untuk periode ${periodLabel}. ` +
    `Laporan ini berisi tentang durasi gangguan, penyebab gangguan dan penyelesaian masalah pada gangguan. ` +
    `Laporan dibuat sebagai data teknis yang menentukan layanan telah sesuai dengan SLA (Service Level Agreement). ` +
    `Jika terdapat gangguan yang menyebabkan tidak terpenuhinya SLA pada layanan, sebagai kompensasi ` +
    `ION Network memberikan restitusi sesuai dengan jumlah waktu yang tidak terpenuhi.`
  );
}
