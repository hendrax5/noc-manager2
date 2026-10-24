"use client";

import { useCallback, useEffect, useState } from "react";
import { exportFairnessSummaryExcel } from "@/lib/schedules/exportExcel";

const MONTHS = [
  { value: 1, label: "Januari" },
  { value: 2, label: "Februari" },
  { value: 3, label: "Maret" },
  { value: 4, label: "April" },
  { value: 5, label: "Mei" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "Agustus" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Desember" },
];

const selectStyle = {
  padding: "0.5rem",
  borderRadius: 4,
  border: "1px solid #cbd5e1",
  minWidth: 140,
};

export default function ShiftFairnessClient({ departments = [] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [departmentId, setDepartmentId] = useState(() =>
    departments.length ? String(departments[0].id) : ""
  );
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!departmentId) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        year: String(year),
        month: String(month),
        departmentId: String(departmentId),
      });
      const res = await fetch(`/api/reports/shifts?${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat Shift Fairness");
      setData(json);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, month, departmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = data?.columns || [];
  const rows = data?.rows || [];
  const deptName =
    departments.find((d) => String(d.id) === String(departmentId))?.name ||
    data?.department ||
    "Departemen";

  function handleExport() {
    if (!data?.columns?.length) return;
    exportFairnessSummaryExcel({
      title: `Shift Fairness — ${deptName}`,
      year,
      month,
      summary: {
        columns: data.columns,
        rows: data.rows,
        hoursPerShift: data.hoursPerShift,
      },
      filename: `Shift_Fairness_${deptName}_${year}-${String(month).padStart(2, "0")}.xls`,
    });
  }

  const yearOptions = [];
  for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 3; y--) {
    yearOptions.push(y);
  }

  return (
    <div>
      <div
        className="card ui-static-4e7e8d73d6"
        style={{display: "flex", flexWrap: "wrap", alignItems: "flex-end"}}
      >
        <div>
          <label className="ui-static-eec2ca914a" style={{display: "block"}}>
            Departemen
          </label>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            style={selectStyle}
            disabled={!departments.length}
          >
            {!departments.length && <option value="">Tidak ada departemen</option>}
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.schedulePola || "POLA_1"})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="ui-static-eec2ca914a" style={{display: "block"}}>
            Bulan
          </label>
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            style={selectStyle}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="ui-static-eec2ca914a" style={{display: "block"}}>
            Tahun
          </label>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            style={selectStyle}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="secondary-btn" style={{ width: "auto" }} onClick={load}>
          Muat ulang
        </button>
        <button
          type="button"
          className="primary-btn"
          style={{ width: "auto" }}
          onClick={handleExport}
          disabled={!data?.rows?.length}
        >
          Export Excel
        </button>
      </div>

      {loading && <p>Memuat Shift Fairness…</p>}
      {error && (
        <p className="ui-static-fda6668d59" >
          {error}
        </p>
      )}

      {data && !loading && (
        <>
          <div className="card table-region" role="region" aria-label="Tabel pemerataan shift" tabIndex={0} style={{ overflowX: "auto" }}>
            <h2 className="ui-static-fd1312781a" >
              {deptName} — {MONTHS.find((m) => m.value === month)?.label} {year}
              {data.pola ? ` (${data.pola})` : ""}
            </h2>
            {rows.length === 0 ? (
              <p className="ui-static-b9010af219" >
                Belum ada data jadwal untuk departemen dan bulan ini.
              </p>
            ) : (
              <table className="ui-static-e81f1882ce" style={{width: "100%", minWidth: "44rem"}}>
                <caption className="sr-only">Jumlah shift per anggota pada {deptName}, {MONTHS.find((m) => m.value === month)?.label} {year}</caption>
                <thead>
                  <tr className="ui-static-6d7b6af7b6" style={{textAlign: "left"}}>
                    <th scope="col" className="ui-static-ee6b240f5a" >Nama</th>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        scope="col"
                        className="ui-static-ee6b240f5a" style={{textAlign: "center"}}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.userId}>
                      <td
                        className="ui-static-56697727d3"
                      >
                        {r.name}
                      </td>
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className="ui-static-ee6b240f5a" style={{textAlign: "center"}}
                        >
                          {r[col.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {data.hoursPerShift != null && (
            <p className="ui-static-f72e2d38ed" >
              Total Jam = Kerja × {data.hoursPerShift} jam/shift ({data.pola || "POLA_1"}).
              Lembur = masuk pada hari baseline Generate OFF, atau dicentang manual.
            </p>
          )}
        </>
      )}
    </div>
  );
}
