import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import DashboardCharts from "./DashboardCharts";
import LiveOpsBoard from "./LiveOpsBoard";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  // Scope Isolation (Tickets assigned to user or their department)
  const scope = {
    OR: [
      { assigneeId: parseInt(session?.user?.id) },
      { departmentId: parseInt(session?.user?.departmentId) || -1 }
    ]
  };

  // Fetch metrics
  const totalNewTickets = await prisma.ticket.count({ where: { ...scope, status: 'New' } });
  const totalWaitingTickets = await prisma.ticket.count({ where: { ...scope, status: 'Waiting Reply' } });
  const totalRepliedTickets = await prisma.ticket.count({ where: { ...scope, status: 'Replied' } });
  const totalInProgressTickets = await prisma.ticket.count({ where: { ...scope, status: 'In Progress' } });
  const totalResolvedTickets = await prisma.ticket.count({ where: { ...scope, status: 'Resolved' } });
  
  const ticketStats = [
    { status: 'New', count: totalNewTickets },
    { status: 'In Progress', count: totalInProgressTickets },
    { status: 'Wait Reply', count: totalWaitingTickets },
    { status: 'Replied', count: totalRepliedTickets },
    { status: 'Resolved', count: totalResolvedTickets }
  ];

  // Compute Average TTR (Time to Resolution)
  const resolvedData = await prisma.ticket.findMany({
    where: { ...scope, status: 'Resolved' },
    select: { createdAt: true, updatedAt: true, resolvedAt: true }
  });
  let totalTtrMs = 0;
  resolvedData.forEach(t => {
    const diff = new Date(t.resolvedAt || t.updatedAt).getTime() - new Date(t.createdAt).getTime();
    if (diff > 0) totalTtrMs += diff;
  });
  const avgTtrMins = resolvedData.length > 0 ? Math.round((totalTtrMs / resolvedData.length) / 60000) : 0;
  const avgTtrObj = {
    h: Math.floor(avgTtrMins / 60),
    m: avgTtrMins % 60
  };

  // Fetch pending Open Tickets specifically allocated to them
  const myOpenTickets = await prisma.ticket.findMany({
    where: {
      assigneeId: parseInt(session?.user?.id),
      status: { notIn: ['Resolved', 'Closed'] }
    },
    orderBy: { updatedAt: 'desc' },
    take: 5
  });

  // Fetch My Upcoming Shifts (Next 7 days)
  const today = new Date();
  today.setHours(0,0,0,0);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  
  const myShifts = await prisma.shiftSchedule.findMany({
    where: { 
      userId: parseInt(session?.user?.id),
      date: { gte: today, lte: nextWeek }
    },
    include: { shiftType: true },
    orderBy: { date: 'asc' },
    take: 4
  });

  // Auto-Report Logic (Today's Touched & Resolved Tickets)
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  
  const todayTickets = await prisma.ticket.findMany({
    where: { 
      ...scope,
      updatedAt: { gte: todayStart }
    },
    select: { id: true, status: true }
  });
  const todayResolved = todayTickets.filter(t => t.status === 'Resolved').length;
  
  const reportStats = [];

  // ================================================
  // Phase 2: Job Category Metrics
  // ================================================
  const jobCategories = await prisma.jobCategory.findMany({
    where: { active: true },
    orderBy: { name: 'asc' }
  });

  // Count active tickets per category
  const categoryMetrics = await Promise.all(
    jobCategories.map(async (cat) => {
      const [activeCount, todayCount, resolvedTodayCount] = await Promise.all([
        prisma.ticket.count({
          where: { ...scope, jobCategoryId: cat.id, status: { notIn: ['Resolved', 'Closed'] } }
        }),
        prisma.ticket.count({
          where: { ...scope, jobCategoryId: cat.id, updatedAt: { gte: todayStart } }
        }),
        prisma.ticket.count({
          where: { ...scope, jobCategoryId: cat.id, status: 'Resolved', resolvedAt: { gte: todayStart } }
        })
      ]);
      return {
        id: cat.id,
        name: cat.name,
        score: cat.score,
        active: activeCount,
        today: todayCount,
        resolvedToday: resolvedTodayCount
      };
    })
  );

  // Category stats for chart (only categories with active tickets)
  const categoryStats = categoryMetrics
    .filter(c => c.active > 0)
    .map(c => ({ name: c.name, count: c.active }));

  // Count today's resolved
  const todayResolvedCount = await prisma.ticket.count({
    where: { ...scope, status: 'Resolved', resolvedAt: { gte: todayStart } }
  });

  // Category colors mapping
  const CATEGORY_COLORS = [
    '#3b82f6', '#ef4444', '#8b5cf6', '#10b981', '#f59e0b', 
    '#f97316', '#06b6d4', '#64748b', '#ec4899', '#84cc16'
  ];

  return (
    <main className="container" style={{ paddingBottom: '3rem' }}>
      
      {/* Hero Header Section */}
      <header style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
        padding: '2.5rem', borderRadius: '16px', color: 'white', 
        marginBottom: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {session?.user?.avatarUrl ? (
            <img src={session.user.avatarUrl} alt="Avatar" style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
          ) : (
            <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', border: '3px solid rgba(255,255,255,0.2)' }}>👋</div>
          )}
          <div>
            <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.8rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
              Welcome back, {session?.user?.name || session?.user?.email?.split('@')[0]}!
            </h1>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', border: '1px solid rgba(59, 130, 246, 0.3)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '1rem' }}>🛡️</span> {session?.user?.role || "Staff"}
              </span>
              <span style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#e2e8f0', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', border: '1px solid rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '1rem' }}>🏢</span> {session?.user?.department || "General"}
              </span>
            </div>
          </div>
        </div>
        <Link href="/tickets/new" className="primary-btn" style={{ 
          background: 'var(--card-bg)', color: 'var(--text-color)', fontWeight: 'bold', padding: '0.8rem 1.5rem', 
          borderRadius: '8px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: 'none'
        }}>
          <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>+</span> Create Ticket
        </Link>
      </header>

      {/* 5 Premium KPI Cards */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        
        {/* New Tickets Card */}
        <Link href="/tickets?statuses=New" style={{ textDecoration: 'none' }}>
          <div style={{ padding: '1.25rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(225, 29, 72, 0.05)', position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }} className="hover-lift kpi-new">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
              <h2 style={{ fontSize: '0.8rem', color: '#be123c', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>New</h2>
              <span style={{ fontSize: '1.2rem' }}>🔥</span>
            </div>
            <p style={{ fontSize: '2.8rem', fontWeight: '900', margin: '0.3rem 0 0 0', color: '#e11d48', lineHeight: 1, position: 'relative', zIndex: 2 }}>{totalNewTickets}</p>
            <div style={{ position: 'absolute', right: '-15px', bottom: '-15px', fontSize: '6rem', opacity: 0.04, zIndex: 1, transform: 'rotate(-15deg)' }}>🔥</div>
          </div>
        </Link>

        {/* In Progress Card */}
        <Link href="/tickets?statuses=In+Progress" style={{ textDecoration: 'none' }}>
          <div style={{ padding: '1.25rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.05)', position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }} className="hover-lift kpi-progress">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
              <h2 style={{ fontSize: '0.8rem', color: '#1d4ed8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>In Progress</h2>
              <span style={{ fontSize: '1.2rem' }}>⚡</span>
            </div>
            <p style={{ fontSize: '2.8rem', fontWeight: '900', margin: '0.3rem 0 0 0', color: '#2563eb', lineHeight: 1, position: 'relative', zIndex: 2 }}>{totalInProgressTickets}</p>
            <div style={{ position: 'absolute', right: '-15px', bottom: '-15px', fontSize: '6rem', opacity: 0.04, zIndex: 1, transform: 'rotate(-15deg)' }}>⚡</div>
          </div>
        </Link>

        {/* Pending Card */}
        <Link href="/tickets?statuses=Waiting+Reply,Replied" style={{ textDecoration: 'none' }}>
          <div style={{ padding: '1.25rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(217, 119, 6, 0.05)', position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }} className="hover-lift kpi-pending">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
              <h2 style={{ fontSize: '0.8rem', color: '#b45309', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Pending</h2>
              <span style={{ fontSize: '1.2rem' }}>⏳</span>
            </div>
            <p style={{ fontSize: '2.8rem', fontWeight: '900', margin: '0.3rem 0 0 0', color: '#d97706', lineHeight: 1, position: 'relative', zIndex: 2 }}>{totalWaitingTickets + totalRepliedTickets}</p>
            <div style={{ position: 'absolute', right: '-15px', bottom: '-15px', fontSize: '6rem', opacity: 0.04, zIndex: 1, transform: 'rotate(-15deg)' }}>⏳</div>
          </div>
        </Link>

        {/* Resolved Today Card */}
        <Link href="/tickets?statuses=Resolved&date=today" style={{ textDecoration: 'none' }}>
          <div style={{ padding: '1.25rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.05)', position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }} className="hover-lift kpi-resolved">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
              <h2 style={{ fontSize: '0.8rem', color: '#15803d', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Resolved Today</h2>
              <span style={{ fontSize: '1.2rem' }}>✅</span>
            </div>
            <p style={{ fontSize: '2.8rem', fontWeight: '900', margin: '0.3rem 0 0 0', color: '#16a34a', lineHeight: 1, position: 'relative', zIndex: 2 }}>{todayResolvedCount}</p>
            <div style={{ position: 'absolute', right: '-15px', bottom: '-15px', fontSize: '6rem', opacity: 0.04, zIndex: 1, transform: 'rotate(-15deg)' }}>✅</div>
          </div>
        </Link>

        {/* Average TTR Card */}
        <div style={{ padding: '1.25rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.05)', position: 'relative', overflow: 'hidden' }} className="hover-lift kpi-ttr">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
            <h2 style={{ fontSize: '0.8rem', color: '#4338ca', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Avg TTR</h2>
            <span style={{ fontSize: '1.2rem' }}>⏱️</span>
          </div>
          <p style={{ fontSize: '2.2rem', fontWeight: '900', margin: '0.5rem 0 0 0', color: '#4f46e5', lineHeight: 1, position: 'relative', zIndex: 2 }}>
            {resolvedData.length === 0 ? 'N/A' : (
              <>
                {avgTtrObj.h > 0 && <span style={{letterSpacing: '-2px'}}>{avgTtrObj.h}<span style={{fontSize: '0.85rem', color: '#818cf8', margin: '0 0.3rem 0 0.1rem', letterSpacing: '0'}}>h</span></span>}
                <span style={{letterSpacing: '-2px'}}>{avgTtrObj.m}<span style={{fontSize: '0.85rem', color: '#818cf8', marginLeft: '0.1rem', letterSpacing: '0'}}>m</span></span>
              </>
            )}
          </p>
          <div style={{ position: 'absolute', right: '-15px', bottom: '-15px', fontSize: '6rem', opacity: 0.03, zIndex: 1, transform: 'rotate(-15deg)' }}>⏱️</div>
        </div>
      </section>

      {/* Job Category Monitor (Phase 2) */}
      {categoryMetrics.filter(cat => cat.active > 0).length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="text-dark" style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🏷️</span> Job Category Monitor
            </h2>
            <Link href="/tickets?tab=all" style={{ fontSize: '0.8rem', color: '#3b82f6', textDecoration: 'none', fontWeight: 'bold' }}>
              View All Tickets →
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
            {categoryMetrics.filter(cat => cat.active > 0).map((cat, idx) => {
              const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
              const total = cat.active + cat.resolvedToday;
              const progress = total > 0 ? Math.round((cat.resolvedToday / total) * 100) : 0;
              const hasOverdue = cat.active > 5; // Simple heuristic; adjust as needed
              return (
                <Link key={cat.id} href={`/tickets?statuses=New,Open,In+Progress,Waiting+Reply,Replied,On+Hold,Finish&assignments=me,unassigned,others`} style={{ textDecoration: 'none' }}>
                  <div className="hover-lift" style={{
                    padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)', cursor: 'pointer', position: 'relative', overflow: 'hidden',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)', transition: 'all 0.2s'
                  }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: color }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: color, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{cat.name}</span>
                      {hasOverdue && <span style={{ fontSize: '0.65rem', background: '#fef2f2', color: '#dc2626', padding: '0.1rem 0.3rem', borderRadius: '3px', fontWeight: 'bold' }}>⚠️</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--heading-color)', lineHeight: 1 }}>{cat.active}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-color)' }}>aktif</span>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: '4px', background: 'var(--hover-bg)', borderRadius: '2px', overflow: 'hidden', marginBottom: '0.3rem' }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: color, borderRadius: '2px', transition: 'width 0.5s ease' }}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-color)' }}>
                      <span>📊 {cat.today} hari ini</span>
                      <span>✅ {cat.resolvedToday}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Live Operations Board (Phase 3) */}
      <section style={{ marginBottom: '2rem' }}>
        <LiveOpsBoard jobCategories={jobCategories} />
      </section>

      {/* Information Modules Grid */}
      <section style={{ marginBottom: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Pending Follow-Ups */}
        <div className="bg-white-card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', position: 'relative' }}>
          <div style={{ width: '40px', height: '4px', background: '#f59e0b', borderRadius: '2px', position: 'absolute', top: 0, left: '1.5rem' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
            <h2 className="text-dark" style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{fontSize: '1.3rem'}}>🎯</span> My Follow-Ups</h2>
          </div>
          
          {myOpenTickets.length === 0 ? (
            <div className="bg-light-stripe" style={{ padding: '2rem 1rem', textAlign: 'center', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
               <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>☕</span>
               <p style={{ color: 'var(--text-color)', fontSize: '0.9rem', margin: 0 }}>You have no open tickets assigned to you. You're all caught up!</p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {myOpenTickets.map(ticket => {
                let extractedName = "Unknown";
                const reporterMatch = ticket.description?.match(/\[Original Reporter: (.*?) -/);
                if (reporterMatch) {
                  extractedName = reporterMatch[1];
                } else if (ticket.services && ticket.services.length > 0 && ticket.services[0].customer) {
                  extractedName = ticket.services[0].customer.name;
                } else if (ticket.customData && typeof ticket.customData === 'object' && ticket.customData["Customer Name"]) {
                   extractedName = ticket.customData["Customer Name"];
                }

                return (
                <li key={ticket.id} className="hover-bg bg-light-stripe" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', transition: 'all 0.2s', borderLeft: '3px solid #3b82f6' }}>
                  <div>
                    <Link href={`/tickets/${ticket.id}`} style={{ textDecoration: 'none' }}>
                      <p className="text-dark" style={{ margin: '0 0 0.25rem 0', fontWeight: 'bold', fontSize: '0.95rem' }}>{extractedName} - {ticket.title}</p>
                    </Link>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      📋 Status: <strong style={{ color: ticket.status === 'New' ? '#ef4444' : '#f59e0b' }}>{ticket.status}</strong> 
                      • Last updated: {new Date(ticket.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* My Shifts */}
        <div className="bg-white-card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', position: 'relative' }}>
          <div style={{ width: '40px', height: '4px', background: '#8b5cf6', borderRadius: '2px', position: 'absolute', top: 0, left: '1.5rem' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
             <h2 className="text-dark" style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{fontSize: '1.3rem'}}>🗓️</span> Weekly Shifts</h2>
          </div>

          {myShifts.length === 0 ? (
            <div className="bg-light-stripe" style={{ padding: '2rem 1rem', textAlign: 'center', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
               <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>🏖️</span>
               <p style={{ color: 'var(--text-color)', fontSize: '0.9rem', margin: 0 }}>No shifts have been generated or assigned for the upcoming week.</p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {myShifts.map(shift => {
                 const isOff = shift.shiftTypeId === null;
                 const d = new Date(shift.date);
                 return (
                   <li key={shift.id} className={`hover-bg ${isOff ? '' : 'bg-light-stripe'}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', borderRadius: '8px', border: isOff ? '1px dashed var(--border-color)' : '1px solid var(--border-color)', transition: 'all 0.2s', background: isOff ? 'transparent' : '' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                       <div className="bg-white-card text-dark" style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', minWidth: '45px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                         {d.toLocaleDateString('en-US', { weekday: 'short' })}
                       </div>
                       <strong className="text-dark" style={{ fontSize: '0.9rem' }}>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric'})}</strong>
                     </div>
                     {isOff ? <span style={{ color: 'var(--text-color)', fontStyle: 'italic', fontSize: '0.9rem' }}>Day Off</span> : (
                       <span style={{ fontWeight: 'bold', color: '#3b82f6', fontSize: '0.9rem' }}>{shift.shiftType?.name} <span style={{color: 'var(--text-color)', fontWeight: '500'}}>- {shift.shiftType?.startTime}</span></span>
                     )}
                   </li>
                 );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Today's Pulse + Charts */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Glassmorphic Auto-Report */}
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', backdropFilter: 'blur(10px)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)', position: 'relative', overflow: 'hidden' }}>
          
          {/* Aesthetic background blobs */}
          <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(56, 189, 248, 0.2) 0%, rgba(255,255,255,0) 70%)', zIndex: 0, borderRadius: '50%' }}></div>
          <div style={{ position: 'absolute', bottom: '-80px', left: '100px', width: '250px', height: '250px', background: 'radial-gradient(circle, rgba(52, 211, 153, 0.15) 0%, rgba(255,255,255,0) 70%)', zIndex: 0, borderRadius: '50%' }}></div>

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 className="text-dark" style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <span style={{fontSize: '1.5rem'}}>⚡</span> Today's Pulse
                </h2>
                <p style={{ color: 'var(--text-color)', fontSize: '0.9rem', margin: 0, maxWidth: '600px', lineHeight: 1.5 }}>
                  Real-time aggregation of operations directly mapping chronological database manipulations dispatched bounds to the current active day shift.
                </p>
              </div>
              <Link href="/tickets?tab=all&date=today" className="primary-btn" style={{ background: 'var(--secondary-color)', color: 'white', fontWeight: 'bold', padding: '0.8rem 1.5rem', borderRadius: '8px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.2)' }}>
                Inspect Log Matrix →
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
               <div className="bg-white-card hover-lift" style={{ padding: '1.25rem', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                 <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#3b82f6', marginBottom: '0.4rem', lineHeight: '1', textShadow: '0 4px 10px rgba(59, 130, 246, 0.2)' }}>{todayTickets.length}</div>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-color)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Touched Today</div>
               </div>
               <div className="bg-white-card hover-lift" style={{ padding: '1.25rem', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                 <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#10b981', marginBottom: '0.4rem', lineHeight: '1', textShadow: '0 4px 10px rgba(16, 185, 129, 0.2)' }}>{todayResolved}</div>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-color)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Resolved Today</div>
               </div>
               <div className="bg-white-card hover-lift" style={{ padding: '1.25rem', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                 <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#f59e0b', marginBottom: '0.4rem', lineHeight: '1', textShadow: '0 4px 10px rgba(245, 158, 11, 0.2)' }}>{categoryMetrics.reduce((a, c) => a + c.active, 0)}</div>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-color)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Active Jobs</div>
               </div>
            </div>
          </div>
        </div>

        {/* Render Dynamic Graphs - Wrapped in a sleeker container */}
        <div className="bg-white-card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
           <DashboardCharts ticketStats={ticketStats} reportStats={reportStats} categoryStats={categoryStats} />
        </div>

      </section>

      {/* Global Style Injection for classes used here */}
      <style dangerouslySetInnerHTML={{__html: `
        .hover-lift { transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s; cursor: default; }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 15px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04) !important; }
        .hover-bg:hover { background: #f1f5f9 !important; border-color: #cbd5e1 !important; }
      `}} />

    </main>
  );
}
