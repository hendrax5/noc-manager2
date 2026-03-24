import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const backupStr = await req.text();
    if (!backupStr) throw new Error("No payload provided");
    
    let parsed;
    try {
      parsed = JSON.parse(backupStr);
      // Fallback for older versions that wrapped output
      if (parsed.backupStr && typeof parsed.backupStr === 'string') {
        parsed = JSON.parse(parsed.backupStr);
      }
    } catch(e) {
      throw new Error("Payload Parsing Failed: Ensure the uploaded file is a valid JSON Snapshot.");
    }
    
    const data = parsed.data || parsed;
    if (!data || typeof data !== 'object') throw new Error("Invalid backup format: Malformed Root Node");

    console.log("Starting DB Full Restore Process...");

    // 1. Cascading Wipes - Start from leaves up to roots to prevent Foreign Key Violations
    await prisma.attachment.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.ticketHistory.deleteMany();
    await prisma.actionItem.deleteMany();
    await prisma.circuitHop.deleteMany();
    await prisma.service.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.dailyReport.deleteMany();
    await prisma.meetingSession.deleteMany();
    await prisma.meeting.deleteMany();
    await prisma.shiftSchedule.deleteMany();
    await prisma.userSchedulePreference.deleteMany();
    await prisma.knowledgeArticle.deleteMany();
    await prisma.knowledgeCategory.deleteMany();

    await prisma.customer.deleteMany();
    await prisma.serviceTemplate.deleteMany();
    
    // We wipe all users EXCEPT the current admin to prevent session lockout
    await prisma.user.deleteMany({ where: { id: { not: parseInt(session.user.id) } } });

    // Wipe Core Dictionary (If data specifies it, we will wipe and inject)
    await prisma.customField.deleteMany();
    await prisma.jobCategory.deleteMany();
    await prisma.location.deleteMany();
    // Departments and Roles might be connected to the current Admin user!
    // We cannot delete the Admin's Department or Role.
    const currentUser = await prisma.user.findUnique({ where: { id: parseInt(session.user.id) } });

    await prisma.department.deleteMany({ where: { id: { not: currentUser?.departmentId || -1 } } });
    await prisma.role.deleteMany({ where: { id: { not: currentUser?.roleId || -1 } } });

    console.log("Wipe completed. Starting injection sequence...");

    // 2. Sequential Injection Mapping
    // Roles & Departments (Upsert to avoid ID conflict with the retained Admin properties)
    for (const r of (data.Role || [])) {
      await prisma.role.upsert({ where: { id: r.id }, update: r, create: r });
    }
    for (const d of (data.Department || [])) {
       await prisma.department.upsert({ where: { id: d.id }, update: d, create: d });
    }

    // Secondary Meta
    if (data.JobCategory?.length) await prisma.jobCategory.createMany({ data: data.JobCategory });
    if (data.CustomField?.length) await prisma.customField.createMany({ data: data.CustomField });
    if (data.Location?.length) await prisma.location.createMany({ data: data.Location });

    // Users (exclude current Admin since already exists)
    const otherUsers = (data.User || []).filter(u => u.id !== parseInt(session.user.id));
    if (otherUsers.length) await prisma.user.createMany({ data: otherUsers, skipDuplicates: true });

    // Assets & Base Elements
    if (data.Customer?.length) await prisma.customer.createMany({ data: data.Customer });
    if (data.ServiceTemplate?.length) await prisma.serviceTemplate.createMany({ data: data.ServiceTemplate });
    if (data.KnowledgeCategory?.length) {
      await prisma.knowledgeCategory.createMany({ data: data.KnowledgeCategory });
    } else if (data.KnowledgeArticle?.length) {
      console.warn("Legacy Backup Detected: Missing KnowledgeCategory. Generating synthetic categories to preserve relations.");
      const uniqueCategoryIds = [...new Set(data.KnowledgeArticle.map(a => a.categoryId))];
      await prisma.knowledgeCategory.createMany({
        data: uniqueCategoryIds.map(id => ({
          id,
          name: `Restored Category ${id}`,
          description: 'Auto-generated for legacy backup compatibility',
        }))
      });
    }

    if (data.KnowledgeArticle?.length) await prisma.knowledgeArticle.createMany({ data: data.KnowledgeArticle });

    // Services
    if (data.Service?.length) await prisma.service.createMany({ data: data.Service });
    
    // Tickets
    if (data.Ticket?.length) await prisma.ticket.createMany({ data: data.Ticket });

    // Relational ticket dependencies
    if (data.CircuitHop?.length) await prisma.circuitHop.createMany({ data: data.CircuitHop });
    if (data.Comment?.length) await prisma.comment.createMany({ data: data.Comment });
    if (data.Attachment?.length) await prisma.attachment.createMany({ data: data.Attachment });
    if (data.TicketHistory?.length) await prisma.ticketHistory.createMany({ data: data.TicketHistory });
    if (data.ActionItem?.length) await prisma.actionItem.createMany({ data: data.ActionItem });

    // Reports and Meetings
    if (data.Meeting?.length) await prisma.meeting.createMany({ data: data.Meeting });
    if (data.MeetingSession?.length) await prisma.meetingSession.createMany({ data: data.MeetingSession });
    if (data.DailyReport?.length) await prisma.dailyReport.createMany({ data: data.DailyReport });
    if (data.ShiftSchedule?.length) await prisma.shiftSchedule.createMany({ data: data.ShiftSchedule });
    if (data.UserSchedulePreference?.length) await prisma.userSchedulePreference.createMany({ data: data.UserSchedulePreference });

    console.log("JSON injection completed. Rebuilding internal Postgres sequences...");

    // 3. PostgreSQL Sequence ID Reset logic
    // Because Prisma createMany with explicit IDs does not advance the native PostgreSQL sequences,
    // we MUST manually resynchronize the sequences to MAX(id) + 1, otherwise next native insert fails!
    const tables = ['Role', 'Department', 'JobCategory', 'CustomField', 'Location', 'User', 'Customer', 'ServiceTemplate', 'Service', 'Ticket', 'CircuitHop', 'Comment', 'Attachment', 'TicketHistory', 'ActionItem', 'Meeting', 'MeetingSession', 'DailyReport', 'ShiftSchedule', 'UserSchedulePreference', 'KnowledgeCategory', 'KnowledgeArticle'];
    
    for (const tbl of tables) {
      try {
         await prisma.$executeRawUnsafe(`SELECT setval('"${tbl}_id_seq"', coalesce(MAX(id), 1)) FROM "${tbl}";`);
      } catch (e) {
         console.warn(`Could not reset sequence for ${tbl}. Possibly table is empty or sequence name disjointed.`);
      }
    }

    console.log("Sequences Resynchronized. Restore Triumphant.");
    return NextResponse.json({ success: true, message: 'Restore completed successfully' });

  } catch (error) {
    console.error('Database Restore Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
