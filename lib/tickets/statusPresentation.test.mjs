import test from 'node:test';import assert from 'node:assert/strict';
import {TICKET_STATUSES,STATUS_COLORS,statusStyle} from './status.js';
test('every ticket state uses paired semantic foreground/background, including legacy aliases',()=>{
 for(const s of TICKET_STATUSES){assert.notEqual(STATUS_COLORS[s].bg,STATUS_COLORS[s].color);assert.match(STATUS_COLORS[s].bg,/^var\(/);}
 assert.deepEqual(statusStyle('resolved'),{backgroundColor:'var(--ui-success-bg)',color:'var(--ui-success)',borderColor:'var(--ui-success)'});
 assert.deepEqual(statusStyle('Waiting Reply'),statusStyle('Pending'));
 assert.equal(statusStyle('unknown').color,'var(--ui-text)');
});
