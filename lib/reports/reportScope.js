export function getReportScope(actor,{users=[],grants=[],period=new Date()}={}){
 const self=Number(actor?.id);if(!Number.isSafeInteger(self)||self<1)return {userIds:[],departmentIds:[],companyIds:[],all:false};
 if(actor.role==='Admin')return {userIds:users.map(u=>u.id),departmentIds:[],companyIds:[],all:true};
 const ids=new Set([self]),departments=new Set(),companies=new Set();
 const managerial=actor.role==='Manager'||actor.permissions?.includes('view_team_reports');
 const at=new Date(period).getTime();
 if(!Number.isFinite(at))return {userIds:[self],departmentIds:[],companyIds:[],all:false};
 for(const grant of managerial?grants:[]){
  if(Number(grant.actorId)!==self||new Date(grant.effectiveFrom).getTime()>at||(grant.effectiveTo&&at>=new Date(grant.effectiveTo).getTime()))continue;
  if(grant.departmentId==null&&!grant.userId)continue;
  // Company is mandatory for department grants; an explicit user grant also requires matching company.
  if(!grant.company)continue;
  for(const u of users)if(u.company===grant.company&&(grant.departmentId==null||u.departmentId===grant.departmentId)&&(!grant.userId||u.id===grant.userId))ids.add(u.id);
  if(grant.departmentId)departments.add(grant.departmentId);
  companies.add(grant.company);
 }
 return {userIds:[...ids].sort((a,b)=>a-b),departmentIds:[...departments],companyIds:[...companies],all:false};
}
export const canReadReport=(scope,userId)=>Boolean(scope?.all||scope?.userIds?.includes(Number(userId)));
