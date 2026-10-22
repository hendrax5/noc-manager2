import { normalizeCid, CidValidationError } from './cid.js';
import { parseCircuitIdentifier } from './circuitIdentifier.js';

export function serviceCodes(service) {
  const legacy = Object.entries(service.customData || {}).filter(([key])=>/^(cid|sid|id layanan|service id|circuit\s*id)$/i.test(key.trim())).map(([,value])=>value);
  return [...new Set([service.cid,...legacy,...(service.identifiers || []).map(item=>item.code)].filter(value=>typeof value==='string'&&value.trim()).map(normalizeCid))];
}
export async function lockCircuitCodes(tx, codes) {
  for (const code of [...new Set(codes.map(normalizeCid).filter(Boolean))].sort()) await tx.$queryRaw`SELECT 'locked'::text AS locked FROM pg_advisory_xact_lock(hashtext(${`circuit-code:${code}`}))`;
}
export async function resolveCircuitIdentifier(db, value) {
  const code = normalizeCid(value);
  if (!code) return {status:'missing'};
  const [services,identifiers] = await Promise.all([
    db.service.findMany({select:{id:true,cid:true,customData:true}}),
    db.serviceIdentifier ? db.serviceIdentifier.findMany({where:{code},select:{serviceId:true,code:true}}) : [],
  ]);
  const ids = new Set([...services.filter(service=>serviceCodes(service).includes(code)).map(service=>service.id),...identifiers.filter(item=>item.code===code).map(item=>item.serviceId)]);
  return ids.size > 1 ? {status:'conflict'} : ids.size === 1 ? {status:'matched',serviceId:[...ids][0]} : {status:'missing'};
}
/** Caller owns the transaction; registration never changes Service inventory version. */
export async function registerCircuitIdentifier(tx, {serviceId,code:input,sourceTicketId=null,actorId=null}) {
  const code=normalizeCid(input);
  if (!code) throw new CidValidationError('Kode layanan wajib diisi.');
  await lockCircuitCodes(tx,[code]);
  const resolution=await resolveCircuitIdentifier(tx,code);
  if (resolution.status==='conflict'||(resolution.serviceId&&resolution.serviceId!==serviceId)) throw new CidValidationError('Kode sudah digunakan layanan lain.',409);
  const existing=await tx.serviceIdentifier.findMany({where:{code}});
  if (existing.some(item=>item.code===code&&item.serviceId===serviceId)) return existing.find(item=>item.code===code);
  return tx.serviceIdentifier.create({data:{serviceId,code,originalCode:input,family:parseCircuitIdentifier(code)?.family||'manual',sourceTicketId,actorId}});
}
