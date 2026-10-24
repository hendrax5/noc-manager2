const assert=require('node:assert/strict');
const path=require('node:path');
const http=require('node:http');
const esbuild=require('esbuild');
const {chromium}=require('playwright');

async function main(){
  const root=path.resolve(__dirname,'..');
  const built=await esbuild.build({stdin:{contents:"import React from 'react';import{createRoot}from'react-dom/client';import Client from './app/settings/trouble-masters/TroubleMastersClient';createRoot(document.getElementById('app')).render(<Client/>);",resolveDir:root,sourcefile:'master-fixture.jsx',loader:'jsx'},bundle:true,write:false,outdir:'out',loader:{'.js':'jsx'},jsx:'automatic'});
  const js=built.outputFiles.find(x=>x.path.endsWith('.js')).text,css=built.outputFiles.find(x=>x.path.endsWith('.css')).text;
  const rows=[{id:1,kind:'symptom',name:'Down',description:'No connection',sortOrder:0,active:true,usageCount:3},{id:2,kind:'cause',name:'FO CUT',description:'Cable cut',sortOrder:0,active:true,usageCount:0}];
  const server=http.createServer(async(req,res)=>{
    if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(js);return;}
    if(req.url.startsWith('/api/trouble-masters')){
      res.setHeader('Content-Type','application/json');
      const id=Number(req.url.split('/').pop());
      if(req.method==='GET'){res.end(JSON.stringify(rows));return;}
      if(req.method==='DELETE'){const row=rows.find(x=>x.id===id);if(!row){res.statusCode=404;res.end(JSON.stringify({error:'Master tidak ditemukan.'}));return;}if(row.usageCount>0){res.statusCode=409;res.end(JSON.stringify({error:`Master ini dipakai ${row.usageCount} tiket dan tidak dapat dihapus.`,usageCount:row.usageCount}));return;}rows.splice(rows.indexOf(row),1);res.end(JSON.stringify({deleted:true,id}));return;}
      let text='';for await(const part of req)text+=part;const body=JSON.parse(text||'{}');
      if(rows.some(row=>row.id!==id&&row.kind===body.kind&&row.name&&row.name.trim().toLowerCase()===body.name.trim().toLowerCase())){res.statusCode=409;res.end(JSON.stringify({error:'Nama sudah digunakan pada jenis master ini.'}));return;}
      if(req.method==='PATCH'){const existing=rows.find(x=>x.id===id);if(!existing){res.statusCode=404;res.end(JSON.stringify({error:'Master tidak ditemukan.'}));return;}Object.assign(existing,body);res.end(JSON.stringify(existing));return;}
      const row={...body,id:rows.length+1,usageCount:0};rows.push(row);res.statusCode=201;res.end(JSON.stringify(row));return;
    }
    res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="id"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--card-bg:#fff;--text-color:#222;--heading-color:#111;--muted-text:#555;--input-bg:#fff;--input-text:#222;--border-color:#ccc;--secondary-color:#14645f;--accent-hover:#0d4d49;--radius-sm:6px;--radius-md:9px;--danger-text:#a22;--danger-bg:#fee;--ui-success:#176043;--ui-success-bg:#e2f3eb;--ui-danger:#b42332;--ui-danger-bg:#fff0f1;--ui-subtle:#f6f7f8;--ui-accent:#14645f;--ui-on-accent:#fff;--ui-tint:#eaf6f4;--ui-surface:#fff;--ui-ink:#111;--ui-text:#222;--ui-muted:#555;--ui-line:#ccc;--ui-control-line:#aaa;--ui-control-height:2.75rem;--ui-speed:150ms;--ui-space-1:.25rem;--ui-space-2:.5rem;--ui-space-3:.75rem;--ui-space-4:1rem;--ui-space-5:1.25rem;--ui-space-6:1.5rem;--ui-space-8:2rem;--ui-type-xs:.6875rem;--ui-type-sm:.75rem;--ui-type-meta:.8125rem;--ui-type-body:.875rem;--ui-type-section:1rem;--ui-type-subtitle:1.125rem;--ui-mono:monospace;--ui-shadow:0 6px 16px rgb(0 0 0 / .12);--ui-overlay:rgb(13 32 43 / .6);--hover-bg:#f5f5f5}body{font:14px Arial;margin:16px}*{box-sizing:border-box} ${css}</style><h1>Master Data Trouble</h1><main id="app"></main><script src="/app.js"></script></html>`);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{browser=await chromium.launch({headless:true,channel:'chrome'});const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);

    // Create: the form must open as a dialog inside the viewport, not below the table.
    await page.getByRole('button',{name:'Tambah Gejala',exact:true}).click();
    const dialog=page.getByRole('dialog');await dialog.waitFor();
    const box=await dialog.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=1000,'dialog fits the viewport');
    await page.getByLabel('Nama',{exact:true}).fill('Gejala baru');await page.getByLabel('Deskripsi (opsional)',{exact:true}).fill('Deskripsi uji');await page.getByRole('button',{name:'Simpan',exact:true}).click();
    await page.getByRole('row').filter({hasText:'Gejala baru'}).waitFor();assert.equal(await dialog.isVisible(),false);

    // Duplicate names are rejected in place, inside the open dialog.
    await page.getByRole('button',{name:'Tambah Gejala',exact:true}).click();await page.getByLabel('Nama',{exact:true}).fill('GEJALA BARU');await page.getByRole('button',{name:'Simpan',exact:true}).click();
    assert.ok((await dialog.getByRole('alert').innerText()).includes('sudah dipakai'));await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});

    // Edit + status switch (no dialog needed to activate or deactivate).
    const row=page.getByRole('row').filter({hasText:'Gejala baru'});await row.getByRole('button',{name:'Edit Gejala baru',exact:true}).click();await page.getByLabel('Nama',{exact:true}).fill('Gejala diperbarui');await page.getByRole('button',{name:'Simpan',exact:true}).click();await page.getByRole('row').filter({hasText:'Gejala diperbarui'}).waitFor();
    const updated=page.getByRole('row').filter({hasText:'Gejala diperbarui'});await updated.getByRole('switch',{name:/Gejala diperbarui/}).click();
    await page.waitForFunction(()=>document.body.innerText.includes('Nonaktif'));assert.equal(rows.find(x=>x.name==='Gejala diperbarui').active,false);

    // Kind switch, search, and the filtered empty state.
    await page.getByRole('button',{name:/^Penyebab/}).click();assert.equal(await page.getByRole('row').filter({hasText:'FO CUT'}).count(),1);
    await page.getByLabel('Cari Penyebab',{exact:true}).fill('unknown');assert.equal(await page.locator('tbody tr').count(),0);await page.getByRole('button',{name:'Bersihkan pencarian',exact:true}).click();

    // Delete: an unused master can be removed after confirmation; a used one explains why not.
    await page.getByRole('button',{name:'Hapus FO CUT',exact:true}).click();await dialog.waitFor();await page.getByRole('button',{name:'Hapus permanen',exact:true}).click();await page.getByRole('row').filter({hasText:'FO CUT'}).waitFor({state:'detached'});
    await page.getByRole('button',{name:/^Gejala/}).click();await page.getByRole('button',{name:'Hapus Down',exact:true}).click();await dialog.waitFor();assert.ok((await dialog.innerText()).includes('Tidak bisa dihapus'));await page.getByRole('button',{name:'Tutup',exact:true}).click();await dialog.waitFor({state:'hidden'});

    // Narrow layout: no horizontal overflow and every control keeps a 44px target.
    await page.setViewportSize({width:320,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const short=await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length&&b.getBoundingClientRect().height<43.5).map(b=>b.textContent.trim()));
    assert.deepEqual(short,[]);
    assert.deepEqual(errors,[]);
    console.log('PASS: dialog create, inline duplicate feedback, edit, status switch, kind tabs, search empty state, confirmed delete, used-master guard, 320px layout and 44px targets. Synthetic API state only.');
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1});
