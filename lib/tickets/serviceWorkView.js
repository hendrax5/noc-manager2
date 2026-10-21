/** Convert a server-owned snapshot into editable request fields, never its audit markers. */
export function serviceWorkInput(change) {
  if (!change || typeof change !== 'object') return {};
  if (!change.after) return {
    targetTemplateId: change.targetTemplateId,
    bandwidthMbps: change.bandwidthMbps,
    effectiveDate: change.effectiveDate || '',
    reason: change.reason || '',
    targetCustomData: change.targetCustomData || {},
  };
  return {
    targetTemplateId: change.after.templateId,
    bandwidthMbps: change.after.bandwidthMbps,
    effectiveDate: change.effectiveDate || '',
    reason: change.reason || '',
    targetCustomData: change.after.customData || {},
  };
}

export function serviceWorkResolveMessage(ticket) {
  const change = ticket.serviceChange;
  if (!change || change.appliedAt) return '';
  return [
    `Resolve ${ticket.serviceWorkTypeLabel || 'pekerjaan layanan'} pada CID ${change.before?.cid || 'terpilih'}?`,
    `Produk: ${change.before?.templateName || '—'} → ${change.after?.templateName || '—'}`,
    `Kapasitas: ${change.before?.bandwidthMbps ?? '—'} → ${change.after?.bandwidthMbps ?? '—'} Mbps`,
    `Status layanan: ${change.before?.status || '—'} → ${change.after?.status || '—'}`,
    `Tanggal efektif: ${change.effectiveDate || '—'}`,
    'Perubahan diterapkan otomatis ke Inventory. Pastikan pekerjaan telah dilaksanakan.',
  ].join('\n');
}
