import MeetingDetailClient from "./MeetingDetailClient";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export default async function MeetingDetailPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const resolvedParams = await params;
  const meetingId = parseInt(resolvedParams.id);

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      organizedBy: { select: { id: true, name: true, email: true } },
      attendees: true,
      permittedDepartments: { select: { id: true } },
      sessions: { 
        include: { author: true, presentAttendees: true, actionItems: { include: { assignee: true, department: true } } }, 
        orderBy: { scheduledFor: 'asc' } 
      },
      actionItems: { include: { assignee: true, department: true }, orderBy: { createdAt: 'desc' } }
    }
  });

  if (!meeting) redirect('/meetings');

  const userId = parseInt(session.user.id);
  const userDeptId = parseInt(session.user.departmentId);
  const isPublic = meeting.visibility === 'Public';
  const isOrganizer = meeting.organizedById === userId;
  const isAttendee = meeting.attendees?.some(a => a.id === userId);
  const isDeptPermitted = meeting.permittedDepartments?.some(d => d.id === userDeptId);

  if (!isPublic && !isOrganizer && !isAttendee && !isDeptPermitted) {
    redirect('/meetings');
  }

  // Fetch users and departments for the Action Items dropdown
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true } });
  const departments = await prisma.department.findMany({ select: { id: true, name: true } });

  return (
    <main className="container">
      <MeetingDetailClient 
        initialMeeting={meeting} 
        currentUser={session.user}
        allUsers={users}
        allDepartments={departments}
      />
    </main>
  );
}
