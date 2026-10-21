import { getDowntimeDuration, parseDowntimeDate } from '../tickets/downtime.js';
import { getServiceCid } from '../services/cid.js';

const normalize = (value) => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const plain = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').trim();
const text = (value) => typeof value === 'string' ? plain(value) : '';

export function parseOutageFilters(input = {}, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const startDate = input.startDate || `${today.slice(0, 7)}-01`;
  const endDate = input.endDate || today;
  for (const date of [startDate, endDate]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
      throw new Error('Tanggal laporan tidak valid.');
    }
  }
  if (startDate > endDate) throw new Error('Tanggal akhir harus sama atau setelah tanggal awal.');
  const durationOperator = input.durationOperator || 'all';
  const outageStatus = input.outageStatus || 'all';
  const durationHours = input.durationHours == null || input.durationHours === '' ? 10 : Number(input.durationHours);
  if (!['all', 'gt', 'gte', 'lt', 'lte'].includes(durationOperator)) throw new Error('Operator durasi tidak valid.');
  if (!['all', 'ongoing', 'finished'].includes(outageStatus)) throw new Error('Status gangguan tidak valid.');
  if (!Number.isFinite(durationHours) || durationHours < 0) throw new Error('Durasi harus berupa angka positif atau nol.');
  return {
    startDate, endDate, durationOperator, durationHours, outageStatus,
    customer: String(input.customer || '').trim().slice(0, 200),
    cause: String(input.cause || '').trim().slice(0, 200),
    symptom: String(input.symptom || '').trim().slice(0, 200),
    search: String(input.search || '').trim().slice(0, 200),
  };
}

function causeOf(ticket) {
  if (ticket.causeLabel) return { cause: text(ticket.causeLabel), causeSource: 'Master penyebab tiket' };
  const cd = ticket.customData || {};
  const fields = ['causeCode', 'rootCause', 'problemCause', 'Penyebab', 'Penyebab Gangguan', 'Problem Cause', 'Root Cause'];
  const values = fields.map((key) => text(cd[key])).filter(Boolean);
  if (values.length) return { cause: values.join(' / '), causeSource: 'Field penyebab tiket' };
  return { cause: plain(ticket.description || ticket.title) || 'Belum tercatat', causeSource: 'Judul/deskripsi tiket' };
}

/** Selects whole individual outages by their start in WIB. Never aggregates duration for eligibility. */
export function buildOutageReport(tickets, filters, now = new Date()) {
  const start = new Date(`${filters.startDate}T00:00:00+07:00`);
  const end = new Date(`${filters.endDate}T23:59:59.999+07:00`);
  const rows = [];
  let invalidDowntime = 0;
  for (const ticket of tickets) {
    if (ticket.workType === 'Installation') continue;
    const cd = ticket.customData || {};
    if (!cd.hasDowntime) continue;
    const down = parseDowntimeDate(cd.startDowntime);
    if (!down) { invalidDowntime++; continue; }
    if (down < start || down > end) continue;
    if ((cd.endDowntime && !parseDowntimeDate(cd.endDowntime)) || down > now) { invalidDowntime++; continue; }
    const duration = getDowntimeDuration(cd.startDowntime, cd.endDowntime, { live: true, now });
    if (!duration || duration.error) { invalidDowntime++; continue; }
    const customers = [...new Set((ticket.services || []).map((s) => s.customer?.name).filter(Boolean))];
    if (!customers.length) {
      const legacy = text(cd['Customer Name'] || cd.customerName || cd.Customer || cd.customer);
      if (legacy) customers.push(legacy);
    }
    const customer = customers.join(', ') || 'Belum terhubung ke customer';
    if (filters.customer && !normalize(customer).includes(normalize(filters.customer))) continue;
    const { cause, causeSource } = causeOf(ticket);
    const causeHaystack = causeSource === 'Judul/deskripsi tiket' ? `${ticket.title} ${cause}` : cause;
    if (filters.cause && !normalize(causeHaystack).includes(normalize(filters.cause))) continue;
    const symptom = text(ticket.symptomLabel) || 'Belum diklasifikasikan';
    if (filters.symptom && !normalize(symptom).includes(normalize(filters.symptom))) continue;
    const services = (ticket.services || []).map((s) => [s.name, getServiceCid(s)].filter(Boolean).join(' · ')).join(', ') || 'Belum tercatat';
    if (filters.search && !normalize(`${ticket.trackingId || ''} ${ticket.title} ${services}`).includes(normalize(filters.search))) continue;
    if (filters.outageStatus === 'ongoing' && !duration.ongoing) continue;
    if (filters.outageStatus === 'finished' && duration.ongoing) continue;
    const threshold = filters.durationHours * 60;
    const n = duration.minutes;
    if (filters.durationOperator === 'gt' && n <= threshold) continue;
    if (filters.durationOperator === 'gte' && n < threshold) continue;
    if (filters.durationOperator === 'lt' && n >= threshold) continue;
    if (filters.durationOperator === 'lte' && n > threshold) continue;
    const publicComment = (ticket.comments || []).find((c) => c.isPublic === true);
    rows.push({
      dbId: ticket.id, trackingId: ticket.trackingId || String(ticket.id), title: plain(ticket.title),
      customer, customers, services, cause, causeSource, symptom,
      startAt: down.toISOString(), endAt: parseDowntimeDate(cd.endDowntime)?.toISOString() || null,
      downtimeMinutes: n, ongoing: duration.ongoing, status: ticket.status,
      action: text(cd.correctiveAction || cd.correctiveActions) || plain(publicComment?.text) || 'Belum tercatat',
    });
  }
  rows.sort((a, b) => b.downtimeMinutes - a.downtimeMinutes || a.dbId - b.dbId);
  return {
    filters, generatedAt: now.toISOString(), rows,
    summary: {
      tickets: rows.length, customers: new Set(rows.flatMap((r) => r.customers)).size,
      ongoing: rows.filter((r) => r.ongoing).length,
      longestMinutes: rows[0]?.downtimeMinutes ?? null, invalidDowntime,
    },
  };
}

export function outageCsv(rows) {
  const values = [
    ['Tiket', 'Customer', 'Layanan / CID', 'Mulai WIB', 'Selesai WIB', 'Durasi menit per tiket', 'Gejala', 'Penyebab', 'Sumber penyebab', 'Tindakan', 'Status gangguan', 'Status tiket'],
    ...rows.map((r) => [r.trackingId, r.customer, r.services, outageDate(r.startAt), r.endAt ? outageDate(r.endAt) : 'Masih berjalan', r.downtimeMinutes, r.symptom, r.cause, r.causeSource, r.action, r.ongoing ? 'Berjalan' : 'Selesai', r.status]),
  ];
  return '\ufeff' + values.map((row) => row.map((value) => {
    let s = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(s) || /^[\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
}

export function outageDate(value) {
  if (!value) return 'Masih berjalan';
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
}

export function outageDuration(minutes) {
  return minutes == null ? '—' : `${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;
}
