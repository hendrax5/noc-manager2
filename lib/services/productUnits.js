import {CidValidationError} from './cid.js';
export const isDarkFiber=template=>/^DARKFIB(RE|ER)$/.test(String(template?.name||'').normalize('NFKC').toUpperCase().replace(/[^A-Z]/g,''));
export const isPairField=name=>/^(paircount|pairs?|jumlahpair|fiberpairs?)$/.test(String(name||'').toLowerCase().replace(/[^a-z]/g,''));
const valid=v=>['number','string'].includes(typeof v)&&String(v).trim()!==''&&Number.isSafeInteger(Number(v))&&Number(v)>0;
export function readPairCount(service){const d=service?.customData||{};if(Object.hasOwn(d,'pairCount'))return valid(d.pairCount)?Number(d.pairCount):null;const values=Object.entries(d).filter(([k])=>isPairField(k)).map(([,v])=>v);return values.length&&values.every(v=>valid(v)&&Number(v)===Number(values[0]))?Number(values[0]):null;}
export function darkFiberData(template,data={},current={}){
 if(!isDarkFiber(template))return data;
 const incoming=Object.entries(data).filter(([k])=>isPairField(k));
 const hasValue=incoming.some(([,v])=>v!=null&&String(v).trim()!==''&&v!=='-');
 const count=hasValue?readPairCount({customData:data}):readPairCount({customData:current})??1;
 if(count===null)throw new CidValidationError('Jumlah pair harus bilangan bulat minimal 1 pair.',400);
 return {...data,pairCount:count};
}
