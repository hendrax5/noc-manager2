import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppConfig } from "@/lib/config";

function generateTrackingId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'HSK-';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
    if (i === 3) id += '-';
  }
  return id;
}

export async function POST(req) {
  try {
    // 1. Authenticate using X-API-Key header
    const apiKeyHeader = req.headers.get("x-api-key");
    const appConfig = getAppConfig();
    const configuredApiKey = process.env.EXTERNAL_API_KEY || appConfig.externalApiKey;

    if (!configuredApiKey || apiKeyHeader !== configuredApiKey) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing API Key" }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json().catch(() => ({}));
    const { title, description, priority, departmentId, assigneeId, jobCategoryId, customData, enableSla, slaTimerMins, serviceIds } = body;

    // 3. Schema validation
    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Bad Request: 'title' is a required non-empty string" }, { status: 400 });
    }

    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json({ error: "Bad Request: 'description' is a required non-empty string" }, { status: 400 });
    }

    if (!departmentId || isNaN(parseInt(departmentId))) {
      return NextResponse.json({ error: "Bad Request: 'departmentId' is required and must be an integer" }, { status: 400 });
    }

    // Validate priority
    const ALL_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
    const finalPriority = priority || 'Medium';
    if (!ALL_PRIORITIES.includes(finalPriority)) {
      return NextResponse.json({ error: `Bad Request: Invalid priority. Allowed values: ${ALL_PRIORITIES.join(', ')}` }, { status: 400 });
    }

    // Verify department exists
    const dept = await prisma.department.findUnique({
      where: { id: parseInt(departmentId) }
    });
    if (!dept) {
      return NextResponse.json({ error: `Bad Request: Department ID ${departmentId} does not exist` }, { status: 400 });
    }

    // 4. Auto assignment routing logic (Least Busy Round-Robin)
    let finalAssigneeId = assigneeId ? parseInt(assigneeId) : null;

    if (!finalAssigneeId) {
      const deptUsers = await prisma.user.findMany({
        where: { departmentId: parseInt(departmentId), role: { name: { not: 'Admin' } } },
        select: { id: true }
      });
      if (deptUsers.length > 0) {
        const activeTicketsCount = await prisma.ticket.groupBy({
          by: ['assigneeId'],
          where: { assigneeId: { in: deptUsers.map(u => u.id) }, status: { notIn: ['Resolved', 'Closed'] } },
          _count: { id: true }
        });

        const loadMap = {};
        deptUsers.forEach(u => loadMap[u.id] = 0);
        activeTicketsCount.forEach(l => { if (l.assigneeId) loadMap[l.assigneeId] = l._count.id; });

        let minLoad = Infinity;
        for (const [uid, count] of Object.entries(loadMap)) {
          if (count < minLoad) {
            minLoad = count;
            finalAssigneeId = parseInt(uid);
          }
        }
      }
    }

    // Validate assignee if manually provided
    if (assigneeId) {
      const user = await prisma.user.findUnique({ where: { id: parseInt(assigneeId) } });
      if (!user) {
        return NextResponse.json({ error: `Bad Request: Assignee ID ${assigneeId} does not exist` }, { status: 400 });
      }
    }

    // 5. Construct ticket data
    let ticketData = {
      trackingId: generateTrackingId(),
      title: title.trim(),
      description: description.trim(),
      priority: finalPriority,
      customData: customData || {},
      departmentId: parseInt(departmentId),
      jobCategoryId: jobCategoryId ? parseInt(jobCategoryId) : null,
      assigneeId: finalAssigneeId,
      status: "New",
      enableSla: enableSla ? true : false,
      slaTimerMins: slaTimerMins ? parseInt(slaTimerMins) : 15,
      nextSlaDeadline: enableSla ? new Date(Date.now() + (slaTimerMins ? parseInt(slaTimerMins) : 15) * 60000) : null,
      historyLogs: {
        create: {
          action: "Ticket created via External API Integration" + (finalAssigneeId ? ` & auto-assigned to operator ID ${finalAssigneeId}` : ''),
          actorId: null // System/API integration
        }
      }
    };

    if (serviceIds && serviceIds.length > 0) {
      ticketData.services = {
        connect: serviceIds.map(id => ({ id: parseInt(id) }))
      };
    }

    // 6. Create ticket
    const ticket = await prisma.ticket.create({
      data: ticketData
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error("External Ticket API Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
