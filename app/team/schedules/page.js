import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAppConfig } from "@/lib/config";
import { canEditSchedules, canManageScheduleEngine } from "@/lib/schedules/access";
import { nextMonthPartsJakarta, nowInJakarta } from "@/lib/schedules/dates";
import SchedulesClient from "./SchedulesClient";
import styles from "./schedules.module.css";

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

  const [shiftTypes, locations, departments, users, scheduleConfig] = await Promise.all([
    prisma.shiftType.findMany({ orderBy: { startTime: "asc" } }),
    prisma.location.findMany({ select: { id: true, city: true }, orderBy: { city: "asc" } }),
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, schedulePola: true, scheduleEnabled: true },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        departmentId: true,
        locationId: true,
        active: true,
        resignedAt: true,
        inactiveReason: true,
        scheduleEligible: true,
        scheduleFlag: true,
        role: { select: { name: true } },
        location: { select: { id: true, city: true } },
        schedulePreference: { include: { fixedShift: true } },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    getAppConfig(),
  ]);

  const jakartaNow = nowInJakarta();
  const nextMonthTarget = nextMonthPartsJakarta();

  return (
    <main className={`container ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>Jadwal Shift & Roster</h1>
          <p className={styles.headerSubtitle}>
            {canEdit
              ? "Lihat jadwal tim, edit shift/lembur/stabilo/catatan, serta proteksi generate otomatis tanggal 15."
              : "Lihat jadwal shift tim (hanya baca)."}
          </p>
        </div>

        <nav className={styles.subNav} aria-label="Navigasi Tim">
          {canManageTeam && (
            <Link href="/team" className={styles.subNavLink}>
              Anggota & Akses
            </Link>
          )}
          <Link
            href="/team/schedules"
            className={`${styles.subNavLink} ${styles.subNavLinkActive}`}
          >
            Jadwal Shift
          </Link>
        </nav>
      </header>

      <SchedulesClient
        initialShiftTypes={shiftTypes}
        users={users}
        locations={locations}
        departments={departments}
        currentUser={currentUser}
        scheduleConfig={scheduleConfig}
        initialCalendar={{ year: jakartaNow.year, monthIndex: jakartaNow.month - 1 }}
        nextMonthTarget={nextMonthTarget}
        canEdit={canEdit}
        canEngine={canEngine}
      />
    </main>
  );
}
