"use client";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useTheme } from "./ThemeProvider";
import { navigationFor, activeSection, activeItem } from "@/lib/navigation/model";
import styles from "./navigation.module.css";

function NavbarContent({ appName = "NOC Management", appVersion = "1.0.0" }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();


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

  const groups = navigationFor(session?.user);
  const section = activeSection(pathname);
  const currentGroup = groups.find(group => group.id === section);

  return (
    <>
    <nav className={`navbar ${styles.topbar}`} aria-label="Menu utama">
      <div className="nav-brand">
        {appName}
        <span className="nav-version">v{appVersion}</span>
      </div>
      {session && (
        <button
          className="mobile-menu-btn"
          aria-expanded={isMobileMenuOpen}
          aria-controls="main-navigation"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          title="Menu"
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMobileMenuOpen ? "Close" : "Menu"}
        </button>
      )}
      {session && (
        <div id="main-navigation" className={`nav-links ${styles.links} ${isMobileMenuOpen ? "open" : ""}`}>
          {groups.map(group => <Link key={group.id} href={group.href} className={section === group.id ? 'active' : ''} aria-current={section === group.id ? 'page' : undefined} onClick={() => setIsMobileMenuOpen(false)}>{group.label}</Link>)}

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
              aria-expanded={showProfileMenu}
              aria-controls="account-navigation"
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

            <div id="account-navigation" className={`profile-dropdown${showProfileMenu ? " open" : ""}`} hidden={!showProfileMenu}>
              <div className="profile-dropdown-header">
                <div className="profile-dropdown-label">Signed in as</div>
                <div className="profile-dropdown-email">{session.user?.email}</div>
              </div>
              <div className="profile-dropdown-actions">
                <Link href="/profile" onClick={() => setShowProfileMenu(false)} className="profile-dropdown-link">
                  Account Settings
                </Link>
                {session.user?.id && (
                  <Link
                    href="/reports?tab=activity"
                    onClick={() => setShowProfileMenu(false)}
                    className="profile-dropdown-link"
                  >
                    Aktivitas &amp; Poin
                  </Link>
                )}
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
          </div>
        </div>
      )}
    </nav>
    {session && currentGroup?.items.length > 0 && <nav className={styles.context} aria-label={`Submenu ${currentGroup.label}`}>{currentGroup.items.map(item => <Link key={item.href} href={item.href} aria-current={activeItem(item, pathname, searchParams) ? 'page' : undefined}>{item.label}</Link>)}</nav>}
    </>
  );
}

export default function Navbar(props) {
  return <Suspense fallback={<nav className="navbar">{props.appName || "NOC Management"}</nav>}><NavbarContent {...props} /></Suspense>;
}
