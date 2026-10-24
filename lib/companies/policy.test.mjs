import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCompany,companyForDepartment} from './policy.js';

test('normalizes supported service companies and legacy PRODC',()=>{
 assert.equal(normalizeCompany('ION'),'ION');
 assert.equal(normalizeCompany('prodc'),'SDC');
 assert.equal(normalizeCompany(' sdc '),'SDC');
 assert.throws(()=>normalizeCompany('Other'));
});

test('derives current employee company from department',()=>{
 assert.equal(companyForDepartment('NocDatacenter'),'SDC');
 assert.equal(companyForDepartment('noc datacenter'),'SDC');
 assert.equal(companyForDepartment('NOC Regional Jakarta'),'ION');
});
