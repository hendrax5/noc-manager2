/** Stable presentation palette; department identities and grouping remain unchanged. */
const roles=['info','warning','violet','success','danger','indigo','orange','accent'];
export function departmentColor(departmentId){const role=roles[Math.abs(Number(departmentId)||0)%roles.length],bg=role==='accent'?'var(--ui-tint)':`var(--ui-${role}-bg)`,accent=`var(--ui-${role})`;return {bg,header:bg,accent,cell:bg,off:bg,text:'var(--ui-ink)'};}
