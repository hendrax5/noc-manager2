const assert=require('node:assert/strict'),{PrismaClient}=require('@prisma/client');
(async()=>{const db=new PrismaClient();try{
 if(process.env.KINERJA_QA!=='1')throw Error('Requires isolated QA database and KINERJA_QA=1');
 const {recordActivity}=await import('../lib/activity/recordActivity.js');
 const baseline=await db.activityEvent.count(),key='qa-activity-'+Date.now();
 await db.$transaction(async tx=>{await tx.appSetting.upsert({where:{key:'workflow_reporting_flags'},create:{key:'workflow_reporting_flags',value:'{"performance_activity_capture":true}'},update:{value:'{"performance_activity_capture":true}'}});const event={actorId:null,source:'system',type:'qa.changed',entityType:'qa',entityId:1,idempotencyKey:key,before:{name:'Before'},after:{name:'After'}};await recordActivity(tx,event);await recordActivity(tx,event);assert.equal(await tx.activityEvent.count({where:{idempotencyKey:key}}),1);assert.equal(await recordActivity(tx,{...event,before:event.after}),null);throw Error('EXPECTED_ROLLBACK');}).catch(e=>{if(e.message!=='EXPECTED_ROLLBACK')throw e;});
 assert.equal(await db.activityEvent.count(),baseline);console.log('PASS database transaction rollback, no-op, idempotency; QA baseline preserved');
 }finally{await db.$disconnect();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
