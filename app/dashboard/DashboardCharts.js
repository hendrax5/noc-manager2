"use client";
import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardCharts({ ticketStats, reportStats }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div style={{ width: '100%', padding: '0.5rem' }}>
      <h3 style={{ margin: '0 0 1.5rem 0', color: '#0f172a', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{fontSize: '1.3rem'}}>📊</span> Overall Ticket Status</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={ticketStats} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="status" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }} />
          <Bar dataKey="count" fill="url(#colorUv)" radius={[6, 6, 0, 0]} />
          <defs>
            <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9}/>
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.9}/>
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
