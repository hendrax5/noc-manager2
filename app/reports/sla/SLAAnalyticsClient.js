"use client";
import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from "recharts";
import SlaLetterView from "./SlaLetterView";

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function thisMonthRange() {
  const now = new Date();
  return { start: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), end: ymd(now) };
}

function lastMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start: ymd(start), end: ymd(end) };
}

export default function SLAAnalyticsClient() {
  const month = thisMonthRange();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preset, setPreset] = useState("month");
  const [startDate, setStartDate] = useState(month.start);
  const [endDate, setEndDate] = useState(month.end);
  const [customer, setCustomer] = useState("");
  const [showInternal, setShowInternal] = useState(false);

  const fetchData = useCallback(async (start, end, cust) => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ startDate: start, endDate: end });
      if (cust.trim()) q.set("customer", cust.trim());
      const res = await fetch(`/api/reports/sla?${q.toString()}`);
      if (!res.ok) throw new Error("Gagal memuat data SLA");
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(startDate, endDate, customer);
    // initial load only — Apply / presets trigger fetch explicitly
  }, []);

  const applyPreset = (type) => {
    setPreset(type);
    if (type === "month") {
      const r = thisMonthRange();
      setStartDate(r.start);
      setEndDate(r.end);
      fetchData(r.start, r.end, customer);
    } else if (type === "last") {
      const r = lastMonthRange();
      setStartDate(r.start);
      setEndDate(r.end);
      fetchData(r.start, r.end, customer);
    } else {
      setPreset("custom");
    }
  };

  const handleApply = (e) => {
    e.preventDefault();
    setPreset("custom");
    fetchData(startDate, endDate, customer);
  };

  const handleExportCSV = () => {
    const rowsSrc = (data?.monthSections || []).flatMap((s) => s.incidents);
    if (!rowsSrc.length) {
      alert("Tidak ada baris outage untuk diekspor");
      return;
    }
    const headers = [
      "No", "Customer", "Ticket", "Incident Date", "Down", "Up", "Duration",
      "Problem Cause", "Corrective Actions", "Month", "SLA %", "Avail %", "Tdown %",
    ];
    const rows = [];
    (data.monthSections || []).forEach((s) => {
      s.incidents.forEach((inc) => {
        rows.push([
          inc.no,
          `"${String(inc.customer).replace(/"/g, '""')}"`,
          inc.id,
          inc.incidentDate,
          inc.downAt,
          inc.upAt,
          inc.duration,
          `"${String(inc.cause).replace(/"/g, '""')}"`,
          `"${String(inc.corrective).replace(/"/g, '""')}"`,
          s.monthLabel,
          s.slaPercent,
          s.availPercent,
          s.tdownPercent,
        ]);
      });
    });
    const csv = `${headers.join(",")}\n${rows.map((r) => r.join(",")).join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SLA_Report_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="sla-analytics-container">
      <form className="card no-print sla-filter" onSubmit={handleApply}>
        <div className="sla-filter-presets">
          <button type="button" className={preset === "month" ? "is-active" : ""} onClick={() => applyPreset("month")}>
            Bulan ini
          </button>
          <button type="button" className={preset === "last" ? "is-active" : ""} onClick={() => applyPreset("last")}>
            Bulan lalu
          </button>
          <button type="button" className={preset === "custom" ? "is-active" : ""} onClick={() => applyPreset("custom")}>
            Custom tanggal
          </button>
        </div>

        <label>
          Dari
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPreset("custom"); }}
          />
        </label>
        <label>
          Sampai
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPreset("custom"); }}
          />
        </label>
        <label className="sla-filter-customer">
          Pelanggan
          <input
            type="text"
            placeholder="QUANTUM CEMARA…"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
          />
        </label>
        <button type="submit" className="primary-btn" disabled={loading} style={{ width: "auto", padding: "0.5rem 1rem" }}>
          {loading ? "Memuat…" : "Terapkan"}
        </button>
        <div className="sla-filter-actions">
          <button type="button" className="secondary-btn" style={{ width: "auto" }} onClick={handleExportCSV}>
            Export CSV
          </button>
          <button type="button" className="primary-btn" style={{ width: "auto" }} onClick={() => window.print()}>
            Cetak / PDF
          </button>
        </div>
      </form>

      {error && <div className="card" style={{ background: "#fee2e2", color: "#b91c1c" }}>{error}</div>}

      {data && !loading && (
        <div id="printable-report">
          <SlaLetterView letter={data.letter} monthSections={data.monthSections} />

          <div className="no-print sla-internal">
            <button type="button" className="secondary-btn" style={{ width: "auto" }} onClick={() => setShowInternal(!showInternal)}>
              {showInternal ? "Sembunyikan analitik internal" : "Tampilkan analitik internal"}
            </button>
            {showInternal && (
              <div style={{ marginTop: "1.25rem" }}>
                <div className="sla-kpis">
                  <div>
                    <strong>{data.summary.uptimePercentage}%</strong>
                    <span>Uptime periode</span>
                  </div>
                  <div>
                    <strong>{data.summary.outageCount}</strong>
                    <span>Outage</span>
                  </div>
                  <div>
                    <strong>{data.summary.slaBreaches}</strong>
                    <span>SLA breach tiket</span>
                  </div>
                  <div>
                    <strong>{data.summary.totalDowntimeHours}h</strong>
                    <span>Total downtime</span>
                  </div>
                </div>
                <div className="sla-charts">
                  <div className="card">
                    <h3>Volume tiket harian</h3>
                    <div style={{ height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.dailyTrend}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <RechartsTooltip />
                          <Legend />
                          <Line type="monotone" dataKey="total" stroke="#18181b" name="Tiket" />
                          <Line type="monotone" dataKey="breached" stroke="#b91c1c" name="Breach" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="card">
                    <h3>Departemen</h3>
                    <div style={{ height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.departmentStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="department" />
                          <YAxis />
                          <RechartsTooltip />
                          <Legend />
                          <Bar dataKey="resolved" stackId="a" fill="#18181b" name="Resolved" />
                          <Bar dataKey="breached" stackId="a" fill="#b91c1c" name="Breach" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
