const assert=require('node:assert/strict');
const path=require('node:path');
const http=require('node:http');
const esbuild=require('esbuild');
const {chromium}=require('playwright');
async function main(){
 const root=path.resolve(__dirname,'..');
 const service={id:7,cid:'ABC-001',name:'Kantor',customer:{name:'PT ABC'},templateId:1,customData:{bandwidthMbps:100}};
 const ticket={id:11,trackingId:'HSK-FIXTURE',title:'Upgrade ABC-001',description:'Upgrade request',workType:'ServiceWork',serviceWorkTypeId:1,serviceWorkTypeLabel:'Upgrade',status:'New',priority:'Medium',departmentId:1,assigneeId:1,jobCategoryId:4,jobCategory:{id:4,name:'Upgrade work'},customData:{},createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z',historyLogs:[{actorId:1,action:'Ticket created',createdAt:'2026-10-01T00:00:00Z',actor:{name:'Operator'}}],comments:[],attachments:[],notes:[],watchers:[],services:[service],serviceChange:{before:{serviceId:7,cid:'ABC-001',templateId:1,templateName:'IPT',bandwidthMbps:100,status:'Active',customData:{}},after:{templateId:1,templateName:'IPT',bandwidthMbps:200,status:'Active',customData:{bandwidthMbps:200}},effectiveDate:'2026-10-22',operation:'Upgrade',appliedAt:null}};
 const props={ticket,departments:[{id:1,name:'NOC'}],users:[{id:1,name:'Operator'}],jobCategories:[{id:4,name:'Upgrade work',score:5}],customFields:[],canModifyTicket:true,currentUser:{id:1,name:'Operator',role:'Admin',department:'NOC',permissions:[]},services:[service],serviceTemplates:[{id:1,name:'IPT',fields:[],active:true}]};
 const built=await esbuild.build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Client from './app/tickets/[id]/TicketDetailClient';const p=${JSON.stringify(props)};if(location.search.includes('applied')){p.ticket.serviceChange.appliedAt='2026-10-22T00:00:00Z';p.ticket.status='Resolved';}createRoot(document.getElementById('app')).render(<Client {...p}/>);`,resolveDir:root,loader:'jsx'},bundle:true,write:false,outdir:'out',loader:{'.js':'jsx'},jsx:'automatic',alias:{'@':root},plugins:[{name:'fixture',setup(build){build.onResolve({filter:/^(next\/navigation|react-hot-toast|node:crypto)$/},args=>({path:args.path,namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='node:crypto'?'export function createHash(){return {update(){return this},digest(){return "fixture-hash"}}}':args.path==='next/navigation'?'export const useRouter=()=>({push(){},refresh(){}});':'const report=m=>{window.messages=(window.messages||[]).concat(m)};export default {error:report,success:report};',loader:'js'}));}}]});
 const posts=[];let reject=false;
 const server=http.createServer((req,res)=>{
  if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(built.outputFiles.find(f=>f.path.endsWith('.js')).text);return;}
  res.setHeader('Content-Type','application/json');
  if(req.method==='PATCH'){let body='';req.on('data',b=>body+=b);req.on('end',()=>{posts.push(JSON.parse(body));res.statusCode=reject?409:200;res.end(JSON.stringify(reject?{error:'Inventory telah berubah'}:ticket));});return;}
  if(req.url.startsWith('/api/')){res.end('[]');return;}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="id"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div><script src="/app.js"></script></html>');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const base=`http://127.0.0.1:${server.address().port}`;
  await page.goto(base);await page.getByRole('region',{name:'Ringkasan pekerjaan layanan'}).waitFor();
  const status=()=>page.locator('select').filter({has:page.locator('option[value="Resolved"]')});
  await status().selectOption('Resolved');
  const resolveDialog=page.getByRole('dialog',{name:'Konfirmasi penyelesaian pekerjaan'});
  await resolveDialog.waitFor();assert.equal(posts.length,0,'Resolve waits for completion evidence');
  assert.ok((await resolveDialog.innerText()).includes('100 → 200 Mbps'));
  await page.locator('#resolve-finished-at').fill('2026-10-22');
  await page.locator('#resolve-evidence').fill('BA 2026-10-22 https://drive.example/ba');
  await page.getByRole('checkbox').check();
  let response=page.waitForResponse(r=>r.request().method()==='PATCH');
  await page.getByRole('button',{name:'Konfirmasi & Resolve'}).click();await response;
  assert.deepEqual(posts.at(-1),{status:'Resolved',completion:{confirmed:true,finishedAt:'2026-10-22',evidence:'BA 2026-10-22 https://drive.example/ba'}},'Resolve sends completion evidence, not the snapshot');
  await page.goto(base);reject=true;await status().selectOption('Resolved');await resolveDialog.waitFor();
  await page.locator('#resolve-finished-at').fill('2026-10-22');await page.locator('#resolve-evidence').fill('BA https://drive.example/ba');await page.getByRole('checkbox').check();
  response=page.waitForResponse(r=>r.request().method()==='PATCH');
  await page.getByRole('button',{name:'Konfirmasi & Resolve'}).click();await response;await page.waitForFunction(()=>window.messages?.includes('Inventory telah berubah'));assert.equal(await status().inputValue(),'New','Failed status is restored');
  reject=false;await page.goto(base+'?applied');await page.getByRole('button',{name:/Edit$/}).click();assert.equal(await page.getByLabel('Jenis pekerjaan',{exact:true}).count(),0,'Applied request cannot be reclassified in edit');
  response=page.waitForResponse(r=>r.request().method()==='PATCH');await page.getByRole('button',{name:'Save Changes',exact:true}).click();await response;
  for(const key of ['workType','serviceIds','serviceWorkTypeId','serviceChange']) assert.equal(posts.at(-1)[key],undefined,`Applied edit omits ${key}`);
  assert.deepEqual(errors,[]);console.log('PASS: real detail summary, Resolve evidence dialog (date/evidence/confirmation), evidence-only payload, conflict feedback + restored status, and applied payload excluded from ordinary edits. Synthetic API only.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1});
