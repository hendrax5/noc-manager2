/** CID belongs to a service/link. Retain the legacy inventory aliases until deliberately normalized. */
export class CidValidationError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function getServiceCid(service) {
  if (typeof service?.cid === 'string' && service.cid.trim()) return service.cid.trim();
  const cd = service?.customData;
  if (!cd || typeof cd !== 'object' || Array.isArray(cd)) return '';
  const key = Object.keys(cd).find((name) => /^(cid|sid|id layanan|service id|circuit\s*id)$/i.test(name.trim()) && String(cd[name] ?? '').trim());
  return key ? String(cd[key]).trim() : '';
}

export function normalizeCid(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new CidValidationError('CID harus berupa teks.');
  const cid = value.normalize('NFKC').trim().toUpperCase();
  if (!cid) return null;
  if (cid.length > 100 || /[\u0000-\u001f]/.test(cid)) throw new CidValidationError('CID maksimal 100 karakter tanpa karakter kontrol.');
  return cid;
}
