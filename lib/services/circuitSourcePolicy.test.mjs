import test from 'node:test';import assert from 'node:assert/strict';
import { classifyCircuitSource } from './circuitSourcePolicy.js';
const source=(workType,name)=>({workType,ticketType:'Incident',jobCategory:{name}});
test('Trouble and legacy outage/operational categories never become sources',()=>{
 for(const row of [source('Trouble','Installasi'),source('Unclassified','Troubleshoot'),source('Unclassified','Troubleshoot IPT/Backbone'),source('Unclassified','Monitoring'),source('Unclassified','Daily Report')])assert.equal(classifyCircuitSource(row).eligibility,'excluded');
});
test('explicit service work and legacy service categories are eligible, not auto reclassified',()=>{
 for(const row of [source('ServiceWork','General'),source('Installation',null),source('Unclassified','Installasi'),source('Unclassified','Upgrade/Downgrade'),source('Unclassified','Terminate')])assert.equal(classifyCircuitSource(row).eligibility,'eligible');
});
test('unclassified ambiguous categories need review',()=>{
 for(const name of [null,'Customer','General','BOD','CrossConnect'])assert.equal(classifyCircuitSource(source('Unclassified',name)).eligibility,'review');
});
test('explicit service classification takes precedence over independently chosen scoring category',()=>{
 assert.equal(classifyCircuitSource(source('ServiceWork','Troubleshoot')).eligibility,'eligible');
 assert.equal(classifyCircuitSource(source('Installation','Monitoring')).eligibility,'eligible');
});
