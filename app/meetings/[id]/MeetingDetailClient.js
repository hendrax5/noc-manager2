"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SearchableAttendeeSelect from "@/components/SearchableAttendeeSelect";

export default function MeetingDetailClient({ initialMeeting, currentUser, allUsers, allDepartments }) {
  const router = useRouter();
  const [meeting, setMeeting] = useState(initialMeeting);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [activeTab, setActiveTab] = useState("sessions"); // 'sessions' | 'action-board'
  const [activeSessionId, setActiveSessionId] = useState(initialMeeting?.sessions?.length > 0 ? initialMeeting.sessions[0].id : null);
  const [showAddSession, setShowAddSession] = useState(false);

  useEffect(() => {
    if (!activeSessionId && meeting.sessions?.length > 0) {
      setActiveSessionId(meeting.sessions[0].id);
    }
  }, [meeting.sessions, activeSessionId]);

  const [showActions, setShowActions] = useState(false);
  const [isEditingMeeting, setIsEditingMeeting] = useState(false);
  const [editFormData, setEditFormData] = useState({
     title: initialMeeting.title,
     scheduledAt: initialMeeting.scheduledAt ? new Date(initialMeeting.scheduledAt).toISOString().slice(0,16) : "",
     attendees: initialMeeting.attendees.map(a => a.id)
  });

  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [newSessionDate, setNewSessionDate] = useState("");
  const [isAddingSession, setIsAddingSession] = useState(false);

  // States for Editing Session Content
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingContent, setEditingContent] = useState("");

  // States for adding tasks per session
  const [taskInputs, setTaskInputs] = useState({});

  const handleEditMeeting = async (e) => {
    e.preventDefault();
    const res = await fetch(`/api/meetings/${meeting.id}`, {
      method: "PATCH", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        title: editFormData.title,
        scheduledAt: editFormData.scheduledAt ? new Date(editFormData.scheduledAt).toISOString() : undefined,
        attendees: editFormData.attendees
      })
    });
    if (res.ok) {
      setMeeting(await res.json());
      setIsEditingMeeting(false);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!newSessionTitle || !newSessionDate) return;

    // Validate the date before sending
    const parsedDate = new Date(newSessionDate);
    if (isNaN(parsedDate.getTime())) {
      alert("Invalid date selected. Please re-enter the session date.");
      return;
    }

    setIsAddingSession(true);
    const res = await fetch(`/api/meetings/${meeting.id}/sessions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newSessionTitle, scheduledFor: parsedDate.toISOString(), content: "" })
    });
    if (res.ok) {
      const addedSession = await res.json();
      setMeeting(prev => ({ ...prev, sessions: [...(prev.sessions || []), addedSession] }));
      setNewSessionTitle("");
      setNewSessionDate("");
    } else {
      const err = await res.json().catch(() => ({}));
      alert("Failed to create session: " + (err.error || "Unknown error"));
    }
    setIsAddingSession(false);
  };


  const handleToggleAttendance = async (sessionId, userId, isPresent) => {
    const session = meeting.sessions.find(s => s.id === sessionId);
    const currentPresent = session.presentAttendees || [];
    let newPresentIds = [];
    if (isPresent) {
       newPresentIds = [...currentPresent.map(u => u.id), userId];
    } else {
       newPresentIds = currentPresent.filter(u => u.id !== userId).map(u => u.id);
    }
    
    setMeeting(prev => ({
      ...prev,
      sessions: prev.sessions.map(s => s.id === sessionId ? {
        ...s,
        presentAttendees: isPresent 
          ? [...(s.presentAttendees || []), meeting.attendees.find(a => a.id === userId)]
          : (s.presentAttendees || []).filter(u => u.id !== userId)
      } : s)
    }));

    await fetch(`/api/meetings/${meeting.id}/sessions/${sessionId}/attendance`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presentUserIds: newPresentIds })
    });
  };

  const saveSessionContent = async (sessionId) => {
    const res = await fetch(`/api/meetings/${meeting.id}/sessions/${sessionId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editingContent })
    });
    if (res.ok) {
      const updated = await res.json();
      setMeeting(prev => ({
        ...prev,
        sessions: prev.sessions.map(s => s.id === sessionId ? updated : s)
      }));
      setEditingSessionId(null);
    }
  };

  const handleAddActionItem = async (e, sessionId) => {
    e.preventDefault();
    const inputs = taskInputs[sessionId] || {};
    if (!inputs.task?.trim()) return;

    const res = await fetch(`/api/action-items`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: inputs.task,
        meetingId: meeting.id,
        meetingSessionId: sessionId,
        assigneeId: inputs.assigneeType === 'user' ? inputs.assigneeId : null,
        departmentId: inputs.assigneeType === 'dept' ? inputs.departmentId : null,
        generateTicket: inputs.generateTicket !== undefined ? inputs.generateTicket : true
      })
    });
    
    if (res.ok) {
      const newItem = await res.json();
      setMeeting(prev => ({
        ...prev,
        sessions: prev.sessions.map(s => s.id === sessionId ? {
          ...s, actionItems: [newItem, ...(s.actionItems || [])]
        } : s)
      }));
      setTaskInputs(prev => ({ ...prev, [sessionId]: { ...inputs, task: "", assigneeId: "", departmentId: "" } }));
    }
  };

  const updateTaskInput = (sessionId, field, value) => {
    setTaskInputs(prev => ({
      ...prev,
      [sessionId]: { ...(prev[sessionId] || { assigneeType: 'user', generateTicket: true }), [field]: value }
    }));
  };

  const toggleActionItemStatus = async (sessionId, itemId, currentStatus) => {
    const newStatus = currentStatus === "Pending" ? "Completed" : "Pending";
    const res = await fetch(`/api/action-items/${itemId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      setMeeting(prev => ({
        ...prev,
        sessions: prev.sessions.map(s => s.id === sessionId ? {
          ...s, actionItems: s.actionItems.map(item => item.id === itemId ? { ...item, status: newStatus } : item)
        } : s)
      }));
    }
  };

  const isAdminOrManager = currentUser.role === 'Admin' || currentUser.role === 'Manager';
  const isSuperAdmin = currentUser.role === 'Admin';
  const isOrganizer = meeting.organizedById === currentUser.id;
  const canFinalize = isAdminOrManager || isOrganizer;

  if (isEditingMeeting) {
    return (
      <div className="card" style={{ maxWidth: '800px', margin: '0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, color: '#0f172a' }}>Edit Megathread</h2>
          <button onClick={() => setIsEditingMeeting(false)} style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
        </div>
        <form onSubmit={handleEditMeeting} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="form-group">
            <label style={{ fontWeight: 'bold' }}>Meeting Title</label>
            <input type="text" required value={editFormData.title} onChange={e => setEditFormData({...editFormData, title: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          </div>
          <div className="form-group">
            <label style={{ fontWeight: 'bold' }}>Scheduled Date</label>
            <input type="datetime-local" value={editFormData.scheduledAt} onChange={e => setEditFormData({...editFormData, scheduledAt: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          </div>
          <div className="form-group" style={{ zIndex: 99 }}>
            <label style={{ fontWeight: 'bold' }}>Invited Global Attendees</label>
            <SearchableAttendeeSelect 
               users={allUsers} 
               departments={allDepartments}
               selectedIds={editFormData.attendees}
               onChange={(newIds) => setEditFormData({...editFormData, attendees: newIds})}
            />
          </div>
          <button type="submit" className="primary-btn" style={{ padding: '0.75rem' }}>Save Changes</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <h1 style={{ margin: 0 }}>{meeting.title}</h1>
            <span className="badge" style={{ backgroundColor: meeting.status === 'Completed' ? '#10b981' : meeting.status === 'In Progress' ? '#3b82f6' : '#f59e0b', fontSize: '1rem' }}>
              {meeting.status}
            </span>
            {isSuperAdmin && (
               <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowActions(!showActions)} className="primary-btn" style={{ padding: '0.2rem 0.5rem', background: '#e2e8f0', color: '#1e293b', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                     ⚙️ Admin
                  </button>
                  {showActions && (
                     <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '0.25rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', shadow: '0 4px 6px rgba(0,0,0,0.1)', borderRadius: '4px', zIndex: 10, display: 'flex', flexDirection: 'column', minWidth: '150px' }}>
                        <button onClick={() => { setIsEditingMeeting(true); setShowActions(false); }} style={{ padding: '0.75rem', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>✎ Edit Meeting</button>
                        <button onClick={async () => {
                          if (confirm('Irreversible: Delete this entire Megathread and ALL its sessions?')) {
                            const del = await fetch(`/api/meetings/${meeting.id}`, { method: 'DELETE' });
                            if (del.ok) router.push('/meetings');
                          }
                        }} style={{ padding: '0.75rem', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', fontWeight: 'bold' }}>🗑️ Delete Meeting</button>
                     </div>
                  )}
               </div>
            )}
          </div>
          <p style={{ margin: 0, color: '#64748b' }}>
            Megathread Initiated: <span suppressHydrationWarning>{mounted && meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleDateString() : '...'}</span> | 
            Organizer: <strong style={{ color: '#475569' }}>{meeting.organizedBy?.name || meeting.organizedBy?.email || 'System'}</strong>
          </p>
        </div>
        {meeting.status !== 'Completed' && canFinalize && (
          <button onClick={async () => {
            const res = await fetch(`/api/meetings/${meeting.id}`, {
              method: "PATCH", headers: {"Content-Type": "application/json"},
              body: JSON.stringify({ status: "Completed" })
            });
            if (res.ok) { setMeeting(await res.json()); }
          }} className="primary-btn" style={{ background: '#10b981' }}>
            Close Entire Megathread ✓
          </button>
        )}
      </header>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem', background: 'var(--card-bg)', padding: '0 1rem', borderRadius: '8px 8px 0 0' }}>
        <button 
          onClick={() => setActiveTab("sessions")} 
          style={{ padding: '1rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'sessions' ? '3px solid var(--primary-color)' : '3px solid transparent', color: activeTab === 'sessions' ? 'var(--primary-color)' : '#64748b', fontWeight: activeTab === 'sessions' ? 'bold' : '500', cursor: 'pointer', fontSize: '1rem', transition: 'all 0.2s' }}
        >
          ⏱️ Sessions Timeline
        </button>
        <button 
          onClick={() => setActiveTab("action-board")} 
          style={{ padding: '1rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'action-board' ? '3px solid var(--primary-color)' : '3px solid transparent', color: activeTab === 'action-board' ? 'var(--primary-color)' : '#64748b', fontWeight: activeTab === 'action-board' ? 'bold' : '500', cursor: 'pointer', fontSize: '1rem', transition: 'all 0.2s' }}
        >
          📋 Check-List & Action Board
        </button>
      </div>

      {activeTab === 'sessions' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Pre-Scheduling Matrix / Add Session Block */}
        {meeting.status !== 'Completed' && (
          <div className="card" style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', transition: 'all 0.3s', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <h3 style={{ margin: 0, color: '#334155', cursor: 'pointer' }} onClick={() => setShowAddSession(!showAddSession)}>
                 {showAddSession ? '− Hide Planner' : '+ Schedule New Session Block'}
               </h3>
            </div>
            {showAddSession && (
              <form onSubmit={handleCreateSession} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.25rem', color: '#64748b' }}>Session Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Week 1: Core Sync" 
                  value={newSessionTitle} 
                  onChange={e => setNewSessionTitle(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.25rem', color: '#64748b' }}>Session Date</label>
                <input 
                  type="datetime-local" 
                  value={newSessionDate} 
                  onChange={e => setNewSessionDate(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <button type="submit" className="primary-btn" disabled={isAddingSession} style={{ width: 'auto', padding: '0.75rem 1.5rem', alignSelf: 'flex-end' }}>
                {isAddingSession ? "Creating..." : "Add Session Block"}
              </button>
            </form>
            )}
          </div>
        )}

        {/* Immersive Command Center Layout */}
        {(!meeting.sessions || meeting.sessions.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontStyle: 'italic', background: '#f8fafc', borderRadius: '8px' }}>
            No sessions scheduled in this megathread yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) minmax(0, 3fr)', gap: '1.5rem', alignItems: 'flex-start' }}>
            
            {/* Left Sidebar: Timeline Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderRight: '1px solid #e2e8f0', paddingRight: '1rem', minHeight: '500px' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.1rem', paddingLeft: '0.5rem' }}>Agenda Timeline</h3>
              {meeting.sessions.map((session, index) => (
                 <div 
                   key={session.id} 
                   onClick={() => setActiveSessionId(session.id)}
                   style={{ 
                     padding: '1rem', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                     background: activeSessionId === session.id ? '#eff6ff' : 'transparent',
                     border: activeSessionId === session.id ? '1px solid #bfdbfe' : '1px solid transparent',
                     borderLeft: activeSessionId === session.id ? '4px solid #3b82f6' : '4px solid transparent'
                   }}
                 >
                   <div style={{ fontWeight: 'bold', color: activeSessionId === session.id ? '#1e40af' : '#475569', marginBottom: '0.25rem' }}>{session.title || `Session ${index + 1}`}</div>
                   <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{mounted && session.scheduledFor ? new Date(session.scheduledFor).toLocaleDateString('en-CA') : 'Pending'}</div>
                 </div>
              ))}
            </div>

            {/* Right Main Area: Active Session Detail */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {meeting.sessions.filter(s => s.id === activeSessionId).map((session, index) => {
                const inputs = taskInputs[session.id] || { assigneeType: 'user', generateTicket: true, task: '', assigneeId: '', departmentId: '' };
                
                return (
                  <div key={session.id} className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                    
                    {/* Session Header */}
                    <div style={{ background: '#1e293b', color: 'white', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h2 style={{ margin: '0 0 0.25rem 0', color: 'white', fontSize: '1.4rem' }}>{session.title || `Session Block`}</h2>
                        <span style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                          🗓️ {mounted && session.scheduledFor ? new Date(session.scheduledFor).toLocaleString('en-CA', { dateStyle: 'long', timeStyle: 'short' }) : 'Pending'}
                          &nbsp; | &nbsp; 👤 Organizer: {session.author?.name || session.author?.email}
                        </span>
                      </div>
                    </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 2fr) minmax(250px, 1fr)', gap: '1px', background: '#e2e8f0' }}>
                
                {/* Left Column: Discussion Notes & Action Items */}
                <div style={{ background: 'var(--card-bg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', borderRadius: '8px' }}>
                  
                  {/* Notes Content */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                      <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem' }}>💬 Meeting Notes</h3>
                      {editingSessionId !== session.id && (
                        <button onClick={() => { setEditingSessionId(session.id); setEditingContent(session.content || ""); }} style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                          ✎ Edit Notes
                        </button>
                      )}
                    </div>

                    {editingSessionId === session.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <textarea 
                          rows="6" 
                          value={editingContent}
                          onChange={e => setEditingContent(e.target.value)}
                          style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontFamily: 'inherit' }}
                          placeholder="Type agenda, problems discussed, or summary here..."
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => setEditingSessionId(null)} style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                          <button onClick={() => saveSessionContent(session.id)} className="primary-btn" style={{ width: 'auto', padding: '0.5rem 1rem' }}>Save Notes</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap', color: session.content ? '#334155' : '#94a3b8', lineHeight: '1.6', minHeight: '60px' }}>
                        {session.content || <em>No notes recorded for this session yet. Click Edit to start logging.</em>}
                      </div>
                    )}
                  </div>

                  {/* Nested Action Items */}
                  <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '1.1rem' }}>📌 Session Follow-Ups</h3>
                    
                    {meeting.status !== 'Completed' && (
                      <form onSubmit={(e) => handleAddActionItem(e, session.id)} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        <input 
                          type="text" 
                          placeholder="Describe task springing from this session..." 
                          value={inputs.task} 
                          onChange={e => updateTaskInput(session.id, 'task', e.target.value)} 
                          required 
                          style={{ width: '100%', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <select value={inputs.assigneeType} onChange={e => updateTaskInput(session.id, 'assigneeType', e.target.value)} style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--input-bg)', color: 'var(--input-text)' }}>
                            <option value="user">User</option>
                            <option value="dept">Team</option>
                          </select>
                          
                          {inputs.assigneeType === 'user' ? (
                            <select value={inputs.assigneeId} onChange={e => updateTaskInput(session.id, 'assigneeId', e.target.value)} style={{ flex: 1, padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--input-bg)', color: 'var(--input-text)' }}>
                              <option value="">-- Person --</option>
                              {allUsers.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                            </select>
                          ) : (
                            <select value={inputs.departmentId} onChange={e => updateTaskInput(session.id, 'departmentId', e.target.value)} style={{ flex: 1, padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--input-bg)', color: 'var(--input-text)' }}>
                              <option value="">-- Department --</option>
                              {allDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          )}
                          <button type="submit" className="primary-btn" style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>+ Add</button>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#1e293b', marginTop: '0.25rem' }}>
                          <input type="checkbox" checked={inputs.generateTicket} onChange={e => updateTaskInput(session.id, 'generateTicket', e.target.checked)} style={{ width: '1.2rem', height: '1.2rem' }} />
                          Auto-generate Support Ticket
                        </label>
                      </form>
                    )}

                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {(!session.actionItems || session.actionItems.length === 0) && <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No tasks assigned.</span>}
                      {session.actionItems?.map(item => (
                        <li key={item.id} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', background: item.status === 'Completed' ? '#f8fafc' : 'white', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', opacity: item.status === 'Completed' ? 0.7 : 1 }}>
                          <input 
                            type="checkbox" 
                            checked={item.status === 'Completed'} 
                            onChange={() => toggleActionItemStatus(session.id, item.id, item.status)}
                            style={{ width: '1.25rem', height: '1.25rem', marginTop: '0.2rem', cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <p style={{ margin: '0 0 0.25rem 0', fontWeight: 'bold', color: item.status === 'Completed' ? '#94a3b8' : '#1e293b', textDecoration: item.status === 'Completed' ? 'line-through' : 'none' }}>
                                {item.task}
                              </p>
                              {item.linkedTicketId && (
                                <a href={`/tickets/${item.linkedTicketId}`} style={{ fontSize: '0.75rem', background: '#dbeafe', color: '#1d4ed8', padding: '0.2rem 0.5rem', borderRadius: '12px', textDecoration: 'none', fontWeight: 'bold' }}>
                                  Ticket #{item.linkedTicketId}
                                </a>
                              )}
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', background: '#e2e8f0', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                              To: {item.assignee ? (item.assignee.name || item.assignee.email) : item.department ? item.department.name : 'Unassigned'}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Right Column: Discrete Session Attendance */}
                <div style={{ background: '#f8fafc', padding: '1.5rem' }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '1.1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>✓ Attendance Check</h3>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {meeting.attendees.map(a => {
                      const isPresent = session.presentAttendees?.some(p => p.id === a.id);
                      const canCheck = isOrganizer || isAdminOrManager || a.id === currentUser.id;

                      return (
                        <li key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem', color: '#334155', background: isPresent ? '#ecfdf5' : 'white', padding: '0.5rem', borderRadius: '6px', border: `1px solid ${isPresent ? '#a7f3d0' : '#e2e8f0'}` }}>
                          <span style={{ fontWeight: isPresent ? 'bold' : 'normal', color: isPresent ? '#065f46' : '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                            {a.name || a.email.split('@')[0]}
                          </span>
                          {canCheck ? (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.75rem', color: '#64748b' }}>
                              <input 
                                type="checkbox" 
                                checked={isPresent || false} 
                                onChange={(e) => handleToggleAttendance(session.id, a.id, e.target.checked)}
                                style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                              />
                              Hadir
                            </label>
                          ) : (
                            isPresent ? (
                              <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 'bold' }}>✓</span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>-</span>
                            )
                          )}
                        </li>
                      );
                    })}
                    {meeting.attendees.length === 0 && <li style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No invitees global.</li>}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
            </div>
          </div>
        )}
      </div>
      )}

      {activeTab === 'action-board' && (
        <div style={{ display: 'flex', gap: '1.5rem', overflowX: 'auto', paddingBottom: '1rem', minHeight: '600px' }}>
          {(() => {
            const allTasks = (meeting.sessions || []).flatMap(s => (s.actionItems || []).map(item => ({...item, sessionTitle: s.title})));
            const pendingTasks = allTasks.filter(t => t.status === 'Pending');
            const completedTasks = allTasks.filter(t => t.status === 'Completed');
            return (
              <>
                <div style={{ flex: '1 1 300px', minWidth: '300px', background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 1.5rem 0', color: '#1e293b', display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #cbd5e1', paddingBottom: '0.5rem' }}>
                    <span>⏳ Pending Actions</span>
                    <span style={{ background: '#e2e8f0', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem' }}>{pendingTasks.length}</span>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {pendingTasks.map(t => (
                       <div key={t.id} style={{ background: 'white', padding: '1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'transform 0.1s', ':hover': { transform: 'translateY(-2px)' } }}>
                         <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: 'bold' }}>📍 From: {t.sessionTitle || 'Session'}</div>
                         <p style={{ margin: '0 0 1rem 0', color: '#0f172a', fontWeight: '600', fontSize: '0.95rem', lineHeight: '1.4' }}>{t.task}</p>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', padding: '0.3rem 0.6rem', borderRadius: '4px', fontWeight: 'bold' }}>
                              Assignee: {t.assignee ? (t.assignee.name || t.assignee.email) : (t.department ? t.department.name : 'Unassigned')}
                            </span>
                            <button onClick={() => toggleActionItemStatus(t.meetingSessionId, t.id, t.status)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>Mark ✓</button>
                         </div>
                       </div>
                    ))}
                    {pendingTasks.length === 0 && <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem', textAlign: 'center' }}>No pending tasks in any session.</p>}
                  </div>
                </div>

                <div style={{ flex: '1 1 300px', minWidth: '300px', background: '#f1f5f9', padding: '1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <h3 style={{ margin: '0 0 1.5rem 0', color: '#475569', display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #cbd5e1', paddingBottom: '0.5rem' }}>
                    <span>✅ Completed</span>
                    <span style={{ background: '#cbd5e1', color: '#475569', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem' }}>{completedTasks.length}</span>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {completedTasks.map(t => (
                       <div key={t.id} style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', opacity: 0.8 }}>
                         <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>📍 From: {t.sessionTitle || 'Session'}</div>
                         <p style={{ margin: '0 0 1rem 0', color: '#64748b', textDecoration: 'line-through', fontSize: '0.95rem' }}>{t.task}</p>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Assignee: {t.assignee ? (t.assignee.name || t.assignee.email) : (t.department ? t.department.name : 'Unassigned')}</span>
                            <button onClick={() => toggleActionItemStatus(t.meetingSessionId, t.id, t.status)} style={{ background: 'transparent', color: '#64748b', border: '1px solid #cbd5e1', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>Revert ↩</button>
                         </div>
                       </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
