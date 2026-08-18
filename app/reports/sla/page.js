import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import SLAAnalyticsClient from "./SLAAnalyticsClient";

export const metadata = {
  title: 'SLA & Downtime Analytics - NOC Manager',
  description: 'Analyze Service Level Agreements, uptimes, and incidents.',
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
        <h1>SLA &amp; laporan pelanggan</h1>
        <p>Surat ketersediaan jaringan per periode — pilih bulan atau rentang tanggal custom, lalu cetak PDF.</p>
      </header>

      <SLAAnalyticsClient />
    </main>
  );
}
