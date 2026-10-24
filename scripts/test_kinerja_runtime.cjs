const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{chromium}=require('playwright'),axe=require('axe-core');
(async()=>{const dir=path.join(process.cwd(),'.superpowers/sdd/2026-10-24-unified-performance'),sessions=JSON.parse(fs.readFileSync(path.join(dir,'qa-sessions.json'))),base='http://127.0.0.1:3318';
const browser=await chromium.launch({executablePath:'C:/Users/hendr/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe',headless:true});
try{const contexts={};for(const name of ['staff','manager','other','excluded']){const c=await browser.newContext();await c.addCookies([{name:'next-auth.session-token',value:sessions[name],url:base,httpOnly:true}]);contexts[name]=c;}
const get=async(name,url)=>contexts[name].request.get(base+url),url='/api/reports/kinerja/me?month=2026-10';
const me=await get('staff',url);assert.equal(me.status(),200);const body=await me.json();assert.equal(body.ranking.rank,1);assert.equal(body.ranking.rankedCount,3);assert.equal(body.ranking.tied,true);assert.equal('ranks' in body.ranking,false);
assert.equal((await get('staff',`/api/reports/kinerja/users/${sessions.ids.peer}?month=2026-10`)).status(),403);
assert.equal((await get('manager',`/api/reports/kinerja/users/${sessions.ids.peer}?month=2026-10`)).status(),200);
assert.equal((await get('manager',`/api/reports/kinerja/users/${sessions.ids.other}?month=2026-10`)).status(),403);
const overview=await (await get('staff','/api/reports/kinerja/overview?month=2026-10')).json();assert.deepEqual(overview.rows.map(r=>r.userId),[sessions.ids.staff]);
const excluded=await (await get('excluded',url)).json();assert.equal(excluded.evaluation.status,'excluded');assert.equal(excluded.ranking.rank,null);
assert.equal((await get('staff','/api/reports/kinerja/me?month=bad')).status(),400);
assert.equal((await contexts.staff.request.post(base+'/api/reports/kinerja/activity-review?month=2026-10',{data:{id:1,decision:'accepted',reason:'QA'}})).status(),403);
const anon=await browser.newContext();assert.equal((await anon.request.get(base+url)).status(),401);await anon.close();
const page=await contexts.staff.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/reports?month=2026-10');await page.getByRole('heading',{name:'[QA] Staff A'}).waitFor();await page.getByText('1 dari 3',{exact:false}).first().waitFor();
for(const theme of ['light','dark'])for(const width of [320,1440]){await page.evaluate(t=>document.documentElement.setAttribute('data-theme',t),theme);await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),theme+'/'+width);await page.addScriptTag({content:axe.source});const a=await page.evaluate(()=>axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.deepEqual(a.violations.map(v=>v.id),[]);await page.screenshot({path:path.join(dir,`runtime-${theme}-${width}.png`),fullPage:true});}
await page.getByRole('button',{name:'Aktivitas & Poin',exact:true}).click();await page.getByRole('heading',{name:'Aktivitas & Poin'}).waitFor();
await page.getByRole('link',{name:'Isi laporan harian',exact:true}).click();await page.waitForURL('**/reports/daily');assert.deepEqual(errors,[]);
fs.writeFileSync(path.join(dir,'runtime-receipt.json'),JSON.stringify({passed:true,checks:['staff score/rank/tie','private ranking payload','staff IDOR403','manager grant200','cross company403','self overview only','excluded no rank','invalid month400','staff review403','anonymous401','real light/dark 320/1440 axe','activity tab','no console errors']},null,2));console.log('PASS actual QA runtime: private rank, role/company authorization, 4 render/axe states, activity tab, no client errors');
}finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
