import {getServerSession} from 'next-auth';
import {authOptions} from '@/app/api/auth/[...nextauth]/route';
import {redirect} from 'next/navigation';
import {workflowFlags} from '@/lib/workflows/flags';
import {jakartaMonthKey} from '@/lib/reports/monthPeriod';
import EvaluationTable from './EvaluationTable';
export default async function Page({searchParams}){
 const s=await getServerSession(authOptions);if(!s)redirect('/login');
 const q=await searchParams,flags=await workflowFlags();
 if(flags.unified_performance_ui&&q?.review!=='1')redirect('/reports'+(q?.month?'?month='+encodeURIComponent(q.month):''));
 if(flags.unified_performance_ui)return <main className="container"><h1>Kinerja: review evaluasi</h1><p><a href="/reports">Kembali ke Kinerja</a></p><EvaluationTable initialMonth={q?.month||jakartaMonthKey()}/></main>;
 if((await workflowFlags()).monthly_evaluation_mode==='off')return <main className="container"><h1>Evaluasi bulanan</h1><p>Evaluasi belum diaktifkan.</p></main>;
 return <main className="container"><h1>Evaluasi bulanan</h1><p>Nilai berdasarkan target peran dan bukti pekerjaan. <a href="/reports/daily">Laporan harian</a> · <a href="/reports?legacy=1">Poin historis</a></p><EvaluationTable initialMonth={jakartaMonthKey()}/></main>;
}
