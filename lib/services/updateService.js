import { darkFiberData } from './productUnits.js';
import { recordActivity } from '../activity/recordActivity.js';
import { openPortUpdatedData, validateOpenPortData } from './productBandwidth.js';
import { checkServiceCid } from './cidLookup.js';
import { CidValidationError, getServiceCid } from './cid.js';
import { lockCircuitCodes, registerCircuitIdentifier } from './circuitRegistry.js';
import { normalizeCompany } from '../companies/policy.js';

const toPositiveInt = (value, label) => {
  const n = Number(value);
  if (!['number', 'string'].includes(typeof value) || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(n) || n < 1) {
    throw new CidValidationError(`${label} tidak valid.`, 400);
  }
  return n;
};

/**
 * Updates a Service inside an active transaction, enforcing:
 * - Deterministic identifier + row locks
 * - Active BOD guard
 * - Valid active Customer when reassigning customerId
 * - Valid active ServiceTemplate + unit/capacity rules when changing templateId or customData
 * - Activity logging
 */
export async function updateServiceRecord(tx, serviceId, body, actorId) {
  const existing = await tx.service.findUnique({ where: { id: serviceId } });
  if (!existing) throw new CidValidationError('Layanan tidak ditemukan.', 404);

  const candidate = {
    cid: body.cid === undefined ? existing.cid : body.cid,
    customData: body.customData === undefined ? existing.customData : body.customData,
  };
  const code = getServiceCid(candidate);
  await lockCircuitCodes(tx, [code, getServiceCid(existing)]);
  await tx.$queryRaw`SELECT id FROM "Service" WHERE id = ${serviceId} FOR UPDATE`;

  if (await tx.bodWindow.findFirst({ where: { serviceId, activatedAt: { not: null }, restoredAt: null, cancelledAt: null } })) {
    throw new CidValidationError('BOD aktif. Konfirmasi pengembalian bandwidth normal sebelum mengedit Inventory.', 409);
  }

  const fresh = await tx.service.findUnique({ where: { id: serviceId } });
  if (+new Date(fresh.updatedAt) !== +new Date(existing.updatedAt)) {
    throw new CidValidationError('Layanan berubah; muat ulang.', 409);
  }

  const serviceCid = await checkServiceCid(tx, candidate, serviceId);
  if (getServiceCid(existing)) {
    await registerCircuitIdentifier(tx, { serviceId, code: getServiceCid(existing), actorId, source: 'human' });
  }

  const updateData = {};
  if (body.cid !== undefined || body.customData !== undefined) updateData.cid = serviceCid;
  if (body.name) updateData.name = body.name;
  if (body.status) updateData.status = body.status;
  if (body.company !== undefined) updateData.company = normalizeCompany(body.company);

  if (body.customerId !== undefined && Number(body.customerId) !== fresh.customerId) {
    const nextCustomerId = toPositiveInt(body.customerId, 'Customer');
    const targetCustomer = await tx.customer.findUnique({ where: { id: nextCustomerId } });
    if (!targetCustomer || targetCustomer.active === false) {
      throw new CidValidationError('Customer tujuan tidak ditemukan atau sudah diarsipkan.', 400);
    }
    updateData.customerId = nextCustomerId;
  }

  const templateChanged = body.templateId !== undefined && Number(body.templateId) !== fresh.templateId;
  let effectiveTemplateId = fresh.templateId;
  if (templateChanged) {
    const nextTemplateId = toPositiveInt(body.templateId, 'Produk layanan');
    const targetTemplate = await tx.serviceTemplate.findUnique({ where: { id: nextTemplateId } });
    if (!targetTemplate || targetTemplate.active === false) {
      throw new CidValidationError('Produk layanan tidak ditemukan atau berstatus arsip.', 400);
    }
    effectiveTemplateId = nextTemplateId;
    updateData.templateId = nextTemplateId;
  }

  if (body.customData || templateChanged) {
    const template = await tx.serviceTemplate.findUnique({ where: { id: effectiveTemplateId } });
    const baseCurrent = fresh.customData && typeof fresh.customData === 'object' ? fresh.customData : {};
    const incomingData = body.customData && typeof body.customData === 'object' ? body.customData : baseCurrent;
    const next = darkFiberData(template, openPortUpdatedData(template, baseCurrent, incomingData), baseCurrent);
    validateOpenPortData(template, next);
    updateData.customData = next;
  }

  let updated = fresh;
  if (Object.keys(updateData).length) {
    updated = await tx.service.update({
      where: { id: serviceId },
      data: updateData,
      include: {
        customer: true,
        template: true,
        identifiers: { select: { code: true, family: true } },
      },
    });
    await recordActivity(tx, {
      actorId,
      source: 'human',
      type: 'service.updated',
      entityType: 'service',
      entityId: serviceId,
      before: fresh,
      after: updated,
    });
  }

  if (serviceCid) {
    await registerCircuitIdentifier(tx, { serviceId, code: serviceCid, actorId, source: 'human' });
  }

  if (body.hops) {
    await tx.circuitHop.deleteMany({ where: { serviceId } });
    if (body.hops.length) {
      await tx.circuitHop.createMany({
        data: body.hops.map((h, index) => ({
          serviceId,
          orderIndex: index,
          location: h.location,
          deviceName: h.deviceName,
          portName: h.portName,
          description: h.description,
        })),
      });
    }
  }

  return updated;
}
