import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePhaseTransition } from './transition.js';
const policy={phases:[{key:'prepare'},{key:'execute'},{key:'verify'}]};
const actor={id:3,permissions:[]};
test('phase order and assigned actor enforced independently of ticket status',()=>{
 assert.equal(validatePhaseTransition({currentPhase:{key:'prepare',state:'Active',assigneeId:3},nextPhase:'execute',actor,policy}).allowed,true);
 assert.equal(validatePhaseTransition({currentPhase:{key:'prepare',state:'Active',assigneeId:3},nextPhase:'verify',actor,policy}).allowed,false);
 assert.equal(validatePhaseTransition({currentPhase:{key:'prepare',state:'Active',assigneeId:5},nextPhase:'execute',actor,policy}).allowed,false);
});
test('category override requires explicit permission and reason even for manager',()=>{
 const args={currentPhase:{key:'prepare',state:'Active',assigneeId:3},nextPhase:'execute',policy,overrideCategoryId:8};
 assert.equal(validatePhaseTransition({...args,actor:{...actor,role:'Manager'},reason:'change'}).allowed,false);
 assert.equal(validatePhaseTransition({...args,actor:{...actor,permissions:['override_workflow_category']},reason:''}).allowed,false);
 assert.equal(validatePhaseTransition({...args,actor:{...actor,permissions:['override_workflow_category']},reason:'Assigned field work'}).allowed,true);
});
