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
        className="card"
        style={{
          marginBottom: "1.5rem",
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>
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
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>
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
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>
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
        <p style={{ color: "#b91c1c", background: "#fef2f2", padding: "0.75rem 1rem", borderRadius: 6 }}>
          {error}
        </p>
      )}

      {data && !loading && (
        <>
          <div className="card" style={{ overflowX: "auto" }}>
            <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>
              {deptName} — {MONTHS.find((m) => m.value === month)?.label} {year}
              {data.pola ? ` (${data.pola})` : ""}
            </h2>
            {rows.length === 0 ? (
              <p style={{ color: "#94a3b8" }}>
                Belum ada data jadwal untuk departemen dan bulan ini.
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                    <th style={{ padding: "0.6rem", borderBottom: "1px solid #e2e8f0" }}>Nama</th>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        style={{
                          padding: "0.6rem",
                          borderBottom: "1px solid #e2e8f0",
                          textAlign: "center",
                        }}
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
                        style={{
                          padding: "0.6rem",
                          borderBottom: "1px solid #f1f5f9",
                          fontWeight: 600,
                        }}
                      >
                        {r.name}
                      </td>
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          style={{
                            padding: "0.6rem",
                            borderBottom: "1px solid #f1f5f9",
                            textAlign: "center",
                          }}
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
            <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "#94a3b8" }}>
              Total Jam = Kerja × {data.hoursPerShift} jam/shift ({data.pola || "POLA_1"}).
              Lembur = masuk pada hari baseline Generate OFF, atau dicentang manual.
            </p>
          )}
        </>
      )}
    </div>
  );
}
