"use client";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "./ThemeProvider";

export default function Navbar({ appName = "NOC Management", appVersion = "1.0.0" }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const { theme, toggleTheme } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (status === "loading") return (
    <nav className="navbar">
      <div className="nav-brand">
        {appName}
        <span className="nav-version">v{appVersion}</span>
      </div>
    </nav>
  );
  if (!session && pathname === "/login") return null;

  const canViewReports =
    session?.user?.permissions?.includes("view_reports") ||
    session?.user?.role === "Admin" ||
    session?.user?.role === "Manager";
  const canViewOpsReport =
    session?.user?.role === "Admin" || session?.user?.role === "Manager";
  const canManageTeam =
    session?.user?.permissions?.includes("manage_users") ||
    session?.user?.permissions?.includes("manage_roles") ||
    session?.user?.permissions?.includes("manage_departments") ||
    session?.user?.role === "Admin";
  const canManageSettings =
    session?.user?.permissions?.includes("manage_settings") ||
    session?.user?.role === "Admin";
  const showAdmin =
    canViewReports ||
    canViewOpsReport ||
    canManageTeam ||
    canManageSettings ||
    session?.user?.role === "Manager";

  return (
    <nav className="navbar">
      <div className="nav-brand">
        {appName}
        <span className="nav-version">v{appVersion}</span>
      </div>
      {session && (
        <button
          className="mobile-menu-btn"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          title="Menu"
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMobileMenuOpen ? "Close" : "Menu"}
        </button>
      )}
      {session && (
        <div className={`nav-links ${isMobileMenuOpen ? "open" : ""}`} style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/dashboard" className={pathname === "/dashboard" ? "active" : ""} onClick={() => setIsMobileMenuOpen(false)}>Dashboard</Link>
          <Link href="/tickets" className={pathname.startsWith("/tickets") ? "active" : ""} onClick={() => setIsMobileMenuOpen(false)}>Tickets</Link>
          <Link href="/team/schedules" className={pathname.startsWith("/team/schedules") ? "active" : ""} onClick={() => setIsMobileMenuOpen(false)}>Shifts</Link>
          <Link href="/meetings" className={pathname.startsWith("/meetings") ? "active" : ""} onClick={() => setIsMobileMenuOpen(false)}>Meetings</Link>

          <div className="nav-dropdown">
            <button className={`nav-dropdown-btn ${(pathname.startsWith("/knowledge") || pathname.startsWith("/assets")) ? "active" : ""}`}>
              Resources
            </button>
            <div className="nav-dropdown-content">
              <Link href="/knowledge" className={pathname.startsWith("/knowledge") ? "active" : ""} onClick={() => setIsMobileMenuOpen(false)}>Knowledge Base</Link>
              <Link href="/assets" className={pathname.startsWith("/assets") ? "active" : ""} onClick={() => setIsMobileMenuOpen(false)}>Assets & Services</Link>
            </div>
          </div>

          {showAdmin && (
            <div className="nav-dropdown">
              <button className={`nav-dropdown-btn ${(pathname.startsWith("/reports") || pathname.startsWith("/team") || pathname.startsWith("/settings")) ? "active" : ""}`}>
                Administration
              </button>
              <div className="nav-dropdown-content">
                {canViewReports && (
                  <>
                    <Link href="/reports" className={pathname === "/reports" ? "active" : ""} onClick={() => setIsMobileMenuOpen(false)}>Daily Reports</Link>
                    <Link href="/reports/sla" className={pathname.startsWith("/reports/sla") ? "active" : ""} onClick={() => setIsMobileMenuOpen(false)}>SLA & Analytics</Link>
                  </>
                )}
                {canViewOpsReport && (
                  <Link
                    href="/reports/ops"
                    className={pathname.startsWith("/reports/ops") ? "active" : ""}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Ops Report
                  </Link>
                )}
                {canManageTeam && (
                  <Link href="/team" className={pathname === "/team" ? "active" : ""} onClick={() => setIsMobileMenuOpen(false)}>Team Management</Link>
                )}
                {canManageSettings && (
                  <Link href="/settings" className={pathname.startsWith("/settings") ? "active" : ""} onClick={() => setIsMobileMenuOpen(false)}>System Settings</Link>
                )}
              </div>
            </div>
          )}

          <div className="nav-user-cluster">
            <button
              type="button"
              onClick={toggleTheme}
              className="theme-toggle-btn"
              title="Toggle theme"
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>

            <button
              type="button"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="profile-menu-btn"
            >
              {session.user?.avatarUrl ? (
                <img src={session.user.avatarUrl} alt="" className="nav-avatar" />
              ) : (
                <span className="nav-avatar-fallback" aria-hidden="true">
                  {(session.user?.name || session.user?.email || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="nav-user-name">{session.user?.name || session.user?.email?.split("@")[0]}</span>
            </button>

            {showProfileMenu && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-header">
                  <div className="profile-dropdown-label">Signed in as</div>
                  <div className="profile-dropdown-email">{session.user?.email}</div>
                </div>
                <div className="profile-dropdown-actions">
                  <Link href="/profile" onClick={() => setShowProfileMenu(false)} className="profile-dropdown-link">
                    Account Settings
                  </Link>
                  <button
                    type="button"
                    className="profile-dropdown-logout"
                    onClick={async () => {
                      await signOut({ callbackUrl: "/login" });
                    }}
                  >
                    Log Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
