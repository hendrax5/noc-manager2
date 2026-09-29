import { httpError, integrationGet, parseIntParam } from "@/lib/integration/handler";
import { listLiveOpsTickets } from "@/lib/reports/dashboard";

const DATE_WINDOWS = ["today", "week", "all"];

export const GET = integrationGet(["dashboard:read"], async ({ query }) => {
  const date = query.date || "today";
  if (!DATE_WINDOWS.includes(date)) {
    throw httpError(400, `Invalid date; allowed: ${DATE_WINDOWS.join(", ")}`);
  }
  const departmentId = parseIntParam(query.departmentId, "departmentId");
  const assigneeId = parseIntParam(query.assigneeId, "assigneeId");

  const tickets = await listLiveOpsTickets({
    date,
    category: query.category || "",
    status: query.status || "",
    scope: {
      ...(departmentId ? { departmentId } : {}),
      ...(assigneeId ? { assigneeId } : {}),
    },
  });

  return {
    data: { count: tickets.length, tickets },
    message: `live-ops ${date} count=${tickets.length}`,
  };
});
