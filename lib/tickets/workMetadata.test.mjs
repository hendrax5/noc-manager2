import test from 'node:test';import assert from 'node:assert/strict';
import {automaticWorkMetadata} from './workMetadata.js';
test('category is server owned; routing only from verified CID metadata; unknown never inferred',async()=>{
 const db={appSetting:{findUnique:async()=>({value:'{"Trouble":6}'})},jobCategory:{findUnique:async()=>({id:6,active:true})},service:{findMany:async()=>[{id:1,customerId:308,customData:{'Order Origin':'ION'}},{id:2,customerId:308,customData:{'Order Origin':'SDC'}}]},employeeAssignmentPeriod:{findMany:async()=>[]}};
 const b=await automaticWorkMetadata(db,{workType:'Trouble',jobCategoryId:99,serviceIds:[1,2],customData:{'Order Origin':'ION','Executing Vendor':'ION'},formVersion:'work-v2'},{companyNames:'ION, SDC'});
 assert.equal(b.jobCategoryId,6);assert.equal(b.customData['Order Origin'],undefined);assert.equal(b.customData['Executing Vendor'],undefined);assert.equal(b.customData.serviceRouting.length,2);assert.equal(b.customData.routingStatus,'mixed');
});
test('service work uses existing master category and score, missing mapping blocks rather than guessed points',async()=>{
 const db={serviceWorkType:{findUnique:async()=>({id:4,defaultJobCategoryId:12})},jobCategory:{findUnique:async()=>({id:12,active:true})},service:{findMany:async()=>[]}};
 assert.equal((await automaticWorkMetadata(db,{workType:'ServiceWork',serviceWorkTypeId:4,serviceIds:[]},{companyNames:'ION'})).jobCategoryId,12);
 await assert.rejects(automaticWorkMetadata({...db,jobCategory:{findUnique:async()=>null}},{workType:'ServiceWork',serviceWorkTypeId:4},{companyNames:'ION'}),/kategori/i);
});
