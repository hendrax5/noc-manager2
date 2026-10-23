import {getReportScope} from './reportScope';
export async function loadReportScope(db,actor,period=new Date()){
 const at=new Date(period);
 const [users,assignments,grants]=await Promise.all([
 db.user.findMany({select:{id:true,name:true,departmentId:true,department:{select:{name:true}},roleId:true}}),
 db.employeeAssignmentPeriod.findMany({where:{effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]}}),
 db.reportAccessGrant.findMany({where:{actorId:Number(actor.id),effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]}})
 ]);
 const resolved=users.map(u=>{
 const a=assignments.filter(a=>a.userId===u.id);
 return a.length===1?{...u,departmentId:a[0].departmentId,roleId:a[0].roleId,company:a[0].company}:{...u,company:null};
 });
 return {scope:getReportScope(actor,{users:resolved,grants,period:at}),users:resolved};
}
