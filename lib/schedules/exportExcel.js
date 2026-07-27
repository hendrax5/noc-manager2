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

export function exportScheduleMatrixExcel({
  title,
  year,
  month, // 1-12
  dayHeaders,
  rows, // [{ name, cells: { [day]: shiftName|null|'OFF'|undefined } }]
  filename,
}) {
  const monthName = new Date(year, month - 1, 1).toLocaleString("id-ID", { month: "long" });
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  let thead = `<th style="border:1px solid #94a3b8;padding:4px;background:#e2e8f0">Nama</th>`;
  for (const d of dayHeaders) {
    thead += `<th style="border:1px solid #94a3b8;padding:4px;background:#e2e8f0">${d}</th>`;
  }

  let tbody = "";
  for (const row of rows) {
    tbody += `<tr><td style="border:1px solid #94a3b8;padding:4px;font-weight:bold">${esc(row.name)}</td>`;
    for (const d of dayHeaders) {
      const raw = row.cells[d];
      const label = raw === null || raw === undefined ? (raw === null ? "OFF" : "") : raw;
      const bg = SHIFT_COLORS[label] || (label ? "#dbeafe" : "#ffffff");
      tbody += `<td style="border:1px solid #94a3b8;padding:4px;text-align:center;background:${bg}">${esc(label)}</td>`;
    }
    tbody += `</tr>`;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body>
<h2>${esc(title)} — ${esc(monthName)} ${year}</h2>
<table>${thead}${tbody}</table>
<p>Legend: S1 / S2 / S3 / S1+OC / OFF</p>
</body></html>`;

  const blob = new Blob([`\ufeff${html}`], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `Jadwal_${year}-${String(month).padStart(2, "0")}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
