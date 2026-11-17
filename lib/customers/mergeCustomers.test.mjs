import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCustomerRecords, CustomerMergeError } from './mergeCustomers.js';

function createMockTx(seed = {}) {
  const customers = new Map(
    (seed.customers || []).map((c) => [c.id, { active: true, archivedAt: null, mergedIntoId: null, updatedAt: new Date('2026-10-01T00:00:00Z'), ...c }]),
  );
  const services = (seed.services || []).map((s) => ({ ...s }));
  const pickerUses = (seed.pickerUses || []).map((p) => ({ ...p }));
  const activities = [];
  const lockCalls = [];

  return {
    customers,
    services,
    pickerUses,
    activities,
    lockCalls,
    async $queryRaw(_strings, ...values) {
      lockCalls.push(values);
      return [];
    },
    customer: {
      async findUnique({ where }) {
        return customers.get(where.id) || null;
      },
      async update({ where, data }) {
        const current = customers.get(where.id);
        const next = { ...current, ...data, updatedAt: new Date('2026-11-16T00:00:00Z') };
        customers.set(where.id, next);
        return next;
      },
      async updateMany({ where, data }) {
        let count = 0;
        for (const [id, c] of customers.entries()) {
          if (c.mergedIntoId === where.mergedIntoId) {
            customers.set(id, { ...c, ...data });
            count++;
          }
        }
        return { count };
      },
    },
    service: {
      async updateMany({ where, data }) {
        let count = 0;
        for (const s of services) {
          if (s.customerId === where.customerId) {
            s.customerId = data.customerId;
            count++;
          }
        }
        return { count };
      },
    },
    customerPickerUse: {
      async updateMany({ where, data }) {
        let count = 0;
        for (const p of pickerUses) {
          if (p.customerId === where.customerId) {
            p.customerId = data.customerId;
            count++;
          }
        }
        return { count };
      },
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

test('mergeCustomerRecords moves services, picker uses, fills blank contact, archives source and logs activity', async () => {
  const tx = createMockTx({
    customers: [
      { id: 20, name: 'Contoh Digital', contactEmail: 'noc@contoh.id', contactPhone: '021-555' },
      { id: 5, name: 'PT Contoh Digital', contactEmail: '', contactPhone: null },
      { id: 2, name: 'Contoh Lama', active: false, mergedIntoId: 20, archivedAt: new Date('2026-09-01T00:00:00Z') },
    ],
    services: [
      { id: 101, customerId: 20, cid: 'SAP-C-0001-0001' },
      { id: 102, customerId: 20, cid: 'SAP-C-0001-0002' },
      { id: 103, customerId: 5, cid: 'SAP-C-0001-0003' },
    ],
    pickerUses: [
      { id: 1, customerId: 20, ticketId: 900 },
    ],
  });

  const result = await mergeCustomerRecords(
    tx,
    { sourceCustomerId: 20, targetCustomerId: 5, copyMissingContact: true, confirmMerge: true },
    1,
  );

  assert.equal(result.movedServices, 2);
  assert.equal(result.movedPickerUses, 1);
  assert.deepEqual(tx.lockCalls[0][0], [5, 20]);
  assert.ok(tx.services.every((s) => s.customerId === 5));
  assert.ok(tx.pickerUses.every((p) => p.customerId === 5));
  assert.equal(tx.customers.get(5).contactEmail, 'noc@contoh.id');
  assert.equal(tx.customers.get(5).contactPhone, '021-555');
  assert.equal(tx.customers.get(20).active, false);
  assert.equal(tx.customers.get(20).mergedIntoId, 5);
  assert.ok(tx.customers.get(20).archivedAt instanceof Date);
  assert.equal(tx.customers.get(2).mergedIntoId, 5);
  assert.equal(tx.activities.length, 1);
  assert.equal(tx.activities[0].type, 'customer.merged');
});

test('mergeCustomerRecords rejects missing confirmation, same ID, and already archived customers', async () => {
  const tx = createMockTx({
    customers: [
      { id: 1, name: 'A' },
      { id: 2, name: 'B', active: false, mergedIntoId: 1, archivedAt: new Date() },
    ],
  });

  await assert.rejects(
    () => mergeCustomerRecords(tx, { sourceCustomerId: 1, targetCustomerId: 2 }, 1),
    (err) => err instanceof CustomerMergeError && err.status === 400,
  );
  await assert.rejects(
    () => mergeCustomerRecords(tx, { sourceCustomerId: 1, targetCustomerId: 1, confirmMerge: true }, 1),
    (err) => err instanceof CustomerMergeError && err.status === 400,
  );
  await assert.rejects(
    () => mergeCustomerRecords(tx, { sourceCustomerId: 2, targetCustomerId: 1, confirmMerge: true }, 1),
    (err) => err instanceof CustomerMergeError && err.status === 409,
  );
});
