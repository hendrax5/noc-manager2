"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const SECTIONS = [
  {
    key: "downtime",
    title: "Downtime > 10 jam",
    color: "var(--ui-danger)",
    bg: "var(--ui-danger-bg)",
    border: "var(--ui-danger)",
  },
  {
    key: "terminate",
    title: "Customer Terminate",
    color: "var(--ui-orange)",
    bg: "var(--ui-orange-bg)",
    border: "var(--ui-orange)",
  },
  {
    key: "new",
    title: "Customer Baru",
    color: "var(--ui-success)",
    bg: "var(--ui-success-bg)",
    border: "var(--ui-success)",
  },
  {
    key: "upgrade",
    title: "Customer Upgrade",
    color: "var(--ui-info)",
    bg: "var(--ui-info-bg)",
    border: "var(--ui-info)",
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
  const [customStart, setCustomStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("downtime");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ period, anchor });
      if (period === "custom") {
        q.set("start", customStart);
        q.set("end", customEnd);
      }
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
  }, [period, anchor, customStart, customEnd]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.[activeTab] || [];

  return (
    <div>
      <div
        className="card ui-static-4e7e8d73d6"
        style={{display: "flex", flexWrap: "wrap", alignItems: "flex-end"}}
      >
        <div>
          <label className="ui-static-eec2ca914a" style={{display: "block"}}>
            Periode
          </label>
          <div className="ui-static-30f523173e" style={{display: "flex"}}>
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
            <button
              type="button"
              className={period === "custom" ? "primary-btn" : "secondary-btn"}
              style={{ width: "auto" }}
              onClick={() => setPeriod("custom")}
            >
              Custom
            </button>
          </div>
        </div>
        {period !== "custom" && (
        <div>
          <label className="ui-static-eec2ca914a" style={{display: "block"}}>
            Tanggal acuan
          </label>
          <input
            type="date"
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            className="ui-static-11c1bd4406"
          />
        </div>
        )}
        {period === "custom" && (
          <>
            <div>
              <label className="ui-static-eec2ca914a" style={{display: "block"}}>Dari</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="ui-static-11c1bd4406"
              />
            </div>
            <div>
              <label className="ui-static-eec2ca914a" style={{display: "block"}}>Sampai</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="ui-static-11c1bd4406"
              />
            </div>
          </>
        )}
        <button type="button" className="secondary-btn" style={{ width: "auto" }} onClick={load}>
          Muat ulang
        </button>
        {data && (
          <p className="ui-static-93c5174987" style={{alignSelf: "center"}}>
            Rentang: <strong>{data.startDate}</strong> → <strong>{data.endDate}</strong>
            {period === "week" ? " (Sen–Min)" : period === "month" ? " (bulan kalender)" : " (custom)"} · hitung per tiket
          </p>
        )}
      </div>

      {loading && <p>Memuat Ops Report…</p>}
      {error && (
        <p className="ui-static-fda6668d59" >
          {error}
        </p>
      )}

      {data && !loading && (
        <>
          <div
            className="ui-static-133a06227d" style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"}}
          >
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setActiveTab(s.key)}
                className="ui-static-1f6c085bf9" style={{textAlign: "left", border: `2px solid ${activeTab === s.key ? s.color : s.border}`, background: s.bg, cursor: "pointer"}}
              >
                <div className="ui-static-572d825eec" style={{color: s.color, textTransform: "uppercase"}}>
                  {s.title}
                </div>
                <div className="ui-static-d887231769" style={{color: s.color}}>
                  {data.counts?.[s.key] ?? 0}
                </div>
                <div className="ui-static-f0ec965903" >tiket</div>
              </button>
            ))}
          </div>

          <div className="card table-region" role="region" aria-label="Daftar tiket laporan operasional" tabIndex={0} style={{ overflowX: "auto" }}>
            <h2 className="ui-static-fd1312781a" >
              {SECTIONS.find((s) => s.key === activeTab)?.title} ({rows.length})
            </h2>
            {rows.length === 0 ? (
              <p className="ui-static-b9010af219" >Tidak ada tiket di kategori ini untuk periode ini.</p>
            ) : (
              <table className="ui-static-e81f1882ce" style={{width: "100%", minWidth: "46rem"}}>
                <caption className="sr-only">Tiket pada kategori {SECTIONS.find((s) => s.key === activeTab)?.title}</caption>
                <thead>
                  <tr className="ui-static-6d7b6af7b6" style={{textAlign: "left"}}>
                    <th scope="col" className="ui-static-ee6b240f5a" >Tiket</th>
                    <th scope="col" className="ui-static-ee6b240f5a" >Customer</th>
                    <th scope="col" className="ui-static-ee6b240f5a" >Category</th>
                    <th scope="col" className="ui-static-ee6b240f5a" >Status</th>
                    {activeTab === "downtime" && (
                      <th scope="col" className="ui-static-ee6b240f5a" >Downtime</th>
                    )}
                    <th scope="col" className="ui-static-ee6b240f5a" >
                      {activeTab === "downtime" ? "Resolved / Outage end" : "Resolved"}
                    </th>
                    <th scope="col" className="ui-static-ee6b240f5a" >Assignee</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="ui-static-ee6b240f5a" >
                        <Link href={`/tickets/${r.id}`} className="ui-static-5c05f4afaf" >
                          #{r.ticketNumber}
                        </Link>
                        <div className="ui-static-60700bd225" >{r.title}</div>
                      </td>
                      <td className="ui-static-ee6b240f5a" >{r.customer}</td>
                      <td className="ui-static-ee6b240f5a" >
                        {r.jobCategory || "—"}
                      </td>
                      <td className="ui-static-ee6b240f5a" >{r.status}</td>
                      {activeTab === "downtime" && (
                        <td className="ui-static-56697727d3" >
                          {r.downtimeHours} jam
                          <div className="ui-static-6158a5a8ad" >
                            ({r.downtimeMinutes} mnt)
                            {r.downtimeOngoing ? " · masih berjalan" : ""}
                          </div>
                        </td>
                      )}
                      <td className="ui-static-ee6b240f5a" >
                        {fmtDate(r.resolvedAt)}
                      </td>
                      <td className="ui-static-ee6b240f5a" >
                        {r.assignee || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <p className="ui-static-f72e2d38ed" >
            New / Terminate / Upgrade: tiket Resolved/Closed + Job Category cocok. Downtime: dari field
            &quot;Catat Waktu Outage / Downtime&quot; (durasi efektif, termasuk outage yang masih berjalan) &gt;{" "}
            {data.thresholdHours} jam.
          </p>
        </>
      )}
    </div>
  );
}
