'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export default function DashboardFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentRange = searchParams.get('range') || 'weekly';

  const setRange = (newRange) => {
    if (newRange === currentRange) return;
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (newRange === 'weekly') {
        params.delete('range'); // default
      } else {
        params.set('range', newRange);
      }
      router.push(`?${params.toString()}`);
      router.refresh();
    });
  };

  return (
    <div style={{
      display: 'inline-flex',
      background: '#f1f5f9',
      padding: '4px',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      gap: '4px',
      opacity: isPending ? 0.7 : 1,
      transition: 'opacity 0.2s',
      marginBottom: '1rem'
    }}>
      <button 
        onClick={() => setRange('daily')}
        style={{
          padding: '6px 12px',
          borderRadius: '6px',
          border: 'none',
          fontSize: '0.8rem',
          fontWeight: '600',
          cursor: 'pointer',
          background: currentRange === 'daily' ? '#fff' : 'transparent',
          color: currentRange === 'daily' ? '#0f172a' : '#64748b',
          boxShadow: currentRange === 'daily' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          transition: 'all 0.2s'
        }}
      >
        Daily
      </button>
      <button 
        onClick={() => setRange('weekly')}
        style={{
          padding: '6px 12px',
          borderRadius: '6px',
          border: 'none',
          fontSize: '0.8rem',
          fontWeight: '600',
          cursor: 'pointer',
          background: currentRange === 'weekly' ? '#fff' : 'transparent',
          color: currentRange === 'weekly' ? '#0f172a' : '#64748b',
          boxShadow: currentRange === 'weekly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          transition: 'all 0.2s'
        }}
      >
        Weekly
      </button>
      <button 
        onClick={() => setRange('monthly')}
        style={{
          padding: '6px 12px',
          borderRadius: '6px',
          border: 'none',
          fontSize: '0.8rem',
          fontWeight: '600',
          cursor: 'pointer',
          background: currentRange === 'monthly' ? '#fff' : 'transparent',
          color: currentRange === 'monthly' ? '#0f172a' : '#64748b',
          boxShadow: currentRange === 'monthly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          transition: 'all 0.2s'
        }}
      >
        Monthly
      </button>
    </div>
  );
}
