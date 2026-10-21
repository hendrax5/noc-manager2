import { prisma } from '@/lib/prisma';
import { SERVICE_WORK_OPERATIONS, ServiceWorkError } from '@/lib/tickets/serviceWork';
export { getMasterUser } from '../trouble-masters/user';
export function canManage(user) { return user?.role?.name==='Admin'||(user?.role?.permissions||[]).includes('manage_service_work'); }
export async function validate(body,existing=null) {
 const data={};
 if(!body||typeof body!=='object'||Array.isArray(body)) throw new ServiceWorkError('Data master tidak valid.');
 if(!existing||Object.hasOwn(body,'name')) { if(typeof body.name!=='string') throw new ServiceWorkError('Nama wajib diisi maksimal 80 karakter.'); data.name=body.name.normalize('NFKC').trim().replace(/\s+/gu,' '); if(!data.name||data.name.length>80||/[\u0000-\u001f]/.test(data.name)) throw new ServiceWorkError('Nama wajib diisi maksimal 80 karakter tanpa karakter kontrol.'); data.normalizedName=data.name.toLowerCase(); }
 if(!existing||Object.hasOwn(body,'operation')) { if(!SERVICE_WORK_OPERATIONS.includes(body.operation)||existing&&existing.operation!==body.operation) throw new ServiceWorkError('Operasi tidak valid atau tidak dapat diubah.'); data.operation=body.operation; }
 if(Object.hasOwn(body,'active')) { if(typeof body.active!=='boolean') throw new ServiceWorkError('Status aktif tidak valid.'); data.active=body.active; }
 if(Object.hasOwn(body,'sortOrder')) { if(!Number.isSafeInteger(body.sortOrder)||Math.abs(body.sortOrder)>100000) throw new ServiceWorkError('Urutan harus bilangan bulat antara -100000 dan 100000.'); data.sortOrder=body.sortOrder; }
 if(Object.hasOwn(body,'defaultJobCategoryId')) { const id=body.defaultJobCategoryId===null||body.defaultJobCategoryId===''?null:Number(body.defaultJobCategoryId); if(id!==null) { if(!['number','string'].includes(typeof body.defaultJobCategoryId)||!Number.isSafeInteger(id)||id<1) throw new ServiceWorkError('Job Category tidak valid.'); const category=await prisma.jobCategory.findUnique({where:{id}}); if(!category?.active) throw new ServiceWorkError('Job Category harus aktif.'); } data.defaultJobCategoryId=id; }
 if(!Object.keys(data).length) throw new ServiceWorkError('Tidak ada perubahan master.');
 return data;
}
export function errorResponse(error) { return {error:error.code==='P2002'?'Nama jenis pekerjaan sudah digunakan.':error.code==='P2025'?'Jenis pekerjaan tidak ditemukan.':error instanceof SyntaxError?'JSON tidak valid.':error.status?error.message:'Jenis pekerjaan gagal diproses. Coba lagi.',status:error.code==='P2002'?409:error.code==='P2025'?404:error instanceof SyntaxError?400:error.status||500}; }
