import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWorkflow, validateWorkflowPolicy, workflowContext } from './policy.js';
const phase = {key:'investigate',label:'Investigasi',jobCategoryId:7,category:{active:true}};
const policy = {id:1,publishedAt:'2026-01-01',effectiveFrom:'2026-01-01',workType:'Trouble',operation:null,phases:[phase]};
const input={workType:'Trouble',originCompany:'ION',executorCompany:'SDC',departmentId:2,roleId:3,at:new Date('2026-10-23')};
test('specific company tuple beats default without inferring from CID/customer',()=>{
 const r=resolveWorkflow({...input,policies:[policy,{...policy,id:2,originCompany:'ION',executorCompany:'SDC'}]});
 assert.equal(r.policyVersionId,2); assert.equal(r.phases[0].jobCategoryId,7);
 assert.equal(resolveWorkflow({...input,policies:[]}),null);
 assert.deepEqual(workflowContext({workType:'ServiceWork',serviceChange:{operation:'Upgrade'},customData:{'Order Origin':'ION','Executing Vendor':'SDC'},departmentId:2}),{workType:'ServiceWork',operation:'Upgrade',originCompany:'ION',executorCompany:'SDC',departmentId:2});
});
test('reject ambiguous policies and inactive categories; use custom master operation',()=>{
 assert.throws(()=>resolveWorkflow({...input,policies:[policy,{...policy,id:2}]}),/ambigu/i);
 assert.throws(()=>resolveWorkflow({...input,policies:[{...policy,phases:[{...phase,category:{active:false}}]}]}),/kategori/i);
 assert.equal(resolveWorkflow({...input,workType:'ServiceWork',operation:'Upgrade',policies:[{...policy,workType:'ServiceWork',operation:'Upgrade'}]}).policyVersionId,1);
});
test('draft, future and mismatching routing are ignored; invalid phase definitions rejected',()=>{
 assert.equal(resolveWorkflow({...input,policies:[{...policy,publishedAt:null},{...policy,id:3,effectiveFrom:'2027-01-01'},{...policy,id:4,executorCompany:'ION'}]}),null);
 assert.throws(()=>validateWorkflowPolicy({...policy,phases:[phase,phase]}),/fase/i);
 assert.throws(()=>validateWorkflowPolicy({...policy,workType:'ServiceWork',operation:'Anything'}),/operasi/i);
 assert.throws(()=>validateWorkflowPolicy({...policy,originCompany:'FAKE'},{companyNames:['ION','SDC']}),/perusahaan/i);
});
