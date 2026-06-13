import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";

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

  const isAdminOrManager = session.user.role === 'Admin' || session.user.permissions?.includes('view_reports') || session.user.permissions?.includes('view_all_tickets') || session.user.permissions?.includes('view_live_ops');
  const isCS = session.user.department?.includes('CS') || session.user.department?.toLowerCase().includes('customer');
  const hasGlobalAccess = isAdminOrManager || isCS || session.user.permissions?.includes('view_all_tickets');

  // Retrieve department configuration
  const config = await getAppConfig();
  const userDept = session.user.department || "General";
  const deptConfig = config.dashboardDeptConfig?.[userDept] || {};

  // Resolve allowed scopes for security
  const allowedScopes = ['me'];
  if (hasGlobalAccess || deptConfig.defaultScope === 'all') {
    allowedScopes.push('all');
  }
  if (hasGlobalAccess || deptConfig.defaultScope === 'dept' || session.user.departmentId) {
    allowedScopes.push('dept');
  }

  // Ensure requested scope is allowed
  const finalScope = allowedScopes.includes(scopeParam) ? scopeParam : (deptConfig.defaultScope || (hasGlobalAccess ? 'all' : 'me'));

  let scope = {};
  if (finalScope === 'all') {
    scope = {};
  } else if (finalScope === 'dept') {
    scope = {
      OR: [
        { assigneeId: parseInt(session.user.id) },
        { departmentId: parseInt(session.user.departmentId) || -1 }
      ]
    };
  } else {
    scope = { assigneeId: parseInt(session.user.id) };
  }

  // Category filter
  if (deptConfig.categories && deptConfig.categories.length > 0) {
    if (categoryFilter) {
      if (deptConfig.categories.includes(categoryFilter)) {
        where.jobCategory = { name: categoryFilter };
      } else {
        where.jobCategory = { name: { in: [] } };
      }
    } else {
      where.jobCategory = { name: { in: deptConfig.categories } };
    }
  } else if (categoryFilter) {
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
