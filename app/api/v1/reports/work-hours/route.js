import { integrationGet, parseIntParam, parseYmdParam } from "@/lib/integration/handler";
import { buildWorkHours } from "@/lib/reports/workHours";

export const GET = integrationGet(["reports:performance:read"], async ({ query }) => {
  const report = await buildWorkHours({
    date: parseYmdParam(query.date, "date"),
    locationId: parseIntParam(query.locationId, "locationId"),
    departmentId: parseIntParam(query.departmentId, "departmentId"),
  });
  return { data: report, message: `work-hours ${report.date} users=${report.users.length}` };
});
