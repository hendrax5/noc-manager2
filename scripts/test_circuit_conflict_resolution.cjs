// A site-name conflict disappears from the conflict queue once every source ticket is
// linked to one service; duplicate-owner / unlinked-ticket cases stay conflict.
// Run with: node scripts/test_circuit_conflict_resolution.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');

async function main() {
  const root = path.resolve(__dirname, '..');
  const built = await esbuild.build({
    stdin:{contents:"export {buildCircuitCandidates} from '@/lib/services/circuitCandidates.js';",resolveDir:root,loader:'js'},
    bundle:true,write:false,format:'cjs',platform:'node',alias:{'@':root},
  });
  const filename = path.join(root,'conflict-fixture.cjs');
  const mod = new Module(filename,module);
  mod.filename = filename; mod.paths = module.paths;
  mod._compile(built.outputFiles[0].text,filename);
  const { buildCircuitCandidates } = mod.exports;

  const ticket = (id, name, services = []) => ({
    id, trackingId: 'HSK-' + id, title: 'SAP-C-7000-0001', description: '',
    customData: { 'Customer Name': name }, updatedAt: '2026-10-01T00:00:00.000Z',
    workType: 'Installation', jobCategory: { name: 'Installasi' }, services,
  });
  const service = { id: 5, cid: 'SAP-C-7000-0001', customData: {}, identifiers: [] };

  const unlinked = buildCircuitCandidates([ticket(1,'PT Satu Site A'),ticket(2,'PT Dua Site B')],[]);
  assert.equal(unlinked[0].status,'conflict','different site names with no service stay conflict');
  assert.ok(unlinked[0].reasons.includes('Kode yang sama muncul pada nama/site berbeda; periksa semua sumber.'));

  const linked = buildCircuitCandidates([ticket(1,'PT Satu Site A',[service]),ticket(2,'PT Dua Site B',[service])],[service]);
  assert.equal(linked[0].status,'linked','all source tickets linked after confirmation is resolved');
  assert.equal(linked[0].serviceId,5);
  assert.equal(linked[0].linkedCount,2);
  assert.equal(linked[0].reasons.includes('Kode yang sama muncul pada nama/site berbeda; periksa semua sumber.'),false);

  const partial = buildCircuitCandidates([ticket(1,'PT Satu Site A',[service]),ticket(2,'PT Dua Site B')],[service]);
  assert.equal(partial[0].status,'conflict','partially linked sources remain conflict');

  console.log('PASS circuit-conflict-resolution: site-name conflicts resolve once all sources are linked, partial/duplicate cases stay conflict.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
