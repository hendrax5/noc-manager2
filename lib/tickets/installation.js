import {bandwidthFieldUnit,isCircuitField} from '../services/fields.js';
import {ServiceWorkError,serviceTemplateFields} from './serviceWork.js';
import {gbpsToMbps} from './bandwidth.js';
import {checkServiceCid} from '../services/cidLookup.js';
import {lockCircuitCodes,registerCircuitIdentifier} from '../services/circuitRegistry.js';
export async function prepareInstallationTicket(tx,body,actorId){
 if(!body.installation)return body;
 const input=body.installation;
 if(body.workType!=='ServiceWork'||(await tx.serviceWorkType.findUnique({where:{id:Number(body.serviceWorkTypeId)}}))?.operation!=='Installation')throw new ServiceWorkError('Registrasi customer/layanan hanya untuk Instalasi Baru.');
 if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.name!=='string'||!input.name.trim()||input.name.length>200)throw new ServiceWorkError('Nama layanan/site wajib diisi maksimal200 karakter.');
 if(typeof input.rfsDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.rfsDate)||!Number.isFinite(Date.parse(input.rfsDate))||new Date(input.rfsDate).toISOString().slice(0,10)!==input.rfsDate)throw new ServiceWorkError('RFS tidak valid.');
 const bandwidthMbps=gbpsToMbps(input.bandwidthGbps);
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
 const template=await tx.serviceTemplate.findUnique({where:{id:Number(input.templateId)}});
 if(!template?.active)throw new ServiceWorkError('Pilih produk/layanan aktif.');
 await lockCircuitCodes(tx,[input.cid]);
 let existing=null;
 if(input.existingServiceId){await tx.$queryRaw`SELECT id FROM "Service" WHERE id = ${Number(input.existingServiceId)} FOR UPDATE`;existing=await tx.service.findUnique({where:{id:Number(input.existingServiceId)}});if(!existing||existing.status!=='Pending'||existing.customerId!==customer.id||existing.cid!==String(input.cid).trim().toUpperCase()||existing.templateId!==template.id)throw new ServiceWorkError('Layanan instalasi tidak cocok atau sudah aktif.',409);}
 if(existing&&await tx.ticket.findFirst({where:{workType:'ServiceWork',services:{some:{id:existing.id}},status:{notIn:['Closed','Resolved']}}}))throw new ServiceWorkError('Layanan Pending sudah memiliki tiket aktif.',409);
 const cid=await checkServiceCid(tx,{cid:input.cid},existing?.id);
 if(!cid)throw new ServiceWorkError('CID baru wajib diisi.');
 if(input.targetCustomData!==undefined&&(!input.targetCustomData||typeof input.targetCustomData!=='object'||Array.isArray(input.targetCustomData)))throw new ServiceWorkError('Field produk tidak valid.');
 const customData={...(existing?.customData||{}),...(input.targetCustomData||{}),bandwidthMbps};
 for(const field of serviceTemplateFields(template)){if(isCircuitField(field.name))customData[field.name]=cid;else if(['Gbps','Mbps'].includes(bandwidthFieldUnit(field.name)))customData[field.name]=bandwidthFieldUnit(field.name)==='Gbps'?bandwidthMbps/1000:bandwidthMbps;}
 const service=existing?await tx.service.update({where:{id:existing.id},data:{name:input.name.trim(),customData}}):await tx.service.create({data:{customerId:customer.id,templateId:template.id,name:input.name.trim(),cid,status:'Pending',customData}});
 await registerCircuitIdentifier(tx,{serviceId:service.id,code:cid,actorId});
 return {...body,serviceIds:[service.id],serviceChange:{bandwidthMbps,effectiveDate:input.rfsDate,targetTemplateId:template.id,targetCustomData:input.targetCustomData||{}},customData:{...body.customData,'Customer Name':customer.name}};
}
