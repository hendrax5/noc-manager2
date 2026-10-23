const assert=require('node:assert/strict'),path=require('node:path'),http=require('node:http'),esbuild=require('esbuild'),{chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),posts=[];
 const result=await esbuild.build({stdin:{contents:"import React from 'react';import{createRoot}from'react-dom/client';import Settings from './app/settings/workflows/WorkflowPolicyClient';import Panel from './components/tickets/WorkPhasePanel';createRoot(document.getElementById('root')).render(<><Settings categories={[{id:7,name:'Investigasi',score:5}]} companies={['ION','SDC']}/><Panel ticketId={2}/></>);",resolveDir:root,loader:'jsx'},bundle:true,write:false,loader:{'.js':'jsx'},jsx:'automatic'});
 const server=http.createServer((req,res)=>{
 if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(result.outputFiles[0].text);}
 if(req.url.startsWith('/api/')){res.setHeader('Content-Type','application/json');if(req.method==='POST'){let data='';req.on('data',x=>data+=x);req.on('end',()=>{posts.push(JSON.parse(data));res.end('{"id":1}');});return;}return res.end(req.url.includes('/workflow')&&!req.url.endsWith('workflows')?JSON.stringify([{id:1,state:'Active',definition:{label:'Investigasi'},categorySnapshot:{name:'Investigasi'}}]):'[]');}
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="id"><title>Workflow QA</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{font:14px Arial;margin:12px}input,select,textarea{max-width:100%;display:block}button{min-height:44px}fieldset{min-width:0}table{width:100%}</style><div id="root"></div><script src="/app.js"></script></html>');
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
 await page.getByLabel('Nama aturan',{exact:true}).fill('NOC Trouble');await page.getByLabel('Berlaku mulai').fill('2026-11-01');await page.getByLabel('Job Category',{exact:true}).selectOption('7');await page.getByLabel('Order Origin',{exact:true}).selectOption('ION');await page.getByLabel('Executing Vendor',{exact:true}).selectOption('SDC');
 await page.getByRole('button',{name:'Tambah fase',exact:true}).click();await page.getByLabel('Nama fase',{exact:true}).nth(1).fill('Verifikasi');await page.getByLabel('Job Category',{exact:true}).nth(1).selectOption('7');
 await page.getByRole('button',{name:'Publikasikan aturan'}).click();await page.waitForFunction(()=>true);await page.waitForTimeout(100);
 assert.equal(posts[0].publish,true);assert.equal(posts[0].phases.length,2);assert.equal(posts[0].executorCompany,'SDC');
 assert.ok(await page.getByRole('region',{name:'Fase pekerjaan'}).isVisible());
 await page.setViewportSize({width:320,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('PASS workflow settings preview, routing tuple, phase categories/publish payload, phase panel and320px; synthetic API.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
