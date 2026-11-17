import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import TeamAccessManager from "./TeamAccessManager";
import { getAppConfig } from "@/lib/config";
import styles from "./team.module.css";

export default async function TeamPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const currentUserId = parseInt(session.user.id, 10);
  const dbUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    include: { role: true },
  });

  const canManageUsers =
    dbUser?.role?.permissions?.includes("manage_users") || dbUser?.role?.name === "Admin";
  const canManageRoles =
    dbUser?.role?.permissions?.includes("manage_roles") || dbUser?.role?.name === "Admin";
  const canManageDepartments =
    dbUser?.role?.permissions?.includes("manage_departments") ||
    dbUser?.role?.name === "Admin";

  if (!canManageUsers && !canManageRoles && !canManageDepartments) {
    redirect("/dashboard");
  }

  const [users, departments, roles, locations, config] = await Promise.all([
    prisma.user.findMany({
      include: { role: true, department: true, location: true },
      orderBy: [{ active: "desc" }, { name: "asc" }, { id: "asc" }],
    }),
    prisma.department.findMany({ orderBy: { id: "asc" } }),
    prisma.role.findMany({ orderBy: { id: "asc" } }),
    prisma.location.findMany({ orderBy: { city: "asc" } }),
    getAppConfig(),
  ]);

  const companies = config.companyNames
    ? config.companyNames.split(",").map((s) => s.trim())
    : ["ION", "SDC", "Sistercompany"];
  const initialDeptMap = config.deptCompanyMap || {};
  const initialAutoRouteMap = config.deptAutoRouteMap || {};

  return (
    <main className={`container ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>Tim & Akses</h1>
          <p className={styles.headerSubtitle}>
            Kelola status anggota (Aktif, Non-Shift, Resign), role akses, serta departemen & routing tiket.
          </p>
        </div>

        <nav className={styles.subNav} aria-label="Navigasi Tim">
          <Link href="/team" className={`${styles.subNavLink} ${styles.subNavLinkActive}`}>
            Anggota & Akses
          </Link>
          <Link href="/team/schedules" className={styles.subNavLink}>
            Jadwal Shift
          </Link>
        </nav>
      </header>

      <TeamAccessManager
        users={users}
        roles={roles}
        departments={departments}
        locations={locations}
        companies={companies}
        initialDeptMap={initialDeptMap}
        initialAutoRouteMap={initialAutoRouteMap}
        currentUserId={currentUserId}
        canManageUsers={canManageUsers}
        canManageRoles={canManageRoles}
        canManageDepartments={canManageDepartments}
      />
    </main>
  );
}
