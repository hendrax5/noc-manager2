import { prisma } from '@/lib/prisma';
import { jakartaDate } from '@/lib/services/rfsActivation';
import styles from './tickets/work-form.module.css';

const day = value => Date.parse(`${value}T00:00:00Z`);
const labels = { Installation: 'Instalasi Baru', Upgrade: 'Upgrade', Downgrade: 'Downgrade', Change: 'Perubahan Layanan', Terminate: 'Terminasi', DataCenter: 'Data Center' };

/**
 * RFS is a target date, so tickets whose target has passed still need a human Resolve.
 * This panel only reports them: it never changes ticket or Inventory state.
 */
export default async function RfsOverduePanel({ scope }) {
  const today = jakartaDate(new Date());
  const where = { workType: 'ServiceWork', status: { notIn: ['Resolved', 'Closed'] } };
  const tickets = await prisma.ticket.findMany({
    where: scope ? { AND: [scope, where] } : where,
    select: {
      id: true,
      trackingId: true,
      title: true,
      serviceChange: true,
      assignee: { select: { name: true } },
      services: { select: { cid: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  const overdue = tickets
    .map(ticket => {
      const change = ticket.serviceChange;
      if (!change || change.appliedAt || change.operation === 'BOD') return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(change.effectiveDate || '') || change.effectiveDate >= today) return null;
      const lateDays = Math.round((day(today) - day(change.effectiveDate)) / 86400000);
      return { ticket, change, lateDays };
    })
    .filter(Boolean)
    .sort((left, right) => right.lateDays - left.lateDays)
    .slice(0, 10);
  if (!overdue.length) return null;
  return (
    <section className={styles.form} aria-label="RFS terlewat" style={{marginBottom: '1rem'}}>
      <h2>RFS terlewat, tiket belum ditutup</h2>
      <p>RFS adalah tanggal target, bukan penghalang Resolve. Tiket di bawah sudah melewati RFS tetapi belum di-Resolve; tidak ada perubahan status otomatis.</p>
      <div className={styles.tableWrap}>
        <table>
          <thead><tr>{['Tiket', 'CID / Pekerjaan', 'RFS', 'Lewat', 'PIC'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>
            {overdue.map(({ ticket, change, lateDays }) => (
              <tr key={ticket.id}>
                <td><a href={`/tickets/${ticket.id}`}>{ticket.trackingId || ticket.id}</a><br/>{labels[change.operation] || change.operation}</td>
                <td>{change.before?.cid || ticket.services?.[0]?.cid || '—'}<br/>{ticket.services?.[0]?.name || ticket.title}</td>
                <td>{change.effectiveDate}</td>
                <td>{lateDays} hari</td>
                <td>{ticket.assignee?.name || 'Belum ada PIC'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tickets.length >= 200 && <p>Menampilkan tiket terbaru; periksa daftar tiket untuk sisanya.</p>}
    </section>
  );
}
