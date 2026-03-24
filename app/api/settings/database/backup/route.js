import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const backup = {
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: {
        Role: await prisma.role.findMany(),
        Department: await prisma.department.findMany(),
        JobCategory: await prisma.jobCategory.findMany(),
        CustomField: await prisma.customField.findMany(),
        Location: await prisma.location.findMany(),
        User: await prisma.user.findMany(),
        Customer: await prisma.customer.findMany(),
        ServiceTemplate: await prisma.serviceTemplate.findMany(),
        Service: await prisma.service.findMany(),
        Ticket: await prisma.ticket.findMany(),
        CircuitHop: await prisma.circuitHop.findMany(),
        Comment: await prisma.comment.findMany(),
        Attachment: await prisma.attachment.findMany(),
        TicketHistory: await prisma.ticketHistory.findMany(),
        ActionItem: await prisma.actionItem.findMany(),
        Meeting: await prisma.meeting.findMany(),
        MeetingSession: await prisma.meetingSession.findMany(),
        DailyReport: await prisma.dailyReport.findMany(),
        ShiftSchedule: await prisma.shiftSchedule.findMany(),
        UserSchedulePreference: await prisma.userSchedulePreference.findMany(),
        KnowledgeCategory: await prisma.knowledgeCategory.findMany(),
        KnowledgeArticle: await prisma.knowledgeArticle.findMany(),
      }
    };

    return new NextResponse(JSON.stringify(backup), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="noc-backup-${new Date().getTime()}.json"`,
      },
    });

  } catch (error) {
    console.error('Database Backup Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
