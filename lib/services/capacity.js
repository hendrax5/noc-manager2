/** Canonical Mbps, with explicit unit-bearing legacy aliases only. */
export function readServiceBandwidthMbps(service) {
  const data = service?.customData || {};
  if (Object.hasOwn(data, 'bandwidthMbps')) { const n = Number(data.bandwidthMbps); return ['number','string'].includes(typeof data.bandwidthMbps) && Number.isFinite(n) && n > 0 ? n : null; }
  const keys = [ 'Bandwidth Mbps', 'Bandwidth (Mbps)', 'bandwidth_mbps'];
  const present = keys.filter(k => data[k] !== undefined && data[k] !== '');
  if (present.some(key => !['number','string'].includes(typeof data[key]))) return null;
  const values = present.map(k => Number(data[k]));
  if (!values.length || values.some(v => !Number.isFinite(v) || v <= 0) || values.some(v => v !== values[0])) return null;
  return values[0];
}
