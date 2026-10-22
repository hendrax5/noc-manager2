const assert=require('node:assert/strict'),path=require('node:path'),http=require('node:http');
const esbuild=require('esbuild'),{chromium}=require('playwright');
async function main(){
 const root=path.resolve(__dirname,'..');
 const customers=[{id:1,name:'PT ANTEN'},{id:2,name:'PT OTHER'},{id:3,name:'Tanpa layanan'}];
 const services=[{id:121,customerId:1,name:'OFFICE TANGERANG',cid:'SAP-C-1243-0003',template:{name:'METRO-E'},status:'Active',customData:{bandwidthMbps:100},_count:{tickets:1}},{id:120,customerId:1,name:'BTS CADAS QUEEN',template:{name:'IPT'},status:'Active',_count:{tickets:2}},{id:119,customerId:2,name:'OTHER SITE',cid:'SAP-C-1243-0009',template:{name:'COMIX'},status:'Pending'}];
 const built=await esbuild.build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Assets from './app/assets/AssetClient';createRoot(document.getElementById('app')).render(<Assets session={{user:{role:'Admin'}}} initialCustomers={${JSON.stringify(customers)}} initialTemplates={[]} initialServices={${JSON.stringify(services)}}/>);`,resolveDir:root,loader:'jsx'},bundle:true,write:false,outdir:'out',loader:{'.js':'jsx'},jsx:'automatic',alias:{'@':root},plugins:[{name:'fixture',setup(build){build.onResolve({filter:/^next\/link$/},args=>({path:args.path,namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'import React from "react";export default function Link(props){return <a {...props}/>}',loader:'jsx',resolveDir:root}));}}]});
 const js=built.outputFiles.find(file=>file.path.endsWith('.js')).text,css=built.outputFiles.find(file=>file.path.endsWith('.css')).text;
 const server=http.createServer((req,res)=>{
  if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(js);}
  if(req.url.startsWith('/api/assets/sap-circuits')){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({items:[],total:0,pageSize:25,summary:{circuits:0,needsMapping:0,linked:0,conflicts:0}}));}
  res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="id"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:12px;font:14px Arial;--border-color:#ddd;--card-bg:white;--input-bg:white;--input-text:#222;--heading-color:#111;--text-color:#333;--primary-color:#1256b0}${css}</style><div id="app"></div><script src="/app.js"></script></html>`);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));const base=`http://127.0.0.1:${server.address().port}`;await page.goto(base);
  const inventory=page.getByRole('region',{name:'Layanan per customer'});
  const customer=inventory.getByRole('button',{name:/PT ANTEN/});assert.equal(await customer.count(),1);assert.equal(await customer.getAttribute('aria-expanded'),'false');assert.ok(!(await customer.innerText()).includes('METRO-E'));
  await customer.click();const table=page.getByRole('table',{name:'Layanan PT ANTEN'});assert.equal(await table.locator('tbody tr').count(),2);assert.ok(await table.getByText('METRO-E',{exact:true}).isVisible());assert.ok(await table.getByText('IPT',{exact:true}).isVisible());assert.ok(await table.getByText('CID belum tertaut',{exact:true}).isVisible());assert.ok(!(await inventory.innerText()).includes('#120'));assert.ok(await table.getByText('100 Mbps',{exact:true}).isVisible());
  if(process.env.NOC_UI_SCREENSHOT)await page.screenshot({path:process.env.NOC_UI_SCREENSHOT,fullPage:true});
  const search=page.getByLabel('Cari customer, CID, layanan, atau tipe layanan');await search.fill('SAP-C-1243-0009');assert.equal(await inventory.getByRole('button').count(),1);assert.ok(await page.getByRole('table',{name:'Layanan PT OTHER'}).isVisible(),'Same SAP number segment does not merge customers');
  await search.fill('PT ANTEN');assert.equal(await page.getByRole('table',{name:'Layanan PT ANTEN'}).locator('tbody tr').count(),2);
  await search.fill('IPT');assert.equal(await page.getByRole('table',{name:'Layanan PT ANTEN'}).locator('tbody tr').count(),1);
  await search.fill('not found');await page.getByText('Tidak ada customer atau layanan yang cocok.',{exact:true}).waitFor();await search.fill('');
  await inventory.getByRole('button',{name:/Tanpa layanan/}).click();await page.getByText('Belum ada layanan terdaftar untuk customer ini.',{exact:true}).waitFor();
  await page.goto(base+'/#sap-circuits');await page.getByRole('region',{name:'CID SAP dari tiket'}).waitFor();assert.equal(await page.getByRole('region',{name:'Layanan per customer'}).count(),0);
  await page.getByRole('button',{name:/Customer & Layanan/}).click();await inventory.waitFor();assert.equal(new URL(page.url()).hash,'');
  await page.setViewportSize({width:320,height:900});await inventory.getByRole('button',{name:/PT ANTEN/}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Inventory fits 320px with local table scrolling');assert.deepEqual(errors,[]);
  console.log('PASS: real Assets customer grouping, per-service products/CIDs/capacity/history, no database IDs as CID, search, no-CID and empty states, SAP hash navigation, mobile width. Synthetic data only.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1});
