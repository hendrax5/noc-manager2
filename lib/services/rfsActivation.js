import {recordActivity} from '../activity/recordActivity.js';

/** RFS is a target date, not a Resolve gate. All dates are Asia/Jakarta calendar dates. */
export const JAKARTA_TIME_ZONE = 'Asia/Jakarta';

export function jakartaDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function isDateOnly(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

/** Jakarta midnight of the RFS date: the instant the circuit becomes ready for service. */
export function plannedActivationAt(rfsDate) {
  return isDateOnly(rfsDate) ? new Date(`${rfsDate}T00:00:00+07:00`) : null;
}

/** Keep the registration's RFS instant in step with the ticket's target date. */
export async function syncPlannedActivation(db, {serviceId, rfsDate}) {
  const id = Number(serviceId);
  if (!Number.isSafeInteger(id) || id < 1) return {count: 0};
  return db.service.updateMany({
    where: {id, status: 'Pending'},
    data: {plannedActiveAt: plannedActivationAt(rfsDate)},
  });
}

/** A deleted/cancelled registration must not activate itself through the RFS sweep. */
export async function clearPlannedActivation(db, serviceIds) {
  const ids = (serviceIds || []).map(Number).filter(id => Number.isSafeInteger(id) && id > 0);
  if (!ids.length) return {count: 0};
  return db.service.updateMany({where: {id: {in: ids}, status: 'Pending'}, data: {plannedActiveAt: null}});
}

/**
 * Activate Pending circuits whose RFS instant has passed. Idempotent: only rows still
 * Pending are written, so a manual activation (or a concurrent sweep) wins and produces
 * no duplicate audit. Ticket status is never touched here.
 */
export async function activateDueServices(db, {now = new Date(), serviceIds = null, limit = 100} = {}) {
  const where = {status: 'Pending', plannedActiveAt: {not: null, lte: now}};
  const ids = Array.isArray(serviceIds) ? serviceIds.map(Number).filter(id => Number.isSafeInteger(id) && id > 0) : [];
  if (ids.length) where.id = {in: ids};
  const due = await db.service.findMany({
    where,
    select: {id: true, cid: true, plannedActiveAt: true},
    orderBy: {plannedActiveAt: 'asc'},
    take: Math.max(1, Math.min(500, Number(limit) || 100)),
  });
  let activated = 0;
  const activatedIds = [];
  for (const service of due) {
    const result = await db.service.updateMany({where: {id: service.id, status: 'Pending'}, data: {status: 'Active', activatedAt: now}});
    if (result?.count !== 1) continue;
    activated += 1;
    activatedIds.push(service.id);
    const key = `rfs-activation:${service.id}`;
    const audited = await recordActivity(db, {
      source: 'system',
      type: 'service.activated_at_rfs',
      entityType: 'service',
      entityId: service.id,
      idempotencyKey: key,
      before: {status: 'Pending'},
      after: {status: 'Active'},
    });
    if (!audited && db.activityEvent) {
      // Activation must stay auditable even when performance activity capture is off.
      await db.activityEvent.upsert({
        where: {idempotencyKey: key},
        update: {},
        create: {
          actorId: null,
          source: 'system',
          type: 'service.activated_at_rfs',
          entityType: 'service',
          entityId: service.id,
          occurredAt: now,
          idempotencyKey: key,
          changes: [{field: 'status', before: 'Pending', after: 'Active'}],
        },
      });
    }
  }
  return {due: due.length, activated, serviceIds: activatedIds};
}
