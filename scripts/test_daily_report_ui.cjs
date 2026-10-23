const assert=require('node:assert/strict'),path=require('node:path'),http=require('node:http'),esbuild=require('esbuild'),{chromium}=require('playwright');
async function main(){
 const root=path.resolve(__dirname,'..'),posts=[];
 const built=await esbuild.build({stdin:{contents:"import React from 'react';import{createRoot}from'react-dom/client';import Daily from './app/reports/daily/DailyReportClient';createRoot(document.getElementById('app')).render(<Daily currentUserId={1} initialMonth='2026-10' initialDate='2026-10-23'/>);",resolveDir:root,loader:'jsx'},outdir:'out',bundle:true,write:false,loader:{'.js':'jsx'},jsx:'automatic',alias:{'@':root}});
 const js=built.outputFiles.find(f=>f.path.endsWith('.js')).text,css=built.outputFiles.find(f=>f.path.endsWith('.css')).text;
 const server=http.createServer((req,res)=>{
 if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(js);}
 if(req.url.startsWith('/api/reports')){res.setHeader('Content-Type','application/json');if(req.method==='POST'){let b='';req.on('data',x=>b+=x);req.on('end',()=>{posts.push(JSON.parse(b));res.end('{"id":1}');});return;}return res.end(JSON.stringify({reports:[],activities:[{id:3,source:'phase',label:'Verifikasi selesai',ticketId:9}],users:[{id:1,name:'Operator A'},{id:2,name:'Operator B'}],userId:1,month:'2026-10'}));}
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="id"><title>Daily report QA</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:14px Arial;margin:12px}*{box-sizing:border-box}'+css+'</style><div id="app"></div><script src="/app.js"></script></html>');
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({channel:'chrome',headless:true});const p=await browser.newPage();await p.goto('http://127.0.0.1:'+server.address().port);await p.getByRole('link',{name:'Lihat tiket',exact:true}).waitFor();
 await p.getByRole('button',{name:'Tambah pekerjaan di luar tiket'}).click();await p.getByLabel('Pekerjaan 1',{exact:true}).fill('Periksa monitoring');await p.getByLabel('Hasil 1',{exact:true}).fill('Normal');await p.getByRole('button',{name:'Kirim laporan',exact:true}).click();await p.getByRole('status').getByText('Laporan terkirim ke arsip bulanan.').waitFor();assert.equal(posts[0].activityRefs[0].source,'phase');assert.equal(posts[0].manualItems[0].result,'Normal');assert.equal(posts[0].revision,0);
 await p.getByLabel('Pelapor',{exact:false}).selectOption('2');await p.getByRole('link',{name:'Lihat tiket',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'Kirim laporan',exact:true}).count(),0);
 await p.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 const axeResult=await p.evaluate(async()=>window.axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));assert.deepEqual(axeResult.violations.map(v=>v.id),[]);
 await p.setViewportSize({width:320,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));console.log('PASS real DailyReport manual input, source references, submit, readonly team and320px.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
