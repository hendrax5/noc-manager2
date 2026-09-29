import { httpError, integrationGet, parseIntParam, parseYmdParam } from "@/lib/integration/handler";
import { buildUserPerformance } from "@/lib/reports/performance";

export const GET = integrationGet(["reports:performance:read"], async ({ query, params }) => {
  const userId = parseIntParam(params.userId, "userId");
  if (!userId) throw httpError(400, "Invalid userId");

  const report = await buildUserPerformance({
    userId,
    start: parseYmdParam(query.start, "start"),
    end: parseYmdParam(query.end, "end"),
  });
  if (!report) throw httpError(404, "User not found");
  return { data: report, message: `performance user=${userId}` };
});
