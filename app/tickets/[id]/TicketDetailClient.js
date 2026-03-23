"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TicketDetailClient({ ticket, departments, users, jobCategories, canModifyTicket, currentUser }) {
  const router = useRouter();
  
  const currentUserObj = currentUser || {};
  const currentUserId = currentUserObj.id ? parseInt(currentUserObj.id) : null;

  const isCreator = ticket.historyLogs && ticket.historyLogs.length > 0 && ticket.historyLogs[ticket.historyLogs.length - 1].actorId === currentUserId;
  const isAdminOrManager = currentUserObj.role === 'Admin' || currentUserObj.role === 'Manager';
  const showTicketEdit = isCreator || isAdminOrManager;

  const [editingTicket, setEditingTicket] = useState(false);
  const [editTitle, setEditTitle] = useState(ticket.title);
  const [editDesc, setEditDesc] = useState(ticket.description);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [formData, setFormData] = useState({
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    departmentId: ticket.departmentId,
    assigneeId: ticket.assigneeId || "",
    jobCategoryId: ticket.jobCategoryId || ""
  });
  const [commentText, setCommentText] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [submitAction, setSubmitAction] = useState('reply');
  const [showSubmitDropdown, setShowSubmitDropdown] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!canModifyTicket) {
      alert("You do not have permission to modify these properties.");
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formData,
        departmentId: parseInt(formData.departmentId),
        assigneeId: formData.assigneeId ? parseInt(formData.assigneeId) : null,
        jobCategoryId: formData.jobCategoryId ? parseInt(formData.jobCategoryId) : ticket.jobCategoryId // inherit existing if unchanged
      })
    });
    
    if (res.ok) {
      alert("Ticket properties updated successfully.");
      router.refresh(); 
    } else {
      alert("Failed to update ticket.");
    }
    setLoading(false);
  };

  const saveTicketEdit = async () => {
    setLoading(true);
    const res = await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formData, title: editTitle, description: editDesc })
    });
    if(res.ok) {
      setEditingTicket(false);
      router.refresh();
    } else alert("Failed to save changes");
    setLoading(false);
  };

  const saveCommentEdit = async (id) => {
    const res = await fetch(`/api/tickets/${ticket.id}/comments/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: editingCommentText })
    });
    if(res.ok) {
      setEditingCommentId(null);
      router.refresh();
    } else alert("Failed to save comment edits");
  };

  const handleDelete = async () => {
    if(confirm("DANGER: Are you sure you want to permanently delete this ticket and all tracking logs?")) {
      await fetch(`/api/tickets/${ticket.id}`, { method: "DELETE" });
      router.push("/tickets");
      router.refresh();
    }
  };

  const handleCommentSubmit = async (e, actionType = 'reply') => {
    e.preventDefault();
    if (!commentText.trim() && !file) return;
    setCommentLoading(true);
    
    let attachmentUrl = null;
    let attachmentName = null;

    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      const rep = await fetch("/api/upload", { method: "POST", body: fd });
      if (rep.ok) {
        const json = await rep.json();
        attachmentUrl = json.url;
        attachmentName = json.filename;
      }
    }

    const res = await fetch(`/api/tickets/${ticket.id}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: commentText, attachmentUrl, attachmentName, actionType })
    });
    if (res.ok) {
      const updatedStatus = actionType === 'finish' ? 'Pending CS Confirmation' : 'Auto';
      setCommentText("");
      setFile(null);
      setFormData({...formData, status: updatedStatus});
      router.refresh();
    }
    setCommentLoading(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 7fr) minmax(300px, 3fr)', gap: '2rem', alignItems: 'flex-start' }}>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {editingTicket ? (
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ width: '100%', fontSize: '1.6rem', fontWeight: 'bold', padding: '0.5rem', marginBottom: '1rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
          ) : (
            <h1 style={{ margin: '0 0 1rem 0', fontSize: '1.6rem', color: '#0f172a' }}>{ticket.title}</h1>
          )}

          {ticket.actionItem && ticket.actionItem.meeting && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🤝</span>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#166534', flex: 1 }}>
                <strong>Autogenerated Tracking Task:</strong> Originates from Meeting <a href={`/meetings/${ticket.actionItem.meeting.id}`} style={{ color: '#15803d', textDecoration: 'underline', fontWeight: 'bold' }}>{ticket.actionItem.meeting.title}</a>
              </p>
            </div>
          )}
          
          <div style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
            <span>Contact: <strong>{ticket.assignee?.name || ticket.assignee?.email || 'NOC Operator'}</strong></span>
            <span>• <span>{mounted ? new Date(ticket.createdAt).toLocaleString('en-CA') : '...'}</span></span>
          </div>
          
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', color: '#1e293b', fontSize: '0.95rem' }}>
            <p style={{ margin: '0 0 1rem 0' }}>Dear NOC,</p>
            {editingTicket ? (
              <div>
                <textarea rows="8" value={editDesc} onChange={e => setEditDesc(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontFamily: 'inherit' }} />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button onClick={saveTicketEdit} style={{ background: '#10b981', color: 'white', padding: '0.4rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
                  <button onClick={() => setEditingTicket(false)} style={{ background: '#e2e8f0', color: '#334155', padding: '0.4rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            ) : (
              ticket.description
            )}
          </div>

          {ticket.attachments && ticket.attachments.length > 0 && (
            <div style={{ marginTop: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
              <strong style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>Attachments ({ticket.attachments.length})</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {ticket.attachments.map(att => (
                   <a key={att.id} href={att.url} target="_blank" rel="noreferrer" style={{ background: 'white', padding: '0.4rem 0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem', color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                     📎 {att.filename}
                   </a>
                ))}
              </div>
            </div>
          )}

        </div>

        {ticket.comments?.map(c => (
          <div key={c.id} style={{ background: 'white', padding: '1.5rem 2rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.5rem', fontSize: '0.85rem' }}>
              <span style={{ color: '#94a3b8' }}>
                Reply by <strong style={{ color: '#334155' }}>{c.author?.name || c.author?.email}</strong> 
                <span style={{ marginLeft: '0.5rem' }}>&gt; <span>{mounted ? new Date(c.createdAt).toLocaleString('en-CA') : '...'}</span></span>
              </span>
              <span>
                {c.authorId === currentUserId && (
                  <span onClick={() => { setEditingCommentId(c.id); setEditingCommentText(c.text); }} style={{ color: '#0ea5e9', cursor: 'pointer', fontWeight: 'bold' }}>Edit</span>
                )}
              </span>
            </div>
            {editingCommentId === c.id ? (
              <div style={{ padding: '0.5rem 0' }}>
                <textarea rows="4" value={editingCommentText} onChange={e => setEditingCommentText(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button onClick={() => saveCommentEdit(c.id)} style={{ background: '#3b82f6', color: 'white', padding: '0.4rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Update Save</button>
                  <button onClick={() => setEditingCommentId(null)} style={{ background: '#e2e8f0', color: '#334155', padding: '0.4rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#1e293b', fontSize: '0.95rem' }}>
                {c.text}
              </div>
            )}
            
            {c.attachments && c.attachments.length > 0 && (
              <div style={{ marginTop: '1rem', borderTop: '1px dashed #e2e8f0', paddingTop: '1rem' }}>
                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {c.attachments.map(att => (
                     <a key={att.id} href={att.url} target="_blank" rel="noreferrer" style={{ background: '#f8fafc', padding: '0.4rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem', color: '#0ea5e9', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                       📎 {att.filename}
                     </a>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        ))}

        <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '1rem' }}>
          <form onSubmit={handleCommentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#334155' }}>Reply to ticket</h3>
            <textarea 
              rows="6" 
              placeholder="Type your technical response here..." 
              style={{ width: '100%', padding: '1rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'inherit', boxSizing: 'border-box', background: 'white', fontSize: '0.95rem' }}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              required={!file}
            ></textarea>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'white', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', minWidth: '100px' }}>Attachment:</label>
              <input type="file" onChange={e => setFile(e.target.files[0])} style={{ flex: 1, fontSize: '0.85rem' }} />
              {file && <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 'bold' }}>Added ✓</span>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
              <div style={{ position: 'relative', display: 'inline-flex', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <button type="button" onClick={(e) => handleCommentSubmit(e, submitAction)} disabled={commentLoading} style={{ padding: '0.75rem 1.5rem', background: submitAction === 'finish' ? '#10b981' : '#3b82f6', color: 'white', border: 'none', borderRadius: '4px 0 0 4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'background 0.2s' }}>
                  {commentLoading ? 'Sending...' : (submitAction === 'finish' ? 'Submit & Mark Finished' : 'Submit Reply')}
                </button>
                <button type="button" onClick={() => setShowSubmitDropdown(!showSubmitDropdown)} disabled={commentLoading} style={{ padding: '0.75rem 0.5rem', background: submitAction === 'finish' ? '#059669' : '#2563eb', color: 'white', border: 'none', borderRadius: '0 4px 4px 0', cursor: 'pointer', borderLeft: `1px solid ${submitAction === 'finish' ? '#34d399' : '#60a5fa'}`, transition: 'background 0.2s' }}>
                  <span style={{ fontSize: '0.7rem' }}>▼</span>
                </button>
                
                {showSubmitDropdown && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.25rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', zIndex: 10, minWidth: '220px', overflow: 'hidden' }}>
                    <div onClick={() => { setSubmitAction('reply'); setShowSubmitDropdown(false); }} style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: submitAction === 'reply' ? '#f8fafc' : 'white', fontWeight: submitAction === 'reply' ? 'bold' : 'normal', fontSize: '0.85rem', color: '#334155' }}>
                      <div style={{ marginBottom: '0.25rem' }}>Submit Reply</div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>Status shifts automatically</span>
                    </div>
                    <div onClick={() => { setSubmitAction('finish'); setShowSubmitDropdown(false); }} style={{ padding: '0.75rem 1rem', cursor: 'pointer', background: submitAction === 'finish' ? '#f8fafc' : 'white', fontWeight: submitAction === 'finish' ? 'bold' : 'normal', fontSize: '0.85rem', color: '#10b981' }}>
                      <div style={{ marginBottom: '0.25rem' }}>Submit & Mark Finished</div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>Awaiting CS Confirmation</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {showTicketEdit && (
            <button onClick={() => setEditingTicket(true)} style={{ flex: 1, background: 'white', color: '#64748b', border: '1px solid #cbd5e1', padding: '0.6rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '1rem' }}>✎</span> Edit
            </button>
          )}
          <button style={{ flex: 1, background: 'white', color: '#64748b', border: '1px solid #cbd5e1', padding: '0.6rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '1rem' }}>🖨</span> Print
          </button>
          {canModifyTicket && (
            <button onClick={handleDelete} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.6rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>🗑 Delete</button>
          )}
        </div>

        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
             
             <div style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 1fr) 2fr', alignItems: 'center', fontSize: '0.85rem' }}>
               <label style={{ color: '#64748b' }}>Status:</label>
               <select style={{ padding: '0.3rem', borderRadius: '4px', border: 'none', background: 'transparent', color: formData.status === 'Resolved' ? '#10b981' : '#1e293b', fontWeight: 'bold', cursor: 'pointer' }} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} disabled={!canModifyTicket}>
                 <option value="New">New</option>
                 <option value="Open">Open</option>
                 <option value="Pending">Pending (Waiting User)</option>
                 <option value="Pending CS Confirmation">Pending CS Confirmation</option>
                 <option value="Resolved">Resolved</option>
               </select>
             </div>
             
             <div style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 1fr) 2fr', alignItems: 'center', fontSize: '0.85rem' }}>
               <label style={{ color: '#64748b' }}>Priority:</label>
               <select style={{ padding: '0.3rem', borderRadius: '4px', border: 'none', background: 'transparent', color: '#1e293b', fontWeight: '500', cursor: 'pointer' }} value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} disabled={!canModifyTicket}>
                 <option value="Low">Low</option>
                 <option value="Medium">Medium</option>
                 <option value="High">High</option>
                 <option value="Critical">Critical</option>
               </select>
             </div>
             
             <div style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 1fr) 2fr', alignItems: 'center', fontSize: '0.85rem' }}>
               <label style={{ color: '#64748b' }}>Department:</label>
               <select style={{ padding: '0.3rem', borderRadius: '4px', border: 'none', background: 'transparent', color: '#1e293b', fontWeight: '500', cursor: 'pointer' }} value={formData.departmentId} onChange={e => setFormData({...formData, departmentId: parseInt(e.target.value)})} disabled={!canModifyTicket}>
                 {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
               </select>
            </div>

             <div style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 1fr) 2fr', alignItems: 'center', fontSize: '0.85rem' }}>
               <label style={{ color: '#64748b' }}>Assigned to:</label>
               <select style={{ padding: '0.3rem', borderRadius: '4px', border: 'none', background: 'transparent', color: '#1e293b', fontWeight: '500', cursor: 'pointer' }} value={formData.assigneeId} onChange={e => setFormData({...formData, assigneeId: e.target.value})} disabled={!canModifyTicket}>
                 <option value="">Unassigned</option>
                 {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
               </select>
             </div>
             
             <div style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 1fr) 2fr', alignItems: 'center', fontSize: '0.85rem' }}>
               <label style={{ color: '#64748b' }}>Job Category:</label>
               <select style={{ padding: '0.3rem', borderRadius: '4px', border: formData.status === 'Resolved' && !formData.jobCategoryId ? '1px solid #ef4444' : 'none', background: 'transparent', color: '#1e293b', fontWeight: '500', cursor: 'pointer', outline: 'none' }} value={formData.jobCategoryId} onChange={e => setFormData({...formData, jobCategoryId: e.target.value})} disabled={!canModifyTicket}>
                 <option value="">None Selected</option>
                 {jobCategories?.map(c => <option key={c.id} value={c.id}>{c.name} (+{c.score} pt)</option>)}
               </select>
             </div>

            {canModifyTicket && (
              <button type="submit" style={{ marginTop: '0.5rem', padding: '0.5rem', fontSize: '0.8rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#334155', cursor: 'pointer' }} disabled={loading}>
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
            )}
          </form>
        </div>

        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>Ticket Details</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
              <span style={{ color: '#64748b' }}>Tracking ID:</span>
              <span style={{ fontWeight: 'bold', color: '#334155' }}>{ticket.trackingId}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
              <span style={{ color: '#64748b' }}>Ticket #:</span>
              <span style={{ color: '#1e293b' }}>{ticket.id}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
              <span style={{ color: '#64748b' }}>Created on:</span>
              <span style={{ color: '#1e293b' }}>{mounted ? new Date(ticket.createdAt).toLocaleString('en-CA') : '...'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
              <span style={{ color: '#64748b' }}>Updated:</span>
              <span style={{ color: '#1e293b' }}>{mounted ? new Date(ticket.updatedAt).toLocaleString('en-CA') : '...'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
              <span style={{ color: '#64748b' }}>Replies:</span>
              <span style={{ color: '#1e293b' }}>{ticket.comments?.length || 0}</span>
            </div>
          </div>
        </div>

        {ticket.customData && Object.keys(ticket.customData).length > 0 && (
          <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>Parameters</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem' }}>
              {Object.entries(ticket.customData).map(([key, val]) => (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
                  <span style={{ color: '#64748b', textTransform: 'capitalize' }}>{key}:</span>
                  <span style={{ color: '#1e293b' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '0.9rem', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Ticket History</span>
            <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>ʌ</span>
          </h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
            {(!ticket.historyLogs || ticket.historyLogs.length === 0) && (
              <li style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No history entries logged yet.</li>
            )}
            {ticket.historyLogs?.map(log => {
               const d = new Date(log.createdAt);
               const dateStr = d.toLocaleDateString('en-CA');
               const timeStr = d.toLocaleTimeString('en-GB', {hour12: false});
               const authorName = log.actor?.name || log.actor?.email?.split('@')[0] || 'System';
               return (
                <li key={log.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '1rem', paddingBottom: '1rem', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', color: '#94a3b8', fontSize: '0.75rem', lineHeight: '1.4' }}>
                    <span>{mounted ? dateStr : '...'}</span>
                    <span>{mounted ? timeStr : '...'}</span>
                  </div>
                  <div style={{ color: '#334155', fontSize: '0.8rem', lineHeight: '1.4' }}>
                    <span>{log.action}</span><br/>
                    <span style={{ color: '#64748b' }}>by {authorName} ({authorName})</span>
                  </div>
                </li>
               );
            })}
          </ul>
        </div>

      </div>
    </div>
  );
}
