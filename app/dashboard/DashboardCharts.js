"use client";
import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const CATEGORY_COLORS = ['#3b82f6', '#ef4444', '#8b5cf6', '#10b981', '#f59e0b', '#f97316', '#06b6d4', '#64748b', '#ec4899', '#84cc16'];

export default function DashboardCharts({ ticketStats, reportStats, categoryStats = [] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', width: '100%', padding: '0.5rem' }}>
      
      {/* Ticket Status Bar Chart */}
      <div>
        <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--heading-color)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>📊</span> Status Overview
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={ticketStats} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis dataKey="status" tick={{fill: 'var(--text-color)', fontSize: 12}} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{fill: 'var(--text-color)', fontSize: 12}} axisLine={false} tickLine={false} />
            <Tooltip 
              cursor={{ fill: 'rgba(241, 245, 249, 0.3)' }} 
              contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', background: 'var(--card-bg)', color: 'var(--heading-color)' }} 
            />
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

      {/* Job Category Donut Chart */}
      {categoryStats.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--heading-color)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🏷️</span> Job Category Distribution
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={categoryStats}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
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
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', background: 'var(--card-bg)', color: 'var(--heading-color)' }} 
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
