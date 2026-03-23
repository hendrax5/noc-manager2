import MeetingForm from "./MeetingForm"; 
import { prisma } from "@/lib/prisma";

export default async function NewMeetingPage() {
  const users = await prisma.user.findMany({
    include: { department: true },
    orderBy: { name: 'asc' }
  });

  return (
    <main className="container">
      <header className="page-header">
        <h1>Schedule Meeting</h1>
        <p>Set up an agenda, lock down problems, and invite key delegates for an upcoming synchronization.</p>
      </header>
      <MeetingForm users={users} />
    </main>
  );
}
