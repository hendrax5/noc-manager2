export const COMPANY_OPTIONS=['ION','SDC'];
export function normalizeCompany(value='ION'){
 const normalized=String(value||'ION').trim().toUpperCase();
 if(normalized==='PRODC'||normalized==='SDC')return 'SDC';
 if(normalized==='ION')return 'ION';
 throw new Error('Perusahaan layanan harus ION atau SDC.');
}
export function companyForDepartment(name){
 const normalized=String(name||'').replace(/[^a-z0-9]/gi,'').toLowerCase();
 return normalized==='nocdatacenter'?'SDC':'ION';
}
