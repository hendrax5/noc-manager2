// Render the real report component against synthetic tickets; no login bypass or database writes.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const esbuild = require('esbuild');
const { chromium } = require('playwright');

async function main() {
  const root = path.resolve(__dirname, '..');
  const { buildOutageReport, parseOutageFilters } = await import(pathToFileURL(path.join(root, 'lib/reports/outageReport.js')));
  const now = new Date('2026-10-21T12:00:00+07:00');
  const tickets = [4,7,10,12].map((hours,i)=>({id:i+1,trackingId:`TT-${i+1}`,title:'Link Klender down',description:'FO CUT',status:'Resolved',customData:{hasDowntime:true,startDowntime:`2026-10-0${i+1}T00:00`,endDowntime:`2026-10-0${i+1}T${String(hours).padStart(2,'0')}:00`},services:[{name:'Link Klender',customer:{id:1,name:'Customer A'}}],comments:[{text:'Penyambungan core.',isPublic:true}]}));
  const built = await esbuild.build({
    stdin:{contents:`import React from 'react'; import {createRoot} from 'react-dom/client'; import OutageReportClient from './app/reports/sla/OutageReportClient'; import './app/ui-tokens.css';import './app/globals.css';import './app/legacy-ui.css';import './app/ui-foundation.css'; createRoot(document.getElementById('app')).render(<OutageReportClient/>);`,resolveDir:root,sourcefile:'outage-harness.jsx',loader:'jsx'},
    bundle:true,write:false,outdir:'out',loader:{'.js':'jsx'},jsx:'automatic',alias:{'@':root},
    plugins:[{name:'next-link-harness',setup(build){build.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'harness'}));build.onLoad({filter:/.*/,namespace:'harness'},()=>({contents:"import React from 'react'; export default function Link(props){return React.createElement('a',props)}",loader:'jsx',resolveDir:root}));}}],
  });
  const js=built.outputFiles.find(f=>f.path.endsWith('.js')).text;
  const css=built.outputFiles.find(f=>f.path.endsWith('.css')).text;
  const server=http.createServer((req,res)=>{
    if(req.url.startsWith('/api/reports/outages?')) {
      try { const filters=parseOutageFilters(Object.fromEntries(new URL(req.url,'http://localhost').searchParams),now);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(buildOutageReport(tickets,filters,now))); }
      catch(error){res.statusCode=400;res.end(JSON.stringify({error:error.message}));}
    } else if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(js);}
    else if(req.url==='/ion-logo.png'){res.setHeader('Content-Type','image/png');fs.readFile(path.join(root,'public/ion-logo.png')).then(bytes=>res.end(bytes)).catch(()=>{res.statusCode=404;res.end();});}
    else {res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="id"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body><main class="container"><h1>Gangguan &amp; SLA</h1><div id="app"></div></main><script src="/app.js"></script></body></html>`);}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true,channel:'chrome'});
    const page=await browser.newPage({viewport:{width:1440,height:1100}});
    const errors=[];page.on('pageerror',err=>errors.push(err.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('button',{name:'Terapkan filter'}).waitFor();
    await page.getByLabel('Mulai gangguan dari').fill('2026-10-01');
    await page.getByLabel('Sampai tanggal').fill('2026-10-21');
    await page.getByRole('button',{name:'Isi kriteria FO CUT >10 jam'}).click();
    await page.getByRole('button',{name:'Terapkan filter',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length===1);
    await page.getByRole('link',{name:'TT-4',exact:true}).waitFor();
    assert.equal(await page.locator('tbody tr').count(),1);
    assert.equal(await page.getByRole('link',{name:'TT-1',exact:true}).count(),0);
    await page.getByRole('radio',{name:'Minimal (≥)',exact:true}).check();
    await page.getByRole('button',{name:'Terapkan filter',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length===2);
    await page.getByRole('link',{name:'TT-3',exact:true}).waitFor();
    assert.equal(await page.locator('tbody tr').count(),2);
    await page.getByRole('button',{name:'Pratinjau laporan',exact:true}).click();
    await page.getByRole('heading',{name:'Laporan penanganan gangguan'}).waitFor();
    await page.waitForFunction(()=>{const img=document.querySelector('article img');return img?.complete&&img.naturalWidth>0;});
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'Ekspor CSV'}).click();
    const csv=await fs.readFile(await (await download).path(),'utf8');
    assert.ok(csv.includes('TT-3'));assert.ok(!csv.includes('TT-1'));
    await page.emulateMedia({media:'print'});
    assert.equal(await page.getByRole('heading',{name:'Kriteria laporan gangguan'}).isVisible(),false);
    assert.equal(await page.getByRole('heading',{name:'Laporan penanganan gangguan'}).isVisible(),true);
    await page.emulateMedia({media:'screen'});
    await page.getByRole('button',{name:'Tutup pratinjau',exact:true}).click();
    const artifactDir=process.env.OUTAGE_ARTIFACT_DIR;
    if(artifactDir){await fs.mkdir(artifactDir,{recursive:true});await page.screenshot({path:path.join(artifactDir,'outage-desktop.png'),fullPage:true});}
    for(const width of [320,414,768]){
      await page.setViewportSize({width,height:1000});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`Horizontal page overflow at ${width}px`);
    }
    await page.evaluate(()=>document.documentElement.dataset.theme='dark');
    if(artifactDir)await page.screenshot({path:path.join(artifactDir,'outage-mobile-dark.png'),fullPage:true});
    await page.getByRole('searchbox',{name:/^Customer/}).fill('Does not exist');
    await page.getByRole('button',{name:'Terapkan filter',exact:true}).click();
    await page.getByText('Tidak ada tiket yang sesuai.',{exact:false}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Ekspor CSV'}).isDisabled(),true);
    await page.getByRole('button',{name:'Reset',exact:true}).click();
    await page.getByRole('button',{name:'Terapkan filter',exact:true}).waitFor();
    assert.equal(await page.getByRole('searchbox',{name:/^Customer/}).inputValue(),'');
    assert.equal(await page.getByRole('radio',{name:'Semua durasi',exact:true}).isChecked(),true);
    assert.deepEqual(errors,[]);
    console.log('PASS: per-ticket filtering, > versus >=, preview, CSV, print, empty result, reset, 320/414/768px layouts, no browser errors. Synthetic fixtures; not a live database E2E.');
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
