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
  const hasAccess = session.user.role === 'Admin' || session.user.permissions?.includes('view_reports');
  
  if (!hasAccess) {
    redirect('/dashboard');
  }

  return (
    <main className="container">
      <header className="page-header no-print">
        <h1>SLA & Downtime Analytics</h1>
        <p>Monitor service availability, resolution times, and compliance across your infrastructure.</p>
      </header>

      <SLAAnalyticsClient />
    </main>
  );
}
