import test from 'node:test';import assert from 'node:assert/strict';
import {recordActivity} from './recordActivity.js';
test('no-op excluded, changes redacted and retries deduplicated',async()=>{
 const rows=new Map(),tx={appSetting:{findUnique:async()=>({value:'{"performance_activity_capture":true}'})},activityEvent:{upsert:async({where,create})=>{if(!rows.has(where.idempotencyKey))rows.set(where.idempotencyKey,create);return rows.get(where.idempotencyKey);}}};
 const args={actorId:1,source:'human',type:'service.updated',entityType:'service',entityId:3,idempotencyKey:'service:3:revision1',before:{name:'A',contactEmail:'private'},after:{name:'B',contactEmail:'secret'}};
 await recordActivity(tx,args);await recordActivity(tx,args);assert.equal(rows.size,1);assert.equal(JSON.stringify([...rows.values()]).includes('secret'),false);
 assert.equal(await recordActivity(tx,{...args,before:args.after}),null);
 await recordActivity(tx,{...args,source:'system',idempotencyKey:'auto:3'});assert.equal(rows.get('auto:3').actorId,null);
});
