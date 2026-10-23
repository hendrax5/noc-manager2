"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SearchableAttendeeSelect from "@/components/SearchableAttendeeSelect";

export default function MeetingDetailClient({ initialMeeting, currentUser, allUsers, allDepartments }) {
  const router = useRouter();
  const [meeting, setMeeting] = useState(initialMeeting);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  const isAdminOrManager = currentUser.permissions?.includes('manage_meetings') || currentUser.role === 'Admin';
  const isSuperAdmin = isAdminOrManager;
  const isOrganizer = meeting.organizedById === currentUser.id;
  const canFinalize = isAdminOrManager || isOrganizer;

  if (isEditingMeeting) {
    return (
      <div className="card ui-static-ff227d0632" style={{maxWidth: '800px'}}>
        <div className="ui-static-8bd9dc7312" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <h2 className="ui-static-4a072deec5" >Edit Megathread</h2>
          <button onClick={() => setIsEditingMeeting(false)} className="ui-static-8c78147113" style={{cursor: 'pointer'}}>Cancel</button>
        </div>
        <form onSubmit={handleEditMeeting} className="ui-static-92254f43e7" style={{display: 'flex', flexDirection: 'column'}}>
          <div className="form-group">
            <label className="ui-static-78d7af8b7e" >Meeting Title</label>
            <input type="text" required value={editFormData.title} onChange={e => setEditFormData({...editFormData, title: e.target.value})} className="ui-static-4234f20878" style={{width: '100%'}} />
          </div>
          <div className="form-group">
            <label className="ui-static-78d7af8b7e" >Scheduled Date</label>
            <input type="datetime-local" value={editFormData.scheduledAt} onChange={e => setEditFormData({...editFormData, scheduledAt: e.target.value})} className="ui-static-4234f20878" style={{width: '100%'}} />
          </div>
          <div className="form-group" style={{ zIndex: 99 }}>
            <label className="ui-static-78d7af8b7e" >Invited Global Attendees</label>
            <SearchableAttendeeSelect 
               users={allUsers} 
               departments={allDepartments}
               selectedIds={editFormData.attendees}
               onChange={(newIds) => setEditFormData({...editFormData, attendees: newIds})}
            />
          </div>
          <button type="submit" className="primary-btn ui-static-b52e2fe28a" >Save Changes</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="ui-static-8d1f3419f7" style={{display: 'flex', alignItems: 'center'}}>
            <h1 className="ui-static-ff227d0632" >{meeting.title}</h1>
            <span className="badge ui-static-635656024d" style={{backgroundColor: meeting.status === 'Completed' ? "var(--ui-success)" : meeting.status === 'In Progress' ? "var(--ui-info)" : "var(--ui-warning)"}}>
              {meeting.status}
            </span>
            {isSuperAdmin && (
               <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowActions(!showActions)} className="primary-btn ui-static-348bdd4fdd" style={{display: 'flex', alignItems: 'center'}}>
                      Admin
                  </button>
                  {showActions && (
                     <div className="ui-static-26d75cc849" style={{position: 'absolute', top: '100%', left: 0, shadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 10, display: 'flex', flexDirection: 'column', minWidth: '150px'}}>
                        <button onClick={() => { setIsEditingMeeting(true); setShowActions(false); }} className="ui-static-b7cf0c57fa" style={{textAlign: 'left', cursor: 'pointer'}}> Edit Meeting</button>
                        <button onClick={async () => {
                          if (confirm('Irreversible: Delete this entire Megathread and ALL its sessions?')) {
                            const del = await fetch(`/api/meetings/${meeting.id}`, { method: 'DELETE' });
                            if (del.ok) router.push('/meetings');
                          }
                        }} className="ui-static-f8cbd796a0" style={{textAlign: 'left', cursor: 'pointer'}}> Delete Meeting</button>
                     </div>
                  )}
               </div>
            )}
          </div>
          <p className="ui-static-a750cb1a96" >
            Megathread Initiated: <span suppressHydrationWarning>{mounted && meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleDateString() : '...'}</span> | 
            Organizer: <strong className="ui-static-b9010af219" >{meeting.organizedBy?.name || meeting.organizedBy?.email || 'System'}</strong>
          </p>
        </div>
        {meeting.status !== 'Completed' && canFinalize && (
          <button onClick={async () => {
            const res = await fetch(`/api/meetings/${meeting.id}`, {
              method: "PATCH", headers: {"Content-Type": "application/json"},
              body: JSON.stringify({ status: "Completed" })
            });
            if (res.ok) { setMeeting(await res.json()); }
          }} className="primary-btn ui-static-15adb7a44f" >
            Close Entire Megathread ✓
          </button>
        )}
      </header>

      <div className="ui-static-0410aac9fd" style={{display: 'flex', flexDirection: 'column'}}>
        
        {/* Pre-Scheduling Matrix / Add Session Block */}
        {meeting.status !== 'Completed' && (
          <div className="card ui-static-2f448698d5" >
            <h3 className="ui-static-4db96b46e7" >+ Schedule New Session Block</h3>
            <form onSubmit={handleCreateSession} className="ui-static-af81cc4264" style={{display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap'}}>
              <div style={{ flex: '1 1 200px' }}>
                <label className="ui-static-219a9f3a85" style={{display: 'block'}}>Session Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Week 1: Core Sync" 
                  value={newSessionTitle} 
                  onChange={e => setNewSessionTitle(e.target.value)} 
                  required 
                  className="ui-static-4234f20878" style={{width: '100%'}}
                />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label className="ui-static-219a9f3a85" style={{display: 'block'}}>Session Date</label>
                <input 
                  type="datetime-local" 
                  value={newSessionDate} 
                  onChange={e => setNewSessionDate(e.target.value)} 
                  required 
                  className="ui-static-4234f20878" style={{width: '100%'}}
                />
              </div>
              <button type="submit" className="primary-btn ui-static-4577864700" disabled={isAddingSession} style={{width: 'auto', alignSelf: 'flex-end'}}>
                {isAddingSession ? "Creating..." : "Add Session Block"}
              </button>
            </form>
          </div>
        )}

        {/* Hierarchical Timeline (Sessions) */}
        {(!meeting.sessions || meeting.sessions.length === 0) && (
          <div className="ui-static-f4b6363ad0" style={{textAlign: 'center', fontStyle: 'italic'}}>
            No sessions scheduled in this megathread yet.
          </div>
        )}

        {meeting.sessions?.map((session, index) => {
          const inputs = taskInputs[session.id] || { assigneeType: 'user', generateTicket: true, task: '', assigneeId: '', departmentId: '' };
          
          return (
            <div key={session.id} className="card ui-static-06f04f7095" style={{overflow: 'hidden'}}>
              
              {/* Session Header */}
              <div className="meeting-session-header ui-static-cc5bca5231" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <h2 className="ui-static-8d62b04a95" >{session.title || `Session ${index + 1}`}</h2>
                  <span className="ui-static-dd90b11840" >
                     {mounted && session.scheduledFor ? new Date(session.scheduledFor).toLocaleString('en-CA', { dateStyle: 'long', timeStyle: 'short' }) : 'Pending'}
                      |    {session.author?.name || session.author?.email}
                  </span>
                </div>
              </div>

              <div className="ui-static-f06f47c069" style={{display: 'grid', gridTemplateColumns: 'minmax(300px, 2fr) minmax(250px, 1fr)'}}>
                
                {/* Left Column: Discussion Notes & Action Items */}
                <div className="ui-static-247e0a6cda" style={{display: 'flex', flexDirection: 'column'}}>
                  
                  {/* Notes Content */}
                  <div>
                    <div className="ui-static-051a376dfa" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <h3 className="ui-static-7a5a81d0c2" > Meeting Notes</h3>
                      {editingSessionId !== session.id && (
                        <button onClick={() => { setEditingSessionId(session.id); setEditingContent(session.content || ""); }} className="ui-static-407b1250a0" style={{cursor: 'pointer'}}>
                           Edit Notes
                        </button>
                      )}
                    </div>

                    {editingSessionId === session.id ? (
                      <div className="ui-static-30f523173e" style={{display: 'flex', flexDirection: 'column'}}>
                        <textarea 
                          rows="6" 
                          value={editingContent}
                          onChange={e => setEditingContent(e.target.value)}
                          className="ui-static-22c3168f4e" style={{width: '100%'}}
                          placeholder="Type agenda, problems discussed, or summary here..."
                        />
                        <div className="ui-static-30f523173e" style={{display: 'flex', justifyContent: 'flex-end'}}>
                          <button onClick={() => setEditingSessionId(null)} className="ui-static-8c78147113" style={{cursor: 'pointer'}}>Cancel</button>
                          <button onClick={() => saveSessionContent(session.id)} className="primary-btn ui-static-7f62800e8e" style={{width: 'auto'}}>Save Notes</button>
                        </div>
                      </div>
                    ) : (
                      <div className="ui-static-6dbc24b775" style={{whiteSpace: 'pre-wrap', color: session.content ? "var(--ui-info)" : "var(--ui-info)", minHeight: '60px'}}>
                        {session.content || <em>No notes recorded for this session yet. Click Edit to start logging.</em>}
                      </div>
                    )}
                  </div>

                  {/* Nested Action Items */}
                  <div className="ui-static-e95087ba5b" >
                    <h3 className="ui-static-7c4283a16f" > Session Follow-Ups</h3>
                    
                    {meeting.status !== 'Completed' && (
                      <form onSubmit={(e) => handleAddActionItem(e, session.id)} className="ui-static-169c552110" style={{display: 'flex', flexDirection: 'column'}}>
                        <input 
                          type="text" 
                          placeholder="Describe task springing from this session..." 
                          value={inputs.task} 
                          onChange={e => updateTaskInput(session.id, 'task', e.target.value)} 
                          required 
                          className="ui-static-b9ca49b7f6" style={{width: '100%'}}
                        />
                        <div className="ui-static-30f523173e" style={{display: 'flex', flexWrap: 'wrap'}}>
                          <select value={inputs.assigneeType} onChange={e => updateTaskInput(session.id, 'assigneeType', e.target.value)} className="ui-static-5b3a2ff5f2" >
                            <option value="user">User</option>
                            <option value="dept">Team</option>
                          </select>
                          
                          {inputs.assigneeType === 'user' ? (
                            <select value={inputs.assigneeId} onChange={e => updateTaskInput(session.id, 'assigneeId', e.target.value)} className="ui-static-5b3a2ff5f2" style={{flex: 1}}>
                              <option value="">-- Person --</option>
                              {allUsers.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                            </select>
                          ) : (
                            <select value={inputs.departmentId} onChange={e => updateTaskInput(session.id, 'departmentId', e.target.value)} className="ui-static-5b3a2ff5f2" style={{flex: 1}}>
                              <option value="">-- Department --</option>
                              {allDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          )}
                          <button type="submit" className="primary-btn ui-static-4577864700" style={{width: 'auto'}}>+ Add</button>
                        </div>
                        <label className="ui-static-e82e0bebbb" style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                          <input type="checkbox" checked={inputs.generateTicket} onChange={e => updateTaskInput(session.id, 'generateTicket', e.target.checked)} style={{ width: '1.2rem', height: '1.2rem' }} />
                          Auto-generate Support Ticket
                        </label>
                      </form>
                    )}

                    <ul className="ui-static-9a8354becc" style={{listStyle: 'none', display: 'flex', flexDirection: 'column'}}>
                      {(!session.actionItems || session.actionItems.length === 0) && <span className="ui-static-9d7e95f546" >No tasks assigned.</span>}
                      {session.actionItems?.map(item => (
                        <li key={item.id} className="ui-static-4f38db4618" style={{display: 'flex', alignItems: 'flex-start', background: item.status === 'Completed' ? "var(--ui-surface)" : "var(--ui-surface)", opacity: 1}}>
                          <input 
                            type="checkbox" 
                            checked={item.status === 'Completed'} 
                            onChange={() => toggleActionItemStatus(session.id, item.id, item.status)}
                            className="ui-static-ad0775fa5f" style={{width: '1.25rem', height: '1.25rem', cursor: 'pointer'}}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <p className="ui-static-1094711509" style={{color: item.status === 'Completed' ? "var(--ui-info)" : "var(--ui-ink)", textDecoration: item.status === 'Completed' ? 'line-through' : 'none'}}>
                                {item.task}
                              </p>
                              {item.linkedTicketId && (
                                <a href={`/tickets/${item.linkedTicketId}`} className="ui-static-f82f7b4098" style={{textDecoration: 'none'}}>
                                  Ticket #{item.linkedTicketId}
                                </a>
                              )}
                            </div>
                            <span className="ui-static-fe641e3b91" >
                              To: {item.assignee ? (item.assignee.name || item.assignee.email) : item.department ? item.department.name : 'Unassigned'}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Right Column: Discrete Session Attendance */}
                <div className="ui-static-b0c7aad1e6" >
                  <h3 className="ui-static-b58ab2bb57" >✓ Attendance Check</h3>
                  <ul className="ui-static-9a8354becc" style={{listStyle: 'none', display: 'flex', flexDirection: 'column'}}>
                    {meeting.attendees.map(a => {
                      const isPresent = session.presentAttendees?.some(p => p.id === a.id);
                      const canCheck = isOrganizer || isAdminOrManager || a.id === currentUser.id;

                      return (
                        <li key={a.id} className="ui-static-7dee9abcae" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isPresent ? "var(--ui-surface)" : "var(--ui-surface)", border: `1px solid ${isPresent ? "var(--ui-success)" : "var(--ui-on-accent)"}`}}>
                          <span style={{ fontWeight: isPresent ? 'bold' : 'normal', color: isPresent ? "var(--ui-success)" : "var(--ui-info)", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                            {a.name || a.email.split('@')[0]}
                          </span>
                          {canCheck ? (
                            <label className="ui-static-d405de5c91" style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
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
                              <span className="ui-static-ca31c5a52a" >✓</span>
                            ) : (
                              <span className="ui-static-f0ec965903" >-</span>
                            )
                          )}
                        </li>
                      );
                    })}
                    {meeting.attendees.length === 0 && <li className="ui-static-9d7e95f546" >No invitees global.</li>}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
