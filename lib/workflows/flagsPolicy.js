export function parseWorkflowFlags(value,schemaInstalled){
 let values={};try{values=JSON.parse(value||'{}');}catch{}
 return {work_phase_enabled:values?.work_phase_enabled===true,structured_daily_enabled:values?.structured_daily_enabled===true,monthly_evaluation_mode:['simulation','official'].includes(values?.monthly_evaluation_mode)?values.monthly_evaluation_mode:'off',privacy_enforced:Boolean(schemaInstalled)};
}
