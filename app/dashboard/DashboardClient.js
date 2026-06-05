"use client";
import { useState } from "react";
import Link from "next/link";
import LiveOpsBoard from "./LiveOpsBoard";
import DashboardCharts from "./DashboardCharts";

export default function DashboardClient({
  session,
  hasGlobalAccess,
  hasSkyViewAccess,
  finalScope,
  allowedScopes,
  
  // Workspace / KPI metrics
  totalNewTickets,
  totalInProgressTickets,
  totalWaitingTickets,
  totalRepliedTickets,
  todayResolvedCount,
  avgTtrObj,
  resolvedData,
  
  // Custom Widgets
  showKPIs,
  showCategoryMonitor,
  showLiveOps,
  showMyFollowups,
  showShifts,
  showCharts,
  
  // Data lists
  categoryMetrics,
  categoryStats,
  ticketStats,
  reportStats,
  myOpenTickets,
  myShifts,
  todayTickets,
  todayResolved,
  
  // Sky View specific data
  picWorkloads = [],
  criticalSlaTickets = [],
  activeCustomerIncidents = []
}) {
  const [activeTab, setActiveTab] = useState(hasSkyViewAccess ? "skyview" : "workspace");
  const [expandedPics, setExpandedPics] = useState({});
  const [expandedSlas, setExpandedSlas] = useState({});

  const togglePicExpand = (id) => {
    setExpandedPics(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSlaExpand = (id) => {
    setExpandedSlas(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper to extract customer name (duplicated client-side for rendering consistency)
  function getCustomerName(t) {
    if (t.services && t.services.length > 0 && t.services[0].customer) {
      return t.services[0].customer.name;
    }
    if (t.customData && typeof t.customData === 'object' && t.customData["Customer Name"]) {
      return t.customData["Customer Name"];
    }
    const match = t.description?.match(/\[Original Reporter: (.*?) -/);
    if (match) return match[1];
    return '-';
  }

  function getDuration(start, end) {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const diffMs = endTime - startTime;
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${mins}m`;
  }

  // Calculate global health metrics for Sky View
  const totalActiveOutages = activeCustomerIncidents.filter(t => t.priority === 'Critical').length;
  const totalActiveHighIncidents = activeCustomerIncidents.filter(t => t.priority === 'High').length;
  const totalActiveTicketsCount = categoryMetrics.reduce((a, c) => a + c.active, 0);

  // Group active incidents by Customer/Client
  const clientImpactMap = {};
  activeCustomerIncidents.forEach(t => {
    const clientName = getCustomerName(t);
    if (clientName === '-') return;
    if (!clientImpactMap[clientName]) {
      clientImpactMap[clientName] = {
        name: clientName,
        criticalCount: 0,
        highCount: 0,
        tickets: []
      };
    }
    if (t.priority === 'Critical') {
      clientImpactMap[clientName].criticalCount += 1;
    } else {
      clientImpactMap[clientName].highCount += 1;
    }
    clientImpactMap[clientName].tickets.push(t);
  });
  const clientImpacts = Object.values(clientImpactMap).sort(
    (a, b) => (b.criticalCount * 2 + b.highCount) - (a.criticalCount * 2 + a.highCount)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Hero Header Section */}
      <header style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem',
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
        padding: '2.5rem', borderRadius: '16px', color: 'white', 
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' 
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
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', border: '1px solid rgba(59, 130, 246, 0.3)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                🛡️ {session?.user?.role || "Staff"}
              </span>
              <span style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#e2e8f0', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', border: '1px solid rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                🏢 {session?.user?.department || "General"}
              </span>

              {/* Tab Switcher */}
              {hasSkyViewAccess && (
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', padding: '0.2rem', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.15)', marginLeft: '1rem' }}>
                  <button 
                    onClick={() => setActiveTab("workspace")}
                    style={{
                      background: activeTab === "workspace" ? 'var(--card-bg, #ffffff)' : 'transparent',
                      color: activeTab === "workspace" ? 'var(--heading-color, #0f172a)' : 'rgba(255,255,255,0.8)',
                      border: 'none', padding: '0.35rem 1rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    👤 My Workspace
                  </button>
                  <button 
                    onClick={() => setActiveTab("skyview")}
                    style={{
                      background: activeTab === "skyview" ? 'var(--card-bg, #ffffff)' : 'transparent',
                      color: activeTab === "skyview" ? 'var(--heading-color, #0f172a)' : 'rgba(255,255,255,0.8)',
                      border: 'none', padding: '0.35rem 1rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    🚁 Sky View
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global / Dept / Me Scope Selector (Only for workspace tab or non-admin users) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {activeTab === "workspace" && allowedScopes.length > 1 && (
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', padding: '0.25rem', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)' }}>
              {allowedScopes.includes('all') && (
                <Link href={`/dashboard?scope=all`} style={{ 
                  padding: '0.4rem 1.2rem', borderRadius: '20px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 'bold', 
                  background: finalScope === 'all' ? 'var(--card-bg)' : 'transparent', 
                  color: finalScope === 'all' ? 'var(--heading-color)' : 'rgba(255,255,255,0.7)',
                  transition: 'all 0.2s'
                }}>
                  🌐 Global
                </Link>
              )}
              {allowedScopes.includes('dept') && (
                <Link href={`/dashboard?scope=dept`} style={{ 
                  padding: '0.4rem 1.2rem', borderRadius: '20px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 'bold', 
                  background: finalScope === 'dept' ? 'var(--card-bg)' : 'transparent', 
                  color: finalScope === 'dept' ? 'var(--heading-color)' : 'rgba(255,255,255,0.7)',
                  transition: 'all 0.2s'
                }}>
                  🏢 Dept
                </Link>
              )}
              {allowedScopes.includes('me') && (
                <Link href={`/dashboard?scope=me`} style={{ 
                  padding: '0.4rem 1.2rem', borderRadius: '20px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 'bold', 
                  background: finalScope === 'me' ? 'var(--card-bg)' : 'transparent', 
                  color: finalScope === 'me' ? 'var(--heading-color)' : 'rgba(255,255,255,0.7)',
                  transition: 'all 0.2s'
                }}>
                  👤 Me
                </Link>
              )}
            </div>
          )}
          {(() => {
            const isCS = session?.user?.department?.includes('CS') || session?.user?.department?.toLowerCase().includes('customer');
            const canCreate = session?.user?.role === 'Admin' || isCS || session?.user?.permissions?.includes('create_tickets') || session?.user?.permissions?.includes('manage_tickets');
            return canCreate && (
              <Link href="/tickets/new" className="primary-btn" style={{ 
                background: 'var(--card-bg)', color: 'var(--text-color)', fontWeight: 'bold', padding: '0.8rem 1.5rem', 
                borderRadius: '8px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: 'none'
              }}>
                <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>+</span> Create Ticket
              </Link>
            );
          })()}
        </div>
      </header>

      {/* ========================================================================================= */}
      {/* VIEW 1: MY WORKSPACE DASHBOARD */}
      {/* ========================================================================================= */}
      {activeTab === "workspace" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* KPI Cards Widget */}
          {showKPIs && (
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
              <Link href={`/tickets?statuses=New${finalScope === 'all' ? '&all_depts=true&assignments=me,unassigned,others' : ''}${finalScope === 'dept' ? '&assignments=me,unassigned,others' : ''}${finalScope === 'me' ? '&assignments=me' : ''}`} style={{ textDecoration: 'none' }}>
                <div style={{ padding: '1.25rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(225, 29, 72, 0.05)', position: 'relative', overflow: 'hidden', cursor: 'pointer' }} className="hover-lift kpi-new">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
                    <h2 style={{ fontSize: '0.8rem', color: '#be123c', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>New</h2>
                    <span style={{ fontSize: '1.2rem' }}>🔥</span>
                  </div>
                  <p style={{ fontSize: '2.8rem', fontWeight: '900', margin: '0.3rem 0 0 0', color: '#e11d48', lineHeight: 1, position: 'relative', zIndex: 2 }}>{totalNewTickets}</p>
                  <div style={{ position: 'absolute', right: '-15px', bottom: '-15px', fontSize: '6rem', opacity: 0.04, zIndex: 1, transform: 'rotate(-15deg)' }}>🔥</div>
                </div>
              </Link>

              <Link href={`/tickets?statuses=In+Progress${finalScope === 'all' ? '&all_depts=true&assignments=me,unassigned,others' : ''}${finalScope === 'dept' ? '&assignments=me,unassigned,others' : ''}${finalScope === 'me' ? '&assignments=me' : ''}`} style={{ textDecoration: 'none' }}>
                <div style={{ padding: '1.25rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.05)', position: 'relative', overflow: 'hidden', cursor: 'pointer' }} className="hover-lift kpi-progress">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
                    <h2 style={{ fontSize: '0.8rem', color: '#1d4ed8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>In Progress</h2>
                    <span style={{ fontSize: '1.2rem' }}>⚡</span>
                  </div>
                  <p style={{ fontSize: '2.8rem', fontWeight: '900', margin: '0.3rem 0 0 0', color: '#2563eb', lineHeight: 1, position: 'relative', zIndex: 2 }}>{totalInProgressTickets}</p>
                  <div style={{ position: 'absolute', right: '-15px', bottom: '-15px', fontSize: '6rem', opacity: 0.04, zIndex: 1, transform: 'rotate(-15deg)' }}>⚡</div>
                </div>
              </Link>

              <Link href={`/tickets?statuses=Waiting+Reply,Replied${finalScope === 'all' ? '&all_depts=true&assignments=me,unassigned,others' : ''}${finalScope === 'dept' ? '&assignments=me,unassigned,others' : ''}${finalScope === 'me' ? '&assignments=me' : ''}`} style={{ textDecoration: 'none' }}>
                <div style={{ padding: '1.25rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(217, 119, 6, 0.05)', position: 'relative', overflow: 'hidden', cursor: 'pointer' }} className="hover-lift kpi-pending">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
                    <h2 style={{ fontSize: '0.8rem', color: '#b45309', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Pending</h2>
                    <span style={{ fontSize: '1.2rem' }}>⏳</span>
                  </div>
                  <p style={{ fontSize: '2.8rem', fontWeight: '900', margin: '0.3rem 0 0 0', color: '#d97706', lineHeight: 1, position: 'relative', zIndex: 2 }}>{totalWaitingTickets + totalRepliedTickets}</p>
                  <div style={{ position: 'absolute', right: '-15px', bottom: '-15px', fontSize: '6rem', opacity: 0.04, zIndex: 1, transform: 'rotate(-15deg)' }}>⏳</div>
                </div>
              </Link>

              <Link href={`/tickets?statuses=Resolved&date=today${finalScope === 'all' ? '&all_depts=true&assignments=me,unassigned,others' : ''}${finalScope === 'dept' ? '&assignments=me,unassigned,others' : ''}${finalScope === 'me' ? '&assignments=me' : ''}`} style={{ textDecoration: 'none' }}>
                <div style={{ padding: '1.25rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.05)', position: 'relative', overflow: 'hidden', cursor: 'pointer' }} className="hover-lift kpi-resolved">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
                    <h2 style={{ fontSize: '0.8rem', color: '#15803d', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Resolved Today</h2>
                    <span style={{ fontSize: '1.2rem' }}>✅</span>
                  </div>
                  <p style={{ fontSize: '2.8rem', fontWeight: '900', margin: '0.3rem 0 0 0', color: '#16a34a', lineHeight: 1, position: 'relative', zIndex: 2 }}>{todayResolvedCount}</p>
                  <div style={{ position: 'absolute', right: '-15px', bottom: '-15px', fontSize: '6rem', opacity: 0.04, zIndex: 1, transform: 'rotate(-15deg)' }}>✅</div>
                </div>
              </Link>

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
          )}

          {/* Job Category Monitor */}
          {showCategoryMonitor && categoryMetrics.filter(cat => cat.active > 0).length > 0 && (
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--heading-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🏷️</span> Job Category Monitor
                </h2>
                <Link href={`/tickets?statuses=New,Open,In+Progress,Waiting+Reply,Replied,On+Hold,Finish${finalScope === 'all' ? '&all_depts=true&assignments=me,unassigned,others' : ''}${finalScope === 'dept' ? '&assignments=me,unassigned,others' : ''}${finalScope === 'me' ? '&assignments=me' : ''}`} style={{ fontSize: '0.8rem', color: '#3b82f6', textDecoration: 'none', fontWeight: 'bold' }}>
                  View All Tickets →
                </Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                {categoryMetrics.filter(cat => cat.active > 0).map((cat, idx) => {
                  const CATEGORY_COLORS_LIST = ['#3b82f6', '#ef4444', '#8b5cf6', '#10b981', '#f59e0b', '#f97316', '#06b6d4', '#64748b', '#ec4899', '#84cc16'];
                  const color = CATEGORY_COLORS_LIST[idx % CATEGORY_COLORS_LIST.length];
                  const total = cat.active + cat.resolvedToday;
                  const progress = total > 0 ? Math.round((cat.resolvedToday / total) * 100) : 0;
                  const hasOverdue = cat.active > 5;
                  return (
                    <Link key={cat.id} href={`/tickets?statuses=New,Open,In+Progress,Waiting+Reply,Replied,On+Hold,Finish&jobCategory=${encodeURIComponent(cat.name)}${finalScope === 'all' ? '&all_depts=true&assignments=me,unassigned,others' : ''}${finalScope === 'dept' ? '&assignments=me,unassigned,others' : ''}${finalScope === 'me' ? '&assignments=me' : ''}`} style={{ textDecoration: 'none' }}>
                      <div className="hover-lift" style={{
                        padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)',
                        background: 'var(--card-bg)', cursor: 'pointer', position: 'relative', overflow: 'hidden',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
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

          {/* Live Operations Board */}
          {showLiveOps && (
            <section>
              <LiveOpsBoard jobCategories={categoryMetrics} defaultScope={finalScope} />
            </section>
          )}

          {/* Follow-ups and Shifts */}
          {(showMyFollowups || showShifts) && (
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {showMyFollowups && (
                <div style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', position: 'relative', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
                  <div style={{ width: '40px', height: '4px', background: '#f59e0b', borderRadius: '2px', position: 'absolute', top: 0, left: '1.5rem' }}></div>
                  <h2 style={{ margin: '0.5rem 0 1.5rem 0', fontSize: '1.2rem', color: 'var(--heading-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>🎯</span> My Follow-Ups
                  </h2>
                  {myOpenTickets.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', borderRadius: '8px', border: '1px dashed var(--border-color)', background: 'var(--hover-bg)' }}>
                       <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>☕</span>
                       <p style={{ color: 'var(--text-color)', fontSize: '0.9rem', margin: 0 }}>You have no open tickets assigned to you.</p>
                    </div>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {myOpenTickets.map(ticket => (
                        <li key={ticket.id} className="hover-bg" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', borderLeft: '3px solid #3b82f6', background: 'var(--hover-bg)' }}>
                          <div>
                            <Link href={`/tickets/${ticket.id}`} style={{ textDecoration: 'none' }}>
                              <p style={{ margin: '0 0 0.25rem 0', fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--heading-color)' }}>{getCustomerName(ticket)} - {ticket.title}</p>
                            </Link>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-color)' }}>
                              📋 Status: <strong style={{ color: ticket.status === 'New' ? '#ef4444' : '#f59e0b' }}>{ticket.status}</strong> 
                              • Last updated: {new Date(ticket.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {showShifts && (
                <div style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', position: 'relative', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
                  <div style={{ width: '40px', height: '4px', background: '#8b5cf6', borderRadius: '2px', position: 'absolute', top: 0, left: '1.5rem' }}></div>
                  <h2 style={{ margin: '0.5rem 0 1.5rem 0', fontSize: '1.2rem', color: 'var(--heading-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>🗓️</span> Weekly Shifts
                  </h2>
                  {myShifts.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', borderRadius: '8px', border: '1px dashed var(--border-color)', background: 'var(--hover-bg)' }}>
                       <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>🏖️</span>
                       <p style={{ color: 'var(--text-color)', fontSize: '0.9rem', margin: 0 }}>No shifts assigned for this week.</p>
                    </div>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {myShifts.map(shift => {
                         const isOff = shift.shiftTypeId === null;
                         const d = new Date(shift.date);
                         return (
                           <li key={shift.id} className="hover-bg" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', borderRadius: '8px', border: isOff ? '1px dashed var(--border-color)' : '1px solid var(--border-color)', background: isOff ? 'transparent' : 'var(--hover-bg)' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                               <div style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', minWidth: '45px', textAlign: 'center', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--heading-color)' }}>
                                 {d.toLocaleDateString('en-US', { weekday: 'short' })}
                               </div>
                               <strong style={{ fontSize: '0.9rem', color: 'var(--heading-color)' }}>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric'})}</strong>
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
              )}
            </section>
          )}

          {/* Today's Pulse and Charts */}
          {showCharts && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ padding: '2rem', borderRadius: '16px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)' }}>
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, rgba(255,255,255,0) 70%)', zIndex: 0, borderRadius: '50%' }}></div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem', color: 'var(--heading-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                         <span>⚡</span> Today's Pulse
                      </h2>
                      <p style={{ color: 'var(--text-color)', fontSize: '0.9rem', margin: 0, maxWidth: '600px', lineHeight: 1.5 }}>
                        Real-time status updates of active operations in this shift.
                      </p>
                    </div>
                    <Link href="/tickets?tab=all&date=today" className="primary-btn" style={{ background: 'var(--secondary-color)', color: 'white', fontWeight: 'bold', padding: '0.8rem 1.5rem', borderRadius: '8px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Inspect Log Matrix →
                    </Link>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                     <div className="bg-white-card hover-lift" style={{ padding: '1.25rem', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}>
                       <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#3b82f6', marginBottom: '0.4rem', lineHeight: '1' }}>{todayTickets.length}</div>
                       <div style={{ fontSize: '0.8rem', color: 'var(--text-color)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Touched Today</div>
                     </div>
                     <div className="bg-white-card hover-lift" style={{ padding: '1.25rem', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}>
                       <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#10b981', marginBottom: '0.4rem', lineHeight: '1' }}>{todayResolved}</div>
                       <div style={{ fontSize: '0.8rem', color: 'var(--text-color)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Resolved Today</div>
                     </div>
                     <div className="bg-white-card hover-lift" style={{ padding: '1.25rem', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}>
                       <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#f59e0b', marginBottom: '0.4rem', lineHeight: '1' }}>{totalActiveTicketsCount}</div>
                       <div style={{ fontSize: '0.8rem', color: 'var(--text-color)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Active Jobs</div>
                     </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
                 <DashboardCharts ticketStats={ticketStats} reportStats={reportStats} categoryStats={categoryStats} />
              </div>
            </section>
          )}

        </div>
      )}

      {/* ========================================================================================= */}
      {/* VIEW 2: SKY VIEW (GLOBAL EXECUTIVE RADAR) */}
      {/* ========================================================================================= */}
      {activeTab === "skyview" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          {/* Executive Global KPI Stats */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
            
            <div style={{ padding: '1.5rem', borderRadius: '16px', background: '#fef2f2', border: '1px solid #fecaca', boxShadow: '0 10px 15px -3px rgba(220, 38, 38, 0.05)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '0.85rem', color: '#991b1b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Critical Outages</h3>
                <span style={{ fontSize: '1.4rem' }}>🚨</span>
              </div>
              <p style={{ fontSize: '3rem', fontWeight: '900', color: '#dc2626', margin: 0, lineHeight: 1 }}>{totalActiveOutages}</p>
              <p style={{ fontSize: '0.8rem', color: '#be123c', margin: '0.5rem 0 0 0' }}>Tiket prioritas tinggi yang membutuhkan intervensi.</p>
              <div style={{ position: 'absolute', right: '-10px', bottom: '-15px', fontSize: '6rem', opacity: 0.04, transform: 'rotate(-10deg)' }}>🚨</div>
            </div>

            <div style={{ padding: '1.5rem', borderRadius: '16px', background: '#fffbeb', border: '1px solid #fde68a', boxShadow: '0 10px 15px -3px rgba(217, 119, 6, 0.05)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '0.85rem', color: '#92400e', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>SLA Alerts</h3>
                <span style={{ fontSize: '1.4rem' }}>⏳</span>
              </div>
              <p style={{ fontSize: '3rem', fontWeight: '900', color: '#d97706', margin: 0, lineHeight: 1 }}>{criticalSlaTickets.length}</p>
              <p style={{ fontSize: '0.8rem', color: '#b45309', margin: '0.5rem 0 0 0' }}>Tiket aktif dengan batas SLA yang terus berjalan.</p>
              <div style={{ position: 'absolute', right: '-10px', bottom: '-15px', fontSize: '6rem', opacity: 0.04, transform: 'rotate(-10deg)' }}>⏳</div>
            </div>

            <div style={{ padding: '1.5rem', borderRadius: '16px', background: '#eff6ff', border: '1px solid #bfdbfe', boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.05)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '0.85rem', color: '#1e40af', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Global Active Tickets</h3>
                <span style={{ fontSize: '1.4rem' }}>🌐</span>
              </div>
              <p style={{ fontSize: '3rem', fontWeight: '900', color: '#2563eb', margin: 0, lineHeight: 1 }}>{totalActiveTicketsCount}</p>
              <p style={{ fontSize: '0.8rem', color: '#1d4ed8', margin: '0.5rem 0 0 0' }}>Beban tiket aktif secara keseluruhan di seluruh departemen.</p>
              <div style={{ position: 'absolute', right: '-10px', bottom: '-15px', fontSize: '6rem', opacity: 0.04, transform: 'rotate(-10deg)' }}>🌐</div>
            </div>

            <div style={{ padding: '1.5rem', borderRadius: '16px', background: '#ecfdf5', border: '1px solid #a7f3d0', boxShadow: '0 10px 15px -3px rgba(5, 150, 105, 0.05)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '0.85rem', color: '#065f46', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>MTTR Global</h3>
                <span style={{ fontSize: '1.4rem' }}>⏱️</span>
              </div>
              <p style={{ fontSize: '2.5rem', fontWeight: '900', color: '#059669', margin: '0.2rem 0 0 0', lineHeight: 1 }}>
                {resolvedData.length === 0 ? 'N/A' : `${avgTtrObj.h}h ${avgTtrObj.m}m`}
              </p>
              <p style={{ fontSize: '0.8rem', color: '#047857', margin: '0.5rem 0 0 0' }}>Rerata durasi penyelesaian semua tiket saat ini.</p>
              <div style={{ position: 'absolute', right: '-10px', bottom: '-15px', fontSize: '6rem', opacity: 0.03, transform: 'rotate(-10deg)' }}>⏱️</div>
            </div>

          </section>

          {/* Row 1: PIC Workloads Heatmap & SLA Escalation Radar */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '2rem' }}>
            
            {/* Workload Heatmap NOC Staff */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', height: '450px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: 'var(--heading-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>👥</span> NOC Staff Workload Capacity
              </h3>
              <p style={{ color: 'var(--text-color)', fontSize: '0.8rem', margin: '0 0 1.25rem 0' }}>
                Monitoring load aktif setiap tim teknis untuk re-assignment penyeimbangan tugas.
              </p>

              <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
                {picWorkloads.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-color)', fontStyle: 'italic' }}>Tidak ada user NOC terdaftar.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                    {picWorkloads.map(u => {
                      const count = u._count.tickets;
                      const name = u.name || u.email.split('@')[0];
                      const dept = u.department?.name || "General";
                      // Capacity percentage logic (max expected load = 8 tickets)
                      const percent = Math.min(Math.round((count / 8) * 100), 100);
                      // Color code
                      let color = '#10b981'; // green
                      let bg = '#ecfdf5';
                      let loadText = 'Ringan';
                      if (count >= 6) {
                        color = '#ef4444'; // red
                        bg = '#fef2f2';
                        loadText = 'Overload';
                      } else if (count >= 3) {
                        color = '#f59e0b'; // amber
                        bg = '#fffbeb';
                        loadText = 'Sedang';
                      }

                      const totalWeight = (u.tickets || []).reduce((sum, t) => sum + (t.jobCategory?.score || 0), 0);
                      const isExpanded = !!expandedPics[u.id];

                      return (
                        <div key={u.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span 
                              onClick={() => togglePicExpand(u.id)}
                              style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--heading-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                            >
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{isExpanded ? '▼' : '▶'}</span>
                              {name} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-color)' }}>({dept})</span>
                            </span>
                            <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              {totalWeight > 0 && (
                                <span style={{ fontSize: '0.68rem', background: '#eff6ff', color: '#2563eb', padding: '0.15rem 0.5rem', borderRadius: '12px', border: '1px solid #bfdbfe', fontWeight: 'bold' }}>
                                  Bobot: {totalWeight} pt
                                </span>
                              )}
                              <span style={{ background: bg, color: color, padding: '0.15rem 0.6rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', border: `1px solid ${color}30` }}>
                                {count} Tiket • {loadText}
                              </span>
                            </span>
                          </div>
                          <div style={{ height: '8px', background: 'var(--hover-bg)', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => togglePicExpand(u.id)}>
                            <div style={{ height: '100%', width: `${percent}%`, background: color, borderRadius: '4px', transition: 'width 0.4s ease-in-out' }}></div>
                          </div>

                          {isExpanded && (
                            <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--hover-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {(!u.tickets || u.tickets.length === 0) ? (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-color)', textAlign: 'center', fontStyle: 'italic' }}>
                                  Tidak ada tiket aktif saat ini.
                                </div>
                              ) : (
                                u.tickets.map(t => {
                                  let pColor = '#94a3b8';
                                  if (t.priority === 'Critical') pColor = '#ef4444';
                                  else if (t.priority === 'High') pColor = '#f59e0b';
                                  else if (t.priority === 'Medium') pColor = '#3b82f6';
                                  else if (t.priority === 'Low') pColor = '#10b981';

                                  return (
                                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', gap: '0.5rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, flex: 1 }}>
                                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: pColor, flexShrink: 0 }} title={t.priority}></span>
                                        <Link href={`/tickets/${t.id}`} style={{ fontWeight: 'bold', textDecoration: 'none', color: '#3b82f6', flexShrink: 0 }}>
                                          [{t.trackingId}]
                                        </Link>
                                        <span style={{ color: 'var(--heading-color)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={t.title}>
                                          {t.title}
                                        </span>
                                      </div>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-color)', flexShrink: 0 }}>
                                        {(() => {
                                          const hasDt = t.customData && typeof t.customData === 'object' && t.customData.hasDowntime;
                                          return hasDt && t.customData.startDowntime
                                            ? `⏱️ ${getDuration(t.customData.startDowntime, t.customData.endDowntime)}`
                                            : getDuration(t.customData?.reopenedAt || t.createdAt);
                                        })()}
                                      </span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* SLA Early Warning Radar */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', height: '450px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: 'var(--heading-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>⚡</span> SLA Escalation Radar & Warnings
              </h3>
              <p style={{ color: 'var(--text-color)', fontSize: '0.8rem', margin: '0 0 1.25rem 0' }}>
                Daftar tiket aktif yang mendekati batas waktu SLA (diurutkan berdasarkan urgensi waktu).
              </p>

              <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
                {criticalSlaTickets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-color)', fontStyle: 'italic' }}>
                    🎉 Seluruh tiket aktif memiliki SLA yang aman.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {criticalSlaTickets.map(t => {
                      const timeLeftMs = new Date(t.nextSlaDeadline).getTime() - Date.now();
                      const isOverdue = timeLeftMs < 0;
                      const timeLeftMin = Math.round(timeLeftMs / 60000);
                      
                      let urgencyColor = '#10b981';
                      let urgencyBg = '#ecfdf5';
                      let statusLabel = `Sisa ${timeLeftMin} menit`;
                      
                      if (isOverdue) {
                        urgencyColor = '#ef4444';
                        urgencyBg = '#fef2f2';
                        statusLabel = 'SLA BREACHED';
                      } else if (timeLeftMin < 30) {
                        urgencyColor = '#f59e0b';
                        urgencyBg = '#fffbeb';
                        statusLabel = `Kritis (${timeLeftMin}m)`;
                      }

                      const isExpanded = !!expandedSlas[t.id];

                      let priorityEmoji = '🟢';
                      let priorityColor = '#10b981';
                      let priorityBg = '#ecfdf5';
                      if (t.priority === 'Critical') {
                        priorityEmoji = '🔴';
                        priorityColor = '#ef4444';
                        priorityBg = '#fef2f2';
                      } else if (t.priority === 'High') {
                        priorityEmoji = '🟠';
                        priorityColor = '#f59e0b';
                        priorityBg = '#fffbeb';
                      } else if (t.priority === 'Medium') {
                        priorityEmoji = '🔵';
                        priorityColor = '#3b82f6';
                        priorityBg = '#eff6ff';
                      }

                      return (
                        <div key={t.id} style={{ display: 'flex', flexDirection: 'column', padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', borderLeft: `4px solid ${urgencyColor}`, background: 'var(--hover-bg)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%', cursor: 'pointer' }} onClick={() => toggleSlaExpand(t.id)}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{isExpanded ? '▼' : '▶'}</span>
                                <Link href={`/tickets/${t.id}`} style={{ fontWeight: 'bold', fontSize: '0.88rem', textDecoration: 'none', color: '#3b82f6' }} onClick={e => e.stopPropagation()}>
                                  {t.trackingId}
                                </Link>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--heading-color)', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '600' }}>{t.title}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-color)', marginTop: '0.1rem' }}>
                                PIC: {t.assignee?.name || 'Unassigned'} • {t.department?.name}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-end' }}>
                              <span style={{ display: 'inline-block', background: urgencyBg, color: urgencyColor, padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 'bold', border: `1px solid ${urgencyColor}25` }}>
                                {statusLabel}
                              </span>
                              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                <span style={{ background: priorityBg, color: priorityColor, padding: '0.05rem 0.3rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold', border: `1px solid ${priorityColor}20` }}>
                                  {priorityEmoji} {t.priority}
                                </span>
                                {t.jobCategory?.name && (
                                  <span style={{ background: 'var(--card-bg)', color: 'var(--heading-color)', padding: '0.05rem 0.3rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold', border: '1px solid var(--border-color)' }}>
                                    🏷️ {t.jobCategory.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div style={{ color: 'var(--text-color)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                                <strong>Deskripsi:</strong> {t.description ? (t.description.length > 150 ? t.description.substring(0, 150) + "..." : t.description) : "Tidak ada deskripsi."}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-color)' }}>
                                  Dibuat: {new Date(t.createdAt).toLocaleString('en-CA')} ({getDuration(t.createdAt)} lalu)
                                </span>
                                <Link href={`/tickets/${t.id}`} style={{ background: '#3b82f6', color: 'white', textDecoration: 'none', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 'bold' }}>
                                  Buka Tiket →
                                </Link>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </section>

          {/* Row 2: Customer Impact Matrix (Incidents List) & Global Charts */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '2rem' }}>
            
            {/* Customer Outages Impact Matrix */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', height: '450px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: 'var(--heading-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🏢</span> Customer Outage Impact Matrix
              </h3>
              <p style={{ color: 'var(--text-color)', fontSize: '0.8rem', margin: '0 0 1.25rem 0' }}>
                Daftar pelanggan komersial dengan gangguan Critical (Outage) / High yang sedang aktif saat ini.
              </p>

              <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
                {clientImpacts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-color)', fontStyle: 'italic', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                    🟢 Tidak ada pelanggan terdampak outage saat ini. Seluruh jaringan terpantau stabil.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                          <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: 'var(--text-color)', fontWeight: 'bold' }}>Customer Name</th>
                          <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: 'var(--text-color)', fontWeight: 'bold', width: '120px' }}>Critical Outages</th>
                          <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: 'var(--text-color)', fontWeight: 'bold', width: '120px' }}>High Incidents</th>
                          <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: 'var(--text-color)', fontWeight: 'bold' }}>Active Impacted Tickets</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientImpacts.map(client => (
                          <tr key={client.name} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.85rem 0.5rem', fontWeight: 'bold', color: 'var(--heading-color)' }}>
                              🏢 {client.name}
                            </td>
                            <td style={{ padding: '0.85rem 0.5rem', textAlign: 'center' }}>
                              {client.criticalCount > 0 ? (
                                <span style={{ background: '#fef2f2', color: '#dc2626', fontWeight: 'bold', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', border: '1px solid #fecaca' }}>
                                  🔥 {client.criticalCount} Outage
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>-</span>
                              )}
                            </td>
                            <td style={{ padding: '0.85rem 0.5rem', textAlign: 'center' }}>
                              {client.highCount > 0 ? (
                                <span style={{ background: '#fffbeb', color: '#d97706', fontWeight: 'bold', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', border: '1px solid #fde68a' }}>
                                  ⚠️ {client.highCount} Tiket
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>-</span>
                              )}
                            </td>
                            <td style={{ padding: '0.85rem 0.5rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {client.tickets.map(t => (
                                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                                    <Link href={`/tickets/${t.id}`} style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 'bold' }}>
                                      [{t.trackingId}]
                                    </Link>
                                    <span style={{ color: 'var(--heading-color)' }}>{t.title}</span>
                                    <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                                      {(() => {
                                        const hasDt = t.customData && typeof t.customData === 'object' && t.customData.hasDowntime;
                                        return hasDt && t.customData.startDowntime ? (
                                          <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>
                                            ⏱️ Down: {getDuration(t.customData.startDowntime, t.customData.endDowntime)}
                                          </span>
                                        ) : (
                                          `(Down: ${getDuration(t.customData?.reopenedAt || t.createdAt)})`
                                        );
                                      })()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Global Trends & Analytics (Charts) */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', height: '450px', display: 'flex', flexDirection: 'column' }}>
               <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: 'var(--heading-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <span>📈</span> Global Incoming vs Resolved Incident Analytics
               </h3>
               <p style={{ color: 'var(--text-color)', fontSize: '0.8rem', margin: '0 0 1.25rem 0' }}>
                 Visualisasi tren pembuatan dan penyelesaian tiket untuk melihat tren performa tim.
               </p>
               <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
                 <DashboardCharts ticketStats={ticketStats} reportStats={reportStats} categoryStats={categoryStats} />
               </div>
            </div>

          </section>

        </div>
      )}

      {/* Global CSS Style Injections */}
      <style dangerouslySetInnerHTML={{__html: `
        .hover-lift { transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s; }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 15px 25px -5px rgba(0,0,0,0.1) !important; }
        .hover-bg:hover { background: var(--hover-bg, #f1f5f9) !important; }
      `}} />
    </div>
  );
}
