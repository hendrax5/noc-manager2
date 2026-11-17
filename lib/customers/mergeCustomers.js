import { recordActivity } from '../activity/recordActivity.js';
import { CidValidationError } from '../services/cid.js';

export class CustomerMergeError extends CidValidationError {}

const toPositiveInt = (value, label) => {
  const n = Number(value);
  if (!['number', 'string'].includes(typeof value) || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(n) || n < 1) {
    throw new CustomerMergeError(`${label} tidak valid.`, 400);
  }
  return n;
};

/**
 * Merges a duplicate source Customer into a canonical target Customer inside an active transaction:
 * - Deterministically locks both Customer rows (ascending ID order) to avoid deadlocks.
 * - Moves all Service rows and CustomerPickerUse rows from source to target.
 * - Re-points any historical mergedAliases pointing to source onto target.
 * - Optionally fills blank target contactEmail / contactPhone from source.
 * - Archives source non-destructively (active = false, archivedAt = now, mergedIntoId = target.id).
 * - Records audit event via recordActivity.
 */
export async function mergeCustomerRecords(tx, body, actorId) {
  if (body?.confirmMerge !== true) {
    throw new CustomerMergeError('Konfirmasikan penggabungan customer sebelum melanjutkan.', 400);
  }
  const sourceId = toPositiveInt(body?.sourceCustomerId, 'Customer sumber');
  const targetId = toPositiveInt(body?.targetCustomerId, 'Customer tujuan');
  if (sourceId === targetId) {
    throw new CustomerMergeError('Customer sumber dan customer tujuan harus berbeda.', 400);
  }

  const orderedIds = [sourceId, targetId].sort((a, b) => a - b);
  await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ANY(${orderedIds}::int[]) ORDER BY id FOR UPDATE`;

  const [source, target] = await Promise.all([
    tx.customer.findUnique({ where: { id: sourceId } }),
    tx.customer.findUnique({ where: { id: targetId } }),
  ]);
  if (!source) throw new CustomerMergeError('Customer sumber tidak ditemukan.', 404);
  if (!target) throw new CustomerMergeError('Customer tujuan tidak ditemukan.', 404);
  if (source.active === false || source.archivedAt || source.mergedIntoId) {
    throw new CustomerMergeError('Customer sumber sudah diarsipkan atau pernah digabungkan.', 409);
  }
  if (target.active === false || target.archivedAt || target.mergedIntoId) {
    throw new CustomerMergeError('Customer tujuan berstatus arsip dan tidak dapat menerima layanan.', 409);
  }

  const movedServices = await tx.service.updateMany({
    where: { customerId: sourceId },
    data: { customerId: targetId },
  });

  const movedPickerUses = await tx.customerPickerUse.updateMany({
    where: { customerId: sourceId },
    data: { customerId: targetId },
  });

  // Flatten chains so alias matching stays 1-hop on the canonical customer
  await tx.customer.updateMany({
    where: { mergedIntoId: sourceId },
    data: { mergedIntoId: targetId },
  });

  const contactPatch = {};
  if (body?.copyMissingContact !== false) {
    if (!target.contactEmail?.trim() && source.contactEmail?.trim()) {
      contactPatch.contactEmail = source.contactEmail.trim();
    }
    if (!target.contactPhone?.trim() && source.contactPhone?.trim()) {
      contactPatch.contactPhone = source.contactPhone.trim();
    }
  }
  let updatedTarget = target;
  if (Object.keys(contactPatch).length > 0) {
    updatedTarget = await tx.customer.update({
      where: { id: targetId },
      data: contactPatch,
    });
  }

  const archivedAt = new Date();
  const archivedSource = await tx.customer.update({
    where: { id: sourceId },
    data: {
      active: false,
      archivedAt,
      mergedIntoId: targetId,
    },
  });

  await recordActivity(tx, {
    actorId: Number(actorId),
    source: 'human',
    type: 'customer.merged',
    entityType: 'customer',
    entityId: targetId,
    before: {
      customerId: sourceId,
      name: source.name,
      status: 'Active',
      updatedAt: source.updatedAt,
    },
    after: {
      customerId: targetId,
      name: updatedTarget.name,
      status: 'ArchivedSource',
      updatedAt: archivedSource.updatedAt,
    },
  });

  return {
    sourceId,
    targetId,
    sourceName: source.name,
    targetName: updatedTarget.name,
    movedServices: movedServices.count || 0,
    movedPickerUses: movedPickerUses.count || 0,
    archivedAt,
    target: updatedTarget,
    archivedSource,
  };
}
