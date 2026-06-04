"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AsyncSearchSelect from "@/components/AsyncSearchSelect";
import SearchableSelect from "@/components/SearchableSelect";

export default function TicketForm({ departments, categories, users = [], customFields, services, serviceTemplates, companies = ["ION", "SDC", "Sistercompany"], defaultTargetDeptId }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customDataState, setCustomDataState] = useState({});
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    departmentId: defaultTargetDeptId || departments[0]?.id || '',
    assigneeId: '',
    jobCategoryId: '',
    enableSla: false,
    slaTimerMins: 15
  });
  const [file, setFile] = useState(null);
  const [hasDowntime, setHasDowntime] = useState(false);
  const [downtimeStart, setDowntimeStart] = useState("");
  const [downtimeEnd, setDowntimeEnd] = useState("");

  const getDowntimeDuration = () => {
    if (!downtimeStart || !downtimeEnd) return null;
    const start = new Date(downtimeStart);
    const end = new Date(downtimeEnd);
    const diffMs = end - start;
    if (diffMs < 0) return { error: "Waktu selesai tidak boleh sebelum waktu mulai!" };
    const diffMins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return {
      minutes: diffMins,
      text: `${hrs > 0 ? `${hrs} jam ` : ''}${mins} menit (${diffMins} menit)`
    };
  };

  const [visibleCustomFieldIds, setVisibleCustomFieldIds] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [serviceSearchTerm, setServiceSearchTerm] = useState("");
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const serviceWrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutsideService(event) {
      if (serviceWrapperRef.current && !serviceWrapperRef.current.contains(event.target)) {
        setIsServiceDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutsideService);
    return () => document.removeEventListener("mousedown", handleClickOutsideService);
  }, []);

  const filteredServices = (services || []).filter(s => {
    const searchLower = serviceSearchTerm.toLowerCase();
    const customerName = s.customer?.name?.toLowerCase() || "";
    const serviceName = s.name?.toLowerCase() || "";
    const serviceId = String(s.id);
    return customerName.includes(searchLower) || serviceName.includes(searchLower) || serviceId.includes(searchLower);
  });

  const unselectedServices = filteredServices.filter(s => !selectedServiceIds.includes(s.id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

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
      } else {
        alert("File upload failed.");
        setIsSubmitting(false);
        return;
      }
    }

    const duration = hasDowntime ? getDowntimeDuration() : null;
    const finalCustomData = {
      ...customDataState,
      hasDowntime: hasDowntime,
      startDowntime: hasDowntime ? downtimeStart : null,
      endDowntime: hasDowntime ? downtimeEnd : null,
      downtimeMinutes: (hasDowntime && duration && !duration.error) ? duration.minutes : 0
    };

    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formData, customData: finalCustomData, attachmentUrl, attachmentName, serviceIds: selectedServiceIds })
    });

    if (res.ok) {
      router.push("/tickets");
      router.refresh();
    } else {
      alert("Failed to create ticket.");
    }
    setIsSubmitting(false);
  };

  const renderCustomFieldWithChildren = (field) => {
    // Only render if it's required OR explicitly injected by the user via Opt-In
    if (!field.required && !visibleCustomFieldIds.includes(field.id)) return null;

    const children = customFields.filter(f => f.position === `below_custom_${field.id}`);
    return (
      <div key={field.id} style={{ display: 'contents' }}>
        <div style={{ gridColumn: field.type === 'textarea' ? '1 / -1' : 'auto' }}>
          <label style={{ display: 'block', color: '#475569', fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            {field.name} {field.required && <span style={{color: '#ef4444'}}>*</span>}
          </label>
          {(field.type === 'text' || field.type === 'date') && (
            <input type={field.type} style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--input-bg)', color: 'var(--input-text)' }} required={field.required} value={customDataState[field.name] || ''} onChange={e => setCustomDataState({...customDataState, [field.name]: e.target.value})} />
          )}
          {field.type === 'textarea' && (
            <textarea rows="3" style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '4px', resize: 'vertical', background: 'var(--input-bg)', color: 'var(--input-text)' }} required={field.required} value={customDataState[field.name] || ''} onChange={e => setCustomDataState({...customDataState, [field.name]: e.target.value})}></textarea>
          )}
          {field.type === 'select' && field.options?.trim() === '@Customers' ? (
            <AsyncSearchSelect
              value={customDataState[field.name] || ''}
              onChange={(val) => setCustomDataState({...customDataState, [field.name]: val})}
              placeholder="Search Customer ID/Name (Min 3 chars)..."
              apiRoute="/api/assets/customers/search"
              disabled={false}
            />
          ) : field.type === 'select' && (
            <select style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--input-bg)', color: 'var(--input-text)' }} required={field.required} value={customDataState[field.name] || ''} onChange={e => setCustomDataState({...customDataState, [field.name]: e.target.value})}>
              <option value="">-- Select --</option>
              {(field.options === '@ServiceTemplates' 
                  ? (serviceTemplates || []).map(st => st.name) 
                  : field.options?.split(',').map(s => s.trim()) || []
               ).map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          )}
        </div>
        {children.map(renderCustomFieldWithChildren)}
      </div>
    );
  };

  const renderCustomFields = (position) => {
    if (!customFields) return null;
    const fields = customFields.filter(f => (f.position === position) || (position === 'bottom' && (!f.position || f.position === 'bottom')));
    
    // Only verify non-empty elements after recursive required validations
    const renderableFields = fields.filter(f => f.required || visibleCustomFieldIds.includes(f.id));
    if (renderableFields.length === 0) return null;

    return (
      <div className="form-group" style={{ gridColumn: '1 / -1', borderTop: position === 'bottom' ? '1px solid #e2e8f0' : 'none', paddingTop: position === 'bottom' ? '1.5rem' : '0', marginBottom: position !== 'bottom' ? '0.5rem' : '0', background: position !== 'bottom' ? '#f8fafc' : 'transparent', padding: position !== 'bottom' ? '1.5rem' : '0', borderRadius: position !== 'bottom' ? '8px' : '0' }}>
        {position === 'bottom' && <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#1e293b' }}>Additional Information</h3>}
        {position !== 'bottom' && <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Required Parameters</h4>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {fields.map(renderCustomFieldWithChildren)}
        </div>
      </div>
    );
  };

  const optionalFields = customFields?.filter(f => !f.required && !visibleCustomFieldIds.includes(f.id)) || [];

  return (
    <form className="card" onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)', gap: '2rem', padding: '2.5rem', position: 'relative' }}>
      
      {optionalFields.length > 0 && (
        <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '-0.5rem', marginBottom: '-0.5rem', display: 'flex', justifyContent: 'flex-end', zIndex: 10 }}>
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

      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
        <label style={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '0.75rem' }}>Customer / Reporter Name</label>
        <AsyncSearchSelect
          value={customDataState["Customer Name"] || ''}
          onChange={(val) => setCustomDataState({...customDataState, "Customer Name": val})}
          placeholder="Cari nama Customer dari Asset Inventory atau ketik manual..."
          apiRoute="/api/assets/customers/search"
          disabled={false}
        />
      </div>

      <div className="form-group" style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', background: '#f1f5f9', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
        <div>
          <label style={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🏢 Order Origin (Company)
          </label>
              <select 
                value={customDataState["Order Origin"] || ""} 
                onChange={(e) => setCustomDataState({...customDataState, "Order Origin": e.target.value})}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1rem', color: '#334155' }}
              >
                <option value="">-- General / Non-Group --</option>
                {companies.map((c, i) => <option key={`origin-${i}`} value={c}>{c}</option>)}
              </select>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>Entitas komersial penerima order asli.</p>
        </div>
        <div>
          <label style={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🛠️ Executing Vendor
          </label>
              <select 
                value={customDataState["Executing Vendor"] || ""} 
                onChange={(e) => setCustomDataState({...customDataState, "Executing Vendor": e.target.value})}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1rem', color: '#334155' }}
              >
                <option value="">-- Self Executed / Non-Group --</option>
                {companies.map((c, i) => <option key={`vendor-${i}`} value={c}>{c}</option>)}
              </select>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>Unit teknis yang mengeksekusi tiket ini.</p>
        </div>
      </div>

      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
        <label style={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '0.75rem' }}>Subject</label>
        <input 
          type="text" 
          placeholder="Enter a concise summary of the issue..."
          value={formData.title} 
          onChange={e => setFormData({...formData, title: e.target.value})} 
          required 
        />
      </div>
      
      {renderCustomFields('below_subject')}
      
      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
        <label style={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '0.75rem' }}>Message Content</label>
        <textarea 
          rows="14" 
          placeholder="Describe the issue in detail. Please include any relevant steps to reproduce, server names, or error logs..."
          value={formData.description} 
          onChange={e => setFormData({...formData, description: e.target.value})} 
          required
        ></textarea>
      </div>

      {renderCustomFields('below_description')}
      
      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
        <label style={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '0.75rem' }}>Priority</label>
        <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical - Outage</option>
        </select>
      </div>

      {renderCustomFields('below_priority')}
      
      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
        <label style={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '0.75rem' }}>Department</label>
        <SearchableSelect 
          options={departments.map(d => ({ value: d.id, label: d.name }))}
          value={formData.departmentId}
          onChange={val => setFormData({ ...formData, departmentId: val ? parseInt(val) : '' })}
          placeholder="-- Select Department --"
          required
        />
      </div>

      {renderCustomFields('below_department')}

      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
        <label style={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '0.75rem' }}>Assignee (PIC / NOC Staff - Optional)</label>
        <SearchableSelect 
          options={users.map(u => ({ value: u.id, label: u.name || u.email }))}
          value={formData.assigneeId}
          onChange={val => setFormData({ ...formData, assigneeId: val ? parseInt(val) : '' })}
          placeholder="-- Select PIC (Leave empty for Auto-Assignment) --"
        />
        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
          Pilih staf NOC secara manual, atau biarkan kosong untuk penugasan otomatis (Round-Robin).
        </p>
      </div>

      <div className="form-group" style={{ gridColumn: '1 / -1' }} ref={serviceWrapperRef}>
        <label style={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '0.75rem' }}>Impacting Services (Optional Link)</label>
        
        {/* Selected Services Badges */}
        {selectedServiceIds.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {selectedServiceIds.map(id => {
              const s = services?.find(srv => srv.id === id);
              if (!s) return null;
              return (
                <span 
                  key={s.id} 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.35rem', 
                    background: '#e0f2fe', 
                    color: '#0369a1', 
                    padding: '0.35rem 0.75rem', 
                    borderRadius: '9999px', 
                    fontSize: '0.85rem', 
                    fontWeight: 'bold',
                    border: '1px solid #bae6fd' 
                  }}
                >
                  <span>{s.customer?.name}: {s.name} (ID: {s.id})</span>
                  <button 
                    type="button" 
                    onClick={() => setSelectedServiceIds(selectedServiceIds.filter(x => x !== s.id))}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: '#0284c7', 
                      cursor: 'pointer', 
                      fontSize: '1rem', 
                      lineHeight: 1, 
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%'
                    }}
                  >
                    ✕
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Search Input & Dropdown */}
        <div style={{ position: 'relative' }}>
          <input 
            type="text"
            placeholder="Type customer or service name to link services..."
            value={serviceSearchTerm}
            onChange={e => {
              setServiceSearchTerm(e.target.value);
              setIsServiceDropdownOpen(true);
            }}
            onFocus={() => setIsServiceDropdownOpen(true)}
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              border: '1px solid var(--border-color, #cbd5e1)', 
              borderRadius: '4px', 
              background: 'var(--input-bg, white)', 
              color: 'var(--input-text, #0f172a)',
              outline: 'none',
              fontSize: '0.95rem'
            }}
          />
          
          {isServiceDropdownOpen && (
            <div 
              style={{ 
                position: 'absolute', 
                top: '100%', 
                left: 0, 
                right: 0, 
                marginTop: '4px', 
                background: 'var(--card-bg, white)', 
                border: '1px solid var(--border-color, #cbd5e1)', 
                borderRadius: '4px', 
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
                zIndex: 99, 
                maxHeight: '200px', 
                overflowY: 'auto' 
              }}
            >
              {unselectedServices.length > 0 ? (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {unselectedServices.map(s => (
                    <li 
                      key={s.id}
                      onClick={() => {
                        setSelectedServiceIds([...selectedServiceIds, s.id]);
                        setServiceSearchTerm("");
                        setIsServiceDropdownOpen(false);
                      }}
                      style={{ 
                        padding: '0.75rem', 
                        cursor: 'pointer', 
                        borderBottom: '1px solid var(--border-color, #f1f5f9)', 
                        fontSize: '0.9rem', 
                        color: 'var(--text-color, #334155)'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg, #f1f5f9)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <strong style={{ color: '#0f172a' }}>{s.customer?.name}</strong>: {s.name} <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>(ID: {s.id})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ padding: '0.75rem', color: '#64748b', fontSize: '0.9rem', textAlign: 'center' }}>
                  {services && services.length > 0 ? "No matching unlinked services" : "No active services found in Inventory."}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Downtime Tracking Block */}
      <div className="form-group" style={{ gridColumn: '1 / -1', background: 'var(--hover-bg, #f8fafc)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: 'bold', color: '#1e293b' }}>
          <input 
            type="checkbox" 
            checked={hasDowntime} 
            onChange={e => setHasDowntime(e.target.checked)} 
            style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
          />
          🚨 Catat Waktu Outage / Downtime (Trouble Ticket)
        </label>
        
        {hasDowntime && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginTop: '0.5rem' }}>
            <div>
              <label style={{ display: 'block', color: '#475569', fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Mulai Downtime</label>
              <input 
                type="datetime-local" 
                value={downtimeStart} 
                onChange={e => setDowntimeStart(e.target.value)} 
                required={hasDowntime}
                style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: 'var(--input-bg)', color: 'var(--input-text)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#475569', fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Selesai Downtime</label>
              <input 
                type="datetime-local" 
                value={downtimeEnd} 
                onChange={e => setDowntimeEnd(e.target.value)} 
                required={hasDowntime}
                style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: 'var(--input-bg)', color: 'var(--input-text)' }}
              />
            </div>
            
            {downtimeStart && downtimeEnd && (
              <div style={{ gridColumn: '1 / -1', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.9rem', color: '#166534', fontWeight: 'bold' }}>
                {(() => {
                  const duration = getDowntimeDuration();
                  if (duration?.error) {
                    return <span style={{ color: '#ef4444' }}>⚠️ {duration.error}</span>;
                  }
                  return <span>⏱️ Total Durasi Downtime: {duration?.text}</span>;
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
        <label style={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '0.75rem' }}>Job Category (Optional)</label>
        <SearchableSelect 
          options={categories?.map(c => ({ value: c.id, label: `${c.name} (+${c.score} pts)` })) || []}
          value={formData.jobCategoryId}
          onChange={val => setFormData({ ...formData, jobCategoryId: val ? parseInt(val) : '' })}
          placeholder="-- Select Category --"
        />
      </div>

      {renderCustomFields('below_job_category')}

      {/* SLA Opt-In Block */}
      <div className="form-group" style={{ gridColumn: '1 / -1', background: '#fef3c7', padding: '1.5rem', borderRadius: '8px', border: '1px solid #fde68a', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: 'bold', color: '#92400e' }}>
          <input 
            type="checkbox" 
            checked={formData.enableSla} 
            onChange={e => setFormData({...formData, enableSla: e.target.checked})} 
            style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
          />
          Enable External SLA Tracking (Follow-Up Timer)
        </label>
        {formData.enableSla && (
          <div style={{ paddingLeft: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.9rem', color: '#92400e' }}>Timer Duration:</span>
            <input 
              type="number" 
              value={formData.slaTimerMins} 
              onChange={e => setFormData({...formData, slaTimerMins: parseInt(e.target.value)})} 
              min="5" max="1440" 
              style={{ padding: '0.5rem', width: '80px', border: '1px solid #fcd34d', borderRadius: '4px' }}
            />
            <span style={{ fontSize: '0.9rem', color: '#92400e' }}>Minutes (Default: 15)</span>
          </div>
        )}
      </div>

      {renderCustomFields('bottom')}

      <div className="form-group" style={{ gridColumn: '1 / -1', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
        <label style={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '0.75rem' }}>Attach File (optional)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
          <input type="file" onChange={e => setFile(e.target.files[0])} style={{ padding: '0.5rem', border: 'none', background: 'transparent', width: '100%', cursor: 'pointer' }} />
          {file && <span style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Ready to upload ✓</span>}
        </div>
      </div>

      <div style={{ gridColumn: '1 / -1', marginTop: '1.5rem' }}>
        <button type="submit" className="primary-btn" disabled={isSubmitting} style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', background: '#2563eb' }}>
          {isSubmitting ? 'Submitting Pipeline...' : 'Create Support Ticket'}
        </button>
      </div>
    </form>
  );
}
