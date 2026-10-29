import {isDarkFiber} from './productUnits.js';
import {openPortDefaultData} from './productBandwidth.js';
import {capacityCustomData} from './fields.js';
import {planProductChange} from './productChange.js';
import {normalizeCompanyAsync} from '../companies/server.js';
import {recordActivity} from '../activity/recordActivity.js';
import { parseCircuitIdentifier } from './circuitIdentifier.js';
import { classifyCircuitSource } from './circuitSourcePolicy.js';
import { buildCircuitCandidates, isSiteNameConflictOnly } from './circuitCandidates.js';
import { getServiceCid, CidValidationError } from './cid.js';
import { lockCircuitCodes, registerCircuitIdentifier } from './circuitRegistry.js';

export class CircuitAssetError extends CidValidationError {}
export const canManageCircuitAssets=user=>user?.role?.name==='Admin'||(user?.role?.permissions||[]).includes('manage_assets');
export const circuitTicketSelect={id:true,trackingId:true,title:true,description:true,customData:true,updatedAt:true,workType:true,jobCategory:{select:{name:true}},services:{select:{id:true}}};
const serviceSelect={id:true,cid:true,customData:true,identifiers:{select:{code:true}}};
export async function loadCircuitCandidates(db,{family}={}){
  const[tickets,services]=await Promise.all([
    db.ticket.findMany({where:{title:{contains:'-'}},select:circuitTicketSelect}),
    db.service.findMany({select:serviceSelect}),
  ]);
  return buildCircuitCandidates(tickets,services).filter(row=>!family||family==='all'||row.family===family);
}
const id=value=>{const n=Number(value);if(!['number','string'].includes(typeof value)||!/^\d+$/.test(String(value))||!Number.isSafeInteger(n)||n<1)throw new CircuitAssetError('Customer/layanan/produk tidak valid.');return n;};
/** Capacity fields accepted from the mapping dialog; product rules are applied by planProductChange. */
function capacityInput(body){
 const capacity={};
 if(body.bandwidthMbps!==undefined&&body.bandwidthMbps!==null&&body.bandwidthMbps!==''){
  const mbps=Number(body.bandwidthMbps);
  if(!Number.isFinite(mbps)||mbps<0||mbps>1e9)throw new CircuitAssetError('Kapasitas Mbps harus angka positif (maksimal 1.000.000.000).',400);
  const rounded=Math.round(mbps*1e6)/1e6;
  if(!Number.isFinite(rounded))throw new CircuitAssetError('Kapasitas Mbps di luar rentang yang didukung.',400);
  capacity.bandwidthMbps=rounded;
 }
 if(body.pairCount!==undefined&&body.pairCount!==null&&body.pairCount!==''){
  const pairs=Number(body.pairCount);
  if(!Number.isSafeInteger(pairs)||pairs<1)throw new CircuitAssetError('Jumlah pair harus bilangan bulat minimal 1.',400);
  capacity.pairCount=pairs;
 }
 return capacity;
}
/** Reject mixed units instead of silently dropping the wrong one. */
function assertCapacityUnit(template,capacity){
 if(isDarkFiber(template)&&capacity.bandwidthMbps!==undefined)throw new CircuitAssetError('Produk DARKFIBER memakai jumlah pair, bukan bandwidth Gbps.',400);
 if(!isDarkFiber(template)&&capacity.pairCount!==undefined)throw new CircuitAssetError('Produk ini memakai kapasitas bandwidth, bukan jumlah pair.',400);
}
function capacityFor(template,capacity){
 if(isDarkFiber(template))return capacity.pairCount===undefined?{}:{pairCount:capacity.pairCount};
 return capacity.bandwidthMbps===undefined?{}:{bandwidthMbps:capacity.bandwidthMbps};
}
/** Keep legacy Gbps/Mbps unit fields coherent with the canonical bandwidth, as service work does. */
function canonicalCapacityData(template,customData,capacity){
 if(isDarkFiber(template)||capacity.bandwidthMbps===undefined)return customData;
 return capacityCustomData(customData,capacity.bandwidthMbps);
}
async function serviceCompany(value){
 try{return await normalizeCompanyAsync(value);}
 catch(error){throw new CircuitAssetError(error.message,400);}
}
async function joinSources(tx,serviceId,tickets,actorId){
  const missing=tickets.filter(ticket=>!ticket.services?.some(service=>service.id===serviceId)).map(ticket=>ticket.id);
  if(!missing.length)return 0;
  await tx.$executeRaw`INSERT INTO "_ServiceToTicket" ("A","B") SELECT ${serviceId}, unnest(${missing}::int[]) ON CONFLICT DO NOTHING`;
  await tx.ticketHistory.createMany({data:missing.map(ticketId=>({ticketId,actorId,action:'CID linked to Inventory from complete service-work Subject'}))});
  return missing.length;
}
export async function mapCircuitCandidate(db,body,actorId){
  const parsed=parseCircuitIdentifier(body?.cid);
  if(!parsed)throw new CircuitAssetError('Gunakan kode layanan lengkap tanpa keterangan tambahan.');
  const cid=parsed.code;
  return db.$transaction(async tx=>{
    const targetId=body.existingServiceId?id(body.existingServiceId):null;
    const initial=targetId?await tx.service.findUnique({where:{id:targetId}}):null;
    if(targetId&&!initial)throw new CircuitAssetError('Layanan tidak ditemukan.',404);
    // All identifier advisory locks precede Ticket locks, then Service row locks.
    await lockCircuitCodes(tx,[cid,initial?getServiceCid(initial):'']);
    let row=(await loadCircuitCandidates(tx)).find(item=>item.cid===cid);
    if(!row)throw new CircuitAssetError('Tidak ada tiket pekerjaan layanan untuk kode ini.',404);
    await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ANY(${row.ticketIds}::int[]) ORDER BY id FOR UPDATE`;
    const refreshed=(await loadCircuitCandidates(tx)).find(item=>item.cid===cid);
    if(!refreshed||JSON.stringify([...row.ticketIds].sort())!==JSON.stringify([...refreshed.ticketIds].sort()))throw new CircuitAssetError('Daftar sumber berubah. Muat ulang.',409);
    row=refreshed;
    const tickets=await tx.ticket.findMany({where:{id:{in:row.ticketIds}},select:circuitTicketSelect});
    if(tickets.some(ticket=>parseCircuitIdentifier(ticket.title)?.code!==cid||classifyCircuitSource(ticket).eligibility==='excluded'))throw new CircuitAssetError('Tiket sumber berubah atau merupakan Trouble.',409);
    if(row.status==='conflict'){
      if(body.confirmConflict!==true||!isSiteNameConflictOnly(row,tickets))throw new CircuitAssetError(row.reasons.join(' ')||'Kode duplikat atau tautan sumber bertentangan.',409);
      const owners=await tx.service.count({where:{cid}});
      if(owners>0)throw new CircuitAssetError('Kode sudah dimiliki layanan lain.',409);
    }
    if(row.needsConfirmation&&body.confirmReview!==true)throw new CircuitAssetError('Konfirmasikan klasifikasi/format sumber sebelum menautkan.');
    let serviceId=row.serviceId,created=false,aliasAdded=false;
    if(targetId){
      if(serviceId&&serviceId!==targetId)throw new CircuitAssetError('Kode sudah dimiliki layanan lain.',409);
      await tx.$queryRaw`SELECT id FROM "Service" WHERE id = ${targetId} FOR UPDATE`;
      const target=await tx.service.findUnique({where:{id:targetId}});
      if(!target||target.customerId!==id(body.customerId))throw new CircuitAssetError('Layanan bukan milik customer yang dipilih.',409);
      if(+new Date(target.updatedAt)!==+new Date(initial.updatedAt))throw new CircuitAssetError('Inventory berubah; muat ulang.',409);
      const existingCid=getServiceCid(target);
      if(existingCid&&existingCid.toUpperCase()!==cid){
        if(body.confirmAlias!==true)throw new CircuitAssetError('CID berbeda: konfirmasikan bahwa kode lama dan kode utama adalah circuit yang sama.',409);
        aliasAdded=true;
      }
      // The mapping dialog can also complete the selected service's capacity and company.
      const updates={};
      if(!(existingCid&&existingCid.toUpperCase()!==cid)&&target.cid!==cid)updates.cid=cid;
      const company=(body.company!==undefined&&body.company!==null&&body.company!=='')?await serviceCompany(body.company):undefined;
      if(company!==undefined&&company!==target.company)updates.company=company;
      const capacity=capacityInput(body);
      if(Object.keys(capacity).length){
        const template=await tx.serviceTemplate.findUnique({where:{id:target.templateId}});
        if(!template||template.active===false)throw new CircuitAssetError('Produk layanan tidak ditemukan atau tidak aktif.',409);
        assertCapacityUnit(template,capacity);
        const plan=planProductChange({nextTemplate:template,currentTemplateId:target.templateId,currentCustomData:target.customData,incomingCustomData:{...(target.customData||{}),...capacityFor(template,capacity)}});
        if(!plan.ok)throw new CircuitAssetError(plan.error,400);
        const nextCustomData=canonicalCapacityData(template,plan.customData,capacity);
        if(JSON.stringify(nextCustomData)!==JSON.stringify(target.customData))updates.customData=nextCustomData;
      }
      if(updates.company!==undefined||updates.customData!==undefined){
        if(await tx.bodWindow.findFirst({where:{serviceId:targetId,activatedAt:{not:null},restoredAt:null,cancelledAt:null}}))throw new CircuitAssetError('BOD aktif. Konfirmasi pengembalian bandwidth normal sebelum mengedit Inventory.',409);
      }
      if(Object.keys(updates).length){
        const updated=await tx.service.update({where:{id:targetId},data:updates});
        await recordActivity(tx,{actorId,source:'human',type:'service.updated',entityType:'service',entityId:targetId,before:target,after:updated});
      }
      serviceId=targetId;
      if(existingCid)await registerCircuitIdentifier(tx,{serviceId,code:existingCid,actorId});
    }
    if(!serviceId){
      const customerId=id(body.customerId),templateId=id(body.templateId);
      const[customer,template]=await Promise.all([tx.customer.findUnique({where:{id:customerId}}),tx.serviceTemplate.findUnique({where:{id:templateId}})]);
      if(!customer||!template?.active)throw new CircuitAssetError('Pilih customer terdaftar dan produk aktif.');
      const name=typeof body.name==='string'?body.name.trim():row.sourceName||cid;
      if(!name||name.length>500||/[\u0000-\u001f]/.test(name))throw new CircuitAssetError('Nama layanan wajib diisi, maksimal 500 karakter.');
      const status=body.status||'Pending';if(!['Pending','Active','Suspended','Terminated'].includes(status))throw new CircuitAssetError('Status layanan tidak valid.');
      const company=(body.company!==undefined&&body.company!==null&&body.company!=='')?await serviceCompany(body.company):null;
      const capacity=capacityInput(body);
      assertCapacityUnit(template,capacity);
      const plan=planProductChange({nextTemplate:template,currentTemplateId:null,currentCustomData:{},incomingCustomData:{...openPortDefaultData(template,{cidSource:'Ticket Subject'}),...capacityFor(template,capacity)}});
      if(!plan.ok)throw new CircuitAssetError(plan.error,400);
      const service=await tx.service.create({data:{cid,customerId,templateId,name,status,company,customData:canonicalCapacityData(template,plan.customData,capacity)}});
      serviceId=service.id;created=true;
    }
    await registerCircuitIdentifier(tx,{serviceId,code:cid,sourceTicketId:row.ticketIds[0],actorId});
    const linkedTickets=await joinSources(tx,serviceId,tickets,actorId);
    return{cid,serviceId,created,aliasAdded,linkedTickets};
  },{timeout:30000});
}
export async function linkKnownCircuit(db,ticketId){
  const initial=await db.ticket.findUnique({where:{id:ticketId},select:circuitTicketSelect});
  const parsed=parseCircuitIdentifier(initial?.title);
  if(!parsed||parsed.formatStatus!=='primary'||classifyCircuitSource(initial).eligibility!=='eligible'||initial.services?.length)return{linked:false};
  return db.$transaction(async tx=>{
    await lockCircuitCodes(tx,[parsed.code]);
    await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
    const row=(await loadCircuitCandidates(tx)).find(item=>item.cid===parsed.code);
    const ticket=await tx.ticket.findUnique({where:{id:ticketId},select:circuitTicketSelect});
    if(!ticket||ticket.services?.length||parseCircuitIdentifier(ticket.title)?.code!==parsed.code||classifyCircuitSource(ticket).eligibility!=='eligible'||!row||row.status!=='ready_to_link'||row.needsConfirmation)return{linked:false};
    await joinSources(tx,row.serviceId,[ticket],null);return{linked:true,serviceId:row.serviceId};
  },{timeout:30000});
}
