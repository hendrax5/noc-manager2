"use client";
import { useEffect, useState } from "react";

export default function ServiceDeskMetrics({ days = 30 }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [windowDays, setWindowDays] = useState(days);

  useEffect(() => {
    setError("");
    fetch(`/api/reports/service-desk?days=${windowDays}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Failed to load");
        setData(json);
      })
      .catch((err) => setError(err.message));
  }, [windowDays]);

  return (
    <section style={{ marginBottom: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <div>
          <h2 style={{ margin: 0, color: "var(--heading-color)" }}>Service desk metrics</h2>
          <p style={{ margin: "0.35rem 0 0", color: "var(--muted-text)", fontSize: "0.9rem" }}>
            Volume, SLA, TTR, and CSAT for the selected window
          </p>
        </div>
        <select
          value={windowDays}
          onChange={(e) => setWindowDays(parseInt(e.target.value, 10))}
          style={{ padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)", background: "var(--input-bg)", color: "var(--input-text)" }}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {error && <p className="error-text">{error}</p>}
      {!data && !error && <div className="skeleton" style={{ height: 120 }} />}

      {data && (
        <div className="dashboard-grid">
          <div className="card">
            <h2>Volume</h2>
            <p className="kpi-value" style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, color: "var(--heading-color)" }}>
              {data.volume.created}
            </p>
            <p style={{ margin: "0.35rem 0 0", color: "var(--muted-text)", fontSize: "0.85rem" }}>
              Created · {data.volume.resolved} resolved · {data.volume.openNow} open now
            </p>
          </div>
          <div className="card">
            <h2>SLA</h2>
            <p className="kpi-value" style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, color: "var(--heading-color)" }}>
              {data.sla.breachRate}%
            </p>
            <p style={{ margin: "0.35rem 0 0", color: "var(--muted-text)", fontSize: "0.85rem" }}>
              Breach rate · {data.sla.breached}/{data.sla.withSla} with SLA
              {data.sla.responseMetPct != null ? ` · response met ${data.sla.responseMetPct}%` : ""}
              {data.sla.resolutionMetPct != null ? ` · resolution met ${data.sla.resolutionMetPct}%` : ""}
            </p>
          </div>
          <div className="card">
            <h2>TTR</h2>
            <p className="kpi-value" style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, color: "var(--heading-color)" }}>
              {data.ttr.avgMins}m
            </p>
            <p style={{ margin: "0.35rem 0 0", color: "var(--muted-text)", fontSize: "0.85rem" }}>
              Avg resolution · first response {data.ttr.avgResponseMins}m
            </p>
          </div>
          <div className="card">
            <h2>CSAT</h2>
            <p className="kpi-value" style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, color: "var(--heading-color)" }}>
              {data.csat.average != null ? `${data.csat.average}/5` : "—"}
            </p>
            <p style={{ margin: "0.35rem 0 0", color: "var(--muted-text)", fontSize: "0.85rem" }}>
              {data.csat.count} ratings in window
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
