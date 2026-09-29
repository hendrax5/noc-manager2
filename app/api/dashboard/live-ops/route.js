import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";
import { listLiveOpsTickets } from "@/lib/reports/dashboard";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const scopeParam = searchParams.get('scope') || '';

  const isAdminOrManager = session.user.role === 'Admin' || session.user.permissions?.includes('view_reports') || session.user.permissions?.includes('view_all_tickets') || session.user.permissions?.includes('view_live_ops');
  const isCS = session.user.department?.includes('CS') || session.user.department?.toLowerCase().includes('customer');
  const hasGlobalAccess = isAdminOrManager || isCS || session.user.permissions?.includes('view_all_tickets');

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

  const finalScope = allowedScopes.includes(scopeParam) ? scopeParam : (deptConfig.defaultScope || (hasGlobalAccess ? 'all' : 'me'));

  let scope = {};
  if (finalScope === 'dept') {
    scope = {
      OR: [
        { assigneeId: parseInt(session.user.id) },
        { departmentId: parseInt(session.user.departmentId) || -1 }
      ]
    };
  } else if (finalScope !== 'all') {
    scope = { assigneeId: parseInt(session.user.id) };
  }

  const tickets = await listLiveOpsTickets({
    date: searchParams.get('date') || 'today',
    category: searchParams.get('category') || '',
    status: searchParams.get('status') || '',
    allowedCategories: deptConfig.categories || null,
    scope,
  });

  return NextResponse.json(tickets);
}
