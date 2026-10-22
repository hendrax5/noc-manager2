// Real client components, synthetic API fixtures, no authentication bypass or database writes.
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require('playwright');

async function main() {
  const root = path.resolve(__dirname, '..');
  const services = [
    {id: 41, cid: 'CID-ALPHA', name: 'Metro Alpha', customer: {name: 'Customer Alpha'}},
    {id: 42, name: 'Legacy Link', customData: {CID: 'CID-LEGACY'}, customer: {name: 'Customer Legacy'}},
    {id: 43, name: 'Missing Circuit', customer: {name: 'Customer Missing'}},
  ];
  const fixture = {departments:[{id:1,name:'NOC'}],categories:[{id:7,name:'Legacy category',score:5}],users:[{id:3,name:'Operator'}],customFields:[{id:1,name:'Legacy custom note',type:'text',required:true,position:'bottom'},{id:2,name:'Optional legacy field',type:'text',required:false,position:'below_subject'}],services,serviceTemplates:[]};
  const built = await esbuild.build({stdin:{contents:`
    import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
    import TicketForm from './app/tickets/new/TicketForm';
    import TicketWorkClassification from './components/TicketWorkClassification';
    function Snapshot(){const [value,setValue]=useState({workType:'Trouble',symptomId:91,symptomLabel:'Inactive symptom snapshot',causeId:92,causeLabel:'Inactive cause snapshot'});return <TicketWorkClassification value={value} onChange={patch=>setValue(previous=>({...previous,...patch}))}/>}
    const query = new URLSearchParams(location.search);
    createRoot(document.getElementById('app')).render(query.has('snapshot') ? <Snapshot/> : <TicketForm {...${JSON.stringify(fixture)}} defaultWorkType={query.get('workType') || 'Unclassified'}/>);
  `,resolveDir:root,sourcefile:'classification-ui-fixture.jsx',loader:'jsx'},bundle:true,write:false,loader:{'.js':'jsx'},jsx:'automatic',alias:{'@':root},plugins:[{name:'client-fixture-dependencies',setup(build){
    build.onResolve({filter:/^(next\/navigation|react-hot-toast)$/},args=>({path:args.path,namespace:'fixture'}));
    build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='next/navigation' ? 'export const useRouter=()=>({push(){},refresh(){}});' : 'const report=message=>{window.fixtureToasts=(window.fixtureToasts||[]).concat(message)}; export default {error:report,success:report};',loader:'js'}));
  }}]});
  const js=built.outputFiles[0].text;
  const posts=[],masterRequests=[];
  const server=http.createServer((req,res)=>{
    res.setHeader('Content-Type','application/json');
    if(req.url.startsWith('/api/trouble-masters?')){
      const kind=new URL(req.url,'http://localhost').searchParams.get('kind');masterRequests.push(kind);
      res.end(JSON.stringify(kind==='symptom' ? [{id:11,name:'Link down',description:'No connectivity',active:true},{id:12,name:'Packet loss',active:true}] : [{id:21,name:'Belum diketahui',active:true},{id:22,name:'FO CUT',description:'Fiber cable cut',active:true}]));
    } else if(req.url==='/api/queues')res.end('[]');
    else if(req.url==='/api/tickets' && req.method==='POST'){
      let body='';req.on('data',data=>body+=data);req.on('end',()=>{posts.push(JSON.parse(body));res.end('{"id":100}');});
    } else if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(js);}
    else {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="id"><body><div id="app"></div><script src="/app.js"></script></body></html>');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true,channel:'chrome'});
    const page=await browser.newPage({viewport:{width:1440,height:1100}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const base=`http://127.0.0.1:${server.address().port}`;
    const customer=()=>page.getByPlaceholder('Cari dari Telecom Asset Inventory (e.g. Yayasan WFF) atau ketik manual...');
    async function requiredLegacyFields(){
      await page.getByPlaceholder('Enter a concise summary of the issue...').fill('Fixture full form');
      await page.getByPlaceholder('Describe the issue in detail. Please include any relevant steps to reproduce, server names, or error logs...').fill('Retain every original field');
      await page.locator('div').filter({has:page.locator('label').filter({hasText:'Legacy custom note'})}).last().locator('input').fill('Legacy custom value');
      await page.getByPlaceholder('-- Select Category --').click();
      await page.getByText('Legacy category (+5 pts)',{exact:true}).click();
    }
    async function submit(){const response=page.waitForResponse(response=>response.url().endsWith('/api/tickets') && response.request().method()==='POST');await page.getByRole('button',{name:'Create Support Ticket'}).click();await response;return posts.at(-1);}
    await page.goto(base);
    assert.equal(await page.getByLabel('Jenis pekerjaan').inputValue(),'Unclassified');
    await requiredLegacyFields();await customer().fill('Manual legacy customer');
    let payload=await submit();assert.equal(payload.workType,'Unclassified');assert.equal(payload.jobCategoryId,7);assert.equal(payload.customData['Legacy custom note'],'Legacy custom value');assert.equal(payload.customData['Customer Name'],'Manual legacy customer');
    assert.ok(await page.getByPlaceholder('-- Select PIC (Leave empty for Auto-Assignment) --').isVisible());
    assert.ok(await page.getByText('Order Origin (Company)',{exact:false}).isVisible());
    assert.ok(await page.getByText('Executing Vendor',{exact:false}).isVisible());
    const optional=page.locator('select').filter({has:page.locator('option[value="2"]')});await optional.selectOption('2');
    assert.ok(await page.getByText('Optional legacy field',{exact:true}).isVisible());
    await page.getByLabel('Catat Waktu Outage / Downtime (Trouble Ticket)',{exact:false}).check();
    await page.locator('input[type="datetime-local"]').nth(0).fill('2026-10-01T08:00');
    await page.locator('input[type="datetime-local"]').nth(1).fill('2026-10-01T09:00');
    await page.getByLabel('Jenis pekerjaan').selectOption('Installation');
    assert.equal(await page.getByLabel('Catat Waktu Outage / Downtime (Trouble Ticket)',{exact:false}).isChecked(),true);
    assert.equal(await page.locator('input[type="datetime-local"]').nth(0).inputValue(),'2026-10-01T08:00');
    assert.equal(await page.locator('input[type="datetime-local"]').nth(1).inputValue(),'2026-10-01T09:00');
    assert.ok(await page.getByText('Installation tidak dihitung dalam downtime SLA.',{exact:false}).isVisible());
    await page.getByLabel('Referensi SAP (opsional)').fill('SAP-MANUAL-42');
    await customer().fill('Installation free text');payload=await submit();assert.equal(payload.sapReference,'SAP-MANUAL-42');assert.equal(payload.jobCategoryId,7);assert.equal(payload.customData['Legacy custom note'],'Legacy custom value');assert.equal(payload.customData['Customer Name'],'Installation free text');assert.equal(payload.customData.hasDowntime,true);assert.equal(payload.customData.startDowntime,'2026-10-01T08:00');assert.equal(payload.customData.endDowntime,'2026-10-01T09:00');assert.equal(payload.customData.downtimeMinutes,60);
    await page.goto(base+'?workType=Trouble');await requiredLegacyFields();
    assert.ok((await page.getByLabel('Cari & pilih CID layanan',{exact:true}).boundingBox()).y < (await page.getByLabel('Gejala *',{exact:true}).boundingBox()).y,'CID picker must appear before Gejala');
    await page.getByLabel('Cari gejala',{exact:true}).fill('SAP-C-1243-0003');
    await page.getByRole('alert').filter({hasText:'Teks ini terlihat seperti CID'}).waitFor();
    await page.getByRole('button',{name:'Hapus pencarian gejala',exact:true}).click();
    await page.getByLabel('Gejala *',{exact:true}).selectOption('11');
    await page.getByLabel('Cari penyebab').fill('fiber');await page.getByLabel('Penyebab *',{exact:true}).selectOption('22');
    assert.ok(masterRequests.includes('symptom') && masterRequests.includes('cause'));
    await page.getByLabel('Cari & pilih CID layanan',{exact:true}).fill('Missing');await page.getByRole('checkbox',{name:/CID belum tersedia/}).check();
    const before=posts.length;await page.getByRole('button',{name:'Create Support Ticket'}).click();
    await page.waitForFunction(()=>window.fixtureToasts?.some(text=>text.includes('Semua layanan terpilih wajib memiliki CID')));
    assert.equal(posts.length,before,'Missing CID must prevent a create request');
    await page.getByRole('checkbox',{name:/CID belum tersedia/}).uncheck();
    await page.getByLabel('Cari & pilih CID layanan',{exact:true}).fill('CID-LEGACY');await page.getByRole('checkbox',{name:/CID-LEGACY/}).check();
    assert.ok(await page.getByRole('checkbox',{name:/CID-LEGACY/}).isChecked());
    payload=await submit();assert.deepEqual(payload.serviceIds,[42]);assert.equal(payload.symptomId,11);assert.equal(payload.causeId,22);assert.equal(payload.workType,'Trouble');
    await page.goto(base+'?snapshot=1');
    await page.getByLabel('Gejala *',{exact:true}).locator('option[value="91"]').waitFor({state:'attached'});
    assert.equal(await page.getByLabel('Gejala *',{exact:true}).locator('option:checked').textContent(),'Inactive symptom snapshot (tersimpan)');
    assert.equal(await page.getByLabel('Penyebab *',{exact:true}).locator('option:checked').textContent(),'Inactive cause snapshot (tersimpan)');
    await page.getByLabel('Gejala *',{exact:true}).selectOption('12');assert.equal(await page.getByLabel('Gejala *',{exact:true}).inputValue(),'12');
    assert.deepEqual(errors,[]);
    console.log('PASS: real full TicketForm retains legacy fields/jobCategory/manual customers; Installation SAP + existing downtime preservation; Trouble active master fetch/search + legacy CID selection; missing CID blocked before POST; inactive edit snapshots + explicit replacement; no browser errors. Synthetic API fixtures, no live database.');
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
