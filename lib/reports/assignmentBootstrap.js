import {companyForDepartment} from '../companies/policy.js';
export function assignmentCandidates({users,departments,eligibility,existingUserIds=new Set()}){
 const byDepartment=new Map(departments.map(row=>[row.id,row]));
 const excluded=new Set(eligibility.filter(row=>row.enabled===false).map(row=>row.departmentId));
 const result={create:[],skippedExisting:[],skippedExcluded:[],skippedIncomplete:[]};
 for(const user of users){
  if(existingUserIds.has(user.id)){result.skippedExisting.push(user.id);continue;}
  if(!user.departmentId||!user.roleId||!byDepartment.has(user.departmentId)){result.skippedIncomplete.push(user.id);continue;}
  if(excluded.has(user.departmentId)){result.skippedExcluded.push(user.id);continue;}
  result.create.push({userId:user.id,departmentId:user.departmentId,roleId:user.roleId,company:companyForDepartment(byDepartment.get(user.departmentId).name)});
 }
 return result;
}
