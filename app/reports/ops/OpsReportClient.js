"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const SECTIONS = [
  {
    key: "downtime",
    title: "Downtime > 10 jam",
    color: "#991b1b",
    bg: "#fef2f2",
    border: "#fecaca",
  },
  {
    key: "terminate",
    title: "Customer Terminate",
    color: "#9a3412",
    bg: "#fff7ed",
    border: "#fed7aa",
  },
  {
    key: "new",
    title: "Customer Baru",
    color: "#166534",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  {
    key: "upgrade",
    title: "Customer Upgrade",
    color: "#1e40af",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
];

function fmtDate(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(v);
  }
}

export default function OpsReportClient() {
  const [period, setPeriod] = useState("week");
  const [anchor, setAnchor] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("downtime");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ period, anchor });
      const res = await fetch(`/api/reports/ops?${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat Ops Report");
      setData(json);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, anchor]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.[activeTab] || [];

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
            Periode
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className={period === "week" ? "primary-btn" : "secondary-btn"}
              style={{ width: "auto" }}
              onClick={() => setPeriod("week")}
            >
              Mingguan
            </button>
            <button
              type="button"
              className={period === "month" ? "primary-btn" : "secondary-btn"}
              style={{ width: "auto" }}
              onClick={() => setPeriod("month")}
            >
              Bulanan
            </button>
          </div>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>
            Tanggal acuan
          </label>
          <input
            type="date"
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            style={{ padding: "0.5rem", borderRadius: 4, border: "1px solid #cbd5e1" }}
          />
        </div>
        <button type="button" className="secondary-btn" style={{ width: "auto" }} onClick={load}>
          Muat ulang
        </button>
        {data && (
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem", alignSelf: "center" }}>
            Rentang: <strong>{data.startDate}</strong> → <strong>{data.endDate}</strong>
            {period === "week" ? " (Sen–Min)" : " (bulan kalender)"} · hitung per tiket
          </p>
        )}
      </div>

      {loading && <p>Memuat Ops Report…</p>}
      {error && (
        <p style={{ color: "#b91c1c", background: "#fef2f2", padding: "0.75rem 1rem", borderRadius: 6 }}>
          {error}
        </p>
      )}

      {data && !loading && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setActiveTab(s.key)}
                style={{
                  textAlign: "left",
                  padding: "1rem 1.25rem",
                  borderRadius: 8,
                  border: `2px solid ${activeTab === s.key ? s.color : s.border}`,
                  background: s.bg,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: s.color, textTransform: "uppercase" }}>
                  {s.title}
                </div>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: s.color, lineHeight: 1.2 }}>
                  {data.counts?.[s.key] ?? 0}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>tiket</div>
              </button>
            ))}
          </div>

          <div className="card" style={{ overflowX: "auto" }}>
            <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>
              {SECTIONS.find((s) => s.key === activeTab)?.title} ({rows.length})
            </h2>
            {rows.length === 0 ? (
              <p style={{ color: "#94a3b8" }}>Tidak ada tiket di kategori ini untuk periode ini.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                    <th style={{ padding: "0.6rem", borderBottom: "1px solid #e2e8f0" }}>Tiket</th>
                    <th style={{ padding: "0.6rem", borderBottom: "1px solid #e2e8f0" }}>Customer</th>
                    <th style={{ padding: "0.6rem", borderBottom: "1px solid #e2e8f0" }}>Category</th>
                    <th style={{ padding: "0.6rem", borderBottom: "1px solid #e2e8f0" }}>Status</th>
                    {activeTab === "downtime" && (
                      <th style={{ padding: "0.6rem", borderBottom: "1px solid #e2e8f0" }}>Downtime</th>
                    )}
                    <th style={{ padding: "0.6rem", borderBottom: "1px solid #e2e8f0" }}>
                      {activeTab === "downtime" ? "Resolved / Outage end" : "Resolved"}
                    </th>
                    <th style={{ padding: "0.6rem", borderBottom: "1px solid #e2e8f0" }}>Assignee</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ padding: "0.6rem", borderBottom: "1px solid #f1f5f9" }}>
                        <Link href={`/tickets/${r.id}`} style={{ fontWeight: 600 }}>
                          #{r.ticketNumber}
                        </Link>
                        <div style={{ color: "#64748b", fontSize: "0.8rem" }}>{r.title}</div>
                      </td>
                      <td style={{ padding: "0.6rem", borderBottom: "1px solid #f1f5f9" }}>{r.customer}</td>
                      <td style={{ padding: "0.6rem", borderBottom: "1px solid #f1f5f9" }}>
                        {r.jobCategory || "—"}
                      </td>
                      <td style={{ padding: "0.6rem", borderBottom: "1px solid #f1f5f9" }}>{r.status}</td>
                      {activeTab === "downtime" && (
                        <td style={{ padding: "0.6rem", borderBottom: "1px solid #f1f5f9", fontWeight: 600 }}>
                          {r.downtimeHours} jam
                          <div style={{ fontWeight: 400, color: "#64748b", fontSize: "0.75rem" }}>
                            ({r.downtimeMinutes} mnt)
                            {r.downtimeOngoing ? " · masih berjalan" : ""}
                          </div>
                        </td>
                      )}
                      <td style={{ padding: "0.6rem", borderBottom: "1px solid #f1f5f9" }}>
                        {fmtDate(r.resolvedAt)}
                      </td>
                      <td style={{ padding: "0.6rem", borderBottom: "1px solid #f1f5f9" }}>
                        {r.assignee || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "#94a3b8" }}>
            New / Terminate / Upgrade: tiket Resolved/Closed + Job Category cocok. Downtime: dari field
            &quot;Catat Waktu Outage / Downtime&quot; (durasi efektif, termasuk outage yang masih berjalan) &gt;{" "}
            {data.thresholdHours} jam.
          </p>
        </>
      )}
    </div>
  );
}
