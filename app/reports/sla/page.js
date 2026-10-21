import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import ReportTabs from "./ReportTabs";

export const metadata = {
  title: 'Gangguan & SLA - NOC Manager',
  description: 'Laporan gangguan per tiket dan SLA periodik pelanggan.',
};

export default async function SLAPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/login');
  }

  // Allow access for Admins or those with reports permission
  const hasAccess =
    session.user.role === "Admin" ||
    session.user.role === "Manager" ||
    session.user.permissions?.includes("view_reports");
  
  if (!hasAccess) {
    redirect('/dashboard');
  }

  return (
    <main className="container">
      <header className="page-header no-print">
        <h1>Gangguan &amp; SLA</h1>
        <p>Filter gangguan berdasarkan customer, penyebab, dan durasi per tiket, lalu susun laporan cetak.</p>
      </header>

      <ReportTabs />
    </main>
  );
}
