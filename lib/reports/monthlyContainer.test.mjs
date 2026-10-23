import test from 'node:test';import assert from 'node:assert/strict';
import {ensureMonthlyContainer} from './monthlyContainer.js';
test('one monthly personal archive, not work/SLA; no creation points',async()=>{
 let stored=null,tickets=[];
 const tx={$queryRaw:async()=>[],monthlyReportContainer:{findUnique:async()=>stored,create:async({data})=>stored=data},user:{findUnique:async()=>({id:1,name:'NOC A',departmentId:2})},ticket:{create:async({data})=>{tickets.push(data);return {id:99};}}};
 await ensureMonthlyContainer(tx,{userId:1,monthKey:'2026-10'});
 await ensureMonthlyContainer(tx,{userId:1,monthKey:'2026-10'});
 assert.equal(tickets.length,1);assert.equal(tickets[0].purpose,'PersonalMonthlyReport');assert.equal(tickets[0].enableSla,false);assert.equal(tickets[0].historyLogs,undefined);
 await assert.rejects(ensureMonthlyContainer(tx,{userId:1,monthKey:'2026-13'}),/bulan/i);
});
