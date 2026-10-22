// Real ticket form and summary, synthetic API data, no production writes.
const assert=require('node:assert/strict');
const path=require('node:path');
const http=require('node:http');
const fs=require('node:fs');
const esbuild=require('esbuild');
const {chromium}=require('playwright');
async function main(){
 const root=path.resolve(__dirname,'..');
 const services=[{id:7,cid:'ABC-001',name:'Kantor Jakarta',templateId:1,customData:{bandwidthMbps:100},status:'Active',customer:{name:'PT ABC'}},{id:8,cid:'ABC-002',name:'Kantor Bandung',templateId:1,customData:{bandwidthMbps:50},status:'Active',customer:{name:'PT ABC'}}];
 const templates=[{id:1,name:'IPT',active:true,fields:[]},{id:2,name:'METRO-E',active:true,fields:[{name:'Region',type:'select',options:['JKT','BDG'],required:true}]}];
 const types=[{id:1,name:'Upgrade',operation:'Upgrade',defaultJobCategoryId:4},{id:2,name:'Downgrade',operation:'Downgrade',defaultJobCategoryId:4},{id:3,name:'Perubahan Layanan',operation:'Change',defaultJobCategoryId:5},{id:4,name:'Terminasi',operation:'Terminate',defaultJobCategoryId:5}];
 const props={departments:[{id:1,name:'NOC'}],categories:[{id:4,name:'Upgrade category',score:5},{id:5,name:'Change category',score:6}],users:[],customFields:[],services,serviceTemplates:templates,initialServiceId:7,defaultWorkType:'ServiceWork'};
 const snapshot={workType:'ServiceWork',serviceWorkTypeLabel:'Upgrade',serviceChange:{before:{cid:'ABC-001',templateName:'IPT',bandwidthMbps:100,status:'Active'},after:{templateName:'IPT',bandwidthMbps:200,status:'Active'},effectiveDate:'2026-10-22',reason:'Requested upgrade'}};
 const built=await esbuild.build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Form from './app/tickets/new/TicketForm';import Summary from './components/ServiceWorkSummary';createRoot(document.getElementById('app')).render(location.search.includes('summary')?<Summary ticket={${JSON.stringify(snapshot)}}/>:<Form {...${JSON.stringify(props)}}/>);`,resolveDir:root,loader:'jsx'},bundle:true,write:false,loader:{'.js':'jsx'},jsx:'automatic',alias:{'@':root},plugins:[{name:'fixtures',setup(build){build.onResolve({filter:/^(next\/navigation|react-hot-toast)$/},args=>({path:args.path,namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='next/navigation'?'export const useRouter=()=>({push(){},refresh(){}});':'const report=m=>{window.messages=(window.messages||[]).concat(m)};export default {success:report,error:report};',loader:'js'}));}}]});
 const posts=[];
 const server=http.createServer((req,res)=>{
  if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(built.outputFiles[0].text);return;}
  res.setHeader('Content-Type','application/json');
  if(req.url==='/api/service-work-types')return res.end(JSON.stringify(types));
  if(req.url==='/api/queues')return res.end('[]');
  if(req.url==='/api/tickets'){let data='';req.on('data',d=>data+=d);req.on('end',()=>{posts.push(JSON.parse(data));res.end('{"id":100}');});return;}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="id"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:16px;font:14px Arial;background:#f4f6f8;color:#3f3f46;--border-color:#d9dee5;--input-bg:white;--input-text:#263238;--hover-bg:#eef2f6;--card-bg:white;--text-color:#3f3f46;--heading-color:#18181b;--radius-sm:6px}input,select,textarea{max-width:100%}button{padding:8px}#app{max-width:1000px;margin:auto}</style><div id="app"></div><script src="/app.js"></script></html>');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1360,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base=`http://127.0.0.1:${server.address().port}`;await page.goto(base);
  assert.equal(await page.getByRole('radio',{name:/ABC-001/}).isChecked(),true,'CID prefilled');
  await page.getByLabel('Jenis pekerjaan layanan *',{exact:true}).selectOption('1');
  assert.equal(await page.getByLabel('Produk/Layanan (tetap)',{exact:true}).inputValue(),'IPT');assert.equal(await page.getByLabel('Produk/Layanan (tetap)',{exact:true}).getAttribute('readonly'),'');assert.equal(await page.getByLabel('Produk/Layanan tujuan *',{exact:true}).count(),0);
  await page.getByLabel('Kapasitas tujuan (Mbps)',{exact:false}).fill('200');await page.getByLabel('Tanggal efektif *',{exact:true}).fill('2026-10-22');
  await page.getByPlaceholder('Describe the issue in detail. Please include any relevant steps to reproduce, server names, or error logs...').fill('Upgrade request');
  assert.equal(await page.getByPlaceholder('Enter a concise summary of the issue...').inputValue(),'Upgrade - ABC-001');
  async function submit(){const response=page.waitForResponse(r=>r.url().endsWith('/api/tickets')&&r.request().method()==='POST');await page.getByRole('button',{name:'Create Support Ticket'}).click();await response;return posts.at(-1);}
  let payload=await submit();assert.equal(payload.jobCategoryId,4);assert.deepEqual(payload.serviceIds,[7]);assert.equal(payload.serviceChange.bandwidthMbps,200);assert.equal(payload.serviceChange.before,undefined);assert.equal(payload.customData.hasDowntime,false);
  await page.getByPlaceholder('-- Select Category --').click();await page.getByText('Change category (+6 pts)',{exact:true}).click();
  await page.getByLabel('Jenis pekerjaan layanan *',{exact:true}).selectOption('2');await page.getByLabel('Kapasitas tujuan (Mbps)',{exact:false}).fill('50');await page.getByLabel('Tanggal efektif *',{exact:true}).fill('2026-10-22');
  assert.equal(await page.getByLabel('Produk/Layanan (tetap)',{exact:true}).inputValue(),'IPT');
  payload=await submit();assert.equal(payload.jobCategoryId,5,'Manual category retained');
  await page.getByRole('radio',{name:/ABC-002/}).check();assert.equal(await page.getByRole('radio',{name:/ABC-001/}).isChecked(),false,'One CID only');
  await page.getByLabel('Jenis pekerjaan layanan *',{exact:true}).selectOption('3');await page.getByLabel('Produk/Layanan tujuan *',{exact:true}).selectOption('2');
  await page.getByLabel('Region *',{exact:true}).selectOption('BDG');await page.getByLabel('Tanggal efektif *',{exact:true}).fill('2026-10-22');
  payload=await submit();assert.deepEqual(payload.serviceIds,[8]);assert.equal(payload.serviceChange.targetTemplateId,2);assert.equal(payload.serviceChange.targetCustomData.Region,'BDG');
  await page.getByLabel('Jenis pekerjaan layanan *',{exact:true}).selectOption('4');assert.equal(await page.getByLabel('Kapasitas tujuan (Mbps)',{exact:false}).count(),0);
  await page.getByLabel('Alasan terminasi *',{exact:true}).fill('Contract ended');await page.getByLabel('Tanggal efektif *',{exact:true}).fill('2026-10-22');
  payload=await submit();assert.equal(payload.serviceChange.reason,'Contract ended');assert.equal(payload.serviceChange.bandwidthMbps,undefined);
  const artifact=process.env.SERVICE_WORK_QA_DIR || path.join(require('node:os').tmpdir(),'noc-service-work-qa');fs.mkdirSync(artifact,{recursive:true});
  await page.screenshot({path:path.join(artifact,'service-work-desktop.png'),fullPage:true});
  await page.setViewportSize({width:320,height:960});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Form fits 320px');await page.screenshot({path:path.join(artifact,'service-work-mobile.png'),fullPage:true});
  await page.goto(base+'?summary');await page.getByRole('heading',{name:'Upgrade',exact:true}).waitFor();assert.ok((await page.getByRole('table').innerText()).includes('200'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Summary fits 320px');assert.deepEqual(errors,[]);
  console.log('PASS: actual form CID prefill/single selection, Upgrade/Downgrade/product change/Terminate payloads, suggested + manual Job Category, no snapshot leakage, summary and 320px. Screenshots saved in QA output folder. Synthetic API only.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1});
