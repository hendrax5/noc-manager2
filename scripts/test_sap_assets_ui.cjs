const assert=require('node:assert/strict'),path=require('node:path'),http=require('node:http');
const esbuild=require('esbuild'),{chromium}=require('playwright');
async function main(){
 const root=path.resolve(__dirname,'..');
 const built=await esbuild.build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Panel from './app/assets/SapCircuitsClient';createRoot(document.getElementById('app')).render(<Panel customers={[{id:9,name:'PT ABC'},{id:10,name:'PT Other'}]} services={[{id:77,cid:'SAP-C-1243-0003',customerId:9,name:'Office existing',template:{name:'METRO-E'}}]} templates={[{id:8,name:'IPT',active:true},{id:7,name:'Old product',active:false}]} onMapped={()=>window.mapped=true} onCreateCustomer={()=>window.addCustomer=true} onManageProducts={()=>window.products=true}/>);`,resolveDir:root,loader:'jsx'},bundle:true,write:false,outdir:'out',loader:{'.js':'jsx'},jsx:'automatic',alias:{'@':root},plugins:[{name:'fixture',setup(build){build.onResolve({filter:/^next\/link$/},args=>({path:args.path,namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'import React from "react";export default function Link(props){return <a {...props}/>}',loader:'jsx',resolveDir:root}));}}]});
 const js=built.outputFiles.find(file=>file.path.endsWith('.js')).text,css=built.outputFiles.find(file=>file.path.endsWith('.css')).text;
 const row={cid:'SAP-C-1243-0003',sourceName:'PT ABC - Link Kantor',sourceNames:['PT ABC - Link Kantor'],ticketCount:2,tickets:[{id:1,trackingId:'HSK-1'}],status:'needs_mapping',serviceId:null};let fail=true;const writes=[];
 const server=http.createServer((req,res)=>{
  if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(js);}
  res.setHeader('Content-Type','application/json');
  if(req.url.startsWith('/api/assets/circuit-candidates')){
   if(req.method==='POST'){let body='';req.on('data',d=>body+=d);req.on('end',()=>{writes.push(JSON.parse(body));if(fail){res.statusCode=409;res.end('{"error":"CID sudah terdaftar. Muat ulang daftar."}');}else{row.status='linked';row.serviceId=11;res.statusCode=201;res.end(JSON.stringify({cid:row.cid,serviceId:11,created:true,linkedTickets:2}));}});return;}
   const query=new URL(req.url,'http://localhost').searchParams;const match=!query.get('q')||`${row.cid} ${row.sourceName}`.toLowerCase().includes(query.get('q').toLowerCase());const shown=match&&(query.get('status')==='all'||row.status!=='linked');return res.end(JSON.stringify({items:shown?Array.from({length:25},(_,i)=>i===0?row:{...row,cid:`SAP-C-9999-${String(i).padStart(4,"0")}`}):[],page:1,pageSize:25,total:shown?1:0,summary:{circuits:1,needsMapping:row.status==='linked'?0:1,linked:row.status==='linked'?1:0,conflicts:0}}));
  }
  res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="id"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:12px;font:14px Arial;--border-color:#ddd;--card-bg:#fff;--input-bg:white;--input-text:#222}${css}</style><div id="app"></div><script src="/app.js"></script></html>`);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('button',{name:'Tautkan customer & layanan',exact:true}).first().click();assert.equal(await page.getByLabel('Customer *',{exact:true}).inputValue(),'','Owner must not be inferred from SAP sequence or prose');
  assert.ok(await page.getByRole('form',{name:'Tautkan SAP-C-1243-0003',exact:true}).evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.top<innerHeight;}),'Mapping form must enter viewport after action on a long list');
  assert.equal(await page.getByLabel('Layanan milik customer *',{exact:true}).inputValue(),'');
  await page.getByLabel('Customer *',{exact:true}).selectOption('9');await page.getByLabel('Layanan milik customer *',{exact:true}).selectOption('new');await page.getByLabel('Produk/Layanan *',{exact:true}).selectOption('8');await page.getByRole('button',{name:'Simpan CID & tautkan tiket',exact:true}).click();await page.getByRole('alert').filter({hasText:'CID sudah terdaftar'}).waitFor();
  fail=false;await page.getByRole('button',{name:'Simpan CID & tautkan tiket',exact:true}).click();await page.getByRole('link',{name:'Buat Trouble untuk CID ini',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'Buat Trouble untuk CID ini',exact:true}).getAttribute('href'),'/tickets/new?workType=Trouble&serviceId=11');assert.equal(writes.at(-1).customerId,9);assert.equal(writes.at(-1).templateId,8);assert.equal(writes.at(-1).cid,row.cid);
  row.status='needs_mapping';row.serviceId=null;await page.reload();await page.getByRole('button',{name:'Tautkan customer & layanan',exact:true}).first().click();
  await page.getByLabel('Customer *',{exact:true}).selectOption('10');assert.equal(await page.getByLabel('Layanan milik customer *',{exact:true}).locator('option[value="77"]').count(),0);
  await page.getByLabel('Customer *',{exact:true}).selectOption('9');await page.getByLabel('Layanan milik customer *',{exact:true}).selectOption('77');
  assert.equal(await page.getByLabel('Produk/Layanan *',{exact:true}).count(),0,'Existing service retains its product');
  await page.getByRole('button',{name:'Simpan CID & tautkan tiket',exact:true}).click();await page.getByRole('link',{name:'Buat Trouble untuk CID ini',exact:true}).waitFor();
  assert.equal(writes.at(-1).existingServiceId,'77');assert.equal(writes.at(-1).customerId,9);assert.equal(writes.at(-1).templateId,undefined);
  row.status='needs_mapping';row.serviceId=null;row.cid='I-0275-021-01';row.needsConfirmation=true;row.reasons=['Klasifikasi perlu konfirmasi'];await page.reload();
  await page.getByLabel('Format kode',{exact:true}).selectOption('I');
  await page.getByRole('button',{name:'Tautkan customer & layanan',exact:true}).first().click();await page.getByLabel('Customer *',{exact:true}).selectOption('9');await page.getByLabel('Layanan milik customer *',{exact:true}).selectOption('77');
  assert.equal(await page.getByRole('checkbox',{name:/Saya sudah memeriksa sumber/}).isChecked(),false);
  assert.equal(await page.getByRole('checkbox',{name:/Saya mengonfirmasi/}).isChecked(),false);
  await page.getByRole('checkbox',{name:/Saya sudah memeriksa sumber/}).check();await page.getByRole('checkbox',{name:/Saya mengonfirmasi/}).check();
  await page.getByRole('button',{name:'Simpan CID & tautkan tiket',exact:true}).click();await page.getByRole('link',{name:'Buat Trouble untuk CID ini',exact:true}).waitFor();
  assert.equal(writes.at(-1).cid,'I-0275-021-01');assert.equal(writes.at(-1).confirmReview,true);assert.equal(writes.at(-1).confirmAlias,true);
  await page.getByLabel('Tampilkan',{exact:true}).selectOption('all');await page.getByRole('link',{name:'Buka Asset',exact:true}).first().waitFor();
  await page.setViewportSize({width:320,height:960});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'SAP panel fits 320px');
  await page.getByLabel('Cari CID atau nama pada tiket',{exact:true}).fill('does not exist');await page.getByRole('button',{name:'Cari',exact:true}).click();await page.getByText('Tidak ada kode layanan yang cocok.',{exact:false}).waitFor();assert.deepEqual(errors,[]);
  console.log('PASS: real SAP Assets panel with explicit owner/product, Pending default, duplicate feedback, create/link, source visibility, Trouble entry, search and 320px. Synthetic API only.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1});
