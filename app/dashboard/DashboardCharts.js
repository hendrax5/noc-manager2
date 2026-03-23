"use client";
import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardCharts({ ticketStats, reportStats }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
      <div className="card" style={{ height: '350px' }}>
        <h2>Tickets by Status</h2>
        <ResponsiveContainer width="100%" height="80%">
          <BarChart data={ticketStats} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="status" />
            <YAxis allowDecimals={false} />
            <Tooltip cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="count" fill="var(--secondary-color)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="card" style={{ height: '350px' }}>
        <h2>Daily Reports Target</h2>
        <ResponsiveContainer width="100%" height="80%">
          <BarChart data={reportStats} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
