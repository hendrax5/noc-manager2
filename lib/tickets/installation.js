import {isDarkFiber,darkFiberData} from '../services/productUnits.js';
import {minimumBandwidthGbps} from '../services/productBandwidth.js';
import {bandwidthFieldUnit,isCircuitField} from '../services/fields.js';
import {ServiceWorkError,serviceTemplateFields} from './serviceWork.js';
import {gbpsToMbps} from './bandwidth.js';
import {checkServiceCid} from '../services/cidLookup.js';
import {plannedActivationAt} from '../services/rfsActivation.js';
import {lockCircuitCodes,registerCircuitIdentifier} from '../services/circuitRegistry.js';
import {recordActivity} from '../activity/recordActivity.js';
/** Service-work operations that may register a brand-new customer/CID from the ticket form. */
export const REGISTRATION_OPERATIONS=['Installation','DataCenter'];
export async function prepareInstallationTicket(tx,body,actorId){
 if(!body.installation)return body;
 const input=body.installation;
 const master=await tx.serviceWorkType.findUnique({where:{id:Number(body.serviceWorkTypeId)}});
 if(body.workType!=='ServiceWork'||!REGISTRATION_OPERATIONS.includes(master?.operation))throw new ServiceWorkError('Registrasi customer/layanan hanya untuk Instalasi Baru atau pekerjaan Data Center.');
 const dataCenter=master.operation==='DataCenter';
 if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.name!=='string'||!input.name.trim()||input.name.length>200)throw new ServiceWorkError('Nama layanan/site wajib diisi maksimal200 karakter.');
 if(typeof input.rfsDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.rfsDate)||!Number.isFinite(Date.parse(input.rfsDate))||new Date(input.rfsDate).toISOString().slice(0,10)!==input.rfsDate)throw new ServiceWorkError('RFS tidak valid.');
 const template=await tx.serviceTemplate.findUnique({where:{id:Number(input.templateId)}});
 if(!template?.active)throw new ServiceWorkError('Pilih produk/layanan aktif.');
 const fiber=isDarkFiber(template),bandwidthMbps=fiber?null:gbpsToMbps(input.bandwidthGbps);
 let pairData=fiber?darkFiberData(template,{pairCount:input.pairCount??1}):{};
 let customer;
 if(input.newCustomerName){
 if(typeof input.newCustomerName!=='string'||!input.newCustomerName.trim()||input.newCustomerName.length>200||/[\u0000-\u001f]/.test(input.newCustomerName))throw new ServiceWorkError('Nama customer tidak valid.');
 const name=input.newCustomerName.trim().replace(/\s+/g,' ');
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'customer:'+name.toLowerCase()}))::text`;
 customer=await tx.customer.findFirst({where:{name:{equals:name,mode:'insensitive'}}});
 if(!customer)customer=await tx.customer.create({data:{name}});
 }else{
 if(!Number.isSafeInteger(Number(input.customerId))||Number(input.customerId)<1)throw new ServiceWorkError('Pilih customer atau tambah customer baru.');
 customer=await tx.customer.findUnique({where:{id:Number(input.customerId)}});
 }
 if(!customer)throw new ServiceWorkError('Customer tidak ditemukan.');
 if(template&&minimumBandwidthGbps(template)===10&&bandwidthMbps<10000)throw new ServiceWorkError('OPEN PORT minimal 10 Gbps.');
 if(!template?.active)throw new ServiceWorkError('Pilih produk/layanan aktif.');
 await lockCircuitCodes(tx,[input.cid]);
 let existing=null;
 if(input.existingServiceId){await tx.$queryRaw`SELECT id FROM "Service" WHERE id = ${Number(input.existingServiceId)} FOR UPDATE`;existing=await tx.service.findUnique({where:{id:Number(input.existingServiceId)}});if(!existing||existing.status!=='Pending'||existing.customerId!==customer.id||existing.cid!==String(input.cid).trim().toUpperCase()||existing.templateId!==template.id)throw new ServiceWorkError('Layanan instalasi tidak cocok atau sudah aktif.',409);}
 if(existing&&await tx.ticket.findFirst({where:{workType:'ServiceWork',services:{some:{id:existing.id}},status:{notIn:['Closed','Resolved']}}}))throw new ServiceWorkError('Layanan Pending sudah memiliki tiket aktif.',409);
 if(fiber&&input.pairCount===undefined&&existing)pairData=darkFiberData(template,{},existing.customData);
 const cid=await checkServiceCid(tx,{cid:input.cid},existing?.id);
 if(!cid)throw new ServiceWorkError('CID baru wajib diisi.');
 if(input.targetCustomData!==undefined&&(!input.targetCustomData||typeof input.targetCustomData!=='object'||Array.isArray(input.targetCustomData)))throw new ServiceWorkError('Field produk tidak valid.');
 const customData={...(existing?.customData||{}),...(input.targetCustomData||{}),...(fiber?pairData:{bandwidthMbps})};
 for(const field of serviceTemplateFields(template)){if(isCircuitField(field.name))customData[field.name]=cid;else if(!fiber&&['Gbps','Mbps'].includes(bandwidthFieldUnit(field.name)))customData[field.name]=bandwidthFieldUnit(field.name)==='Gbps'?bandwidthMbps/1000:bandwidthMbps;}
 const plannedActiveAt=plannedActivationAt(input.rfsDate);
 const service=existing?await tx.service.update({where:{id:existing.id},data:{name:input.name.trim(),customData,plannedActiveAt,activatedAt:null}}):await tx.service.create({data:{customerId:customer.id,templateId:template.id,name:input.name.trim(),cid,status:'Pending',customData,plannedActiveAt,activatedAt:null}});
 await registerCircuitIdentifier(tx,{serviceId:service.id,code:cid,actorId,source:'human'});
 await recordActivity(tx,{actorId,source:'human',type:dataCenter?'service.registered_from_datacenter':'service.registered_from_installation',entityType:'service',entityId:service.id,before:existing||{},after:service});
 const registrationChange={...(fiber?{pairCount:pairData.pairCount}:{bandwidthMbps}),effectiveDate:input.rfsDate,targetTemplateId:template.id,targetCustomData:input.targetCustomData||{}};
 // Data Center tickets also carry structured work details; keep them while the
 // server owns the registration fields (product/capacity/RFS) above.
 const serviceChange=dataCenter?{...(body.serviceChange&&typeof body.serviceChange==='object'?body.serviceChange:{}),...registrationChange}:registrationChange;
 return {...body,serviceIds:[service.id],serviceChange,customData:{...body.customData,'Customer Name':customer.name}};
}
