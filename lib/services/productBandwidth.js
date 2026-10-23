import {isBandwidthField} from './fields.js';import {readServiceBandwidthMbps} from './capacity.js';import {CidValidationError} from './cid.js';
export function minimumBandwidthGbps(template){return String(template?.name||'').normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g,'')==='OPENPORT'?10:0.000001;}
export function hasUnfilledBandwidth(data){return Object.entries(data||{}).filter(([key])=>isBandwidthField(key)).every(([,v])=>v==null||String(v).trim()===''||String(v).trim()==='-'||((typeof v==='number'||typeof v==='string')&&Number(v)===0));}
export function openPortDefaultData(template,data={}){if(minimumBandwidthGbps(template)!==10)return data;return hasUnfilledBandwidth(data)?{...data,bandwidthMbps:10000}:data;}
export function validateOpenPortData(template,data){if(minimumBandwidthGbps(template)!==10)return;const n=readServiceBandwidthMbps({customData:data});if(n===null||n<10000)throw new CidValidationError('OPEN PORT minimal 10 Gbps. Isi bandwidth dengan satuan yang jelas.',400);}

export function openPortUpdatedData(template,current,incoming){
 if(minimumBandwidthGbps(template)!==10)return incoming;
 const hasInput=Object.keys(incoming||{}).some(isBandwidthField);
 const previous=Object.fromEntries(Object.entries(current||{}).filter(([key])=>isBandwidthField(key)));
 return openPortDefaultData(template,hasInput?incoming:{...incoming,...previous});
}
