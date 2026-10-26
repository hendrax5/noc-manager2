import {ServiceWorkError} from './serviceWork.js';
import {companiesFromConfig, normalizeCompany as normalize} from '../companies/registry.js';
export async function automaticWorkMetadata(db,body,config={}){
 if(!['Trouble','Installation','ServiceWork'].includes(body.workType))return body;
 let categoryId,workOperation=null;
 if(body.workType==='ServiceWork'){
 const type=await db.serviceWorkType.findUnique({where:{id:Number(body.serviceWorkTypeId)}});
 categoryId=type?.defaultJobCategoryId;
 workOperation=type?.operation;
 }else{
 let defaults={};try{defaults=JSON.parse((await db.appSetting.findUnique({where:{key:'ticket_work_defaults'}}))?.value||'{}');}catch{}
 categoryId=defaults[body.workType];
 }
 if(!Number.isSafeInteger(categoryId)||!(await db.jobCategory.findUnique({where:{id:categoryId}}))?.active)throw new ServiceWorkError('Kategori otomatis belum dipetakan ke master aktif. Hubungi Admin.');
 const data={...body.customData},companies=companiesFromConfig(config);
 const services=await db.service.findMany({where:{id:{in:body.serviceIds||[]}},select:{id:true,customerId:true,company:true,customData:true}});
 if(body.formVersion==='work-v2'){
 delete data['Order Origin'];delete data['Executing Vendor'];
 const routing=services.map(s=>{let orderCompany=null,raw=s.company||s.customData?.['Order Origin'];try{if(raw)orderCompany=normalize(raw,companies);}catch{}return {serviceId:s.id,customerId:s.customerId,orderCompany};});
 data.serviceRouting=routing;
 const origins=[...new Set(routing.map(s=>s.orderCompany).filter(Boolean))];
 data.routingStatus=routing.length&&routing.every(s=>s.orderCompany)?origins.length===1?'linked':'mixed':'needs_mapping';
 if(data.routingStatus==='linked')data['Order Origin']=origins[0];
 const department=workOperation==='DataCenter'?await db.department.findUnique({where:{id:Number(body.departmentId)},select:{name:true}}):null;
 if(workOperation==='DataCenter'&&String(department?.name||'').replace(/[^a-z0-9]/gi,'').toLowerCase()!=='nocdatacenter')throw new ServiceWorkError('Pekerjaan Data Center harus diarahkan ke departemen NocDatacenter.');
 const assigned=body.assigneeId&&db.employeeAssignmentPeriod?await db.employeeAssignmentPeriod.findMany({where:{userId:Number(body.assigneeId),effectiveFrom:{lte:new Date()},OR:[{effectiveTo:null},{effectiveTo:{gt:new Date()}}]}}):[];
 const executor=workOperation==='DataCenter'?'SDC':assigned.length===1?assigned[0].company:config.deptCompanyMap?.[body.departmentId];
 if(typeof executor==='string'&&companies.some(item=>item.code===executor))data['Executing Vendor']=executor;
 }
 return {...body,jobCategoryId:categoryId,customData:data};
}
