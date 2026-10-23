import {isDarkFiber,readPairCount} from '@/lib/services/productUnits';
import { serviceWorkResolveMessage,snapshotCapacity } from '@/lib/tickets/serviceWorkView';

export default function ServiceWorkSummary({ ticket }) {
  const change = ticket.serviceChange;
  if (ticket.workType !== 'ServiceWork' || !change) return null;
  const rows = [
    ['Produk / layanan', change.before?.templateName, change.after?.templateName],
    isDarkFiber({name:change.before?.templateName})||isDarkFiber({name:change.after?.templateName})?['Kapasitas',snapshotCapacity(change.before),snapshotCapacity(change.after)]:['Kapasitas (Mbps)', change.before?.bandwidthMbps, change.after?.bandwidthMbps],
    ['Status layanan', change.before?.status, change.after?.status],
  ];
  const changedKeys = Object.keys(change.after?.customData || {}).filter(key =>
    !['bandwidthMbps','pairCount'].includes(key) && JSON.stringify(change.before?.customData?.[key]) !== JSON.stringify(change.after.customData[key]));
  for (const key of changedKeys) rows.push([key, change.before?.customData?.[key], change.after.customData[key]]);
  const display = value => value == null || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return <section aria-label="Ringkasan pekerjaan layanan" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', margin: '1rem 0', minWidth: 0, overflowWrap: 'anywhere' }}>
    <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.6rem' }}>{ticket.serviceWorkTypeLabel || 'Pekerjaan Layanan'}</h2>
    <p>CID: <strong>{change.before?.cid || '—'}</strong> · Tanggal efektif: {change.effectiveDate || '—'}</p>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <caption style={{ textAlign: 'left', marginBottom: '0.5rem' }}>Kondisi sebelum dan sesudah pekerjaan</caption>
        <thead><tr>{['Data', 'Sebelum', 'Sesudah'].map(label => <th key={label} scope="col" style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>{label}</th>)}</tr></thead>
        <tbody>{rows.map(([label, before, after]) => <tr key={label}><th scope="row" style={{ padding: '0.5rem', fontWeight: 500 }}>{label}</th><td style={{ padding: '0.5rem' }}>{display(before)}</td><td style={{ padding: '0.5rem' }}>{display(after)}</td></tr>)}</tbody>
      </table>
    </div>
    {change.reason && <p>Alasan: {change.reason}</p>}
    <p role="status">{change.appliedAt ? `Sudah diterapkan ke Inventory pada ${change.appliedAt}. Membuka kembali tiket tidak membatalkan perubahan ini.` : 'Belum diterapkan. Inventory diperbarui otomatis saat Resolve setelah validasi.'}</p>
    {!change.appliedAt && <details><summary>Ringkasan saat Resolve</summary><p style={{ whiteSpace: 'pre-line' }}>{serviceWorkResolveMessage(ticket)}</p></details>}
  </section>;
}
