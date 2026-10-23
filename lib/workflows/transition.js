export function validatePhaseTransition({currentPhase,nextPhase,actor,policy,overrideCategoryId,reason}) {
 const deny=reason=>({allowed:false,reason});
 if(!actor?.id||!currentPhase||currentPhase.state!=='Active')return deny('Fase tidak aktif.');
 if(Number(currentPhase.assigneeId)!==Number(actor.id)&&actor.role!=='Admin'&&!actor.permissions?.includes('manage_workflows'))return deny('Hanya pelaksana fase atau pengelola berizin.');
 const i=policy.phases.findIndex(p=>p.key===currentPhase.key);
 if(i<0||(policy.phases[i+1]?.key||null)!==(nextPhase||null))return deny('Fase harus diselesaikan berurutan.');
 if(overrideCategoryId&&(!(actor.role==='Admin'||actor.permissions?.includes('override_workflow_category'))||typeof reason!=='string'||!reason.trim()))return deny('Override kategori membutuhkan izin dan alasan.');
 return {allowed:true,reason:null};
}
