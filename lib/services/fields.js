/** Shared semantic fields. Unitless legacy values are never assigned a unit. */
export function isBandwidthField(name){return /^(bandwidth|bandwith|bandwidht|kapasitas|capacity)(gbps|mbps)?$/.test(String(name||'').normalize('NFKC').toLowerCase().replace(/[^a-z]/g,''));}
export function bandwidthFieldUnit(name){if(!isBandwidthField(name))return null;return /gbps/i.test(name)?'Gbps':/mbps/i.test(name)?'Mbps':'unknown';}
export function isCircuitField(name){return /^(cid|sid|idlayanan|serviceid|circuitid)$/.test(String(name||'').toLowerCase().replace(/[^a-z]/g,''));}
export function capacityCustomData(data,mbps){const next={...data,bandwidthMbps:mbps};for(const key of Object.keys(next)){const unit=bandwidthFieldUnit(key);if(unit==='Gbps')next[key]=mbps/1000;if(unit==='Mbps')next[key]=mbps;}return next;}

export function isPlaceholderField(name){return /^[\s\-–—.]*$/.test(String(name||''));}
