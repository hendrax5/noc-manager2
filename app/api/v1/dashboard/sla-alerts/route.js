import { integrationGet, parseIntParam } from "@/lib/integration/handler";
import { listSlaAlerts } from "@/lib/reports/dashboard";

export const GET = integrationGet(["dashboard:read"], async ({ query }) => {
  const withinMins = Math.min(Math.max(parseIntParam(query.withinMins, "withinMins") ?? 2, 0), 1440);
  const result = await listSlaAlerts({ withinMins });
  return { data: { withinMins, ...result }, message: `sla-alerts count=${result.count}` };
});
