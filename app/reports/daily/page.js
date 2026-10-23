import {getServerSession} from 'next-auth';
import {authOptions} from '@/app/api/auth/[...nextauth]/route';
import {redirect} from 'next/navigation';
import {workflowFlags} from '@/lib/workflows/flags';
import {jakartaMonthKey} from '@/lib/reports/monthPeriod';
import DailyReportClient from './DailyReportClient';
export default async function Page(){
 const s=await getServerSession(authOptions);if(!s)redirect('/login');
 if(!(await workflowFlags()).structured_daily_enabled)return <main className="container"><h1>Laporan Saya</h1><p>Laporan terstruktur belum diaktifkan.</p></main>;
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return <main className="container"><h1>Laporan harian</h1><p>Aktivitas personal dan catatan pekerjaan di luar tiket.</p><DailyReportClient currentUserId={Number(s.user.id)} initialMonth={jakartaMonthKey()} initialDate={date}/></main>;
}
