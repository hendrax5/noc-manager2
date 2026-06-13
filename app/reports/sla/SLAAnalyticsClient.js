"use client";
import { useState, useEffect } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';

export default function SLAAnalyticsClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Default to last 30 days
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 30);
  const [startDate, setStartDate] = useState(defaultStart.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/sla?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error("Failed to fetch SLA data");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExportCSV = () => {
    if (!data || !data.incidents || data.incidents.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = ["Ticket ID", "Title", "Priority", "Department", "Assignee", "Status", "Created At", "Resolved At", "Resolution Time (Hrs)", "SLA Breaches", "Services Affected"];
    const rows = data.incidents.map(inc => [
      inc.id,
      `"${inc.title.replace(/"/g, '""')}"`,
      inc.priority,
      `"${inc.department}"`,
      `"${inc.assignee}"`,
      inc.status,
      new Date(inc.createdAt).toLocaleString(),
      inc.resolvedAt === 'Unresolved' ? 'Unresolved' : new Date(inc.resolvedAt).toLocaleString(),
      inc.resolutionTimeHours,
      inc.slaBreaches,
      `"${inc.servicesAffected}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SLA_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    // Rely on browser's native print to PDF with @media print CSS
    window.print();
  };

  return (
    <div className="sla-analytics-container">
      <div className="card no-print" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>End Date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
        </div>
        <button onClick={fetchData} className="primary-btn" disabled={loading}>
          {loading ? 'Loading...' : 'Apply Filter'}
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleExportCSV} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.6rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            📥 Export CSV
          </button>
          <button onClick={handleExportPDF} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.6rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            🖨️ Export PDF
          </button>
        </div>
      </div>

      {error && <div className="card" style={{ background: '#fee2e2', color: '#b91c1c' }}>{error}</div>}

      {data && !loading && (
        <div id="printable-report">
          {/* Print Header (Only visible on Print) */}
          <div style={{ display: 'none' }} className="print-header">
            <h1 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>SLA & Downtime Analytics Report</h1>
            <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '2rem' }}>Period: {startDate} to {endDate}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#3b82f6' }}>{data.summary.uptimePercentage}%</div>
              <div style={{ color: '#64748b', fontWeight: 'bold' }}>Estimated Uptime</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ef4444' }}>{data.summary.slaBreaches}</div>
              <div style={{ color: '#64748b', fontWeight: 'bold' }}>SLA Breaches</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#10b981' }}>{data.summary.averageResolutionTimeHours}h</div>
              <div style={{ color: '#64748b', fontWeight: 'bold' }}>Avg Resolution Time</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#f59e0b' }}>{data.summary.totalDowntimeHours}h</div>
              <div style={{ color: '#64748b', fontWeight: 'bold' }}>Total Downtime (High/Crit)</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>Daily Ticket Volume & Breaches</h3>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total Tickets" />
                    <Line type="monotone" dataKey="breached" stroke="#ef4444" name="SLA Breached" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>Department Performance</h3>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.departmentStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="department" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="resolved" stackId="a" fill="#10b981" name="Resolved on Time" />
                    <Bar dataKey="breached" stackId="a" fill="#ef4444" name="SLA Breached" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Chronology of Incidents (Sorted by Downtime)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '0.8rem' }}>Ticket</th>
                    <th style={{ padding: '0.8rem' }}>Priority</th>
                    <th style={{ padding: '0.8rem' }}>Dept / Assignee</th>
                    <th style={{ padding: '0.8rem' }}>Downtime/Resolution</th>
                    <th style={{ padding: '0.8rem' }}>SLA Breach</th>
                  </tr>
                </thead>
                <tbody>
                  {data.incidents.slice(0, 50).map(inc => (
                    <tr key={inc.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.8rem' }}>
                        <strong>{inc.title}</strong><br/>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(inc.createdAt).toLocaleString()}</span>
                      </td>
                      <td style={{ padding: '0.8rem' }}>
                        <span className={`badge ${inc.priority === 'Critical' ? 'status-closed' : inc.priority === 'High' ? 'status-high' : 'status-new'}`}>
                          {inc.priority}
                        </span>
                      </td>
                      <td style={{ padding: '0.8rem' }}>
                        {inc.department}<br/>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{inc.assignee}</span>
                      </td>
                      <td style={{ padding: '0.8rem', fontWeight: 'bold' }}>
                        {inc.resolutionTimeHours !== '-' ? `${inc.resolutionTimeHours} hrs` : 'Active'}
                      </td>
                      <td style={{ padding: '0.8rem' }}>
                        {inc.hasBreach === 'Yes' ? <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Yes ({inc.slaBreaches})</span> : <span style={{ color: '#10b981' }}>No</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.incidents.length > 50 && (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontStyle: 'italic' }}>
                  Showing top 50 longest incidents. Export to CSV to see all {data.incidents.length} records.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html:`
        @media print {
          .print-header { display: block !important; }
        }
      `}} />
    </div>
  );
}
