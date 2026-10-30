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
  const applied = change.appliedAt;
  const rfsTarget = change.effectiveDate || '—';
  const registration = change.registration === 'new' || change.operation === 'Installation';
  const activationNote = registration
    ? `Aktivasi layanan Pending mengikuti jadwal RFS ${rfsTarget} (WIB) melalui pemindai RFS, bukan Resolve.`
    : '';
  const inventoryNote = change.operation === 'DataCenter'
    ? (registration
        ? `${applied ? `Pekerjaan selesai dicatat pada ${applied}. ` : 'Belum dicatat. '}${activationNote}`
        : (applied ? `Pekerjaan Data Center sudah dicatat pada ${applied} tanpa mengubah Inventory.` : 'Belum dicatat. Pekerjaan Data Center tidak mengubah produk, kapasitas, atau status layanan.'))
    : (applied ? `Sudah diterapkan ke Inventory pada ${applied}. Membuka kembali tiket tidak membatalkan perubahan ini.` : `Belum diterapkan. Inventory diperbarui otomatis saat Resolve setelah konfirmasi selesai dan bukti penyelesaian. RFS ${rfsTarget} hanya tanggal target.`);
  return <section aria-label="Ringkasan pekerjaan layanan" className="ui-static-90ddf9dc1e" style={{minWidth: 0, overflowWrap: 'anywhere'}}>
    <h2 className="ui-static-66f3578e31" >{ticket.serviceWorkTypeLabel || 'Pekerjaan Layanan'}</h2>
    <p>CID: <strong>{change.before?.cid || '—'}</strong> · RFS (target): {rfsTarget}</p>
    <div style={{ overflowX: 'auto' }}>
      <table className="ui-static-57b942e79e" style={{width: '100%', textAlign: 'left'}}>
        <caption className="ui-static-fc11fc4f62" style={{textAlign: 'left'}}>Kondisi sebelum dan sesudah pekerjaan</caption>
        <thead><tr>{['Data', 'Sebelum', 'Sesudah'].map(label => <th key={label} scope="col" className="ui-static-b206cfd32c" >{label}</th>)}</tr></thead>
        <tbody>{rows.map(([label, before, after]) => <tr key={label}><th scope="row" className="ui-static-672f2700de" >{label}</th><td className="ui-static-ce5f724e09" >{display(before)}</td><td className="ui-static-ce5f724e09" >{display(after)}</td></tr>)}</tbody>
      </table>
    </div>
    {change.reason && <p>Alasan: {change.reason}</p>}
    {change.completion && <p>Penyelesaian: {change.completion.finishedAt} — {change.completion.evidence}{change.completion.confirmedAt ? ` (dikonfirmasi ${change.completion.confirmedAt})` : ''}</p>}
    <p role="status">{inventoryNote}</p>
    {!change.appliedAt && <details><summary>Ringkasan saat Resolve</summary><p style={{ whiteSpace: 'pre-line' }}>{serviceWorkResolveMessage(ticket)}</p></details>}
  </section>;
}
