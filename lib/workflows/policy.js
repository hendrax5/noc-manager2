const operations = ['Installation', 'Upgrade', 'Downgrade', 'Change', 'Terminate', 'BOD'];
export class WorkflowError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = message => { throw new WorkflowError(message); };
export function workflowContext(ticket) {
  return {
    workType: ticket.workType,
    operation: ticket.serviceChange?.operation || null,
    originCompany: ticket.customData?.['Order Origin'] || null,
    executorCompany: ticket.customData?.['Executing Vendor'] || null,
    departmentId: ticket.departmentId,
  };
}
export function validateWorkflowPolicy(policy, { companyNames } = {}) {
  if (!['Trouble', 'Installation', 'ServiceWork'].includes(policy.workType)) fail('Klasifikasi workflow tidak valid.');
  if (policy.workType === 'ServiceWork' ? !operations.includes(policy.operation) : Boolean(policy.operation)) fail('Operasi workflow tidak valid.');
  for (const field of ['originCompany', 'executorCompany']) {
    if (policy[field] && (typeof policy[field] !== 'string' || (companyNames && !companyNames.includes(policy[field])))) fail('Identitas perusahaan tidak valid.');
  }
  if (!Array.isArray(policy.phases) || !policy.phases.length || policy.phases.length > 20) fail('Isi 1 sampai 20 fase.');
  const keys = new Set();
  for (const phase of policy.phases) {
    if (!/^[a-z][a-z0-9_-]{0,39}$/.test(phase.key) || keys.has(phase.key) || typeof phase.label !== 'string' || !phase.label.trim() || phase.label.length > 80) fail('Definisi fase tidak valid atau duplikat.');
    keys.add(phase.key);
    if (!Number.isSafeInteger(phase.jobCategoryId) || phase.jobCategoryId < 1 || phase.category?.active === false) fail('Pilih kategori aktif untuk setiap fase.');
  }
  return policy;
}
export function resolveWorkflow({ policies = [], at = new Date(), ...context }) {
  const timestamp = new Date(at).getTime();
  if (!Number.isFinite(timestamp)) fail('Tanggal workflow tidak valid.');
  const matches = policies.filter(policy => policy.publishedAt && new Date(policy.publishedAt).getTime() <= timestamp && new Date(policy.effectiveFrom).getTime() <= timestamp && (!policy.effectiveTo || timestamp < new Date(policy.effectiveTo).getTime()) && policy.workType === context.workType && (policy.operation || null) === (context.operation || null) && ['originCompany', 'executorCompany', 'departmentId', 'roleId'].every(key => policy[key] == null || policy[key] === context[key]));
  const specificity = policy => ['originCompany', 'executorCompany', 'departmentId', 'roleId'].filter(key => policy[key] != null).length;
  matches.sort((a, b) => specificity(b) - specificity(a));
  if (!matches.length) return null;
  if (matches[1] && specificity(matches[0]) === specificity(matches[1])) fail('Workflow ambigu. Hubungi Admin.');
  const policy = validateWorkflowPolicy(matches[0]);
  return { policyVersionId: policy.id, phases: policy.phases.map(({ id, key, label, jobCategoryId }) => ({ ...(id ? { definitionId: id } : {}), key, label, jobCategoryId })) };
}
