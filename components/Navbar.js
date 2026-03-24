"use client";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "./ThemeProvider";

export default function Navbar({ appName = "NOC Management" }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const { theme, toggleTheme } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (status === "loading") return null;
  // Jangan render navbar jika tidak ada session dan sedang di halaman login
  if (!session && pathname === "/login") return null;

  return (
    <nav className="navbar">
      <div className="nav-brand">{appName}</div>
      {session && (
        <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} title="Menu">
          {isMobileMenuOpen ? '✖' : '☰'}
        </button>
      )}
      {session && (
        <div className={`nav-links ${isMobileMenuOpen ? 'open' : ''}`} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard" className={pathname === "/dashboard" ? "active" : ""} onClick={() => setIsMobileMenuOpen(false)}>Dashboard</Link>
          <Link href="/tickets" className={pathname.startsWith("/tickets") ? "active" : ""} onClick={() => setIsMobileMenuOpen(false)}>Tickets</Link>
          <Link href="/meetings" className={pathname.startsWith("/meetings") ? "active" : ""} onClick={() => setIsMobileMenuOpen(false)}>Meetings</Link>
          {/* Resources Dropdown */}
          <div className="nav-dropdown">
            <button className={`nav-dropdown-btn ${(pathname.startsWith("/knowledge") || pathname.startsWith("/assets")) ? "active" : ""}`}>
              Resources ▾
            </button>
            <div className="nav-dropdown-content">
              <Link href="/knowledge" className={pathname.startsWith("/knowledge") ? "active" : ""} onClick={() => setIsMobileMenuOpen(false)}>📚 Knowledge Base</Link>
              <Link href="/assets" className={pathname.startsWith("/assets") ? "active" : ""} onClick={() => setIsMobileMenuOpen(false)}>🗄️ Assets & Services</Link>
            </div>
          </div>

          {/* Administration Dropdown */}
          {(session.user?.role === 'Admin' || session.user?.role === 'Manager') && (
            <div className="nav-dropdown">
              <button className={`nav-dropdown-btn ${(pathname.startsWith("/reports") || pathname.startsWith("/team") || pathname.startsWith("/settings")) ? "active" : ""}`}>
                Administration ▾
              </button>
              <div className="nav-dropdown-content">
                <Link href="/reports" className={pathname.startsWith("/reports") ? "active" : ""} onClick={() => setIsMobileMenuOpen(false)}>📊 Reports & Analytics</Link>
                {session.user?.role === 'Admin' && (
                  <>
                    <Link href="/team" className={pathname === "/team" ? "active" : ""} onClick={() => setIsMobileMenuOpen(false)}>👥 Team Management</Link>
                    <Link href="/settings" className={pathname.startsWith("/settings") ? "active" : ""} onClick={() => setIsMobileMenuOpen(false)}>⚙️ System Settings</Link>
                  </>
                )}
              </div>
            </div>
          )}
          
          <div style={{ position: 'relative', marginLeft: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            
            <button 
              onClick={toggleTheme}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', transition: 'all 0.2s', fontSize: '1.2rem' }}
              title="Toggle Theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', padding: '0.4rem 0.8rem', borderRadius: '30px', color: 'white', transition: 'all 0.2s', height: '100%' }}
            >
              {session.user?.avatarUrl ? (
                <img src={session.user.avatarUrl} alt="Avatar" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>👤</span>
              )}
              <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>{session.user?.name || session.user?.email?.split('@')[0]}</span>
              <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>▼</span>
            </button>

            {showProfileMenu && (
              <div className="profile-dropdown" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', minWidth: '220px', zIndex: 100, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--hover-bg)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Signed in as</div>
                  <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '0.2rem' }}>{session.user?.email}</div>
                </div>
                <div style={{ padding: '0.5rem' }}>
                  <Link href="/profile" onClick={() => setShowProfileMenu(false)} style={{ padding: '0.75rem 1rem', textDecoration: 'none', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '6px', fontSize: '0.95rem' }} onMouseEnter={(e)=>e.currentTarget.style.background='#f1f5f9'} onMouseLeave={(e)=>e.currentTarget.style.background='transparent'}>
                    ⚙️ Account Settings
                  </Link>
                  <button onClick={async () => {
                      await signOut({ redirect: false });
                      window.location.href = '/login';
                  }} style={{ padding: '0.75rem 1rem', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', fontWeight: 'bold', width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '6px', marginTop: '0.2rem', fontSize: '0.95rem' }} onMouseEnter={(e)=>e.currentTarget.style.background='#fef2f2'} onMouseLeave={(e)=>e.currentTarget.style.background='transparent'}>
                    🚪 Log Out
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
