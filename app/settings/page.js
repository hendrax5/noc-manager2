import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || session.user.role !== 'Admin') {
    redirect('/dashboard');
  }

  const customFields = await prisma.customField.findMany({ orderBy: { id: 'asc' } });
  const jobCategories = await prisma.jobCategory.findMany({ orderBy: { id: 'asc' } });

  return (
    <main className="container">
      <header className="page-header">
        <h1>Helpdesk Settings</h1>
        <p>Customize dynamic ticket submission forms conforming to explicit NOC metrics.</p>
      </header>

      <SettingsClient initialFields={customFields} initialCategories={jobCategories} />
    </main>
  );
}
