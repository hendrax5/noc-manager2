import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAppConfig } from "@/lib/config";
import { canEditSchedules, canManageScheduleEngine } from "@/lib/schedules/access";
import SchedulesClient from "./SchedulesClient";

export default async function SchedulesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const currentUser = session.user;
  const canEdit = canEditSchedules(currentUser);
  const canEngine = canManageScheduleEngine(currentUser);
  const canManageTeam =
    currentUser.role === "Admin" ||
    currentUser.permissions?.includes("manage_users") ||
    currentUser.permissions?.includes("manage_roles") ||
    currentUser.permissions?.includes("manage_departments");

  const shiftTypes = await prisma.shiftType.findMany({ orderBy: { startTime: "asc" } });
  const locations = await prisma.location.findMany({ select: { id: true, city: true } });
  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, schedulePola: true, scheduleEnabled: true },
  });
  const users = await prisma.user.findMany({
    include: {
      location: true,
      schedulePreference: { include: { fixedShift: true } },
    },
    orderBy: { name: "asc" },
  });
  const scheduleConfig = await getAppConfig();

  return (
    <main className="container">
      <header className="page-header" style={{ marginBottom: "1rem" }}>
        <h1>Roster & Shift</h1>
        <p>
          {canEdit
            ? "Lihat jadwal · ubah shift · stabilo · catatan"
            : "Lihat jadwal shift tim (read-only)"}
        </p>
      </header>

      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1.5rem",
          borderBottom: "2px solid #e2e8f0",
        }}
      >
        {canManageTeam && (
          <Link
            href="/team"
            style={{ padding: "0.75rem 1.5rem", textDecoration: "none", color: "#64748b", fontWeight: 500 }}
          >
            Members & Access
          </Link>
        )}
        <Link
          href="/team/schedules"
          style={{
            padding: "0.75rem 1.5rem",
            textDecoration: "none",
            borderBottom: "3px solid #3b82f6",
            fontWeight: "bold",
            color: "#1e293b",
            marginBottom: "-2px",
          }}
        >
          Shift Schedules
        </Link>
      </div>

      <SchedulesClient
        initialShiftTypes={shiftTypes}
        users={users}
        locations={locations}
        departments={departments}
        currentUser={currentUser}
        scheduleConfig={scheduleConfig}
        canEdit={canEdit}
        canEngine={canEngine}
      />
    </main>
  );
}
