/** Access: Ops Report — Manager & Admin only */

export function canViewOpsReport(user) {
  if (!user) return false;
  return user.role === "Admin" || user.role === "Manager";
}
