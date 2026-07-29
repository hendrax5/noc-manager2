import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { canViewOpsReport } from "@/lib/reports/opsAccess";
import OpsReportClient from "./OpsReportClient";

export const metadata = {
  title: "Ops Report - NOC Manager",
};

export default async function OpsReportPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!canViewOpsReport(session.user)) redirect("/dashboard");

  return (
    <main className="container">
      <header className="page-header" style={{ marginBottom: "1.25rem" }}>
        <h1>Ops Report</h1>
        <p>
          Rekap mingguan / bulanan: downtime &gt;10 jam, terminate, customer baru, dan upgrade (per tiket).
          Akses Manager &amp; Admin.
        </p>
      </header>
      <OpsReportClient />
    </main>
  );
}
