import { workflowFlags } from '@/lib/workflows/flags';
import { prisma } from "@/lib/prisma";

function parseIsoDate(value, name) {
  if (value == null || value === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    const err = new Error(`Invalid ${name}; use ISO-8601 datetime`);
    err.status = 400;
    throw err;
  }
  return d;
}

export function publicDailyReportDto(r) {
  return {
    id: r.id,
    content: r.content,
    createdAt: r.createdAt,
    user: r.user
      ? { id: r.user.id, name: r.user.name, email: r.user.email }
      : { id: r.userId },
  };
}

export async function integrationReportScope(appId){
 if(!(await workflowFlags()).privacy_enforced)return null;
 const row=appId?await prisma.appSetting.findUnique({where:{key:'report_integration_scope:'+appId}}):null;
 let ids=[];try{ids=JSON.parse(row?.value||'{}').userIds||[];}catch{}
 if(!Array.isArray(ids)||!ids.length||ids.some(id=>!Number.isSafeInteger(id)||id<1)){const e=new Error('Explicit report user scope required.');e.status=403;throw e;}
 return ids;
}
export async function listDailyReportsForIntegration(query = {}, appId) {
  const limitRaw = parseInt(query.limit ?? "50", 10);
  const offsetRaw = parseInt(query.offset ?? "0", 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 100);
  const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);

  const allowedIds=await integrationReportScope(appId);
  const where = allowedIds?{userId:{in:allowedIds}}:{};
  if (query.userId) {
    const id = parseInt(query.userId, 10);
    if (!Number.isFinite(id)) {
      const err = new Error("Invalid userId");
      err.status = 400;
      throw err;
    }
    if(allowedIds&&!allowedIds.includes(id)){const e=new Error("Forbidden");e.status=403;throw e;}
    where.userId = id;
  }
  const from = parseIsoDate(query.from, "from");
  const to = parseIsoDate(query.to, "to");
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  const [total, reports] = await Promise.all([
    prisma.dailyReport.count({ where }),
    prisma.dailyReport.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
  ]);

  return {
    reports: reports.map(publicDailyReportDto),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + reports.length < total,
    },
  };
}

export async function getDailyReportForIntegration(id, appId) {
  const allowedIds=await integrationReportScope(appId);
  const reportId = parseInt(id, 10);
  if (!Number.isFinite(reportId)) {
    const err = new Error("Invalid report id");
    err.status = 400;
    throw err;
  }
  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!report || allowedIds&&!allowedIds.includes(report.userId)) return null;
  return publicDailyReportDto(report);
}
