import {bandwidthFieldUnit} from './fields.js';
const positive=v=>['number','string'].includes(typeof v)&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>0;
/** Canonical Mbps first; only explicit, mutually consistent legacy units may fall back. */
export function readServiceBandwidthMbps(service){const d=service?.customData||{};if(Object.hasOwn(d,'bandwidthMbps'))return positive(d.bandwidthMbps)?Number(d.bandwidthMbps):null;const values=[];for(const [key,v]of Object.entries(d)){const unit=bandwidthFieldUnit(key);if(!unit||unit==='unknown'||v==null||v==='')continue;if(!positive(v))return null;values.push(Number(v)*(unit==='Gbps'?1000:1));}return values.length&&values.every(v=>Math.abs(v-values[0])<1e-8)?values[0]:null;}
