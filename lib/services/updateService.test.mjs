import test from 'node:test';
import assert from 'node:assert/strict';
import { updateServiceRecord } from './updateService.js';
import { CidValidationError } from './cid.js';

function createMockTx({ service, bodActive = false, customers = [], templates = [] }) {
  let current = { ...service };
  const activities = [];

  return {
    activities,
    getCurrent: () => current,
    async $queryRaw() {
      return [];
    },
    service: {
      async findUnique() {
        return current;
      },
      async findMany() {
        return [current];
      },
      async update({ data }) {
        current = { ...current, ...data, updatedAt: new Date('2026-11-16T01:00:00Z') };
        return current;
      },
    },
    customer: {
      async findUnique({ where }) {
        return customers.find((c) => c.id === where.id) || null;
      },
    },
    serviceTemplate: {
      async findUnique({ where }) {
        return templates.find((t) => t.id === where.id) || null;
      },
    },
    bodWindow: {
      async findFirst() {
        return bodActive ? { id: 1, activatedAt: new Date() } : null;
      },
    },
    serviceIdentifier: {
      async findUnique() {
        return { code: current.cid, serviceId: current.id };
      },
      async findMany({ where } = {}) {
        return where?.code === current.cid ? [{ id: 1, code: current.cid, serviceId: current.id }] : [];
      },
      async create() {
        return { id: 1 };
      },
    },
    circuitHop: {
      async deleteMany() {},
      async createMany() {},
    },
    appSetting: {
      async findUnique() {
        return { value: JSON.stringify({ performance_activity_capture: true }) };
      },
    },
    activityEvent: {
      async upsert({ create }) {
        activities.push(create);
        return create;
      },
    },
  };
}

test('updateServiceRecord reassigns customerId and templateId cleanly when no BOD is active', async () => {
  const tx = createMockTx({
    service: {
      id: 10,
      cid: 'SAP-C-0001-0001',
      customerId: 1,
      templateId: 1,
      name: 'Link Utama',
      status: 'Active',
      customData: { bandwidthMbps: 100 },
      updatedAt: new Date('2026-10-01T00:00:00Z'),
    },
    customers: [
      { id: 1, name: 'Lama', active: true },
      { id: 2, name: 'Resmi', active: true },
    ],
    templates: [
      { id: 1, name: 'INTERNET', active: true },
      { id: 3, name: 'DARKFIBER', active: true },
    ],
  });

  const updated = await updateServiceRecord(tx, 10, { customerId: 2, templateId: 3 }, 99);
  assert.equal(updated.customerId, 2);
  assert.equal(updated.templateId, 3);
  assert.equal(updated.customData.pairCount, 1);
  const serviceEvent = tx.activities.find((a) => a.type === 'service.updated');
  assert.ok(serviceEvent);
  assert.ok(serviceEvent.changes.some((c) => c.field === 'customerId' && c.after === 2));
  assert.ok(serviceEvent.changes.some((c) => c.field === 'templateId' && c.after === 3));
});

test('updateServiceRecord blocks reassignment to archived customer or during active BOD', async () => {
  const archivedCustomerTx = createMockTx({
    service: { id: 10, cid: 'SAP-C-0001-0001', customerId: 1, templateId: 1, customData: {}, updatedAt: new Date() },
    customers: [{ id: 2, name: 'Arsip', active: false }],
    templates: [{ id: 1, name: 'INTERNET', active: true }],
  });

  await assert.rejects(
    () => updateServiceRecord(archivedCustomerTx, 10, { customerId: 2 }, 99),
    (e) => e instanceof CidValidationError && e.status === 400,
  );

  const bodTx = createMockTx({
    service: { id: 10, cid: 'SAP-C-0001-0001', customerId: 1, templateId: 1, customData: {}, updatedAt: new Date() },
    bodActive: true,
    customers: [{ id: 2, name: 'Resmi', active: true }],
    templates: [{ id: 1, name: 'INTERNET', active: true }],
  });

  await assert.rejects(
    () => updateServiceRecord(bodTx, 10, { customerId: 2 }, 99),
    (e) => e instanceof CidValidationError && e.status === 409,
  );
});
