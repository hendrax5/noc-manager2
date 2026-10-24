import {WorkflowError} from '../workflows/policy.js';

export function validatePerformancePolicy(input) {
 if(input==null)return {rankable:false,calibrationKey:null};
 const r={...input};
 if(typeof r.calibrationKey!=='string'||!r.calibrationKey.trim()||r.calibrationKey.length>80||!Array.isArray(r.calibratedRoles)||!r.calibratedRoles.length||r.calibratedRoles.some(x=>!Number.isSafeInteger(x)||x<1))throw new WorkflowError('Kalibrasi peran tidak valid.');
 if(!Number.isFinite(r.minimumCoverage)||r.minimumCoverage<=0||r.minimumCoverage>1||!Number.isSafeInteger(r.reportDeadlineMinutes)||r.reportDeadlineMinutes<0||r.reportDeadlineMinutes>10080||!Number.isSafeInteger(r.reworkWindowDays)||r.reworkWindowDays<1||r.reworkWindowDays>90)throw new WorkflowError('Aturan cakupan, tenggat, atau observasi tidak valid.');
 return {...r,calibrationKey:r.calibrationKey.trim(),rankable:true};
}
