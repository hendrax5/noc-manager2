/** Full leaderboard + other people's reports: Admin, Manager, or view_reports. */
export function canViewAllPerformance(user) {
  if (!user) return false;
  return (
    user.role === "Admin" ||
    user.role === "Manager" ||
    user.permissions?.includes("view_reports")
  );
}

/** Own report is always allowed; everyone else's requires canViewAllPerformance. */
export function canViewUserPerformance(user, targetUserId) {
  if (!user) return false;
  if (canViewAllPerformance(user)) return true;
  const selfId = parseInt(user.id, 10);
  const targetId = parseInt(targetUserId, 10);
  return Number.isInteger(selfId) && selfId === targetId;
}
