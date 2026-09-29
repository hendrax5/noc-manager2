import { integrationGet, parseIntParam } from "@/lib/integration/handler";
import { buildServiceDeskMetrics } from "@/lib/reports/serviceDesk";

export const GET = integrationGet(["reports:sla:read"], async ({ query }) => {
  const report = await buildServiceDeskMetrics({ days: parseIntParam(query.days, "days") ?? 30 });
  return { data: report, message: `service-desk ${report.windowDays}d` };
});
