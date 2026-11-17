const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const fmtNumber = (value, maxDigits = 1) =>
  value == null || !Number.isFinite(Number(value))
    ? 'Belum tersedia'
    : new Intl.NumberFormat('id-ID', { maximumFractionDigits: maxDigits }).format(Number(value));

export const fmtSigned = value =>
  value == null || !Number.isFinite(Number(value))
    ? '—'
    : `${Number(value) > 0 ? '+' : ''}${fmtNumber(value)}`;

export const fmtMinutes = mins => {
  if (mins == null || !Number.isFinite(Number(mins))) return 'Belum tersedia';
  const rounded = Math.round(Number(mins) * 10) / 10;
  if (rounded < 60) return `${fmtNumber(rounded)} mnt`;
  const hours = Math.floor(rounded / 60);
  const rem = Math.round(rounded % 60);
  return rem ? `${hours}j ${rem}m` : `${hours}j`;
};

export const fmtPercent = value =>
  value == null || !Number.isFinite(Number(value)) ? 'Belum tersedia' : `${fmtNumber(value)}%`;

export const fmtMonthShort = monthKey => {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '';
  const [year, month] = monthKey.split('-').map(Number);
  return `${MONTHS_ID[month - 1] || month} ${String(year).slice(-2)}`;
};

export const fmtEvalStatus = value =>
  ({
    excluded: 'Dikecualikan',
    insufficient_data: 'Belum cukup bukti',
    ready: 'Siap direview',
    locked: 'Terkunci',
    reviewed: 'Sudah direview',
    unpublished: 'Belum dipublikasikan',
  })[value] || value;

export function polarityClass(styles, polarity) {
  if (polarity === 'improved') return styles.polarityImproved;
  if (polarity === 'declined') return styles.polarityDeclined;
  if (polarity === 'warning') return styles.polarityWarning;
  if (polarity === 'new') return styles.polarityNew;
  return styles.polarityNeutral;
}

export function formatDeltaBadge(deltaObj, { kind = 'count' } = {}) {
  if (!deltaObj || deltaObj.status === 'unavailable' || deltaObj.delta == null) {
    return { text: 'Pembanding belum ada', polarity: 'neutral' };
  }
  if (deltaObj.isNewActivity) {
    return { text: `Baru aktif (+${fmtNumber(deltaObj.delta)})`, polarity: 'new' };
  }
  if (deltaObj.polarity === 'flat' || deltaObj.delta === 0) {
    const sign = deltaObj.delta > 0 ? '+' : '';
    const unit = kind === 'pp' ? ' pp' : kind === 'minutes' ? ' mnt' : '';
    return { text: `Stabil (${sign}${fmtNumber(deltaObj.delta)}${unit})`, polarity: 'neutral' };
  }
  if (kind === 'pp') {
    const sign = deltaObj.delta > 0 ? '+' : '';
    return { text: `${sign}${fmtNumber(deltaObj.delta)} pp`, polarity: deltaObj.polarity };
  }
  if (kind === 'minutes') {
    const absVal = fmtNumber(Math.abs(deltaObj.delta));
    if (deltaObj.delta < 0) return { text: `${absVal} mnt lebih cepat`, polarity: 'improved' };
    return { text: `+${absVal} mnt lebih lambat`, polarity: 'declined' };
  }
  const sign = deltaObj.delta > 0 ? '+' : '';
  const pct =
    deltaObj.percentDelta != null
      ? ` (${deltaObj.percentDelta > 0 ? '+' : ''}${fmtNumber(deltaObj.percentDelta, 0)}%)`
      : '';
  return { text: `${sign}${fmtNumber(deltaObj.delta)}${pct}`, polarity: deltaObj.polarity };
}

export function trendDirectionMeta(direction) {
  switch (direction) {
    case 'up':
      return { label: '▲ Naik', polarity: 'improved' };
    case 'down':
      return { label: '▼ Turun', polarity: 'declined' };
    case 'new':
      return { label: '★ Baru', polarity: 'new' };
    case 'flat':
      return { label: '● Stabil', polarity: 'neutral' };
    default:
      return { label: '— Belum aktif', polarity: 'neutral' };
  }
}

export function buildCompareMonthOptions(monthKey, count = 6) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return [];
  const [year, month] = monthKey.split('-').map(Number);
  const options = [];
  for (let i = 1; i <= count; i += 1) {
    const key = new Date(Date.UTC(year, month - 1 - i, 1)).toISOString().slice(0, 7);
    options.push({
      key,
      label: i === 1 ? `Bulan sebelumnya (${fmtMonthShort(key)})` : `${fmtMonthShort(key)} (${i} bln lalu)`,
    });
  }
  return options;
}
