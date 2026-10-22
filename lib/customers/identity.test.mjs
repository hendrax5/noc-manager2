import test from 'node:test';import assert from 'node:assert/strict';
import {formatCustomerId,withCustomerCode} from './identity.js';
test('ION Customer ID is stable, unique per customer, distinct from circuit CID',()=>{
 assert.equal(formatCustomerId({id:29,name:'Old'}),'ION-CUST-000029');assert.equal(formatCustomerId({id:29,name:'Renamed'}),'ION-CUST-000029');assert.equal(formatCustomerId({id:1234567}),'ION-CUST-1234567');assert.notEqual(formatCustomerId({id:29}),formatCustomerId({id:30}));assert.equal(withCustomerCode({id:29,name:'Tower'}).customerCode,'ION-CUST-000029');
 for(const id of [undefined,0,-1,NaN,'SAP-C-1243-0002'])assert.equal(formatCustomerId({id}),'');
});
