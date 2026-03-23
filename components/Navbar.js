"use client";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (status === "loading") return null;
  // Jangan render navbar jika tidak ada session dan sedang di halaman login
  if (!session && pathname === "/login") return null;

  return (
    <nav className="navbar">
      <div className="nav-brand">NOC Management</div>
      {session && (
        <div className="nav-links">
          <Link href="/dashboard" className={pathname === "/dashboard" ? "active" : ""}>Dashboard</Link>
          <Link href="/tickets" className={pathname.startsWith("/tickets") ? "active" : ""}>Tickets</Link>
          {(session.user?.role === 'Admin' || session.user?.role === 'Manager') && (
            <Link href="/reports" className={pathname.startsWith("/reports") ? "active" : ""}>Reports</Link>
          )}
          <Link href="/meetings" className={pathname.startsWith("/meetings") ? "active" : ""}>Meetings</Link>
          {session.user?.role === 'Admin' && (
            <>
              <Link href="/team" className={pathname.startsWith("/team") ? "active" : ""}>Team</Link>
              <Link href="/settings" className={pathname.startsWith("/settings") ? "active" : ""}>Settings</Link>
            </>
          )}
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="logout-btn">Log Out</button>
        </div>
      )}
    </nav>
  );
}
