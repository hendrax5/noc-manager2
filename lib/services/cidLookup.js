import { getServiceCid, normalizeCid, CidValidationError } from './cid.js';

export async function checkServiceCid(db, candidate, exceptId = null) {
  if (candidate.cid != null && typeof candidate.cid !== 'string') throw new CidValidationError('CID harus berupa teks.');
  const cid = normalizeCid(getServiceCid(candidate));
  if (!cid) return null;
  // Canonical uniqueness is enforced by PostgreSQL; this also protects legacy JSON-only CIDs.
  const services = await db.service.findMany({ select: { id: true, cid: true, customData: true } });
  if (services.some((s) => s.id !== exceptId && getServiceCid(s).normalize('NFKC').trim().toUpperCase() === cid)) {
    throw new CidValidationError('CID sudah digunakan oleh layanan lain.', 409);
  }
  return cid;
}

export async function findServiceIdsByCid(db, query) {
  const needle = String(query || '').normalize('NFKC').trim().toLowerCase();
  if (!needle) return [];
  const services = await db.service.findMany({ select: { id: true, cid: true, customData: true } });
  return services.filter((s) => getServiceCid(s).normalize('NFKC').toLowerCase().includes(needle)).map((s) => s.id);
}
