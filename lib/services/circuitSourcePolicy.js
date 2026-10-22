export function classifyCircuitSource(ticket) {
  const category = String(ticket?.jobCategory?.name || '').trim().toLowerCase();
  if (ticket?.workType === 'Trouble' || /troubleshoot|trouble\s*ticket|monitoring|daily\s*report/.test(category)) return { eligibility: 'excluded', reason: 'Trouble/aktivitas operasional bukan sumber CID baru.' };
  if (['ServiceWork','Installation'].includes(ticket?.workType) || ['installasi','instalasi','installasi/terminate','upgrade/downgrade','terminate'].includes(category)) return { eligibility: 'eligible', reason: 'Pekerjaan layanan teridentifikasi.' };
  return { eligibility: 'review', reason: 'Klasifikasi tiket lama perlu dikonfirmasi sebagai pekerjaan layanan.' };
}
