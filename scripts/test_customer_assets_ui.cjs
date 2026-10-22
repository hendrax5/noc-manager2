const assert=require('node:assert/strict'),path=require('node:path'),http=require('node:http');
const esbuild=require('esbuild'),{chromium}=require('playwright');
async function main(){
 const root=path.resolve(__dirname,'..');
 const customers=[{id:1,name:'PT ANTEN'},{id:2,name:'PT OTHER'},{id:3,name:'Tanpa layanan'},...Array.from({length:30},(_,i)=>({id:100+i,name:'ZZ Customer '+String(i).padStart(2,'0')}))];
 const services=[{id:121,identifiers:[{code:'I-0275-021-01'}],customerId:1,name:'OFFICE TANGERANG',cid:'SAP-C-1243-0003',template:{name:'METRO-E'},status:'Active',customData:{bandwidthMbps:100},_count:{tickets:1}},{id:120,customerId:1,name:'BTS CADAS QUEEN',template:{name:'IPT'},status:'Active',_count:{tickets:2}},{id:119,customerId:2,name:'OTHER SITE',cid:'SAP-C-1243-0009',template:{name:'COMIX'},status:'Pending'}];
 const built=await esbuild.build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Assets from './app/assets/AssetClient';createRoot(document.getElementById('app')).render(<Assets session={{user:{role:'Admin'}}} initialCustomers={${JSON.stringify(customers)}} initialTemplates={[]} initialServices={${JSON.stringify(services)}}/>);`,resolveDir:root,loader:'jsx'},bundle:true,write:false,outdir:'out',loader:{'.js':'jsx'},jsx:'automatic',alias:{'@':root},plugins:[{name:'fixture',setup(build){build.onResolve({filter:/^next\/link$/},args=>({path:args.path,namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'import React from "react";export default function Link(props){return <a {...props}/>}',loader:'jsx',resolveDir:root}));}}]});
 const baseCss=require('node:fs').readFileSync(path.join(root,'app/globals.css'),'utf8');
 const js=built.outputFiles.find(file=>file.path.endsWith('.js')).text,css=built.outputFiles.find(file=>file.path.endsWith('.css')).text;
 const server=http.createServer((req,res)=>{
  if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(js);}
  if(req.url.startsWith('/api/assets/circuit-candidates')){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({items:[],total:0,pageSize:25,summary:{circuits:0,needsMapping:0,linked:0,conflicts:0}}));}
  res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="id"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:12px;font:14px Arial}${baseCss}${css}</style><div id="app"></div><script src="/app.js"></script></html>`);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));const base=`http://127.0.0.1:${server.address().port}`;await page.goto(base);
  if(process.env.NOC_UI_SCREENSHOT)console.log(await page.evaluate(()=>({font:getComputedStyle(document.body).fontFamily,primary:getComputedStyle(document.documentElement).getPropertyValue('--secondary-color'),rules:document.styleSheets[0].cssRules.length,head:document.documentElement.outerHTML.slice(0,200)})));
  const inventory=page.getByRole('region',{name:'Layanan per customer'});
  assert.equal(await inventory.locator('button[aria-expanded]').count(),25,'Only one page of customer groups rendered');await page.getByRole('button',{name:'Berikutnya',exact:true}).click();assert.equal(await inventory.locator('button[aria-expanded]').count(),8);await page.getByRole('button',{name:'Sebelumnya',exact:true}).click();
  const customer=inventory.getByRole('button',{name:/PT ANTEN/});assert.equal(await customer.count(),1);assert.equal(await customer.getAttribute('aria-expanded'),'false');assert.ok(!(await customer.innerText()).includes('METRO-E'));
  await customer.click();const table=page.getByRole('table',{name:'Layanan PT ANTEN'});assert.equal(await table.locator('tbody tr').count(),2);assert.ok(await table.getByText('METRO-E',{exact:true}).isVisible());assert.ok(await table.getByText('IPT',{exact:true}).isVisible());assert.ok(await table.getByText('CID belum tertaut',{exact:true}).isVisible());assert.ok(!(await inventory.innerText()).includes('#120'));assert.ok(await table.getByText('100 Mbps',{exact:true}).isVisible());
  if(process.env.NOC_UI_SCREENSHOT)await page.screenshot({path:process.env.NOC_UI_SCREENSHOT,fullPage:true});
  const search=page.getByLabel('Cari customer, Customer ID, atau CID');await search.fill('ION-CUST-000001');assert.equal(await page.getByRole('table',{name:'Layanan PT ANTEN'}).locator('tbody tr').count(),2,'Customer ID selects all child circuits');await search.fill('I-0275-021-01');assert.equal(await page.getByRole('table',{name:'Layanan PT ANTEN'}).locator('tbody tr').count(),1,'Alias resolves to the canonical circuit');await search.fill('SAP-C-1243-0009');assert.equal(await inventory.locator('button[aria-expanded]').count(),1);assert.ok(await page.getByRole('table',{name:'Layanan PT OTHER'}).isVisible(),'Same SAP number segment does not merge customers');
  await search.fill('PT ANTEN');assert.equal(await page.getByRole('table',{name:'Layanan PT ANTEN'}).locator('tbody tr').count(),2);
  await search.fill('IPT');assert.equal(await page.getByRole('table',{name:'Layanan PT ANTEN'}).locator('tbody tr').count(),1);
  await search.fill('not found');await page.getByText('Tidak ada customer atau layanan yang cocok.',{exact:true}).waitFor();await search.fill('');
  await inventory.getByRole('button',{name:/Tanpa layanan/}).click();await page.getByText('Belum ada layanan terdaftar untuk customer ini.',{exact:true}).waitFor();
  await page.goto(base+'/#sap-circuits');await page.getByRole('region',{name:'CID dari tiket'}).waitFor();assert.equal(await page.getByRole('region',{name:'Layanan per customer'}).count(),0);
  await page.getByRole('button',{name:/Customer & layanan/}).click();await inventory.waitFor();assert.equal(new URL(page.url()).hash,'');
  await page.setViewportSize({width:320,height:900});await inventory.getByRole('button',{name:/PT ANTEN/}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Inventory fits 320px with local table scrolling');assert.deepEqual(errors,[]);
  console.log('PASS: real Assets customer grouping, per-service products/CIDs/capacity/history, no database IDs as CID, search, no-CID and empty states, SAP hash navigation, mobile width. Synthetic data only.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1});
