import test from 'node:test';import assert from 'node:assert/strict';
import {assertIntegrationWorkflowUpdate} from './integrationGuard.js';
test('integration cannot skip active phases or rewrite routing, unrelated priority remains allowed',async()=>{
 const tx={ticketPhaseExecution:{findMany:async()=>[{state:'Active'}]}},ticket={id:1,purpose:'Work',customData:{'Order Origin':'ION','Executing Vendor':'SDC'}};
 await assert.rejects(assertIntegrationWorkflowUpdate(tx,ticket,{status:'Resolved'}),/fase/i);
 await assert.rejects(assertIntegrationWorkflowUpdate(tx,ticket,{customData:{'Order Origin':'SDC'}}),/routing/i);
 await assertIntegrationWorkflowUpdate(tx,ticket,{priority:'High'});
 await assert.rejects(assertIntegrationWorkflowUpdate(tx,{...ticket,purpose:'PersonalMonthlyReport'},{priority:'High'}),/arsip/i);
});
