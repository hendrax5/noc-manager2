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
      <header className="page-header ui-static-3e8220669e" >
        <h1>Roster & Shift</h1>
        <p>
          {canEdit
            ? "Lihat jadwal · ubah shift · stabilo · catatan"
            : "Lihat jadwal shift tim (read-only)"}
        </p>
      </header>

      <div
        className="ui-static-4a8d184217" style={{display: "flex"}}
      >
        {canManageTeam && (
          <Link
            href="/team"
            className="ui-static-d465603229" style={{textDecoration: "none"}}
          >
            Members & Access
          </Link>
        )}
        <Link
          href="/team/schedules"
          className="ui-static-f18cac270c" style={{textDecoration: "none"}}
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
