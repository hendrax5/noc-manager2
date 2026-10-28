import test from 'node:test';import assert from 'node:assert/strict';
import {isBandwidthField,bandwidthFieldUnit} from './fields.js';
import {readServiceBandwidthMbps} from './capacity.js';
test('legacy typos are capacity semantics; explicit units only, no unitless guesses',()=>{for(const name of ['Bandwith','Bandwidth','Kapasitas','Bandwidth (Gbps)','bandwidth_mbps'])assert.equal(isBandwidthField(name),true,name);assert.equal(isBandwidthField('IP Address'),false);assert.equal(bandwidthFieldUnit('Bandwith'),'unknown');assert.equal(readServiceBandwidthMbps({customData:{'Bandwith (Gbps)':0.1}}),100);assert.equal(readServiceBandwidthMbps({customData:{Bandwith:100}}),null);assert.equal(readServiceBandwidthMbps({customData:{'Bandwidth (Gbps)':1,'Bandwidth Mbps':200}}),null);assert.equal(readServiceBandwidthMbps({customData:{bandwidthMbps:100,Bandwith:'legacy ambiguous'}}),100);});

test('explicit zero capacity is readable; negatives and garbage stay unreadable',()=>{
 assert.equal(readServiceBandwidthMbps({customData:{bandwidthMbps:0}}),0);
 assert.equal(readServiceBandwidthMbps({customData:{bandwidthMbps:'0'}}),0);
 assert.equal(readServiceBandwidthMbps({customData:{'Bandwidth (Mbps)':0}}),0);
 assert.equal(readServiceBandwidthMbps({customData:{bandwidthMbps:-1}}),null);
});
