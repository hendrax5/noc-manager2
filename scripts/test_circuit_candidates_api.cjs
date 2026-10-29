// GET /api/assets/circuit-candidates returns owner/company hints for the visible page.
// Fixtures only: no database, no network.
// Run with: node scripts/test_circuit_candidates_api.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');

async function main() {
  const root = path.resolve(__dirname, '..');
  const ticket = (id, code, name, company) => ({
    id, trackingId: 'HSK-' + id, title: code, description: '', customData: { 'Customer Name': name, company },
    updatedAt: '2026-10-01T00:00:00.000Z', workType: 'Installation', jobCategory: { name: 'Installasi' }, services: [],
  });
  const tickets = [
    ticket(1, 'SAP-C-4000-0001', 'PT JARINGAN TIANG INDONESIA GROUP-OFFICE KALIGELAN', 'ION'),
    ticket(2, 'I-4000-0002', 'PT MERDEKA BARU YANG BELUM ADA site GUDANG', 'PRODC'),
    ticket(3, 'C-4000-0003', 'PT INDOTEL Site PT JOYO NETWORK SOLUTION', 'ION'),
  ];
  const customers = [
    { id: 1, name: 'PT JARINGAN TIANG INDONESIA GROUP', aliases: null },
    { id: 2, name: 'PT INDO TELEMEDIA SOLUSI (ION PARTNERSHIP)', aliases: ['INDOTEL'] },
  ];
  const companies = [{ code: 'ION', name: 'ION', aliases: [] }, { code: 'SDC', name: 'SDC', aliases: ['PRODC'] }];
  const state = { user: { id: 1, role: { name: 'Admin', permissions: [] } } };
  const db = {
    ticket: {
      findMany: async ({ where }) => {
        if (where?.title?.contains) return structuredClone(tickets);
        if (where?.id?.in) return structuredClone(tickets.filter(item => where.id.in.includes(item.id)).map(item => ({ id: item.id, customData: item.customData })));
        return [];
      },
    },
    service: { findMany: async () => [] },
    customer: { findMany: async () => structuredClone(customers) },
  };
  globalThis.__circuitCandidatesFixture = { db, state, companies };
  const mocks = {
    'next/server': 'export const NextResponse={json:(body,init)=>new Response(JSON.stringify(body),init)};',
    '@/lib/prisma': 'export const prisma=globalThis.__circuitCandidatesFixture.db;',
    '@/lib/companies/server': 'export async function getCompanies(){return globalThis.__circuitCandidatesFixture.companies;}',
  };
  const built = await esbuild.build({
    entryPoints:[path.join(root,'app/api/assets/circuit-candidates/route.js')],
    bundle:true,write:false,format:'cjs',platform:'node',alias:{'@':root},
    plugins:[{name:'fixture',setup(build){
      build.onResolve({filter:/trouble-masters\/user$/},args=>({path:args.path,namespace:'fixture'}));
      build.onResolve({filter:/.*/},args=>mocks[args.path]?{path:args.path,namespace:'fixture'}:undefined);
      build.onLoad({filter:/.*/,namespace:'fixture'},args=>({
        contents: args.path.includes('trouble-masters') ? 'export async function getMasterUser(){return globalThis.__circuitCandidatesFixture.state.user;}'
          : args.path === '@/lib/companies/server' ? mocks[args.path]
          : args.path === '@/lib/prisma' ? mocks[args.path]
          : mocks['next/server'],
        loader:'js',
      }));
    }}],
  });
  const filename = path.join(root,'circuit-candidates-fixture.cjs');
  const mod = new Module(filename,module);
  mod.filename = filename; mod.paths = module.paths;
  mod._compile(built.outputFiles[0].text,filename);
  const { GET } = mod.exports;
  const request = () => new Request('http://localhost/api/assets/circuit-candidates?status=pending&page=1');

  state.user = null;
  assert.equal((await GET(request())).status,401);
  state.user = { id: 2, role: { name: 'Staff', permissions: [] } };
  assert.equal((await GET(request())).status,403);

  state.user = { id: 1, role: { name: 'Admin', permissions: [] } };
  const response = await GET(request());
  assert.equal(response.status,200);
  const body = await response.json();
  assert.equal(body.total,3);
  assert.equal(body.pageSize,25);
  const matched = body.items.find(item => item.cid === 'SAP-C-4000-0001');
  assert.equal(matched.customerSuggestion.status,'matched');
  assert.equal(matched.customerSuggestion.customerId,1,'existing PT is suggested with its Customer ID');
  assert.equal(matched.companySuggestion,'ION','ticket company becomes the service-company hint');
  const proposed = body.items.find(item => item.cid === 'I-4000-0002');
  assert.equal(proposed.customerSuggestion.status,'new');
  assert.equal(proposed.customerSuggestion.customerId,null,'missing owner is never invented');
  assert.equal(proposed.customerSuggestion.proposedName,'PT Merdeka Baru Yang Belum Ada','extracted PT name is proposed');
  assert.equal(proposed.companySuggestion,'SDC','legacy PRODC alias is normalized');
  const aliased = body.items.find(item => item.cid === 'C-4000-0003');
  assert.equal(aliased.customerSuggestion.status,'matched');
  assert.equal(aliased.customerSuggestion.customerId,2,'registered brand alias resolves to the target customer');
  assert.equal(aliased.customerSuggestion.customerName,'PT INDO TELEMEDIA SOLUSI (ION PARTNERSHIP)');
  assert.equal(matched.ticketIds,undefined,'internal ticket ids stay server-side');
  assert.equal(matched.trackingIds,undefined);

  delete globalThis.__circuitCandidatesFixture;
  console.log('PASS circuit-candidates API: owner suggestion (matched Customer ID, registered alias, proposed new PT), normalized ticket company hint, ACL, and hidden internal ids. Synthetic API only.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
