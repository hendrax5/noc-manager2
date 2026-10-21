import { redirect } from 'next/navigation';
import { getMasterUser } from '@/app/api/trouble-masters/user';
import { canManageTroubleMasters } from '@/lib/tickets/troubleMasters';
import TroubleMastersClient from './TroubleMastersClient';

export default async function TroubleMastersPage() {
  const user = await getMasterUser();
  if (!user) redirect('/login');
  if (!canManageTroubleMasters(user)) redirect('/dashboard');
  return <main className="container"><header className="page-header"><h1>Master Data Trouble</h1><p>Kelola gejala dan penyebab standar. Perubahan nama tidak mengubah riwayat tiket.</p></header><TroubleMastersClient /></main>;
}
