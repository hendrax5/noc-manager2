import {isDarkFiber,readPairCount} from '../services/productUnits.js';
/** Convert a server-owned snapshot into editable request fields, never its audit markers. */
export function serviceWorkInput(change) {
  if (!change || typeof change !== 'object') return {};
  if (!change.after) return {
    ...(change.bod?{bodStartAt:change.bod.startsAt,bodEndAt:change.bod.endsAt}:{}),
    targetTemplateId: change.targetTemplateId,
    bandwidthMbps: change.bandwidthMbps,
    ...(change.pairCount!==undefined?{pairCount:change.pairCount}:{}),
    effectiveDate: change.effectiveDate || '',
    reason: change.reason || '',
    targetCustomData: change.targetCustomData || {},
  };
  return {
    ...(change.bod?{bodStartAt:change.bod.startsAt,bodEndAt:change.bod.endsAt}:{}),
    targetTemplateId: change.after.templateId,
    bandwidthMbps: change.after.bandwidthMbps,
    ...(isDarkFiber({name:change.after.templateName})?{pairCount:readPairCount({customData:change.after.customData})}:{}),
    effectiveDate: change.effectiveDate || '',
    reason: change.reason || '',
    targetCustomData: change.after.customData || {},
    ...(change.operation==='DataCenter'&&change.workDetails?{workDetails:change.workDetails}:{}),
  };
}

export function serviceWorkResolveMessage(ticket) {
  const change = ticket.serviceChange;
  if(change?.operation==='BOD') return change.bod?.restoredAt?'Bandwidth normal sudah dikembalikan. Selesaikan tiket BOD?':'Kembalikan bandwidth normal dan konfirmasi sebelum Resolve BOD.';
  if (!change || change.appliedAt) return '';
  return [
    `Resolve ${ticket.serviceWorkTypeLabel || 'pekerjaan layanan'} pada CID ${change.before?.cid || 'terpilih'}?`,
    `Produk: ${change.before?.templateName || '—'} → ${change.after?.templateName || '—'}`,
    isDarkFiber({name:change.before?.templateName})||isDarkFiber({name:change.after?.templateName})?`Kapasitas: ${snapshotCapacity(change.before)} → ${snapshotCapacity(change.after)}`:`Kapasitas: ${change.before?.bandwidthMbps ?? '—'} → ${change.after?.bandwidthMbps ?? '—'} Mbps`,
    `Status layanan: ${change.before?.status || '—'} → ${change.after?.status || '—'}`,
    `Tanggal efektif: ${change.effectiveDate || '—'}`,
    change.registration==='new'?'Layanan/CID baru didaftarkan oleh tiket ini dan akan diaktifkan otomatis ke Inventory saat Resolve. Pastikan pekerjaan telah dilaksanakan.':change.operation==='DataCenter'?'Pekerjaan Data Center dicatat tanpa mengubah produk, kapasitas, atau status layanan. Pastikan pekerjaan telah dilaksanakan.':'Perubahan diterapkan otomatis ke Inventory. Pastikan pekerjaan telah dilaksanakan.',
  ].join('\n');
}

export function snapshotCapacity(snapshot){return isDarkFiber({name:snapshot?.templateName})?(readPairCount({customData:snapshot?.customData})??'—')+' pair':(snapshot?.bandwidthMbps??'—')+' Mbps';}
