import {WorkflowError} from '../workflows/policy.js';
export function jakartaMonthRange(monthKey){
 if(typeof monthKey!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey))throw new WorkflowError('Bulan tidak valid.');
 const [year,month]=monthKey.split('-').map(Number);
 if(year<2000||year>2100)throw new WorkflowError('Bulan di luar rentang.');
 return {gte:new Date(Date.UTC(year,month-1,1)-7*3600000),lt:new Date(Date.UTC(year,month,1)-7*3600000)};
}
export const jakartaMonthKey=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit'}).format(now).slice(0,7);
export function previousMonthKey(monthKey){const [year,month]=monthKey.split('-').map(Number);return new Date(Date.UTC(year,month-2,1)).toISOString().slice(0,7);}
