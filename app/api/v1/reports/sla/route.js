import { integrationGet, parseYmdParam } from "@/lib/integration/handler";
import { buildSlaAnalytics } from "@/lib/reports/slaAnalytics";

export const GET = integrationGet(["reports:sla:read"], async ({ query }) => {
  const report = await buildSlaAnalytics({
    startDate: parseYmdParam(query.startDate, "startDate"),
    endDate: parseYmdParam(query.endDate, "endDate"),
    customer: query.customer ? String(query.customer).slice(0, 200) : "",
  });
  return {
    data: report,
    message: `sla ${report.letter.startDate}..${report.letter.endDate} total=${report.summary.totalTickets}`,
  };
});
