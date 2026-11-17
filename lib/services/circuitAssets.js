import {darkFiberData} from './productUnits.js';
import {openPortDefaultData} from './productBandwidth.js';
import { parseCircuitIdentifier } from './circuitIdentifier.js';
import { classifyCircuitSource } from './circuitSourcePolicy.js';
import { buildCircuitCandidates } from './circuitCandidates.js';
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
    if(row.status==='conflict')throw new CircuitAssetError(row.reasons.join(' ')||'Kode duplikat atau tautan sumber bertentangan.',409);
    if(row.needsConfirmation&&body.confirmReview!==true)throw new CircuitAssetError('Konfirmasikan klasifikasi/format sumber sebelum menautkan.');
    const tickets=await tx.ticket.findMany({where:{id:{in:row.ticketIds}},select:circuitTicketSelect});
    if(tickets.some(ticket=>parseCircuitIdentifier(ticket.title)?.code!==cid||classifyCircuitSource(ticket).eligibility==='excluded'))throw new CircuitAssetError('Tiket sumber berubah atau merupakan Trouble.',409);
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
      }else if(target.cid!==cid)await tx.service.update({where:{id:targetId},data:{cid}});
      serviceId=targetId;
      if(existingCid)await registerCircuitIdentifier(tx,{serviceId,code:existingCid,actorId});
    }
    if(!serviceId){
      const customerId=id(body.customerId),templateId=id(body.templateId);
      const[customer,template]=await Promise.all([tx.customer.findUnique({where:{id:customerId}}),tx.serviceTemplate.findUnique({where:{id:templateId}})]);
      if(!customer||customer.active===false||!template?.active)throw new CircuitAssetError('Pilih customer aktif terdaftar dan produk aktif.');
      const name=typeof body.name==='string'?body.name.trim():row.sourceName||cid;
      if(!name||name.length>500||/[\u0000-\u001f]/.test(name))throw new CircuitAssetError('Nama layanan wajib diisi, maksimal 500 karakter.');
      const status=body.status||'Pending';if(!['Pending','Active','Suspended','Terminated'].includes(status))throw new CircuitAssetError('Status layanan tidak valid.');
      const service=await tx.service.create({data:{cid,customerId,templateId,name,status,customData:darkFiberData(template,openPortDefaultData(template,{cidSource:'Ticket Subject'}))}});
      serviceId=service.id;created=true;
    }
    await registerCircuitIdentifier(tx,{serviceId,code:cid,sourceTicketId:row.ticketIds[0],actorId});
    const linkedTickets=await joinSources(tx,serviceId,tickets,actorId);
    return{cid,serviceId,created,aliasAdded,linkedTickets};
  },{timeout:30000});
}

export async function mapCircuitCandidatesBatch(db,body,actorId){
  const rawItems=Array.isArray(body?.items)?body.items:[];
  if(!rawItems.length)throw new CircuitAssetError('Pilih minimal satu CID untuk ditautkan.');
  if(rawItems.length>50)throw new CircuitAssetError('Maksimal 50 CID dalam satu proses batch.');
  const seenCids=new Set();
  const parsedItems=rawItems.map(item=>{
    const parsed=parseCircuitIdentifier(item?.cid);
    if(!parsed)throw new CircuitAssetError(`Gunakan kode layanan lengkap tanpa keterangan tambahan (${String(item?.cid||'')}).`);
    if(seenCids.has(parsed.code))throw new CircuitAssetError(`CID duplikat dalam daftar batch: ${parsed.code}.`);
    seenCids.add(parsed.code);
    return{cid:parsed.code,name:typeof item?.name==='string'?item.name.trim():''};
  });
  const sortedCodes=[...seenCids].sort();
  return db.$transaction(async tx=>{
    await lockCircuitCodes(tx,sortedCodes);
    const allRows=await loadCircuitCandidates(tx);
    const byCid=new Map(allRows.map(item=>[item.cid,item]));
    const selectedRows=parsedItems.map(item=>{
      const row=byCid.get(item.cid);
      if(!row)throw new CircuitAssetError(`Tidak ada tiket pekerjaan layanan untuk kode ${item.cid}.`,404);
      return{...item,row};
    });
    const allTicketIds=[...new Set(selectedRows.flatMap(entry=>entry.row.ticketIds))].sort((a,b)=>a-b);
    if(allTicketIds.length){
      await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ANY(${allTicketIds}::int[]) ORDER BY id FOR UPDATE`;
    }
    const refreshedMap=new Map((await loadCircuitCandidates(tx)).map(item=>[item.cid,item]));
    for(const entry of selectedRows){
      const refreshed=refreshedMap.get(entry.cid);
      if(!refreshed||JSON.stringify([...entry.row.ticketIds].sort())!==JSON.stringify([...refreshed.ticketIds].sort())){
        throw new CircuitAssetError(`Daftar sumber untuk ${entry.cid} berubah. Muat ulang.`,409);
      }
      entry.row=refreshed;
      if(refreshed.status==='conflict')throw new CircuitAssetError(`${entry.cid}: ${refreshed.reasons.join(' ')||'Kode duplikat atau tautan sumber bertentangan.'}`,409);
      if(refreshed.status==='linked')throw new CircuitAssetError(`${entry.cid} sudah tertaut.`,409);
      if(refreshed.needsConfirmation&&body?.confirmReview!==true){
        throw new CircuitAssetError(`Konfirmasikan klasifikasi/format sumber untuk ${entry.cid} sebelum menautkan.`);
      }
    }
    const needsNewService=selectedRows.some(entry=>!entry.row.serviceId);
    let customer=null,template=null,defaultStatus='Pending';
    if(needsNewService){
      const customerId=id(body?.customerId),templateId=id(body?.templateId);
      [customer,template]=await Promise.all([
        tx.customer.findUnique({where:{id:customerId}}),
        tx.serviceTemplate.findUnique({where:{id:templateId}}),
      ]);
      if(!customer||customer.active===false||!template?.active){
        throw new CircuitAssetError('Pilih customer aktif terdaftar dan produk aktif.');
      }
      defaultStatus=body?.status||'Pending';
      if(!['Pending','Active','Suspended','Terminated'].includes(defaultStatus)){
        throw new CircuitAssetError('Status layanan tidak valid.');
      }
    }
    const tickets=allTicketIds.length?await tx.ticket.findMany({where:{id:{in:allTicketIds}},select:circuitTicketSelect}):[];
    const ticketsById=new Map(tickets.map(t=>[t.id,t]));
    const results=[];
    for(const entry of selectedRows){
      const rowTickets=entry.row.ticketIds.map(tid=>ticketsById.get(tid)).filter(Boolean);
      if(rowTickets.length!==entry.row.ticketIds.length||rowTickets.some(t=>parseCircuitIdentifier(t.title)?.code!==entry.cid||classifyCircuitSource(t).eligibility==='excluded')){
        throw new CircuitAssetError(`Tiket sumber ${entry.cid} berubah atau merupakan Trouble.`,409);
      }
      let serviceId=entry.row.serviceId,created=false;
      if(!serviceId){
        const name=(entry.name||entry.row.sourceName||entry.cid).slice(0,500);
        if(!name||/[\u0000-\u001f]/.test(name))throw new CircuitAssetError(`Nama layanan untuk ${entry.cid} wajib diisi tanpa karakter kontrol.`);
        const service=await tx.service.create({
          data:{
            cid:entry.cid,
            customerId:customer.id,
            templateId:template.id,
            name,
            status:defaultStatus,
            customData:darkFiberData(template,openPortDefaultData(template,{cidSource:'Ticket Subject'})),
          },
        });
        serviceId=service.id;
        created=true;
      }
      await registerCircuitIdentifier(tx,{serviceId,code:entry.cid,sourceTicketId:entry.row.ticketIds[0],actorId});
      const linkedTickets=await joinSources(tx,serviceId,rowTickets,actorId);
      results.push({cid:entry.cid,serviceId,created,linkedTickets});
    }
    return{count:results.length,createdCount:results.filter(r=>r.created).length,linkedTicketsCount:results.reduce((n,r)=>n+r.linkedTickets,0),results};
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
