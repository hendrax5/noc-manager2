import test from 'node:test';
import assert from 'node:assert/strict';
import { mapCircuitCandidatesBatch, CircuitAssetError } from './circuitAssets.js';

function createMockDb({ tickets = [], services = [], customers = [], templates = [] } = {}) {
  let nextServiceId = 500;
  const createdServices = [];
  const registeredIdentifiers = [];
  const joinedPairs = [];
  const lockLog = [];

  const db = {
    createdServices,
    registeredIdentifiers,
    joinedPairs,
    lockLog,
    async $transaction(fn) {
      return fn(db);
    },
    async $queryRaw(_strings, ...values) {
      lockLog.push(values);
      return [];
    },
    async $executeRaw(_strings, serviceId, ticketIds) {
      for (const tid of ticketIds) {
        joinedPairs.push([serviceId, tid]);
        const t = tickets.find((x) => x.id === tid);
        if (t) t.services = [...(t.services || []), { id: serviceId }];
      }
      return ticketIds.length;
    },
    ticket: {
      async findMany({ where }) {
        if (where?.id?.in) return tickets.filter((t) => where.id.in.includes(t.id));
        return tickets;
      },
    },
    service: {
      async findMany() {
        return services;
      },
      async findUnique({ where }) {
        return services.find((s) => s.id === where.id) || null;
      },
      async create({ data }) {
        const created = { id: ++nextServiceId, identifiers: [], ...data };
        services.push(created);
        createdServices.push(created);
        return created;
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
    serviceIdentifier: {
      async findMany({ where } = {}) {
        if (where?.code) return registeredIdentifiers.filter((r) => r.code === where.code);
        return registeredIdentifiers;
      },
      async findUnique({ where }) {
        return registeredIdentifiers.find((r) => r.code === where.code) || null;
      },
      async create({ data }) {
        const rec = { id: registeredIdentifiers.length + 1, ...data };
        registeredIdentifiers.push(rec);
        return rec;
      },
    },
    ticketHistory: {
      async createMany() {
        return { count: 1 };
      },
    },
  };

  return db;
}

test('mapCircuitCandidatesBatch locks codes deterministically, creates services, and links existing ready_to_link rows', async () => {
  const db = createMockDb({
    tickets: [
      { id: 10, title: 'SAP-C-0001-0002', workType: 'ServiceWork', jobCategory: { name: 'Installasi' }, description: '[Original Reporter: PT Contoh - Cabang B]', services: [] },
      { id: 11, title: 'SAP-C-0001-0001', workType: 'ServiceWork', jobCategory: { name: 'Installasi' }, description: '[Original Reporter: PT Contoh - Kantor Pusat]', services: [] },
      { id: 12, title: 'SAP-C-0001-0003', workType: 'ServiceWork', jobCategory: { name: 'Installasi' }, description: '[Original Reporter: PT Contoh - Gudang]', services: [] },
    ],
    services: [
      { id: 77, cid: 'SAP-C-0001-0003', customerId: 5, customData: {}, identifiers: [{ code: 'SAP-C-0001-0003' }] },
    ],
    customers: [{ id: 5, name: 'PT Contoh', active: true }],
    templates: [{ id: 8, name: 'IPT', active: true }],
  });

  const result = await mapCircuitCandidatesBatch(db, {
    customerId: 5,
    templateId: 8,
    status: 'Pending',
    items: [
      { cid: 'SAP-C-0001-0002', name: 'Cabang B' },
      { cid: 'SAP-C-0001-0001', name: 'Kantor Pusat' },
      { cid: 'SAP-C-0001-0003' },
    ],
  }, 1);

  assert.equal(result.count, 3);
  assert.equal(result.createdCount, 2);
  assert.equal(result.linkedTicketsCount, 3);
  assert.equal(db.createdServices.length, 2);
  assert.ok(db.joinedPairs.some(([sid, tid]) => sid === 77 && tid === 12));
});

test('mapCircuitCandidatesBatch rejects archived customer and missing review confirmation', async () => {
  const db = createMockDb({
    tickets: [
      { id: 1, title: 'I2-0001-0001', workType: 'Unclassified', jobCategory: { name: 'General' }, description: '[Original Reporter: Site A]', services: [] },
    ],
    customers: [{ id: 5, name: 'PT Arsip', active: false }],
    templates: [{ id: 8, name: 'IPT', active: true }],
  });

  await assert.rejects(
    () => mapCircuitCandidatesBatch(db, { customerId: 5, templateId: 8, items: [{ cid: 'I2-0001-0001' }] }, 1),
    (e) => e instanceof CircuitAssetError && /Konfirmasikan/.test(e.message),
  );

  await assert.rejects(
    () => mapCircuitCandidatesBatch(db, { customerId: 5, templateId: 8, confirmReview: true, items: [{ cid: 'I2-0001-0001' }] }, 1),
    (e) => e instanceof CircuitAssetError && /customer aktif/.test(e.message),
  );
});
