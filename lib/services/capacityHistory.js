import { adoptableCapacity, candidateKindLabel, extractCapacityHints, sortCapacityCandidates } from './capacityHints.js';
import { getServiceCid } from './cid.js';
import { recordActivity } from '../activity/recordActivity.js';

const EVIDENCE_LIMIT = 4;

function dateLabel(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

/** Human label used in validation errors, for example `500 Mbps (nama client/perangkat, 07 Sep 2026, HSK-...)`. */
export function describeCapacityCandidate(candidate) {
  const unit = candidate.mbps >= 1000 ? `${Number((candidate.mbps / 1000).toFixed(3))} Gbps` : `${candidate.mbps} Mbps`;
  const tracking = candidate.source?.trackingId ? `, ${candidate.source.trackingId}` : '';
  return `${unit} (${candidateKindLabel(candidate.kind)}, ${dateLabel(candidate.source?.createdAt)}${tracking})`;
}

export function describeCapacityCandidates(candidates = []) {
  return sortCapacityCandidates(candidates).slice(0, EVIDENCE_LIMIT).map(describeCapacityCandidate).join('; ');
}

/**
 * Load the CID's ticket history (descriptions, titles, comments) and extract
 * bandwidth hints. Read-only.
 */
export async function loadServiceCapacityHints(db, service) {
  const tickets = await db.ticket.findMany({
    where: { services: { some: { id: service.id } } },
    select: {
      id: true,
      trackingId: true,
      title: true,
      description: true,
      createdAt: true,
      _count: { select: { services: true } },
      comments: { select: { text: true, createdAt: true }, orderBy: { id: 'desc' }, take: 200 },
    },
    orderBy: { id: 'desc' },
    take: 200,
  });
  const texts = [];
  for (const ticket of tickets) {
    const source = { ticketId: ticket.id, trackingId: ticket.trackingId || '', createdAt: ticket.createdAt, singleService: (ticket._count?.services ?? 0) === 1 };
    if (ticket.title) texts.push({ ...source, text: ticket.title, kind: 'title' });
    if (ticket.description) texts.push({ ...source, text: ticket.description, kind: 'ticket' });
    for (const comment of ticket.comments || []) {
      texts.push({ ...source, createdAt: comment.createdAt, text: comment.text, kind: 'comment' });
    }
  }
  const identifiers = await db.serviceIdentifier.findMany({ where: { serviceId: service.id }, select: { code: true } });
  const hints = extractCapacityHints({ cid: getServiceCid(service), aliases: identifiers.map((item) => item.code), texts });
  return { ...hints, tickets };
}

/**
 * Adopt the current bandwidth from ticket history when the inventory value is
 * missing and the evidence is unambiguous. Runs inside the caller's transaction.
 *
 * @returns {{service?:object,resolution:object,hints:object}}
 */
export async function adoptServiceCapacity(db, service) {
  const hints = await loadServiceCapacityHints(db, service);
  const resolution = adoptableCapacity(hints.existing);
  if (resolution.status !== 'ready') return { resolution, hints };
  await db.$queryRaw`SELECT id FROM "Service" WHERE id = ${service.id} FOR UPDATE`;
  const fresh = await db.service.findUnique({ where: { id: service.id }, include: { template: true } });
  if (!fresh) return { resolution: { status: 'missing' }, hints };
  const current = fresh.customData?.['bandwidthMbps'];
  if (current != null && Number(current) > 0) {
    return { service: fresh, resolution: { ...resolution, adopted: false }, hints };
  }
  const customData = { ...(fresh.customData || {}), bandwidthMbps: resolution.mbps };
  const updated = await db.service.update({ where: { id: fresh.id }, data: { customData }, include: { template: true } });
  await recordActivity(db, {
    actorId: null,
    source: 'system',
    type: 'service.capacity_from_ticket',
    entityType: 'service',
    entityId: fresh.id,
    before: fresh,
    after: updated,
    idempotencyKey: `capacity-hint-${fresh.id}-${resolution.mbps}`,
  });
  return { service: updated, resolution: { ...resolution, adopted: true }, hints };
}
