'use client';

import { useState } from 'react';
import SLAAnalyticsClient from './SLAAnalyticsClient';
import OutageReportClient from './OutageReportClient';
import styles from './OutageReport.module.css';

export default function ReportTabs() {
  const [mode, setMode] = useState('outages');
  return <>
    <nav className={`no-print ${styles.tabs}`} aria-label="Jenis laporan">
      <button type="button" aria-pressed={mode === 'outages'} onClick={() => setMode('outages')}>Gangguan per tiket</button>
      <button type="button" aria-pressed={mode === 'sla'} onClick={() => setMode('sla')}>SLA periodik</button>
    </nav>
    {mode === 'outages' ? <OutageReportClient /> : <SLAAnalyticsClient />}
  </>;
}
