import { httpError, integrationGet, parseYmdParam } from "@/lib/integration/handler";
import { buildLeaderboard } from "@/lib/reports/leaderboard";

export const GET = integrationGet(["reports:performance:read"], async ({ query }) => {
  const start = parseYmdParam(query.start, "start");
  const end = parseYmdParam(query.end, "end");
  if (!!start !== !!end) throw httpError(400, "Provide both start and end, or neither");

  const board = await buildLeaderboard({ start, end });
  return {
    data: { period: { start, end }, ...board },
    message: `leaderboard ${start || "all"}..${end || "all"}`,
  };
});
