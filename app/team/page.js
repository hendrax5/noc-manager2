import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import TeamAccessManager from "./TeamAccessManager";

import { getAppConfig } from "@/lib/config";

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/login');
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: parseInt(session.user.id) },
    include: { role: true }
  });

  const canManageUsers = dbUser?.role?.permissions?.includes('manage_users') || dbUser?.role?.name === 'Admin';
  const canManageRoles = dbUser?.role?.permissions?.includes('manage_roles') || dbUser?.role?.name === 'Admin';
  const canManageDepartments = dbUser?.role?.permissions?.includes('manage_departments') || dbUser?.role?.name === 'Admin';

  if (!canManageUsers && !canManageRoles && !canManageDepartments) {
    redirect('/dashboard');
  }

  const users = await prisma.user.findMany({ include: { role: true, department: true }, orderBy: { id: 'asc' } });
  const departments = await prisma.department.findMany({ orderBy: { id: 'asc' } });
  const roles = await prisma.role.findMany();

  const config = await getAppConfig();
  const companies = config.companyNames ? config.companyNames.split(',').map(s => s.trim()) : ["ION", "SDC", "Sistercompany"];
  const initialDeptMap = config.deptCompanyMap || {};
  const initialAutoRouteMap = config.deptAutoRouteMap || {};

  return (
    <main className="container">
      <header className="page-header ui-static-3e8220669e" >
        <h1>Team & Access Management</h1>
        <p>Complete control over NOC staff assignments, sub-departments, and global security roles.</p>
      </header>

      <div className="ui-static-4a8d184217" style={{display: 'flex'}}>
        <Link href="/team" className="ui-static-f18cac270c" style={{textDecoration: 'none'}}>Members & Access</Link>
        <Link href="/team/schedules" className="ui-static-d465603229" style={{textDecoration: 'none'}}>Shift Schedules</Link>
      </div>

      <TeamAccessManager 
        users={users} 
        roles={roles} 
        departments={departments} 
        companies={companies} 
        initialDeptMap={initialDeptMap} 
        initialAutoRouteMap={initialAutoRouteMap}
        canManageUsers={canManageUsers}
        canManageRoles={canManageRoles}
        canManageDepartments={canManageDepartments}
      />
    </main>
  );
}
