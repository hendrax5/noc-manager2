import { getServiceCid } from '../services/cid.js';
import { readServiceBandwidthMbps } from '../services/capacity.js';
export const SERVICE_WORK_OPERATIONS = ['Installation','Upgrade','Downgrade','Change','Terminate'];
export class ServiceWorkError extends Error { constructor(message, status=400) { super(message); this.status=status; } }
const fail = (message, status) => { throw new ServiceWorkError(message,status); };
const stable = value => JSON.stringify(value, function(key, v) { return v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k,v[k]])) : v; });
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const id = value => { const n=Number(value); if (!['number','string'].includes(typeof value)||!/^\d+$/.test(String(value))||!Number.isSafeInteger(n)||n<1) fail('ID pekerjaan/produk tidak valid.'); return n; };
export function serviceWorkInputChanged(body) { return Object.hasOwn(body,'serviceChange') || Object.hasOwn(body,'serviceWorkTypeId'); }
export function snapshotService(service) { return { serviceId:service.id, cid:getServiceCid(service),templateId:service.templateId,templateName:service.template?.name || '',status:service.status,bandwidthMbps:readServiceBandwidthMbps(service),customData:service.customData || {},updatedAt:new Date(service.updatedAt).toISOString() }; }
export function serviceTemplateFields(template) {
 let fields=template?.fields;
 if(typeof fields==='string') { try { fields=JSON.parse(fields); } catch { fail('Definisi field produk tidak valid. Hubungi Admin.'); } }
 if(fields==null) return [];
 if(!Array.isArray(fields)) fail('Definisi field produk tidak valid. Hubungi Admin.');
 return fields.filter(field=>field&&typeof field.name==='string');
}
function validateFields(template, data) {
 const fields=serviceTemplateFields(template);
 for(const field of fields) {
  const v=data[field.name];
  if(field.required && (v===undefined||v===null||String(v).trim()==='')) fail(`Field produk wajib: ${field.name}`);
  if(v===undefined||v===null||v==='') continue;
  if(!['string','number','boolean'].includes(typeof v)) fail(`Nilai field produk tidak valid: ${field.name}`);
  if(field.type==='number' && (typeof v==='boolean'||!Number.isFinite(Number(v)))) fail(`Field produk harus angka: ${field.name}`);
  if(field.type==='date') validateDate(v);
  if(field.type==='select') {
   const options=Array.isArray(field.options)?field.options:typeof field.options==='string'?field.options.split(/[,\n]/).map(s=>s.trim()).filter(Boolean):[];
   if(options.length&&!options.includes(String(v))) fail(`Pilihan field produk tidak valid: ${field.name}`);
  }
 }
}
function validateDate(value) { if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value) fail('Tanggal efektif tidak valid.'); }
export async function prepareServiceWork(db, body, existing=null) {
 const workType=body.workType ?? existing?.workType;
 const linksChanged=Object.hasOwn(body,'serviceIds') && (!Array.isArray(body.serviceIds)||JSON.stringify(body.serviceIds.map(Number))!==JSON.stringify((existing?.services||[]).map(s=>s.id)));
 const touched=serviceWorkInputChanged(body)||linksChanged||(Object.hasOwn(body,'workType')&&body.workType!==existing?.workType);
 if(existing?.serviceChange?.appliedAt && touched) fail('Perubahan layanan yang telah diterapkan tidak dapat diubah.');
 if(workType!=='ServiceWork') { if(serviceWorkInputChanged(body)) fail('Detail pekerjaan layanan membutuhkan klasifikasi Pekerjaan Layanan.'); return {data:existing?.workType==='ServiceWork'?{serviceWorkTypeId:null,serviceWorkTypeLabel:null,serviceChange:null}:{}}; }
 if(existing&&!touched) return {data:{}};
 const master=await db.serviceWorkType.findUnique({where:{id:id(body.serviceWorkTypeId ?? existing?.serviceWorkTypeId)}});
 const retainedMaster=existing?.workType==='ServiceWork'&&existing.serviceWorkTypeId===master?.id&&existing.serviceChange?.operation===master?.operation;
 if(!master||(!master.active&&!retainedMaster)||!SERVICE_WORK_OPERATIONS.includes(master.operation)) fail('Pilih jenis pekerjaan layanan aktif.');
 const ids=body.serviceIds ?? existing?.services?.map(s=>s.id);
 if(!Array.isArray(ids)||ids.length!==1) fail('Pekerjaan layanan wajib tepat satu CID.');
 const service=await db.service.findUnique({where:{id:id(ids[0])},include:{template:true}});
 if(!service||!getServiceCid(service)) fail('Layanan/CID tidak valid.');
 const incoming=body.serviceChange ?? (existing?.serviceChange ? { targetTemplateId:existing.serviceChange.after.templateId,bandwidthMbps:existing.serviceChange.after.bandwidthMbps,effectiveDate:existing.serviceChange.effectiveDate,reason:existing.serviceChange.reason,targetCustomData:existing.serviceChange.after.customData }:null);
 if(!object(incoming)) fail('Detail perubahan layanan wajib diisi.');
 const allowed=['targetTemplateId','bandwidthMbps','effectiveDate','reason','targetCustomData'];
 if(Object.keys(incoming).some(k=>!allowed.includes(k))) fail('Snapshot dan penanda penerapan hanya dapat ditulis server.');
 validateDate(incoming.effectiveDate);
 if(incoming.reason!==undefined && (typeof incoming.reason!=='string'||incoming.reason.length>2000)) fail('Alasan maksimal 2000 karakter.');
 const template=await db.serviceTemplate.findUnique({where:{id:incoming.targetTemplateId!==undefined&&incoming.targetTemplateId!==null&&incoming.targetTemplateId!=='' ? id(incoming.targetTemplateId):service.templateId}});
 if(!template||(!template.active&&!(master.operation==='Terminate'&&template.id===service.templateId))) fail('Produk tujuan tidak aktif/tidak tersedia.');
 const before=snapshotService(service);
 let bandwidth=before.bandwidthMbps;
 if(incoming.bandwidthMbps!==undefined&&incoming.bandwidthMbps!==null&&incoming.bandwidthMbps!=='') { bandwidth=Number(incoming.bandwidthMbps); if(!['number','string'].includes(typeof incoming.bandwidthMbps)||!Number.isFinite(bandwidth)||bandwidth<=0) fail('Kapasitas Mbps harus angka positif.'); }
 if(master.operation==='Installation'&&bandwidth===null) fail('Kapasitas instalasi wajib diisi dalam Mbps.');
 if(['Upgrade','Downgrade'].includes(master.operation)) {
 if(before.bandwidthMbps===null||bandwidth===null) fail('Kapasitas saat ini belum diketahui; periksa Inventory.');
 if(master.operation==='Upgrade'&&bandwidth<=before.bandwidthMbps) fail('Upgrade harus menaikkan kapasitas.');
 if(master.operation==='Downgrade'&&bandwidth>=before.bandwidthMbps) fail('Downgrade harus menurunkan kapasitas.');
 }
 if(incoming.targetCustomData!==undefined&&!object(incoming.targetCustomData)) fail('Field produk tidak valid.');
 const extras=incoming.targetCustomData||{};
 const fields=serviceTemplateFields(template);
 const allowedFields=new Set(fields.map(f=>f.name));
 for(const key of Object.keys(extras)) {
  if(/^(cid|sid|id layanan|service id|circuit\s*id)$/i.test(key.trim())&&stable(extras[key])!==stable(before.customData[key])) fail('CID circuit tidak dapat diubah melalui pekerjaan layanan.');
  if(!allowedFields.has(key)&&key!=='bandwidthMbps'&&stable(extras[key])!==stable(before.customData[key])) fail(`Field produk tidak diizinkan: ${key}`);
  if(['__proto__','constructor','prototype'].includes(key)) fail('Field tidak valid.');
 }
 const customData=master.operation==='Terminate'?{...before.customData}:{...before.customData,...extras,...(bandwidth===null?{}:{bandwidthMbps:bandwidth})};
 if(master.operation!=='Terminate') for(const key of ['Bandwidth Mbps','Bandwidth (Mbps)','bandwidth_mbps']) if(Object.hasOwn(customData,key)&&bandwidth!==null) customData[key]=bandwidth;
 if(master.operation==='Terminate' && (template.id!==before.templateId||bandwidth!==before.bandwidthMbps||stable(customData)!==stable(before.customData))) fail('Terminasi hanya menonaktifkan layanan; perubahan produk/kapasitas harus melalui tiket terpisah.');
 if(master.operation!=='Terminate') validateFields(template,customData);
 const after={...before,templateId:template.id,templateName:template.name,status:master.operation==='Terminate'?'Terminated':master.operation==='Installation'?'Active':before.status,bandwidthMbps:bandwidth,customData};
 if(master.operation==='Terminate'&&!incoming.reason?.trim()) fail('Alasan terminasi wajib diisi.');
 return {data:{serviceWorkTypeId:master.id,serviceWorkTypeLabel:existing?.serviceWorkTypeId===master.id?(existing.serviceWorkTypeLabel||master.name):master.name,serviceChange:{before,after,operation:master.operation,effectiveDate:incoming.effectiveDate,reason:incoming.reason?.trim()||'',appliedAt:null}}};
}
export async function applyServiceWork(db,ticket,actorId,now=new Date()) {
 const change=ticket.serviceChange;
 if(change?.appliedAt) return {serviceChange:change,applied:false};
 if(!change?.before||!change?.after) fail('Snapshot pekerjaan layanan tidak tersedia.');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 if(change.effectiveDate>today) fail('Tanggal efektif di masa depan belum dapat di-Resolve.');
 const master=await db.serviceWorkType.findUnique({where:{id:ticket.serviceWorkTypeId}});
 if(!master||master.operation!==change.operation) fail('Jenis pekerjaan tidak tersedia atau berubah.');
 if(ticket.services?.length!==1||ticket.services[0].id!==change.before.serviceId) fail('Relasi CID tidak sesuai snapshot.',409);
 await db.$queryRaw`SELECT id FROM "Service" WHERE id = ${change.before.serviceId} FOR UPDATE`;
 const service=await db.service.findUnique({where:{id:change.before.serviceId},include:{template:true}});
 if(!service||stable(snapshotService(service))!==stable(change.before)) fail('Inventory telah berubah. Tinjau ulang pekerjaan sebelum Resolve.',409);
 const template=await db.serviceTemplate.findUnique({where:{id:change.after.templateId}});
 if(!template||(!template.active&&change.operation!=='Terminate')) fail('Produk tujuan tidak aktif/tidak tersedia.');
 if(change.operation!=='Terminate') validateFields(template,change.after.customData);
 const result=await db.service.updateMany({where:{id:service.id,updatedAt:service.updatedAt},data:{templateId:change.after.templateId,status:change.after.status,customData:change.after.customData}});
 if(result.count!==1) fail('Inventory telah berubah. Tinjau ulang pekerjaan sebelum Resolve.',409);
 const updated=await db.service.findUnique({where:{id:service.id},include:{template:true}});
 return {applied:true,serviceChange:{...change,after:snapshotService(updated),appliedAt:now.toISOString(),appliedBy:actorId}};
}
