import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationFor, activeSection, activeItem } from './model.js';
test('main navigation groups operational pages and preserves permission boundaries',()=>{
 const staff=navigationFor({id:1,role:'Staff',permissions:[]});
 assert.deepEqual(staff.map(x=>x.label),['Dashboard','Tiket','Customer & Layanan','Tim','Laporan','Knowledge']);
 assert.deepEqual(staff.find(x=>x.id==='reports').items.map(x=>x.href),['/reports','/reports/daily']);
 const admin=navigationFor({role:'Admin'});assert.equal(admin.length,7);
 for(const href of ['/team','/team/schedules','/meetings','/settings/trouble-masters','/settings/service-work-types','/settings/workflows','/settings/evaluation','/settings'])assert.ok(admin.flatMap(x=>x.items).some(x=>x.href===href),href);
 const manager=navigationFor({role:'Manager'});assert.ok(manager.find(x=>x.id==='reports').items.some(x=>x.href==='/reports/ops'));assert.ok(!manager.some(x=>x.id==='settings'));
});
test('nested routes have one active parent and one exact contextual link',()=>{
 const nav=navigationFor({role:'Admin'});
 assert.equal(activeSection('/team/schedules'), 'team');assert.equal(activeSection('/tickets/11952'),'tickets');
 const reports=nav.find(x=>x.id==='reports').items;
 assert.equal(reports.filter(x=>activeItem(x,'/reports/ops',new URLSearchParams())).length,1);
 const tickets=nav.find(x=>x.id==='tickets').items;
 assert.equal(tickets.filter(x=>activeItem(x,'/tickets',new URLSearchParams('workType=Trouble'))).length,1);
 assert.equal(tickets.find(x=>activeItem(x,'/tickets',new URLSearchParams('view=installation'))).label,'Instalasi');
 assert.equal(tickets.find(x=>activeItem(x,'/tickets',new URLSearchParams('workType=Installation'))).label,'Instalasi');
 assert.equal(tickets.find(x=>activeItem(x,'/tickets/new',new URLSearchParams('workType=ServiceWork&operation=Installation'))).label,'Instalasi');
});
