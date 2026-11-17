"use client";
import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const CATEGORY_COLORS = [
  'var(--ui-info)',
  'var(--ui-danger)',
  'var(--ui-violet)',
  'var(--ui-success)',
  'var(--ui-warning)',
  'var(--ui-orange)',
  'var(--ui-accent)',
  'var(--ui-muted)',
  'var(--ui-indigo)',
];

export default function DashboardCharts({ ticketStats, reportStats, categoryStats = [] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 20rem), 1fr))', gap: 'var(--ui-space-5)', width: '100%' }}>
      <div>
        <h3 style={{ margin: '0 0 var(--ui-space-3)', fontSize: 'var(--ui-type-section)', fontWeight: 700, color: 'var(--ui-ink)' }}>
          Status Overview
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={ticketStats} margin={{ top: 16, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ui-line)" />
            <XAxis dataKey="status" tick={{ fill: 'var(--ui-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: 'var(--ui-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'var(--ui-subtle)' }}
              contentStyle={{ borderRadius: 'var(--ui-radius)', border: '1px solid var(--ui-line)', background: 'var(--ui-surface)', color: 'var(--ui-ink)' }}
            />
            <Bar dataKey="count" fill="var(--ui-accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {categoryStats.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 var(--ui-space-3)', fontSize: 'var(--ui-type-section)', fontWeight: 700, color: 'var(--ui-ink)' }}>
            Job Category Distribution
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={categoryStats}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={88}
                paddingAngle={3}
                dataKey="count"
                nameKey="name"
                label={({ name, count }) => `${name} (${count})`}
                labelLine={true}
              >
                {categoryStats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 'var(--ui-radius)', border: '1px solid var(--ui-line)', background: 'var(--ui-surface)', color: 'var(--ui-ink)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
