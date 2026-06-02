import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const dateFilter = searchParams.get('date') || 'today';
  const categoryFilter = searchParams.get('category') || '';
  const statusFilter = searchParams.get('status') || '';

  // Build date filter
  const where = {};
  if (dateFilter === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    where.updatedAt = { gte: today };
  } else if (dateFilter === 'week') {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);
    where.updatedAt = { gte: weekAgo };
  }

  const scopeParam = searchParams.get('scope') || '';

  const isAdminOrManager = session.user.role === 'Admin' || session.user.role === 'Manager';
  const isCS = session.user.department?.includes('CS') || session.user.department?.toLowerCase().includes('customer');
  const hasGlobalAccess = isAdminOrManager || isCS;

  let scope = {};
  if (hasGlobalAccess) {
    if (scopeParam === 'dept') {
      scope = {
        OR: [
          { assigneeId: parseInt(session.user.id) },
          { departmentId: parseInt(session.user.departmentId) || -1 }
        ]
      };
    } else {
      // Default for Admin/CS: 'all' (no scope filter)
      scope = {};
    }
  } else {
    // Non-global users only see their assigned tickets
    scope = { assigneeId: parseInt(session.user.id) };
  }

  // Category filter
  if (categoryFilter) {
    where.jobCategory = { name: categoryFilter };
  }

  // Status filter
  if (statusFilter) {
    where.status = { in: statusFilter.split(',') };
  } else {
    // Default: show active tickets
    where.status = { notIn: ['Closed'] };
  }

  const tickets = await prisma.ticket.findMany({
    where: {
      ...where,
      ...scope
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      department: { select: { id: true, name: true } },
      jobCategory: { select: { id: true, name: true } },
      services: { 
        include: { customer: { select: { name: true } } },
        take: 1
      },
      notes: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          author: { select: { name: true } }
        }
      }
    },
    orderBy: [
      { slaBreaches: 'desc' },
      { updatedAt: 'desc' }
    ],
    take: 100
  });

  return NextResponse.json(tickets);
}
