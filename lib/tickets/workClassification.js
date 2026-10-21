import { getServiceCid } from '../services/cid.js';

export class TicketClassificationError extends Error {}
export const WORK_TYPES = ['Unclassified', 'Trouble', 'Installation', 'ServiceWork'];
export const WORK_TYPE_LABELS = { Unclassified: 'Belum diklasifikasikan', Trouble: 'Trouble', Installation: 'Instalasi', ServiceWork: 'Pekerjaan Layanan' };
export const CLASSIFICATION_FIELDS = ['workType', 'sapReference', 'symptomId', 'causeId'];
export const hasClassificationInput = (body) => CLASSIFICATION_FIELDS.some((key) => Object.hasOwn(body, key));
export function classificationFieldsChanged(body, existing) {
  return CLASSIFICATION_FIELDS.some((key) => {
    if (!Object.hasOwn(body, key)) return false;
    if (key === 'workType') return body[key] !== (existing.workType || 'Unclassified');
    if (key === 'sapReference') return (typeof body[key] === 'string' ? body[key].trim() || null : body[key] ?? null) !== (existing[key] || null);
    const value = body[key] == null || body[key] === '' ? null : Number(body[key]);
    return value !== (existing[key] ?? null);
  });
}
export function affectedServicesChanged(body, existing) {
  if (!Object.hasOwn(body, 'serviceIds')) return false;
  if (!Array.isArray(body.serviceIds)) return true;
  const incoming = [...new Set(body.serviceIds.map(Number))].sort((a,b)=>a-b);
  const current = (existing.services || []).map((s)=>s.id).sort((a,b)=>a-b);
  return JSON.stringify(incoming) !== JSON.stringify(current);
}
export function workTypeWhere(value) { return WORK_TYPES.includes(value) ? { workType: value } : {}; }

function positiveId(value, label) {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) throw new TicketClassificationError(`${label} tidak valid.`);
  return Number(value);
}

export function parseServiceIds(value) {
  if (!Array.isArray(value)) throw new TicketClassificationError('Daftar layanan harus berupa array.');
  if (value.length > 200) throw new TicketClassificationError('Maksimal 200 layanan per tiket.');
  return [...new Set(value.map((id) => positiveId(id, 'ID layanan')))];
}

/** Validates new explicit metadata only; ordinary updates to old tickets remain backward-compatible. */
export async function prepareTicketClassification(db, body, existing = null) {
  const creating = !existing;
  const touched = hasClassificationInput(body);
  const servicesTouched = Object.hasOwn(body, 'serviceIds');
  if (!creating && !touched && !servicesTouched) return { data: {}, serviceIds: null };
  const workType = body.workType === undefined ? (existing?.workType || 'Unclassified') : body.workType;
  if (!WORK_TYPES.includes(workType)) throw new TicketClassificationError('Klasifikasi pekerjaan tidak valid.');
  const data = { workType };
  let serviceIds = servicesTouched ? parseServiceIds(body.serviceIds) : null;
  if (workType === 'Trouble') {
    const selected = serviceIds === null
      ? (existing?.services || [])
      : await db.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, cid: true, customData: true } });
    if (!selected.length || (serviceIds !== null && selected.length !== serviceIds.length) || selected.some((s) => !getServiceCid(s))) throw new TicketClassificationError('Trouble wajib ditautkan ke layanan/CID yang valid. Pilih layanan dari inventory.');
    for (const [key, label, kind] of [['symptomId', 'Gejala', 'symptom'], ['causeId', 'Penyebab', 'cause']]) {
      const id = positiveId(body[key] === undefined ? existing?.[key] : body[key], label);
      const choice = await db.troubleMasterEntry.findUnique({ where: { id } });
      const unchanged = existing?.workType === 'Trouble' && id === existing[key];
      if (!choice || choice.kind !== kind || (!choice.active && !unchanged)) throw new TicketClassificationError(`${label} harus dipilih dari master aktif yang sesuai.`);
      data[key] = id;
      const snapshot = key === 'symptomId' ? 'symptomLabel' : 'causeLabel';
      data[snapshot] = unchanged && existing[snapshot] ? existing[snapshot] : choice.name;
    }
    data.sapReference = null;
  } else {
    data.symptomId = null; data.causeId = null; data.symptomLabel = null; data.causeLabel = null;
    if (['Installation','ServiceWork'].includes(workType)) {
      const ref = body.sapReference === undefined && ['Installation','ServiceWork'].includes(existing?.workType) ? existing.sapReference : body.sapReference;
      if (ref != null && typeof ref !== 'string') throw new TicketClassificationError('Referensi SAP harus berupa teks.');
      data.sapReference = ref?.trim() || null;
      if (data.sapReference && (data.sapReference.length > 80 || /[\u0000-\u001f]/.test(data.sapReference))) throw new TicketClassificationError('Referensi SAP maksimal 80 karakter tanpa karakter kontrol.');
    } else data.sapReference = null;
  }
  return { data, serviceIds };
}
