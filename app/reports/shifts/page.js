import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canViewShiftFairnessReport } from "@/lib/schedules/access";
import ShiftFairnessClient from "./ShiftFairnessClient";

export const metadata = {
  title: "Shift Fairness - NOC Manager",
};

export default async function ShiftFairnessReportPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!canViewShiftFairnessReport(session.user)) redirect("/dashboard");

  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, schedulePola: true },
  });

  return (
    <main className="container">
      <header className="page-header" style={{ marginBottom: "1.25rem" }}>
        <h1>Shift Fairness</h1>
        <p>
          Ringkasan distribusi shift per orang (S1/S2/OC/OFF, lembur, total jam) per departemen
          dan bulan. Akses Admin, Manager, view_reports, atau manage_schedules.
        </p>
      </header>
      <ShiftFairnessClient departments={departments} />
    </main>
  );
}
