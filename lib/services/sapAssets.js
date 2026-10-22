import { buildSapCandidates, extractSapCid } from './sapCid.js';

export class SapAssetError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const canManageSapAssets = user => user?.role?.name === 'Admin' || (user?.role?.permissions || []).includes('manage_assets');
const sourceSelect = { id:true, trackingId:true, title:true, description:true, customData:true, updatedAt:true, services:{select:{id:true}} };
const serviceSelect = { id:true, cid:true, customData:true };

export async function loadSapCandidates(db) {
  const [tickets,services] = await Promise.all([
    db.ticket.findMany({where:{title:{contains:'SAP',mode:'insensitive'}},select:sourceSelect}),
    db.service.findMany({select:serviceSelect}),
  ]);
  return buildSapCandidates(tickets,services);
}

const positiveId = value => {
  if (!['number','string'].includes(typeof value) || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value)<1) throw new SapAssetError('Customer/produk tidak valid.');
  return Number(value);
};

async function lockCid(tx,cid) {
  await tx.$queryRaw`SELECT 'locked'::text AS locked FROM pg_advisory_xact_lock(hashtext(${`sap-cid:${cid}`}))`;
}

async function joinSources(tx, serviceId, tickets, actorId) {
  const missing = tickets.filter(ticket => !ticket.services?.some(service => service.id === serviceId)).map(ticket=>ticket.id);
  if (!missing.length) return 0;
  // Join directly so neither Ticket age nor Service Inventory version changes.
  await tx.$executeRaw`INSERT INTO "_ServiceToTicket" ("A","B") SELECT ${serviceId}, unnest(${missing}::int[]) ON CONFLICT DO NOTHING`;
  await tx.ticketHistory.createMany({data:missing.map(ticketId=>({ticketId,actorId,action:'CID SAP linked to Inventory from complete ticket Subject'}))});
  return missing.length;
}

export async function mapSapCircuit(db, body, actorId) {
  const cid = extractSapCid(body?.cid);
  if (!cid) throw new SapAssetError('CID harus berupa Subject SAP lengkap tanpa keterangan tambahan.');
  return db.$transaction(async tx=>{
    await lockCid(tx,cid);
    let row=(await loadSapCandidates(tx)).find(item=>item.cid===cid);
    if (!row) throw new SapAssetError('Tidak ada tiket sumber untuk CID SAP ini.',404);
    await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ANY(${row.ticketIds}::int[]) ORDER BY id FOR UPDATE`;
    const tickets=await tx.ticket.findMany({where:{id:{in:row.ticketIds}},select:sourceSelect});
    if (tickets.some(ticket=>extractSapCid(ticket.title)!==cid)) throw new SapAssetError('Subject tiket sumber berubah. Muat ulang daftar.',409);
    const services=await tx.service.findMany({select:serviceSelect});
    row=buildSapCandidates(tickets,services).find(item=>item.cid===cid);
    if (!row || row.status==='conflict') throw new SapAssetError('CID duplikat atau tautan tiket tidak sesuai. Periksa Inventory dan tiket sumber.',409);
    let serviceId=row.serviceId,created=false;
    if (!serviceId) {
      const customerId=positiveId(body.customerId),templateId=positiveId(body.templateId);
      const [customer,template]=await Promise.all([tx.customer.findUnique({where:{id:customerId}}),tx.serviceTemplate.findUnique({where:{id:templateId}})]);
      if (!customer || !template?.active) throw new SapAssetError('Pilih customer yang terdaftar dan produk aktif.');
      const status=body.status || 'Pending';
      if (!['Pending','Active','Suspended','Terminated'].includes(status)) throw new SapAssetError('Status layanan tidak valid.');
      const name=typeof body.name==='string' ? body.name.trim() : row.sourceName || cid;
      if (!name || name.length>500 || /[\u0000-\u001f]/.test(name)) throw new SapAssetError('Nama layanan wajib diisi, maksimal 500 karakter.');
      const service=await tx.service.create({data:{cid,customerId,templateId,name,status,customData:{sapSource:'Ticket Subject',sapImportedAt:new Date().toISOString(),sapImportedBy:actorId}}});
      serviceId=service.id;created=true;
    }
    const linkedTickets=await joinSources(tx,serviceId,tickets,actorId);
    return {cid,serviceId,created,linkedTickets};
  },{timeout:20000});
}

/** Best effort: new tickets only link unique existing circuits, never guess ownership. */
export async function linkExistingSapCircuit(db,ticketId) {
  const initial=await db.ticket.findUnique({where:{id:ticketId},select:sourceSelect});
  const cid=extractSapCid(initial?.title);
  if (!cid || initial.services?.length) return {linked:false};
  return db.$transaction(async tx=>{
    await lockCid(tx,cid);
    await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
    const ticket=await tx.ticket.findUnique({where:{id:ticketId},select:sourceSelect});
    if (!ticket || extractSapCid(ticket.title)!==cid || ticket.services?.length) return {linked:false};
    const matches=buildSapCandidates([ticket],await tx.service.findMany({select:serviceSelect}));
    const row=matches[0];
    if (row?.status!=='ready_to_link') return {linked:false};
    await joinSources(tx,row.serviceId,[ticket],null);
    return {linked:true,serviceId:row.serviceId};
  },{timeout:10000});
}
