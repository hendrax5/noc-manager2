import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  
  if (!session) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: parseInt(session.user.id) },
    include: { role: true, department: true }
  });

  if (!user) redirect('/login');

  return (
    <main className="container">
      <header className="page-header">
        <h1>My Profile</h1>
        <p>Manage your identity, security credentials, and communication signatures.</p>
      </header>
      <ProfileClient user={user} />
    </main>
  );
}
