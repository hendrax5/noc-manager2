"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

function linkify(text) {
  if (!text) return "";
  if (text.includes("<a ")) {
    return text.replace(/<a\b([^>]*)>/gi, (match, attrs) => {
      if (!attrs.includes("target=")) {
        return `<a target="_blank" rel="noopener noreferrer" ${attrs}>`;
      }
      return match;
    });
  }
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, function(url) {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline; word-break: break-all;">${url}</a>`;
  });
}

function SearchableSelect({ options, value, onChange, disabled, placeholder }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value == value);
  const displayValue = isOpen ? searchTerm : (selectedOption ? selectedOption.label : "");

  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={{ position: 'relative', width: '100%', zIndex: isOpen ? 50 : 1 }}>
      <input 
        type="text" 
        style={{ width: '100%', textOverflow: 'ellipsis', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: disabled ? 'var(--hover-bg)' : 'var(--input-bg)', color: value ? 'var(--heading-color)' : 'var(--text-color)', fontWeight: '600', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }} 
        placeholder={placeholder}
        value={displayValue}
        disabled={disabled}
        onClick={() => { if(!disabled) setIsOpen(true); }}
        onChange={e => { setSearchTerm(e.target.value); setIsOpen(true); }}
        onBlur={() => setTimeout(() => { setIsOpen(false); setSearchTerm(''); }, 200)}
      />
      {isOpen && !disabled && (
         <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '250px', overflowY: 'auto', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 10 }}>
           <div onClick={() => { onChange(""); setIsOpen(false); }} style={{ padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-color)' }}>{placeholder}</div>
           {filteredOptions.length === 0 ? (
             <div style={{ padding: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>No results found</div>
           ) : filteredOptions.map(o => (
             <div key={o.value} onClick={() => { onChange(o.value); setIsOpen(false); setSearchTerm(''); }} className="hover-bg" style={{ padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--heading-color)' }}>
               {o.label}
             </div>
           ))}
         </div>
      )}
    </div>
  );
}

export default function TicketDetailClient({ ticket, departments, users, jobCategories, customFields, canModifyTicket, currentUser, serviceTemplates }) {
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
  const [visibleCustomFieldIds, setVisibleCustomFieldIds] = useState([]);
  const [replyCustomData, setReplyCustomData] = useState({});
  const [formData, setFormData] = useState({
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    departmentId: ticket.departmentId,
    assigneeId: ticket.assigneeId || "",
    jobCategoryId: ticket.jobCategoryId || "",
    customData: ticket.customData || {}
  });
  const [commentText, setCommentText] = useState(currentUser.signature ? `\n\n${currentUser.signature}` : "");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [submitAction, setSubmitAction] = useState('reply');
  const [showSubmitDropdown, setShowSubmitDropdown] = useState(false);
  const [slaLoading, setSlaLoading] = useState(false);
  
  const [mounted, setMounted] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [now, setNow] = useState(new Date().getTime());
  useEffect(() => {
    setMounted(true);
    if (ticket.enableSla && ticket.status !== 'Resolved' && ticket.status !== 'Waiting Reply') {
      const interval = setInterval(() => setNow(Date.now()), 10000); // 10s tick
      return () => clearInterval(interval);
    }
  }, [ticket]);

  const triggerAutoSave = async (key, newValue) => {
    if (!canModifyTicket) return;
    setFormData(prev => ({ ...prev, [key]: newValue }));
    
    const updatedPayload = {
      ...formData,
      [key]: newValue,
      departmentId: key === 'departmentId' ? parseInt(newValue) : parseInt(formData.departmentId),
      assigneeId: key === 'assigneeId' ? (newValue ? parseInt(newValue) : null) : (formData.assigneeId ? parseInt(formData.assigneeId) : null),
      jobCategoryId: key === 'jobCategoryId' ? (newValue ? parseInt(newValue) : null) : (formData.jobCategoryId ? parseInt(formData.jobCategoryId) : ticket.jobCategoryId),
    };

    const res = await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedPayload)
    });
    
    if (res.ok) {
      router.refresh(); 
    } else {
      alert("Failed to auto-update ticket property.");
    }
  };

  const saveTicketEdit = async () => {
    setLoading(true);
    const res = await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formData, title: editTitle, description: editDesc, customData: formData.customData })
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
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: commentText, attachmentUrl, attachmentName, actionType, replyCustomData })
    });
    if (res.ok) {
      const updatedStatus = actionType === 'finish' ? 'Pending CS Confirmation' : 'Auto';
      setCommentText(currentUser.signature ? `\n\n${currentUser.signature}` : "");
      setFile(null);
      setReplyCustomData({});
      setVisibleCustomFieldIds([]);
      setFormData({...formData, status: updatedStatus, customData: { ...(formData.customData || {}), ...replyCustomData }});
      router.refresh();
    }
    setCommentLoading(false);
  };

  const optionalFields = customFields?.filter(f => !visibleCustomFieldIds.includes(f.id)) || [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 7fr) minmax(300px, 3fr)', gap: '2rem', alignItems: 'flex-start' }}>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {editingTicket ? (
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ width: '100%', fontSize: '1.6rem', fontWeight: 'bold', padding: '0.5rem', marginBottom: '1rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <h1 style={{ margin: 0, fontSize: '1.6rem', color: 'var(--heading-color)' }}>
                {ticket.title}
                {ticket.customData && Object.values(ticket.customData).some(val => typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) && new Date(val) < new Date()) && ticket.status !== 'Resolved' && (
                  <span className="badge" style={{background: '#ef4444', color: 'white', marginLeft: '1rem', verticalAlign: 'middle', fontSize: '0.8rem'}}>⚠️ EXPIRED</span>
                )}
              </h1>
              {ticket.enableSla && (
                <div style={{ marginLeft: '1rem' }}>
                  {(() => {
                    if (ticket.status === 'Resolved' || ticket.status === 'Waiting Reply') {
                      return <span className="badge" style={{background: '#e2e8f0', color: '#64748b', fontSize: '0.8rem'}}>⏸️ SLA Paused</span>;
                    }
                    if (!ticket.nextSlaDeadline) return null;
                    const diffMins = Math.round((new Date(ticket.nextSlaDeadline).getTime() - now) / 60000);
                    if (diffMins < 0) {
                      return <span className="badge" style={{background: '#ef4444', color: 'white', border: '2px solid #b91c1c', fontSize: '0.9rem', fontWeight: 'bold'}}>🚨 OVERDUE: {Math.abs(diffMins)}m (Pings: {ticket.slaBreaches})</span>;
                    } else if (diffMins <= 5) {
                      return <span className="badge" style={{background: '#f59e0b', color: 'white', fontSize: '0.9rem'}}>⚠️ Due in: {diffMins}m (Pings: {ticket.slaBreaches})</span>;
                    } else {
                      return <span className="badge" style={{background: '#10b981', color: 'white', fontSize: '0.9rem'}}>⏱️ Due in: {diffMins}m (Pings: {ticket.slaBreaches})</span>;
                    }
                  })()}
                </div>
              )}
            </div>
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
          
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', color: 'var(--text-color)', fontSize: '0.95rem' }}>
            <p style={{ margin: '0 0 1rem 0' }}>Dear NOC,</p>
            {editingTicket ? (
              <div>
                <textarea rows="8" value={editDesc} onChange={e => setEditDesc(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--input-text)', fontFamily: 'inherit', marginBottom: '1rem' }} />
                
                {customFields?.length > 0 && (
                  <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '0.9rem' }}>Configure Custom Parameters</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {customFields.map(f => (
                        <div key={f.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 3fr', alignItems: 'center', fontSize: '0.85rem' }}>
                          <label style={{ color: '#64748b', fontWeight: 'bold' }}>{f.name}:</label>
                          {f.type === 'textarea' ? (
                            <textarea 
                              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--input-text)', outline: 'none' }}
                              value={formData.customData?.[f.name] || ''}
                              onChange={e => setFormData({ ...formData, customData: { ...formData.customData, [f.name]: e.target.value }})}
                            />
                          ) : f.type === 'select' && f.options === '@Customers' ? (
                            isEditing ? (
                              <AsyncSearchSelect
                                value={formData.customData?.[f.name] || ''}
                                onChange={(val) => setFormData({ ...formData, customData: { ...formData.customData, [f.name]: val }})}
                                placeholder="Search Customer..."
                                apiRoute="/api/assets/customers/search"
                                disabled={false}
                              />
                            ) : (
                               <span style={{ color: 'var(--text-color)' }}>{ticket.customData?.[f.name] || '-'}</span>
                            )
                          ) : f.type === 'select' && f.options === '@Customers' ? (
                            isEditing ? (
                              <AsyncSearchSelect
                                value={formData.customData?.[f.name] || ''}
                                onChange={(val) => setFormData({ ...formData, customData: { ...formData.customData, [f.name]: val }})}
                                placeholder="Search Customer..."
                                apiRoute="/api/assets/customers/search"
                                disabled={false}
                              />
                            ) : (
                               <span style={{ color: 'var(--text-color)' }}>{ticket.customData?.[f.name] || '-'}</span>
                            )
                          ) : f.type === 'select' ? (
                            <SearchableSelect 
                              options={(f.options ? (function(){
                                if (f.options === '@ServiceTemplates') return (serviceTemplates || []).map(st => ({ value: st.name, label: st.name }));
                                try { return JSON.parse(f.options); } catch(e) { return f.options.split(',').map(s=>({value: s.trim(), label: s.trim()})); }
                              })() : [])}
                              value={formData.customData?.[f.name] || ''}
                              onChange={val => setFormData({ ...formData, customData: { ...formData.customData, [f.name]: val }})}
                              placeholder={`-- Select ${f.name} --`}
                            />
                          ) : (
                            <input 
                              type={f.type === 'date' ? 'date' : 'text'}
                              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--input-text)', outline: 'none' }}
                              value={formData.customData?.[f.name] || ''}
                              onChange={e => setFormData({ ...formData, customData: { ...formData.customData, [f.name]: e.target.value }})}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button onClick={saveTicketEdit} style={{ background: '#10b981', color: 'white', padding: '0.4rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Save Changes</button>
                  <button onClick={() => setEditingTicket(false)} style={{ background: '#e2e8f0', color: '#334155', padding: '0.4rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div dangerouslySetInnerHTML={{ __html: linkify(ticket.description) }} />
                
                {formData.customData && Object.keys(formData.customData).filter(k => formData.customData[k]).length > 0 && (
                  <div style={{ marginTop: '2rem', background: 'var(--hover-bg)', padding: '1.25rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: 'var(--heading-color)', fontSize: '0.9rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Attached Parameters</h4>
                    <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.85rem' }}>
                      {Object.entries(formData.customData).filter(([k, v]) => v).map(([k, v]) => (
                        <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) 4fr', gap: '1rem' }}>
                          <span style={{ color: 'var(--text-color)', fontWeight: 'bold' }}>{k}</span>
                          <span style={{ color: 'var(--heading-color)' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {ticket.attachments && ticket.attachments.length > 0 && (
            <div style={{ marginTop: '1.5rem', background: 'var(--hover-bg)', padding: '1rem', borderRadius: '6px', border: '1px dashed var(--border-color)' }}>
              <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-color)', marginBottom: '0.5rem' }}>Attachments ({ticket.attachments.length})</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {ticket.attachments.map(att => (
                   <a key={att.id} href={att.url} target="_blank" rel="noreferrer" style={{ background: 'var(--card-bg)', padding: '0.4rem 0.8rem', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.85rem', color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                     📎 {att.filename}
                   </a>
                ))}
              </div>
            </div>
          )}

        </div>

        {ticket.comments?.map(c => (
          <div key={c.id} style={{ background: 'var(--card-bg)', padding: '1.5rem 2rem', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.5rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-color)' }}>
                Reply by <strong style={{ color: 'var(--heading-color)' }}>{c.author?.name || c.author?.email}</strong> 
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
                <textarea rows="4" value={editingCommentText} onChange={e => setEditingCommentText(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--input-text)', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button onClick={() => saveCommentEdit(c.id)} style={{ background: '#3b82f6', color: 'white', padding: '0.4rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Update Save</button>
                  <button onClick={() => setEditingCommentId(null)} style={{ background: 'var(--hover-bg)', color: 'var(--heading-color)', padding: '0.4rem 1rem', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: 'var(--text-color)', fontSize: '0.95rem' }} dangerouslySetInnerHTML={{ __html: linkify(c.text) }} />
            )}
            
            {c.attachments && c.attachments.length > 0 && (
              <div style={{ marginTop: '1rem', borderTop: '1px dashed var(--border-color)', paddingTop: '1rem' }}>
                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {c.attachments.map(att => (
                     <a key={att.id} href={att.url} target="_blank" rel="noreferrer" style={{ background: 'var(--hover-bg)', padding: '0.4rem 0.8rem', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.8rem', color: '#0ea5e9', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                       📎 {att.filename}
                     </a>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        ))}

        <div style={{ background: 'var(--hover-bg)', padding: '2rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '1rem' }}>
          <form onSubmit={handleCommentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--heading-color)' }}>Reply to ticket</h3>
            
            {optionalFields.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#e0f2fe', padding: '0.4rem 1.25rem', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                  <span style={{ fontSize: '0.85rem', color: '#0369a1', fontWeight: 'bold' }}>+ Tambah Parameter:</span>
                  <select 
                     defaultValue=""
                     style={{ background: 'transparent', border: 'none', color: '#0f172a', fontWeight: 'bold', cursor: 'pointer', outline: 'none', fontSize: '0.85rem' }}
                     onChange={e => {
                       if(e.target.value) setVisibleCustomFieldIds([...visibleCustomFieldIds, parseInt(e.target.value)]);
                       e.target.value = "";
                     }}
                  >
                    <option value="">[ Pilih Field... ]</option>
                    {optionalFields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            {visibleCustomFieldIds.length > 0 && (
              <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {customFields.filter(f => visibleCustomFieldIds.includes(f.id)).map(f => (
                  <div key={f.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 3fr', alignItems: 'center', fontSize: '0.85rem' }}>
                    <label style={{ color: 'var(--text-color)', fontWeight: 'bold' }}>{f.name}:</label>
                    {f.type === 'textarea' ? (
                      <textarea 
                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--heading-color)', outline: 'none' }}
                        value={replyCustomData[f.name] || ''}
                        onChange={e => setReplyCustomData({ ...replyCustomData, [f.name]: e.target.value })}
                        required
                      />
                    ) : f.type === 'select' ? (
                      <SearchableSelect 
                        options={(f.options ? (function(){
                          if (f.options === '@ServiceTemplates') return (serviceTemplates || []).map(st => ({ value: st.name, label: st.name }));
                          try { return JSON.parse(f.options); } catch(e) { return f.options.split(',').map(s=>({ value: s.trim(), label: s.trim() })); }
                        })() : [])}
                        value={replyCustomData[f.name] || ''}
                        onChange={val => setReplyCustomData({ ...replyCustomData, [f.name]: val })}
                        placeholder={`-- Select ${f.name} --`}
                        required
                      />
                    ) : (
                      <input 
                        type={f.type === 'date' ? 'date' : 'text'}
                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--heading-color)', outline: 'none' }}
                        value={replyCustomData[f.name] || ''}
                        onChange={e => setReplyCustomData({ ...replyCustomData, [f.name]: e.target.value })}
                        required
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Knowledge Base search removed by user request */}

            <div style={{ position: 'relative' }}>
              <textarea 
                rows="6" 
                placeholder="Type your technical response here..." 
                style={{ width: '100%', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontFamily: 'inherit', boxSizing: 'border-box', background: 'var(--input-bg)', color: 'var(--input-text)', fontSize: '0.95rem' }}
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                required={!file && visibleCustomFieldIds.length === 0}
              ></textarea>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--input-bg)', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-color)', minWidth: '100px' }}>Attachment:</label>
              <input type="file" onChange={e => setFile(e.target.files[0])} style={{ flex: 1, fontSize: '0.85rem', color: 'var(--input-text)' }} />
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
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.25rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', zIndex: 10, minWidth: '220px', overflow: 'hidden' }}>
                    <div onClick={() => { setSubmitAction('reply'); setShowSubmitDropdown(false); }} style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', background: submitAction === 'reply' ? 'var(--hover-bg)' : 'var(--card-bg)', fontWeight: submitAction === 'reply' ? 'bold' : 'normal', fontSize: '0.85rem', color: 'var(--heading-color)' }}>
                      <div style={{ marginBottom: '0.25rem' }}>Submit Reply</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-color)', fontWeight: 'normal' }}>Status shifts automatically</span>
                    </div>
                    <div onClick={() => { setSubmitAction('finish'); setShowSubmitDropdown(false); }} style={{ padding: '0.75rem 1rem', cursor: 'pointer', background: submitAction === 'finish' ? 'var(--hover-bg)' : 'var(--card-bg)', fontWeight: submitAction === 'finish' ? 'bold' : 'normal', fontSize: '0.85rem', color: '#10b981' }}>
                      <div style={{ marginBottom: '0.25rem' }}>Submit & Mark Finished</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-color)', fontWeight: 'normal' }}>Awaiting CS Confirmation</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {ticket.enableSla && ticket.status !== 'Resolved' && ticket.status !== 'Waiting Reply' && (
           <div className="no-print" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
             <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#b45309' }}>SLA Enforcement Active</h3>
             <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#92400e', lineHeight: '1.4' }}>The Customer Service team is required to follow up with the customer every {ticket.slaTimerMins} minutes.</p>
             <button 
               onClick={async () => {
                 setSlaLoading(true);
                 const res = await fetch(`/api/tickets/${ticket.id}/sla-follow-up`, { method: "POST" });
                 if(res.ok) router.refresh();
                 else alert("Failed to log follow-up.");
                 setSlaLoading(false);
               }} 
               disabled={slaLoading}
               style={{ width: '100%', background: '#d97706', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
             >
               {slaLoading ? 'Logging...' : '↻ Log Follow-Up (Ext. Channel)'}
             </button>
           </div>
        )}

        <div className="no-print" style={{ display: 'flex', gap: '0.5rem' }}>
          {showTicketEdit && (
            <button onClick={() => setEditingTicket(true)} style={{ flex: 1, background: 'var(--card-bg)', color: 'var(--heading-color)', border: '1px solid var(--border-color)', padding: '0.6rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '1rem' }}>✎</span> Edit
            </button>
          )}
          <button onClick={() => window.print()} className="print-btn" style={{ flex: 1, background: 'var(--card-bg)', color: 'var(--heading-color)', border: '1px solid var(--border-color)', padding: '0.6rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '1rem' }}>🖨</span> Print
          </button>
          {canModifyTicket && (
            <button onClick={handleDelete} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.6rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>🗑 Delete</button>
          )}
        </div>

        <div style={{ background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
               <label style={{ color: 'var(--text-color)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Ticket Status</label>
               <select style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: formData.status === 'Resolved' ? '#064e3b' : 'var(--input-bg)', color: formData.status === 'Resolved' ? '#34d399' : 'var(--input-text)', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', outline: 'none' }} value={formData.status} onChange={e => triggerAutoSave('status', e.target.value)} disabled={!canModifyTicket}>
                 <option value="New">New</option>
                 <option value="Open">Open</option>
                 <option value="Pending">Pending (Waiting User)</option>
                 <option value="Pending CS Confirmation">Pending CS Confirmation</option>
                 <option value="Resolved">Resolved</option>
               </select>
             </div>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
               <label style={{ color: 'var(--text-color)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Priority Level</label>
               <select style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: formData.priority === 'Critical' ? '#e11d48' : 'var(--input-text)', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem', outline: 'none' }} value={formData.priority} onChange={e => triggerAutoSave('priority', e.target.value)} disabled={!canModifyTicket}>
                 <option value="Low">Low</option>
                 <option value="Medium">Medium</option>
                 <option value="High">High</option>
                 <option value="Critical">Critical</option>
               </select>
             </div>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
               <label style={{ color: 'var(--text-color)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Department</label>
               <SearchableSelect 
                  options={(departments || []).map(d => ({ value: d.id, label: d.name }))} 
                  value={formData.departmentId} 
                  onChange={val => triggerAutoSave('departmentId', val)} 
                  disabled={!canModifyTicket} 
                  placeholder="-- Select Department --" 
                />
            </div>

             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
               <label style={{ color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Assigned To</label>
               <SearchableSelect 
                 options={users.map(u => ({ value: u.id, label: u.name || u.email }))} 
                 value={formData.assigneeId} 
                 onChange={val => triggerAutoSave('assigneeId', val)} 
                 disabled={!canModifyTicket} 
                 placeholder="-- Unassigned --" 
               />
             </div>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
               <label style={{ color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Job Phase Category</label>
               <SearchableSelect 
                 options={(jobCategories || []).map(c => ({ value: c.id, label: isAdminOrManager ? `${c.name} (+${c.score} pt)` : c.name }))} 
                 value={formData.jobCategoryId} 
                 onChange={val => triggerAutoSave('jobCategoryId', val)} 
                 disabled={!canModifyTicket} 
                 placeholder="-- Phase Unassigned --" 
               />
             </div>
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--heading-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Ticket Details</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
              <span style={{ color: 'var(--text-color)' }}>Tracking ID:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--heading-color)' }}>{ticket.trackingId}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
              <span style={{ color: 'var(--text-color)' }}>Ticket #:</span>
              <span style={{ color: 'var(--heading-color)' }}>{ticket.id}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
              <span style={{ color: 'var(--text-color)' }}>Created on:</span>
              <span style={{ color: 'var(--heading-color)' }}>{mounted ? new Date(ticket.createdAt).toLocaleString('en-CA') : '...'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
              <span style={{ color: 'var(--text-color)' }}>Updated:</span>
              <span style={{ color: 'var(--heading-color)' }}>{mounted ? new Date(ticket.updatedAt).toLocaleString('en-CA') : '...'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
              <span style={{ color: 'var(--text-color)' }}>Replies:</span>
              <span style={{ color: 'var(--heading-color)' }}>{ticket.comments?.length || 0}</span>
            </div>
          </div>
        </div>



          {ticket.services && ticket.services.length > 0 && (
            <div style={{ background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Network Topology (Impacted)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {ticket.services.map(srv => (
                  <div key={srv.id} style={{ background: 'var(--hover-bg)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--heading-color)', marginBottom: '0.2rem', fontSize: '0.9rem' }}>{srv.customer?.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-color)', marginBottom: '0.8rem' }}>{srv.name}</div>
                    
                    {srv.hops && srv.hops.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '2px solid var(--primary-color)', paddingLeft: '0.8rem', marginLeft: '0.5rem', position: 'relative' }}>
                        {srv.hops.map((hop, i) => (
                          <div key={hop.id} style={{ position: 'relative', background: 'var(--input-bg)', padding: '0.5rem 0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                            <div style={{ position: 'absolute', left: '-1.15rem', top: '10px', background: 'var(--card-bg)', border: '2px solid var(--primary-color)', width: '10px', height: '10px', borderRadius: '50%' }}></div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--heading-color)' }}>{hop.location}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-color)', fontFamily: 'monospace' }}>{hop.deviceName} • {hop.portName}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-color)' }}>No routing hops mapped.</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        <div style={{ background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '0.9rem', color: 'var(--heading-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Ticket History</span>
            <span style={{ color: 'var(--text-color)', fontSize: '0.7rem' }}>ʌ</span>
          </h3>
          <ul style={{ listStyle: 'none', margin: '0 0 1rem 0', padding: 0, display: 'flex', flexDirection: 'column' }}>
            {(!ticket.historyLogs || ticket.historyLogs.length === 0) && (
              <li style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No history entries logged yet.</li>
            )}
            {ticket.historyLogs?.slice(0, 5).map(log => {
               const d = new Date(log.createdAt);
               const dateStr = d.toLocaleDateString('en-CA');
               const timeStr = d.toLocaleTimeString('en-GB', {hour12: false});
               const authorName = log.actor?.name || log.actor?.email?.split('@')[0] || 'System';
               return (
                <li key={log.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '1rem', paddingBottom: '1rem', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', color: 'var(--text-color)', fontSize: '0.75rem', lineHeight: '1.4' }}>
                    <span>{mounted ? dateStr : '...'}</span>
                    <span>{mounted ? timeStr : '...'}</span>
                  </div>
                  <div style={{ color: 'var(--heading-color)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                    <span>{log.action}</span><br/>
                    <span style={{ color: 'var(--text-color)' }}>by {authorName}</span>
                  </div>
                </li>
               );
            })}
          </ul>
          {ticket.historyLogs?.length > 5 && (
            <button onClick={() => setShowHistoryModal(true)} style={{ width: '100%', padding: '0.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
              View Full History ({ticket.historyLogs.length})
            </button>
          )}
        </div>

      </div>

      {showHistoryModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem', backdropFilter: 'blur(2px)' }}>
          <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--heading-color)' }}>Full Audit History</h2>
              <button onClick={() => setShowHistoryModal(false)} style={{ background: 'var(--hover-bg)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', color: 'var(--heading-color)', fontWeight: 'bold' }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '1rem' }}>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
                {ticket.historyLogs.map(log => {
                   const d = new Date(log.createdAt);
                   const dateStr = d.toLocaleDateString('en-CA');
                   const timeStr = d.toLocaleTimeString('en-GB', {hour12: false});
                   const authorName = log.actor?.name || log.actor?.email?.split('@')[0] || 'System';
                   return (
                    <li key={log.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '1rem', paddingBottom: '1.25rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', color: 'var(--text-color)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--heading-color)' }}>{mounted ? dateStr : '...'}</span>
                        <span>{mounted ? timeStr : '...'}</span>
                      </div>
                      <div style={{ color: 'var(--heading-color)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                        <span style={{ fontWeight: '500' }}>{log.action}</span><br/>
                        <span style={{ color: 'var(--text-color)', fontSize: '0.8rem' }}>Actor: <strong style={{color:'var(--heading-color)'}}>{authorName}</strong></span>
                      </div>
                    </li>
                   );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
