/**
 * Build an Excel-openable HTML workbook (no npm deps).
 * Excel / LibreOffice open .xls from HTML table reliably.
 */
const SHIFT_COLORS = {
  S1: "#bfdbfe",
  S2: "#fde68a",
  S3: "#ddd6fe",
  "S1+OC": "#fecaca",
  OFF: "#f1f5f9",
};

const CELL = "border:1px solid #94a3b8;padding:4px";
const TH = `${CELL};background:#e2e8f0`;

function downloadExcelHtml(html, filename) {
  const blob = new Blob([`\ufeff${html}`], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildSummaryTableHtml(summary, esc) {
  if (!summary?.columns?.length) return "";
  let thead = `<th style="${TH}">Nama</th>`;
  for (const col of summary.columns) {
    thead += `<th style="${TH}">${esc(col.label)}</th>`;
  }
  let tbody = "";
  for (const row of summary.rows || []) {
    tbody += `<tr><td style="${CELL};font-weight:bold">${esc(row.name)}</td>`;
    for (const col of summary.columns) {
      tbody += `<td style="${CELL};text-align:center">${esc(row[col.key] ?? "")}</td>`;
    }
    tbody += `</tr>`;
  }
  return `<h3>Ringkasan Fairness</h3>
<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
<br/>`;
}

export function exportScheduleMatrixExcel({
  title,
  year,
  month, // 1-12
  dayHeaders,
  rows, // [{ name, totalHours?, cells: { [day]: shiftName|null|'OFF'|undefined } }]
  filename,
  summary, // { columns: [{key,label}], rows: [{name,...counts}], hoursPerShift } | undefined
}) {
  const monthName = new Date(year, month - 1, 1).toLocaleString("id-ID", { month: "long" });
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const showTotalHours = rows.some((row) => row.totalHours != null);

  let dayGridHtml = "";
  if (dayHeaders.length > 0) {
    let thead = `<th style="${TH}">Nama</th>`;
    if (showTotalHours) {
      thead += `<th style="${TH}">Total Jam</th>`;
    }
    for (const d of dayHeaders) {
      thead += `<th style="${TH}">${d}</th>`;
    }

    let tbody = "";
    for (const row of rows) {
      tbody += `<tr><td style="${CELL};font-weight:bold">${esc(row.name)}</td>`;
      if (showTotalHours) {
        tbody += `<td style="${CELL};text-align:center">${esc(row.totalHours ?? "")}</td>`;
      }
      for (const d of dayHeaders) {
        const raw = row.cells[d];
        const label = raw === null || raw === undefined ? (raw === null ? "OFF" : "") : raw;
        const bg = SHIFT_COLORS[label] || (label ? "#dbeafe" : "#ffffff");
        tbody += `<td style="${CELL};text-align:center;background:${bg}">${esc(label)}</td>`;
      }
      tbody += `</tr>`;
    }

    dayGridHtml = `<table>${thead}${tbody}</table>
<p>Legend: S1 / S2 / S3 / S1+OC / OFF</p>`;
  }

  const summaryHtml = buildSummaryTableHtml(summary, esc);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body>
<h2>${esc(title)} — ${esc(monthName)} ${year}</h2>
${summaryHtml}${dayGridHtml}
</body></html>`;

  downloadExcelHtml(html, filename || `Jadwal_${year}-${String(month).padStart(2, "0")}.xls`);
}

export function exportFairnessSummaryExcel({ title, year, month, summary, filename }) {
  exportScheduleMatrixExcel({
    title,
    year,
    month,
    dayHeaders: [],
    rows: [],
    filename,
    summary,
  });
}
