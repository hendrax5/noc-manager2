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
    <section className="ui-static-a5e927dc66" >
      <div className="ui-static-331fd259eb" style={{display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap"}}>
        <div>
          <h2 className="ui-static-ee96dc83fb" >Service desk metrics</h2>
          <p className="ui-static-705612920b" >
            Volume, SLA, TTR, and CSAT for the selected window
          </p>
        </div>
        <select
          value={windowDays}
          onChange={(e) => setWindowDays(parseInt(e.target.value, 10))}
          className="ui-static-542a98fed6"
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
            <p className="kpi-value ui-static-e77c1b93ed" >
              {data.volume.created}
            </p>
            <p className="ui-static-705612920b" >
              Created · {data.volume.resolved} resolved · {data.volume.openNow} open now
            </p>
          </div>
          <div className="card">
            <h2>SLA</h2>
            <p className="kpi-value ui-static-e77c1b93ed" >
              {data.sla.breachRate}%
            </p>
            <p className="ui-static-705612920b" >
              Breach rate · {data.sla.breached}/{data.sla.withSla} with SLA
              {data.sla.responseMetPct != null ? ` · response met ${data.sla.responseMetPct}%` : ""}
              {data.sla.resolutionMetPct != null ? ` · resolution met ${data.sla.resolutionMetPct}%` : ""}
            </p>
          </div>
          <div className="card">
            <h2>TTR</h2>
            <p className="kpi-value ui-static-e77c1b93ed" >
              {data.ttr.avgMins}m
            </p>
            <p className="ui-static-705612920b" >
              Avg resolution · first response {data.ttr.avgResponseMins}m
            </p>
          </div>
          <div className="card">
            <h2>CSAT</h2>
            <p className="kpi-value ui-static-e77c1b93ed" >
              {data.csat.average != null ? `${data.csat.average}/5` : "—"}
            </p>
            <p className="ui-static-705612920b" >
              {data.csat.count} ratings in window
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
