import { integrationGet, parseIntParam } from "@/lib/integration/handler";
import { buildDashboardOverview } from "@/lib/reports/dashboard";

export const GET = integrationGet(["dashboard:read"], async ({ query }) => {
  const departmentId = parseIntParam(query.departmentId, "departmentId");
  const assigneeId = parseIntParam(query.assigneeId, "assigneeId");
  const scope = {
    ...(departmentId ? { departmentId } : {}),
    ...(assigneeId ? { assigneeId } : {}),
  };
  const categoryNames = query.categories
    ? String(query.categories).split(",").map((s) => s.trim()).filter(Boolean)
    : null;

  const overview = await buildDashboardOverview({
    scope,
    categoryNames,
    includeSkyView: query.skyView !== "false",
  });

  // resolvedData/todayTickets are raw chart inputs for the UI; the aggregates already cover them.
  const { resolvedData, todayTickets, ...data } = overview;
  return {
    data: {
      generatedAt: new Date().toISOString(),
      filters: { departmentId, assigneeId, categories: categoryNames },
      ...data,
    },
    message: "dashboard overview",
  };
});
