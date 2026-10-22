import {formatCustomerId} from './identity.js';
import {getServiceSearchText} from '../services/cid.js';

const validId=value=>Number.isSafeInteger(Number(value))&&Number(value)>0;

/** Read-only view projection. Counts are calculated before customer pagination. */
export function selectServiceInventory({customers=[],services=[],query='',templateId='',status='',page=1,pageSize=25}) {
  const groups=new Map(customers.filter(c=>validId(c.id)).map(customer=>[Number(customer.id),{customer,services:[]}]));
  for(const service of services){
    const id=service.customerId??service.customer?.id;
    if(!validId(id))continue;
    if(!groups.has(Number(id))&&service.customer)groups.set(Number(id),{customer:service.customer,services:[]});
    groups.get(Number(id))?.services.push(service);
  }
  const search=String(query).trim().toLocaleLowerCase();
  const filtered=[...groups.values()].map(group=>{
    const customerMatch=`${group.customer.name} ${formatCustomerId(group.customer)}`.toLocaleLowerCase().includes(search);
    const visible=group.services.filter(service=>(customerMatch||getServiceSearchText(service).toLocaleLowerCase().includes(search))&&(!templateId||String(service.templateId??service.template?.id)===String(templateId))&&(!status||service.status===status));
    return {customer:group.customer,services:visible,totalServiceCount:group.services.length,pendingCount:visible.filter(s=>s.status==='Pending').length,include:visible.length>0||(!group.services.length&&customerMatch&&!templateId&&!status)};
  }).filter(group=>group.include).sort((a,b)=>a.customer.name.localeCompare(b.customer.name)||Number(a.customer.id)-Number(b.customer.id));
  const size=Number.isSafeInteger(pageSize)&&pageSize>0?pageSize:25;
  const pageCount=Math.max(1,Math.ceil(filtered.length/size));
  const current=Math.max(1,Math.min(pageCount,Number.isSafeInteger(page)?page:1));
  return {groups:filtered.slice((current-1)*size,current*size).map(({include:_include,...group})=>group),customerCount:filtered.length,serviceCount:filtered.reduce((n,g)=>n+g.services.length,0),page:current,pageCount};
}
