import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import TeamAccessManager from "./TeamAccessManager";

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || session.user.role !== 'Admin') {
    redirect('/dashboard');
  }

  const users = await prisma.user.findMany({ include: { role: true, department: true }, orderBy: { id: 'asc' } });
  const departments = await prisma.department.findMany();
  const roles = await prisma.role.findMany();

  return (
    <main className="container">
      <header className="page-header">
        <h1>Team & Access Management</h1>
        <p>Complete control over NOC staff assignments, sub-departments, and global security roles.</p>
      </header>

      <TeamAccessManager users={users} roles={roles} departments={departments} />
    </main>
  );
}
