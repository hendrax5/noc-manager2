import { redirect } from 'next/navigation';
import { getMasterUser } from '@/app/api/trouble-masters/user';
import { prisma } from '@/lib/prisma';
import ServiceWorkTypesClient from './ServiceWorkTypesClient';

export default async function ServiceWorkTypesPage() {
  const user = await getMasterUser();
  if (!user) redirect('/login');
  if (user.role?.name !== 'Admin' && !user.role?.permissions?.includes('manage_service_work')) redirect('/dashboard');
  const categories = await prisma.jobCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } });
  return <main className="container"><header className="page-header"><h1>Jenis Pekerjaan Layanan</h1><p>Jenis pekerjaan menentukan perubahan circuit. Produk/Layanan bersumber dari Inventory. Job Category menentukan poin dan hanya disarankan melalui mapping ini.</p></header><ServiceWorkTypesClient categories={categories} /></main>;
}
