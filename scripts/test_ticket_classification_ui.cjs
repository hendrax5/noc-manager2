// Real client components, synthetic API fixtures, no authentication bypass or database writes.
// Covers the current work-v2 form: classification, CID/symptom/cause gating, and inactive master snapshots.
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require('playwright');

async function main() {
  const root = path.resolve(__dirname, '..');
  const services = [
    {id: 41, cid: 'CID-ALPHA', name: 'Metro Alpha', customer: {name: 'Customer Alpha'}},
    {id: 42, identifiers:[{code:'I-0275-021-01'}], name: 'Legacy Link', customData: {CID: 'CID-LEGACY'}, customer: {name: 'Customer Legacy'}},
    {id: 43, name: 'Missing Circuit', customer: {name: 'Customer Missing'}},
  ];
  const fixture = {departments:[{id:1,name:'NOC'}],categories:[{id:7,name:'Legacy category',score:5}],users:[{id:3,name:'Operator'}],services,serviceTemplates:[]};
  const built = await esbuild.build({
    stdin: {
      contents: `
        import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
        import TicketForm from './app/tickets/new/TicketForm';
        import TicketWorkClassification from './components/TicketWorkClassification';
        function Snapshot(){const [value,setValue]=useState({workType:'Trouble',symptomId:91,symptomLabel:'Inactive symptom snapshot',causeId:92,causeLabel:'Inactive cause snapshot'});return <TicketWorkClassification value={value} onChange={patch=>setValue(previous=>({...previous,...patch}))}/>}
        const query = new URLSearchParams(location.search);
        createRoot(document.getElementById('app')).render(query.has('snapshot') ? <Snapshot/> : <TicketForm {...${JSON.stringify(fixture)}} defaultWorkType={query.get('workType') || 'Unclassified'}/>);
      `,
      resolveDir: root, sourcefile: 'classification-ui-fixture.jsx', loader: 'jsx',
    },
    bundle: true, outdir: 'out', write: false, loader: {'.js': 'jsx'}, jsx: 'automatic', alias: {'@': root},
    plugins: [{
      name: 'client-fixture-dependencies',
      setup(build) {
        build.onResolve({filter: /^(next\/navigation|react-hot-toast|node:crypto)$/}, args => ({path: args.path, namespace: 'fixture'}));
        build.onLoad({filter: /.*/, namespace: 'fixture'}, args => ({
          contents: args.path === 'node:crypto'
            ? 'export function createHash(){return {update(){return this},digest(){return "fixture-hash"}}}'
            : args.path === 'next/navigation'
              ? 'export const useRouter=()=>({push(){},refresh(){}});'
              : 'const report=message=>{window.fixtureToasts=(window.fixtureToasts||[]).concat(message)}; export default {error:report,success:report};',
          loader: 'js',
        }));
      },
    }],
  });
  const js = built.outputFiles.find(file => file.path.endsWith('.js')).text;
  const css = built.outputFiles.find(file => file.path.endsWith('.css'))?.text || '';
  const posts = [], masterRequests = [];
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/api/trouble-masters?')) {
      const kind = new URL(req.url, 'http://localhost').searchParams.get('kind');
      masterRequests.push(kind);
      res.end(JSON.stringify(kind === 'symptom'
        ? [{id:11,name:'Link down',description:'No connectivity',active:true},{id:12,name:'Packet loss',active:true}]
        : [{id:21,name:'Belum diketahui',active:true},{id:22,name:'FO CUT',description:'Fiber cable cut',active:true}]));
    } else if (req.url === '/api/service-work-types') res.end('[]');
    else if (req.url === '/api/queues') res.end('[]');
    else if (req.url === '/api/tickets' && req.method === 'POST') {
      let body = ''; req.on('data', data => body += data); req.on('end', () => { posts.push(JSON.parse(body)); res.end('{"id":100}'); });
    } else if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(js); }
    else {
      res.setHeader('Content-Type', 'text/html');
      res.end(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Ticket classification QA</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main id="app"></main><script src="/app.js"></script></body></html>`);
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless: true, channel: 'chrome'});
    const page = await browser.newPage({viewport: {width: 1280, height: 1000}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = `http://127.0.0.1:${server.address().port}`;
    const subject = () => page.getByLabel('Subject', {exact: true});
    const message = () => page.getByLabel('Message Content', {exact: true});
    const workType = () => page.getByLabel('Jenis pekerjaan', {exact: true});
    async function submit() {
      const response = page.waitForResponse(res => res.url().endsWith('/api/tickets') && res.request().method() === 'POST');
      await page.getByRole('button', {name: 'Create Support Ticket'}).click();
      await response;
      return posts.at(-1);
    }

    // Unclassified: a plain ticket keeps the classification empty.
    await page.goto(base);
    assert.equal(await subject().count(), 1);
    await subject().fill('Fixture full form'); await message().fill('Retain every original field');
    let payload = await submit();
    assert.equal(payload.workType, 'Unclassified');
    assert.deepEqual(payload.serviceIds, []);
    assert.equal(payload.symptomId, undefined);
    assert.equal(payload.jobCategoryId, undefined);

    // Trouble: CID picker comes before the master pickers, invalid and missing CID are blocked.
    await page.goto(base + '?workType=Trouble');
    assert.match(await workType().innerText(), /Trouble/);
    await subject().fill('Trouble fixture'); await message().fill('Link down on Metro Alpha');
    assert.ok((await page.getByLabel('Cari & pilih CID layanan', {exact: true}).boundingBox()).y < (await page.getByLabel('Gejala *', {exact: true}).boundingBox()).y, 'CID picker must appear before Gejala');
    await page.getByLabel('Gejala *', {exact: true}).fill('SAP-C-1243-0003');
    await page.getByRole('alert').filter({hasText: 'Teks ini terlihat seperti CID'}).waitFor();
    await page.getByLabel('Gejala *', {exact: true}).fill('down');
    await page.getByRole('option', {name: 'Link down', exact: true}).click();
    await page.getByLabel('Penyebab *', {exact: true}).fill('fiber');
    await page.getByRole('option', {name: 'FO CUT', exact: true}).click();
    assert.equal(await page.getByLabel('Cari gejala', {exact: true}).count(), 0);
    assert.equal(await page.getByLabel('Cari penyebab', {exact: true}).count(), 0);
    assert.ok(masterRequests.includes('symptom') && masterRequests.includes('cause'));

    await page.getByLabel('Cari & pilih CID layanan', {exact: true}).fill('Missing');
    await page.getByRole('checkbox', {name: /CID belum tersedia/}).check();
    const before = posts.length;
    await page.getByRole('button', {name: 'Create Support Ticket'}).click();
    await page.getByRole('alert').filter({hasText: 'Pilih CID, gejala, dan penyebab gangguan.'}).waitFor();
    assert.equal(posts.length, before, 'Missing CID must prevent a create request');
    await page.getByRole('checkbox', {name: /CID belum tersedia/}).uncheck();

    await page.getByLabel('Cari & pilih CID layanan', {exact: true}).fill('I-0275-021-01');
    await page.getByRole('checkbox', {name: /CID-LEGACY/}).check();
    payload = await submit();
    assert.deepEqual(payload.serviceIds, [42]);
    assert.equal(payload.symptomId, 11);
    assert.equal(payload.causeId, 22);
    assert.equal(payload.workType, 'Trouble');

    // Inactive master snapshots stay visible until the operator replaces them.
    await page.goto(base + '?snapshot=1');
    const symptom = page.getByLabel('Gejala *', {exact: true});
    assert.equal(await symptom.inputValue(), 'Inactive symptom snapshot');
    assert.equal(await page.getByLabel('Penyebab *', {exact: true}).inputValue(), 'Inactive cause snapshot');
    await symptom.fill('Packet'); await symptom.press('ArrowDown'); await symptom.press('Enter');
    assert.equal(await symptom.inputValue(), 'Packet loss');
    await symptom.fill('unknown free text');
    assert.equal(await symptom.evaluate(input => input.checkValidity()), false, 'Free text must not become a master selection');
    await symptom.press('Escape');
    assert.equal(await symptom.inputValue(), '');
    await symptom.fill('down'); await symptom.press('ArrowDown'); await symptom.press('Enter');
    assert.equal(await symptom.evaluate(input => input.checkValidity()), true);
    await symptom.focus(); await symptom.press('Escape');
    assert.equal(await symptom.getAttribute('aria-expanded'), 'false');
    assert.equal(await symptom.inputValue(), 'Link down');

    await page.setViewportSize({width: 320, height: 900});
    await symptom.click();
    assert.ok((await page.getByRole('listbox', {name: 'Pilihan gejala'}).boundingBox()).width <= 320);

    await page.addScriptTag({path: require.resolve('axe-core/axe.min.js')});
    const axeResult = await page.evaluate(async () => window.axe.run({runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']}}));
    assert.deepEqual(axeResult.violations.map(violation => violation.id), []);
    assert.deepEqual(errors, []);
    console.log('PASS: current work-v2 form classification (Unclassified/Trouble), CID ordering and missing-CID guard, active master fetch/search, inactive snapshots with explicit replacement, 320px listbox, axe and no browser errors. Synthetic API only.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
