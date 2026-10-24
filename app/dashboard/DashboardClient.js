"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { WORK_TYPES, WORK_TYPE_LABELS } from "@/lib/tickets/workClassification";
import { useState } from "react";
import Link from "next/link";
import LiveOpsBoard from "./LiveOpsBoard";
import DashboardCharts from "./DashboardCharts";
import MyPointsCard from "@/components/MyPointsCard";
import { isPersonalCategoryName } from "@/lib/tickets/personalCategories";

export default function DashboardClient({
  session,
  hasGlobalAccess,
  hasSkyViewAccess,
  finalScope,
  workType = "",
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const dashboardHref = (scope) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('scope', scope);
    return `/dashboard?${params.toString()}`;
  };
  const classificationQuery = workType ? `&workType=${encodeURIComponent(workType)}` : '';
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
    <div className="ui-static-0410aac9fd" style={{display: 'flex', flexDirection: 'column'}}>
      {/* Hero Header Section */}
      <header className="dashboard-welcome ui-static-e76a58ee40" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'}}>
        <div className="ui-static-92254f43e7" style={{display: 'flex', alignItems: 'center'}}>
          {session?.user?.avatarUrl ? (
            <img src={session.user.avatarUrl} alt="Avatar" className="ui-static-d048fa8c56" style={{width: '70px', height: '70px', objectFit: 'cover'}} />
          ) : (
            <div className="ui-static-663b46f5b4" style={{width: '70px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{(session?.user?.name||'N').slice(0,1).toUpperCase()}</div>
          )}
          <div>
            <h1 className="ui-static-9630f42854" >
              Welcome back, {session?.user?.name || session?.user?.email?.split('@')[0]}!
            </h1>
            <div className="ui-static-e59a73fd03" style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center'}}>
              <span className="ui-static-c51c81112a" style={{display: 'flex', alignItems: 'center'}}>
                 {session?.user?.role || "Staff"}
              </span>
              <span className="ui-static-c7f6937aad" style={{display: 'flex', alignItems: 'center'}}>
                 {session?.user?.department || "General"}
              </span>

              {/* Tab Switcher */}
              {hasSkyViewAccess && (
                <div className="ui-static-bef1a418ac" style={{display: 'flex'}}>
                  <button 
                    onClick={() => setActiveTab("workspace")}
                    className="ui-static-d97111110f" style={{background: activeTab === "workspace" ? 'var(--card-bg, #ffffff)' : 'transparent', color: activeTab === "workspace" ? 'var(--heading-color, #0f172a)' : 'var(--muted-text)', cursor: 'pointer', transition: 'all 0.2s'}}
                  >
                     My Workspace
                  </button>
                  <button 
                    onClick={() => setActiveTab("skyview")}
                    className="ui-static-d97111110f" style={{background: activeTab === "skyview" ? 'var(--card-bg, #ffffff)' : 'transparent', color: activeTab === "skyview" ? 'var(--heading-color, #0f172a)' : 'var(--muted-text)', cursor: 'pointer', transition: 'all 0.2s'}}
                  >
                     Sky View
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global / Dept / Me Scope Selector (Only for workspace tab or non-admin users) */}
        <div className="ui-static-af81cc4264" style={{display: 'flex', alignItems: 'center', flexWrap: 'wrap'}}>
          <label className="ui-static-1626e8f810" style={{display: 'flex', flexDirection: 'column'}}>
            Klasifikasi pekerjaan
            <select value={workType} onChange={e => {
              const params = new URLSearchParams(searchParams.toString());
              if (e.target.value) params.set('workType', e.target.value);
              else params.delete('workType');
              router.push(`/dashboard?${params.toString()}`);
            }} className="ui-static-4b0e18c498" >
              <option value="">Semua</option>
              {WORK_TYPES.map(value => <option key={value} value={value}>{WORK_TYPE_LABELS[value]}</option>)}
            </select>
          </label>
          {activeTab === "workspace" && allowedScopes.length > 1 && (
            <div className="ui-static-5ff7455716" style={{display: 'flex'}}>
              {allowedScopes.includes('all') && (
                <Link href={dashboardHref("all")} className="ui-static-d1a9377e2e" style={{textDecoration: 'none', background: finalScope === 'all' ? 'var(--card-bg)' : 'transparent', color: finalScope === 'all' ? 'var(--heading-color)' : 'rgba(255,255,255,0.7)', transition: 'all 0.2s'}}>
                   Global
                </Link>
              )}
              {allowedScopes.includes('dept') && (
                <Link href={dashboardHref("dept")} className="ui-static-d1a9377e2e" style={{textDecoration: 'none', background: finalScope === 'dept' ? 'var(--card-bg)' : 'transparent', color: finalScope === 'dept' ? 'var(--heading-color)' : 'rgba(255,255,255,0.7)', transition: 'all 0.2s'}}>
                   Dept
                </Link>
              )}
              {allowedScopes.includes('me') && (
                <Link href={dashboardHref("me")} className="ui-static-d1a9377e2e" style={{textDecoration: 'none', background: finalScope === 'me' ? 'var(--card-bg)' : 'transparent', color: finalScope === 'me' ? 'var(--heading-color)' : 'rgba(255,255,255,0.7)', transition: 'all 0.2s'}}>
                   Me
                </Link>
              )}
            </div>
          )}
          {(() => {
            const isCS = session?.user?.department?.includes('CS') || session?.user?.department?.toLowerCase().includes('customer');
            const canCreate = session?.user?.role === 'Admin' || isCS || session?.user?.permissions?.includes('create_tickets') || session?.user?.permissions?.includes('manage_tickets');
            return canCreate && (
              <Link href={workType ? `/tickets/new?workType=${workType}` : "/tickets/new"} className="primary-btn btn-fit" style={{textDecoration: 'none', display: 'flex', alignItems: 'center'}}>
                <span className="ui-static-cb379bd05e" >+</span> Create Ticket
              </Link>
            );
          })()}
        </div>
      </header>

      {session?.user?.id && <MyPointsCard userId={session.user.id} />}

      {/* ========================================================================================= */}
      {/* VIEW 1: MY WORKSPACE DASHBOARD */}
      {/* ========================================================================================= */}
      {activeTab === "workspace" && (
        <div className="ui-static-0410aac9fd" style={{display: 'flex', flexDirection: 'column'}}>

          {/* KPI Cards Widget */}
          {showKPIs && (
            <section className="ui-static-6ef8599ce0" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'}}>
              <Link href={`/tickets?statuses=New${classificationQuery}${finalScope === 'all' ? '&all_depts=true&assignments=me,unassigned,others' : ''}${finalScope === 'dept' ? '&assignments=me,unassigned,others' : ''}${finalScope === 'me' ? '&assignments=me' : ''}`} style={{ textDecoration: 'none' }}>
                <div style={{position: 'relative', overflow: 'hidden', cursor: 'pointer'}} className="hover-lift kpi-new ui-static-f009ec8784">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
                    <h2 className="ui-static-0754c6ce13" style={{textTransform: 'uppercase'}}>New</h2>
                    <span className="ui-static-7f8da12489" ></span>
                  </div>
                  <p className="ui-static-75e3da95f2" style={{position: 'relative', zIndex: 2}}>{totalNewTickets}</p>
                  <div className="ui-static-12dae84fc3" style={{position: 'absolute', right: '-15px', bottom: '-15px', opacity: 0.04, zIndex: 1, transform: 'rotate(-15deg)'}}></div>
                </div>
              </Link>

              <Link href={`/tickets?statuses=In+Progress${classificationQuery}${finalScope === 'all' ? '&all_depts=true&assignments=me,unassigned,others' : ''}${finalScope === 'dept' ? '&assignments=me,unassigned,others' : ''}${finalScope === 'me' ? '&assignments=me' : ''}`} style={{ textDecoration: 'none' }}>
                <div style={{position: 'relative', overflow: 'hidden', cursor: 'pointer'}} className="hover-lift kpi-progress ui-static-f009ec8784">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
                    <h2 className="ui-static-f93603907b" style={{textTransform: 'uppercase'}}>In Progress</h2>
                    <span className="ui-static-7f8da12489" ></span>
                  </div>
                  <p className="ui-static-2b2733060d" style={{position: 'relative', zIndex: 2}}>{totalInProgressTickets}</p>
                  <div className="ui-static-12dae84fc3" style={{position: 'absolute', right: '-15px', bottom: '-15px', opacity: 0.04, zIndex: 1, transform: 'rotate(-15deg)'}}></div>
                </div>
              </Link>

              <Link href={`/tickets?statuses=Waiting+Reply,Replied${classificationQuery}${finalScope === 'all' ? '&all_depts=true&assignments=me,unassigned,others' : ''}${finalScope === 'dept' ? '&assignments=me,unassigned,others' : ''}${finalScope === 'me' ? '&assignments=me' : ''}`} style={{ textDecoration: 'none' }}>
                <div style={{position: 'relative', overflow: 'hidden', cursor: 'pointer'}} className="hover-lift kpi-pending ui-static-f009ec8784">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
                    <h2 className="ui-static-b539b90448" style={{textTransform: 'uppercase'}}>Pending</h2>
                    <span className="ui-static-7f8da12489" ></span>
                  </div>
                  <p className="ui-static-3cc0c9b4a6" style={{position: 'relative', zIndex: 2}}>{totalWaitingTickets + totalRepliedTickets}</p>
                  <div className="ui-static-12dae84fc3" style={{position: 'absolute', right: '-15px', bottom: '-15px', opacity: 0.04, zIndex: 1, transform: 'rotate(-15deg)'}}></div>
                </div>
              </Link>

              <Link href={`/tickets?statuses=Resolved&date=today${classificationQuery}${finalScope === 'all' ? '&all_depts=true&assignments=me,unassigned,others' : ''}${finalScope === 'dept' ? '&assignments=me,unassigned,others' : ''}${finalScope === 'me' ? '&assignments=me' : ''}`} style={{ textDecoration: 'none' }}>
                <div style={{position: 'relative', overflow: 'hidden', cursor: 'pointer'}} className="hover-lift kpi-resolved ui-static-f009ec8784">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
                    <h2 className="ui-static-343a1266dd" style={{textTransform: 'uppercase'}}>Resolved Today</h2>
                    <span className="ui-static-7f8da12489" ></span>
                  </div>
                  <p className="ui-static-bb17bdc2e1" style={{position: 'relative', zIndex: 2}}>{todayResolvedCount}</p>
                  <div className="ui-static-12dae84fc3" style={{position: 'absolute', right: '-15px', bottom: '-15px', opacity: 0.04, zIndex: 1, transform: 'rotate(-15deg)'}}></div>
                </div>
              </Link>

              <div style={{position: 'relative', overflow: 'hidden'}} className="hover-lift kpi-ttr ui-static-f009ec8784">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
                  <h2 className="ui-static-f93603907b" style={{textTransform: 'uppercase'}}>Avg TTR</h2>
                  <span className="ui-static-7f8da12489" ></span>
                </div>
                <p className="ui-static-e8ccd93cc4" style={{position: 'relative', zIndex: 2}}>
                  {resolvedData.length === 0 ? 'N/A' : (
                    <>
                      {avgTtrObj.h > 0 && <span className="ui-static-a55b0e3a39" >{avgTtrObj.h}<span className="ui-static-1a03a1a0a0" >h</span></span>}
                      <span className="ui-static-a55b0e3a39" >{avgTtrObj.m}<span className="ui-static-ad5b56afa7" >m</span></span>
                    </>
                  )}
                </p>
                <div className="ui-static-12dae84fc3" style={{position: 'absolute', right: '-15px', bottom: '-15px', opacity: 0.03, zIndex: 1, transform: 'rotate(-15deg)'}}></div>
              </div>
            </section>
          )}

          {/* Job Category Monitor */}
          {showCategoryMonitor && categoryMetrics.filter(cat => cat.active > 0).length > 0 && (
            <section>
              <div className="ui-static-3e8220669e" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h2 className="ui-static-9c15ba00ea" style={{display: 'flex', alignItems: 'center'}}>
                  <span></span> Job Category Monitor
                </h2>
                <Link href={`/tickets?statuses=New,Open,In+Progress,Waiting+Reply,Replied,On+Hold,Finish${classificationQuery}${finalScope === 'all' ? '&all_depts=true&assignments=me,unassigned,others' : ''}${finalScope === 'dept' ? '&assignments=me,unassigned,others' : ''}${finalScope === 'me' ? '&assignments=me' : ''}`} className="ui-static-9f009e84f1" style={{textDecoration: 'none'}}>
                  View All Tickets →
                </Link>
              </div>
              <div className="ui-static-e59a73fd03" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))'}}>
                {categoryMetrics.filter(cat => cat.active > 0).map((cat, idx) => {
                  const CATEGORY_COLORS_LIST = ["var(--ui-info)", "var(--ui-danger)", "var(--ui-info)", "var(--ui-success)", "var(--ui-warning)", "var(--ui-warning)", "var(--ui-info)", "var(--ui-info)", "var(--ui-violet)", "var(--ui-success)"];
                  const color = CATEGORY_COLORS_LIST[idx % CATEGORY_COLORS_LIST.length];
                  const total = cat.active + cat.resolvedToday;
                  const progress = total > 0 ? Math.round((cat.resolvedToday / total) * 100) : 0;
                  const hasOverdue = cat.active > 5;
                  return (
                    <Link key={cat.id} href={`/tickets?statuses=New,Open,In+Progress,Waiting+Reply,Replied,On+Hold,Finish&jobCategory=${encodeURIComponent(cat.name)}${classificationQuery}${finalScope === 'all' ? '&all_depts=true&assignments=me,unassigned,others' : ''}${finalScope === 'dept' ? '&assignments=me,unassigned,others' : ''}${finalScope === 'me' ? '&assignments=me' : ''}`} style={{ textDecoration: 'none' }}>
                      <div className="hover-lift ui-static-e7bf6513c8" style={{cursor: 'pointer', position: 'relative', overflow: 'hidden'}}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: color }}></div>
                        <div className="ui-static-fc11fc4f62" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                          <span className="ui-static-679768e4bb" style={{color: color, textTransform: 'uppercase'}}>{cat.name}</span>
                          {hasOverdue && <span className="ui-static-776a1045ec" ></span>}
                        </div>
                        <div className="ui-static-fd3a6e970b" style={{display: 'flex', alignItems: 'baseline'}}>
                          <span className="ui-static-03599b3ef8" >{cat.active}</span>
                          <span className="ui-static-291febf571" >aktif</span>
                        </div>
                        <div className="ui-static-bacd3fd374" style={{height: '4px', overflow: 'hidden'}}>
                          <div className="ui-static-2e363ceebd" style={{height: '100%', width: `${progress}%`, background: color, transition: 'width 0.5s ease'}}></div>
                        </div>
                        <div className="ui-static-291febf571" style={{display: 'flex', justifyContent: 'space-between'}}>
                          <span> {cat.today} hari ini</span>
                          <span> {cat.resolvedToday}</span>
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
              <LiveOpsBoard
                jobCategories={categoryMetrics.filter((c) => !isPersonalCategoryName(c.name))}
                defaultScope={finalScope}
                workType={workType}
              />
            </section>
          )}

          {/* Follow-ups and Shifts */}
          {(showMyFollowups || showShifts) && (
            <section className="ui-static-92254f43e7" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))'}}>
              {showMyFollowups && (
                <div className="ui-static-9f06b22268" style={{position: 'relative'}}>
                  <div className="ui-static-b17792765c" style={{width: '40px', height: '4px', position: 'absolute', top: 0, left: '1.5rem'}}></div>
                  <h2 className="ui-static-7b763727f1" style={{display: 'flex', alignItems: 'center'}}>
                    <span></span> My Follow-Ups
                  </h2>
                  {myOpenTickets.length === 0 ? (
                    <div className="ui-static-dc75899528" style={{textAlign: 'center'}}>
                       <span className="ui-static-d2216e6cde" style={{display: 'block'}}></span>
                       <p className="ui-static-03226245f5" >You have no open tickets assigned to you.</p>
                    </div>
                  ) : (
                    <ul className="ui-static-9a8354becc" style={{listStyle: 'none', display: 'flex', flexDirection: 'column'}}>
                      {myOpenTickets.map(ticket => (
                        <li key={ticket.id} className="hover-bg ui-static-187987a52f" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                          <div>
                            <Link href={`/tickets/${ticket.id}`} style={{ textDecoration: 'none' }}>
                              <p className="ui-static-7ffa2d2e60" >{getCustomerName(ticket)} - {ticket.title}</p>
                            </Link>
                            <span className="ui-static-6d93d6f90d" >
                               Status: <strong style={{ color: ticket.status === 'New' ? "var(--ui-danger)" : "var(--ui-warning)" }}>{ticket.status}</strong>
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
                <div className="ui-static-9f06b22268" style={{position: 'relative'}}>
                  <div className="ui-static-f546acb1b4" style={{width: '40px', height: '4px', position: 'absolute', top: 0, left: '1.5rem'}}></div>
                  <h2 className="ui-static-7b763727f1" style={{display: 'flex', alignItems: 'center'}}>
                    <span></span> Weekly Shifts
                  </h2>
                  {myShifts.length === 0 ? (
                    <div className="ui-static-dc75899528" style={{textAlign: 'center'}}>
                       <span className="ui-static-d2216e6cde" style={{display: 'block'}}></span>
                       <p className="ui-static-03226245f5" >No shifts assigned for this week.</p>
                    </div>
                  ) : (
                    <ul className="ui-static-fc23bed47e" style={{listStyle: 'none', display: 'flex', flexDirection: 'column'}}>
                      {myShifts.map(shift => {
                         const isOff = shift.shiftTypeId === null;
                         const d = new Date(shift.date);
                         return (
                           <li key={shift.id} className="hover-bg ui-static-f668e79162" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: isOff ? '1px dashed var(--border-color)' : '1px solid var(--border-color)', background: isOff ? 'transparent' : 'var(--hover-bg)'}}>
                             <div className="ui-static-e59a73fd03" style={{display: 'flex', alignItems: 'center'}}>
                               <div className="ui-static-e7262fd930" style={{minWidth: '45px', textAlign: 'center'}}>
                                 {d.toLocaleDateString('en-US', { weekday: 'short' })}
                               </div>
                               <strong className="ui-static-cff60ffc40" >{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric'})}</strong>
                             </div>
                             {isOff ? <span className="ui-static-1602df5bc5" style={{fontStyle: 'italic'}}>Day Off</span> : (
                               <span className="ui-static-5a129b03a3" >{shift.shiftType?.name} <span className="ui-static-c75c516e5e" >- {shift.shiftType?.startTime}</span></span>
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
            <section className="ui-static-0410aac9fd" style={{display: 'flex', flexDirection: 'column'}}>
              <div className="ui-static-a655bdfe6d" style={{position: 'relative', overflow: 'hidden'}}>
                <div className="ui-static-850f3368d1" style={{position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', zIndex: 0}}></div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div className="ui-static-d02daea45f" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'}}>
                    <div>
                      <h2 className="ui-static-2ae7cd83e3" style={{display: 'flex', alignItems: 'center'}}>
                         <span></span> Today's Pulse
                      </h2>
                      <p className="ui-static-54b6c35c84" style={{maxWidth: '600px'}}>
                        Real-time status updates of active operations in this shift.
                      </p>
                    </div>
                    <Link href={`/tickets?tab=all&date=today${classificationQuery}`} className="primary-btn btn-fit" style={{textDecoration: 'none', display: 'flex', alignItems: 'center'}}>
                      Inspect Log Matrix →
                    </Link>
                  </div>
                  <div className="ui-static-af81cc4264" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))'}}>
                     <div className="bg-white-card hover-lift ui-static-e39ddfa8d4" style={{textAlign: 'center'}}>
                       <div className="ui-static-49f92dbb32" >{todayTickets.length}</div>
                       <div className="ui-static-cf0f5612e4" style={{textTransform: 'uppercase'}}>Touched Today</div>
                     </div>
                     <div className="bg-white-card hover-lift ui-static-e39ddfa8d4" style={{textAlign: 'center'}}>
                       <div className="ui-static-bbf0251d9d" >{todayResolved}</div>
                       <div className="ui-static-cf0f5612e4" style={{textTransform: 'uppercase'}}>Resolved Today</div>
                     </div>
                     <div className="bg-white-card hover-lift ui-static-e39ddfa8d4" style={{textAlign: 'center'}}>
                       <div className="ui-static-240b89d13b" >{totalActiveTicketsCount}</div>
                       <div className="ui-static-cf0f5612e4" style={{textTransform: 'uppercase'}}>Active Jobs</div>
                     </div>
                  </div>
                </div>
              </div>

              <div className="ui-static-9f06b22268" >
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
        <div className="ui-static-2648847821" style={{display: 'flex', flexDirection: 'column'}}>
          
          {/* Executive Global KPI Stats */}
          <section className="ui-static-92254f43e7" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'}}>
            
            <div className="ui-static-fbec7520e6" style={{position: 'relative', overflow: 'hidden'}}>
              <div className="ui-static-fc11fc4f62" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h3 className="ui-static-0754c6ce13" style={{textTransform: 'uppercase'}}>Critical Outages</h3>
                <span className="ui-static-f22051fec5" ></span>
              </div>
              <p className="ui-static-79cf5ba966" >{totalActiveOutages}</p>
              <p className="ui-static-a4d1401e2d" >Tiket prioritas tinggi yang membutuhkan intervensi.</p>
              <div className="ui-static-12dae84fc3" style={{position: 'absolute', right: '-10px', bottom: '-15px', opacity: 0.04, transform: 'rotate(-10deg)'}}></div>
            </div>

            <div className="ui-static-fbec7520e6" style={{position: 'relative', overflow: 'hidden'}}>
              <div className="ui-static-fc11fc4f62" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h3 className="ui-static-b539b90448" style={{textTransform: 'uppercase'}}>SLA Alerts</h3>
                <span className="ui-static-f22051fec5" ></span>
              </div>
              <p className="ui-static-6d118d0418" >{criticalSlaTickets.length}</p>
              <p className="ui-static-5ad0c3adac" >Tiket aktif dengan batas SLA yang terus berjalan.</p>
              <div className="ui-static-12dae84fc3" style={{position: 'absolute', right: '-10px', bottom: '-15px', opacity: 0.04, transform: 'rotate(-10deg)'}}></div>
            </div>

            <div className="ui-static-fbec7520e6" style={{position: 'relative', overflow: 'hidden'}}>
              <div className="ui-static-fc11fc4f62" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h3 className="ui-static-f93603907b" style={{textTransform: 'uppercase'}}>Global Active Tickets</h3>
                <span className="ui-static-f22051fec5" ></span>
              </div>
              <p className="ui-static-1e7146ffa0" >{totalActiveTicketsCount}</p>
              <p className="ui-static-b3c64a293f" >Beban tiket aktif secara keseluruhan di seluruh departemen.</p>
              <div className="ui-static-12dae84fc3" style={{position: 'absolute', right: '-10px', bottom: '-15px', opacity: 0.04, transform: 'rotate(-10deg)'}}></div>
            </div>

            <div className="ui-static-fbec7520e6" style={{position: 'relative', overflow: 'hidden'}}>
              <div className="ui-static-fc11fc4f62" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h3 className="ui-static-343a1266dd" style={{textTransform: 'uppercase'}}>MTTR Global</h3>
                <span className="ui-static-f22051fec5" ></span>
              </div>
              <p className="ui-static-e5af81cd2d" >
                {resolvedData.length === 0 ? 'N/A' : `${avgTtrObj.h}h ${avgTtrObj.m}m`}
              </p>
              <p className="ui-static-2f70af7785" >Rerata durasi penyelesaian semua tiket saat ini.</p>
              <div className="ui-static-12dae84fc3" style={{position: 'absolute', right: '-10px', bottom: '-15px', opacity: 0.03, transform: 'rotate(-10deg)'}}></div>
            </div>

          </section>

          {/* Row 1: PIC Workloads Heatmap & SLA Escalation Radar */}
          <section className="ui-static-0410aac9fd" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 26.25rem), 1fr))'}}>
            
            {/* Workload Heatmap NOC Staff */}
            <div className="ui-static-e59b28a07d" style={{height: '450px', display: 'flex', flexDirection: 'column'}}>
              <h3 className="ui-static-2ae7cd83e3" style={{display: 'flex', alignItems: 'center'}}>
                <span></span> NOC Staff Workload Capacity
              </h3>
              <p className="ui-static-9de55af077" >
                Monitoring load aktif setiap tim teknis untuk re-assignment penyeimbangan tugas.
              </p>

              <div className="ui-static-e039f5d738" style={{overflowY: 'auto', flex: 1}}>
                {picWorkloads.length === 0 ? (
                  <div className="ui-static-3bdb82cc13" style={{textAlign: 'center', fontStyle: 'italic'}}>Tidak ada user NOC terdaftar.</div>
                ) : (
                  <div className="ui-static-af81cc4264" style={{display: 'flex', flexDirection: 'column'}}>
                    {picWorkloads.map(u => {
                      const count = u._count.tickets;
                      const name = u.name || u.email.split('@')[0];
                      const dept = u.department?.name || "General";
                      // Capacity percentage logic (max expected load = 8 tickets)
                      const percent = Math.min(Math.round((count / 8) * 100), 100);
                      // Color code
                      let color = "var(--ui-success)"; // green
                      let bg = "var(--ui-success-bg)";
                      let loadText = 'Ringan';
                      if (count >= 6) {
                        color = "var(--ui-danger)"; // red
                        bg = "var(--ui-danger-bg)";
                        loadText = 'Overload';
                      } else if (count >= 3) {
                        color = "var(--ui-warning)"; // amber
                        bg = "var(--ui-warning-bg)";
                        loadText = 'Sedang';
                      }

                      const totalWeight = (u.tickets || []).reduce((sum, t) => sum + (t.jobCategory?.score || 0), 0);
                      const isExpanded = !!expandedPics[u.id];

                      return (
                        <div key={u.id} className="ui-static-fd8ce977f7" style={{display: 'flex', flexDirection: 'column'}}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span 
                              onClick={() => togglePicExpand(u.id)}
                              className="ui-static-22e1e413cb" style={{cursor: 'pointer', display: 'flex', alignItems: 'center'}}
                            >
                              <span className="ui-static-f0ec965903" >{isExpanded ? '▼' : '▶'}</span>
                              {name} <span className="ui-static-3a42f193ce" >({dept})</span>
                            </span>
                            <span className="ui-static-30f523173e" style={{display: 'flex', alignItems: 'center'}}>
                              {totalWeight > 0 && (
                                <span className="ui-static-4d8a84740d" >
                                  Bobot: {totalWeight} pt
                                </span>
                              )}
                              <span className="ui-static-5745689772" style={{background: bg, color: color, border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`}}>
                                {count} Tiket • {loadText}
                              </span>
                            </span>
                          </div>
                          <div className="ui-static-0506de3dd0" style={{height: '8px', overflow: 'hidden', cursor: 'pointer'}} onClick={() => togglePicExpand(u.id)}>
                            <div className="ui-static-2e363ceebd" style={{height: '100%', width: `${percent}%`, background: color, transition: 'width 0.4s ease-in-out'}}></div>
                          </div>

                          {isExpanded && (
                            <div className="ui-static-82327c6f58" style={{display: 'flex', flexDirection: 'column'}}>
                              {(!u.tickets || u.tickets.length === 0) ? (
                                <div className="ui-static-6d93d6f90d" style={{textAlign: 'center', fontStyle: 'italic'}}>
                                  Tidak ada tiket aktif saat ini.
                                </div>
                              ) : (
                                u.tickets.map(t => {
                                  let pColor = "var(--ui-info)";
                                  if (t.priority === 'Critical') pColor = "var(--ui-danger)";
                                  else if (t.priority === 'High') pColor = "var(--ui-warning)";
                                  else if (t.priority === 'Medium') pColor = "var(--ui-info)";
                                  else if (t.priority === 'Low') pColor = "var(--ui-success)";

                                  return (
                                    <div key={t.id} className="ui-static-78b7557d4f" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                      <div className="ui-static-30f523173e" style={{display: 'flex', alignItems: 'center', minWidth: 0, flex: 1}}>
                                        <span className="ui-static-30e89704d0" style={{display: 'inline-block', width: '8px', height: '8px', background: pColor, flexShrink: 0}} title={t.priority}></span>
                                        <Link href={`/tickets/${t.id}`} className="ui-static-b7242cb764" style={{textDecoration: 'none', flexShrink: 0}}>
                                          [{t.trackingId}]
                                        </Link>
                                        <span className="ui-static-bffd53f399" style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={t.title}>
                                          {t.title}
                                        </span>
                                      </div>
                                      <span className="ui-static-291febf571" style={{flexShrink: 0}}>
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
            <div className="ui-static-e59b28a07d" style={{height: '450px', display: 'flex', flexDirection: 'column'}}>
              <h3 className="ui-static-2ae7cd83e3" style={{display: 'flex', alignItems: 'center'}}>
                <span></span> SLA Escalation Radar & Warnings
              </h3>
              <p className="ui-static-9de55af077" >
                Daftar tiket aktif yang mendekati batas waktu SLA (diurutkan berdasarkan urgensi waktu).
              </p>

              <div className="ui-static-e039f5d738" style={{overflowY: 'auto', flex: 1}}>
                {criticalSlaTickets.length === 0 ? (
                  <div className="ui-static-8df4ca33bf" style={{textAlign: 'center', fontStyle: 'italic'}}>
                     Seluruh tiket aktif memiliki SLA yang aman.
                  </div>
                ) : (
                  <div className="ui-static-e59a73fd03" style={{display: 'flex', flexDirection: 'column'}}>
                    {criticalSlaTickets.map(t => {
                      const timeLeftMs = new Date(t.nextSlaDeadline).getTime() - Date.now();
                      const isOverdue = timeLeftMs < 0;
                      const timeLeftMin = Math.round(timeLeftMs / 60000);
                      
                      let urgencyColor = "var(--ui-success)";
                      let urgencyBg = "var(--ui-success-bg)";
                      let statusLabel = `Sisa ${timeLeftMin} menit`;
                      
                      if (isOverdue) {
                        urgencyColor = "var(--ui-danger)";
                        urgencyBg = "var(--ui-danger-bg)";
                        statusLabel = 'SLA BREACHED';
                      } else if (timeLeftMin < 30) {
                        urgencyColor = "var(--ui-warning)";
                        urgencyBg = "var(--ui-warning-bg)";
                        statusLabel = `Kritis (${timeLeftMin}m)`;
                      }

                      const isExpanded = !!expandedSlas[t.id];

                      let priorityEmoji = '🟢';
                      let priorityColor = "var(--ui-success)";
                      let priorityBg = "var(--ui-success-bg)";
                      if (t.priority === 'Critical') {
                        priorityEmoji = '🔴';
                        priorityColor = "var(--ui-danger)";
                        priorityBg = "var(--ui-danger-bg)";
                      } else if (t.priority === 'High') {
                        priorityEmoji = '🟠';
                        priorityColor = "var(--ui-warning)";
                        priorityBg = "var(--ui-warning-bg)";
                      } else if (t.priority === 'Medium') {
                        priorityEmoji = '🔵';
                        priorityColor = "var(--ui-info)";
                        priorityBg = "var(--ui-info-bg)";
                      }

                      return (
                        <div key={t.id} className="ui-static-7d95da76d6" style={{display: 'flex', flexDirection: 'column', borderColor: urgencyColor}}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%', cursor: 'pointer' }} onClick={() => toggleSlaExpand(t.id)}>
                              <div className="ui-static-0f8796a915" style={{display: 'flex', alignItems: 'center'}}>
                                <span className="ui-static-f0ec965903" >{isExpanded ? '▼' : '▶'}</span>
                                <Link href={`/tickets/${t.id}`} className="ui-static-5dbb0bc9a7" style={{textDecoration: 'none'}} onClick={e => e.stopPropagation()}>
                                  {t.trackingId}
                                </Link>
                              </div>
                              <div className="ui-static-bfa9da7775" style={{overflow: 'hidden', textOverflow: 'ellipsis'}}>{t.title}</div>
                              <div className="ui-static-b521b59541" >
                                PIC: {t.assignee?.name || 'Unassigned'} • {t.department?.name}
                              </div>
                            </div>
                            <div className="ui-static-0f8796a915" style={{textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end'}}>
                              <span className="ui-static-eb34fca0dc" style={{display: 'inline-block', background: urgencyBg, color: urgencyColor, border: `1px solid color-mix(in srgb, ${urgencyColor} 20%, transparent)`}}>
                                {statusLabel}
                              </span>
                              <div className="ui-static-0f8796a915" style={{display: 'flex', alignItems: 'center'}}>
                                <span className="ui-static-f74335ef38" style={{background: priorityBg, color: priorityColor, border: `1px solid color-mix(in srgb, ${priorityColor} 20%, transparent)`}}>
                                  {priorityEmoji} {t.priority}
                                </span>
                                {t.jobCategory?.name && (
                                  <span className="ui-static-5fb10253f7" >
                                     {t.jobCategory.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="ui-static-87524e6844" style={{display: 'flex', flexDirection: 'column'}}>
                              <div className="ui-static-8cbcbcc936" style={{whiteSpace: 'pre-wrap'}}>
                                <strong>Deskripsi:</strong> {t.description ? (t.description.length > 150 ? t.description.substring(0, 150) + "..." : t.description) : "Tidak ada deskripsi."}
                              </div>
                              <div className="ui-static-1d80db8102" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <span className="ui-static-6d93d6f90d" >
                                  Dibuat: {new Date(t.createdAt).toLocaleString('en-CA')} ({getDuration(t.createdAt)} lalu)
                                </span>
                                <Link href={`/tickets/${t.id}`} className="ui-static-caa646e077" style={{textDecoration: 'none'}}>
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
          <section className="ui-static-0410aac9fd" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 26.25rem), 1fr))'}}>
            
            {/* Customer Outages Impact Matrix */}
            <div className="ui-static-e59b28a07d" style={{height: '450px', display: 'flex', flexDirection: 'column'}}>
              <h3 className="ui-static-2ae7cd83e3" style={{display: 'flex', alignItems: 'center'}}>
                <span></span> Customer Outage Impact Matrix
              </h3>
              <p className="ui-static-9de55af077" >
                Daftar pelanggan komersial dengan gangguan Critical (Outage) / High yang sedang aktif saat ini.
              </p>

              <div className="ui-static-e039f5d738" style={{overflowY: 'auto', flex: 1}}>
                {clientImpacts.length === 0 ? (
                  <div className="ui-static-10d34cd813" style={{textAlign: 'center', fontStyle: 'italic'}}>
                     Tidak ada pelanggan terdampak outage saat ini. Seluruh jaringan terpantau stabil.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="ui-static-e81f1882ce" style={{width: '100%'}}>
                      <thead>
                        <tr className="ui-static-78ef770609" >
                          <th className="ui-static-d38a9f5ffd" style={{textAlign: 'left'}}>Customer Name</th>
                          <th className="ui-static-d38a9f5ffd" style={{textAlign: 'center', width: '120px'}}>Critical Outages</th>
                          <th className="ui-static-d38a9f5ffd" style={{textAlign: 'center', width: '120px'}}>High Incidents</th>
                          <th className="ui-static-d38a9f5ffd" style={{textAlign: 'left'}}>Active Impacted Tickets</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientImpacts.map(client => (
                          <tr key={client.name} className="ui-static-31df06b618" >
                            <td className="ui-static-0a78b74ead" >
                               {client.name}
                            </td>
                            <td className="ui-static-f1d558941b" style={{textAlign: 'center'}}>
                              {client.criticalCount > 0 ? (
                                <span className="ui-static-acd5f525b4" >
                                   {client.criticalCount} Outage
                                </span>
                              ) : (
                                <span className="ui-static-b9010af219" >-</span>
                              )}
                            </td>
                            <td className="ui-static-f1d558941b" style={{textAlign: 'center'}}>
                              {client.highCount > 0 ? (
                                <span className="ui-static-8d545b30e6" >
                                   {client.highCount} Tiket
                                </span>
                              ) : (
                                <span className="ui-static-b9010af219" >-</span>
                              )}
                            </td>
                            <td className="ui-static-f1d558941b" >
                              <div className="ui-static-30f523173e" style={{display: 'flex', flexDirection: 'column'}}>
                                {client.tickets.map(t => (
                                  <div key={t.id} className="ui-static-5828bb51d7" style={{display: 'flex', alignItems: 'center'}}>
                                    <Link href={`/tickets/${t.id}`} className="ui-static-b674ec9d7d" style={{textDecoration: 'none'}}>
                                      [{t.trackingId}]
                                    </Link>
                                    <span className="ui-static-bffd53f399" >{t.title}</span>
                                    <span className="ui-static-812470f6b2" >
                                      {(() => {
                                        const hasDt = t.customData && typeof t.customData === 'object' && t.customData.hasDowntime;
                                        return hasDt && t.customData.startDowntime ? (
                                          <span className="ui-static-1b3b267cb2" >
                                             Down: {getDuration(t.customData.startDowntime, t.customData.endDowntime)}
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
            <div className="ui-static-e59b28a07d" style={{height: '450px', display: 'flex', flexDirection: 'column'}}>
               <h3 className="ui-static-2ae7cd83e3" style={{display: 'flex', alignItems: 'center'}}>
                 <span></span> Global Incoming vs Resolved Incident Analytics
               </h3>
               <p className="ui-static-9de55af077" >
                 Visualisasi tren pembuatan dan penyelesaian tiket untuk melihat tren performa tim.
               </p>
               <div className="ui-static-e039f5d738" style={{overflowY: 'auto', flex: 1}}>
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
