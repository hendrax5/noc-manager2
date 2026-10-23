import {getServerSession} from 'next-auth';
import {authOptions} from '@/app/api/auth/[...nextauth]/route';
import {redirect} from 'next/navigation';
import {prisma} from '@/lib/prisma';
import {getAppConfig} from '@/lib/config';
import WorkflowPolicyClient from './WorkflowPolicyClient';
export default async function Page(){
 const s=await getServerSession(authOptions);if(!s)redirect('/login');
 if(s.user.role!=='Admin'&&!s.user.permissions?.includes('manage_workflows'))redirect('/');
 const [categories,departments,roles,config]=await Promise.all([prisma.jobCategory.findMany({where:{active:true}}),prisma.department.findMany(),prisma.role.findMany({select:{id:true,name:true}}),getAppConfig()]);
 return <main className="container"><h1>Workflow pekerjaan</h1><p>Atur fase dan kategori otomatis sesuai pekerjaan serta perusahaan pelaksana.</p><WorkflowPolicyClient categories={categories} departments={departments} roles={roles} companies={String(config.companyNames||'').split(',').map(x=>x.trim()).filter(Boolean)}/></main>;
}
