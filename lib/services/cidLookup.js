import { formatCustomerId } from '../customers/identity.js';
import { getServiceCid, normalizeCid, CidValidationError } from './cid.js';
import { resolveCircuitIdentifier, serviceCodes } from './circuitRegistry.js';

export async function checkServiceCid(db, candidate, exceptId = null) {
  if (candidate.cid != null && typeof candidate.cid !== 'string') throw new CidValidationError('CID harus berupa teks.');
  if (serviceCodes(candidate).length>1) throw new CidValidationError('Field CID lama bertentangan dengan CID utama. Gunakan Penautan CID untuk mengonfirmasi alias circuit.',409);
  const cid = normalizeCid(getServiceCid(candidate));
  if (!cid) return null;
  const resolution=await resolveCircuitIdentifier(db,cid);
  if (resolution.status==='conflict'||(resolution.serviceId&&resolution.serviceId!==exceptId)) throw new CidValidationError('CID sudah digunakan oleh layanan lain.',409);
  return cid;
}

export async function findServiceIdsByCid(db, query) {
  const needle = String(query || '').normalize('NFKC').trim().toLowerCase();
  if (!needle) return [];
  const services = await db.service.findMany({ select: { id: true, customerId: true, cid: true, customData: true, identifiers: {select:{code:true}} } });
  return services.filter((s) => (formatCustomerId({id:s.customerId}).toLowerCase().includes(needle)||serviceCodes(s).some(code=>code.toLowerCase().includes(needle)))).map((s) => s.id);
}
