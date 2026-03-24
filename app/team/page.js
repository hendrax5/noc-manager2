import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import TeamAccessManager from "./TeamAccessManager";

import { getAppConfig } from "@/lib/config";

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || session.user.role !== 'Admin') {
    redirect('/dashboard');
  }

  const users = await prisma.user.findMany({ include: { role: true, department: true }, orderBy: { id: 'asc' } });
  const departments = await prisma.department.findMany({ orderBy: { id: 'asc' } });
  const roles = await prisma.role.findMany();

  const config = getAppConfig();
  const companies = config.companyNames ? config.companyNames.split(',').map(s => s.trim()) : ["ION", "SDC", "Sistercompany"];
  const initialDeptMap = config.deptCompanyMap || {};

  return (
    <main className="container">
      <header className="page-header" style={{ marginBottom: '1rem' }}>
        <h1>Team & Access Management</h1>
        <p>Complete control over NOC staff assignments, sub-departments, and global security roles.</p>
      </header>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0' }}>
        <Link href="/team" style={{ padding: '0.75rem 1.5rem', textDecoration: 'none', borderBottom: '3px solid #3b82f6', fontWeight: 'bold', color: '#1e293b', marginBottom: '-2px' }}>Members & Access</Link>
        <Link href="/team/schedules" style={{ padding: '0.75rem 1.5rem', textDecoration: 'none', color: '#64748b', fontWeight: '500' }}>Shift Schedules</Link>
      </div>

      <TeamAccessManager users={users} roles={roles} departments={departments} companies={companies} initialDeptMap={initialDeptMap} />
    </main>
  );
}
