"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AsyncSearchSelect from "@/components/AsyncSearchSelect";

export default function TicketForm({ departments, categories, customFields, services, serviceTemplates, users, companies = ["ION", "SDC", "Sistercompany"], defaultTargetDeptId }) {
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
    slaTimerMins: 15,
    visibility: "Public",
    permittedDepartmentIds: [],
    rfs: ""
  });
  const [file, setFile] = useState(null);
  const [visibleCustomFieldIds, setVisibleCustomFieldIds] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);

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

    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ...formData, 
        rfs: formData.rfs ? new Date(formData.rfs).toISOString() : null,
        customData: customDataState, 
        attachmentUrl, 
        attachmentName, 
        serviceIds: selectedServiceIds 
      })
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
        <input 
          type="text" 
          placeholder="e.g. Yayasan WFF Indonesia or BPS Pusat..."
          value={customDataState["Customer Name"] || ''} 
          onChange={e => setCustomDataState({...customDataState, "Customer Name": e.target.value})} 
          style={{ width: '100%', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '1rem' }}
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
        <select value={formData.departmentId} onChange={e => setFormData({...formData, departmentId: parseInt(e.target.value)})}>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {renderCustomFields('below_department')}

      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
        <label style={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '0.75rem' }}>Assignee (Optional Override)</label>
        <select value={formData.assigneeId || ''} onChange={e => setFormData({...formData, assigneeId: e.target.value})}>
          <option value="">-- Let System Auto-Assign (Least Busy) --</option>
          {users?.filter(u => u.departmentId === parseInt(formData.departmentId)).map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
        </select>
        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>If left blank, the system will automatically route to the least busy technician in the selected department.</p>
      </div>

      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
        <label style={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '0.75rem' }}>RFS Target (Ready For Service)</label>
        <input 
          type="datetime-local" 
          value={formData.rfs || ''} 
          onChange={e => setFormData({...formData, rfs: e.target.value})} 
          style={{ width: '100%', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '1rem', background: '#f8fafc' }}
        />
        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>Opsional. Tanggal target penyerahan masalah atau instalasi layanan.</p>
      </div>

      <div className="form-group" style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
        <label style={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '0.75rem' }}>Ticket Privacy & Visibility</label>
        <select value={formData.visibility} onChange={e => setFormData({...formData, visibility: e.target.value})} style={{ background: '#f8fafc' }}>
          <option value="Public">🌐 Public (Visible to assigned department & general staff)</option>
          <option value="Private">🔒 Private (Strictly visible only to Creator and specifically Assigned User)</option>
          <option value="Restricted">🏢 Restricted (Visible to Creator, Assignee & explicitly selected Departments)</option>
        </select>
      </div>

      {formData.visibility === 'Restricted' && (
        <div className="form-group" style={{ gridColumn: '1 / -1', background: '#fef2f2', padding: '1rem', borderLeft: '4px solid #ef4444', borderRadius: '6px' }}>
          <label style={{ fontWeight: 'bold', color: '#b91c1c' }}>Permitted Departments</label>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#7f1d1d' }}>Select which departments can view this Restricted ticket.</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
             {departments?.map(dept => (
               <label key={dept.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'white', padding: '0.4rem 0.8rem', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                 <input type="checkbox" checked={formData.permittedDepartmentIds.includes(dept.id)} onChange={(e) => {
                    if (e.target.checked) setFormData({...formData, permittedDepartmentIds: [...formData.permittedDepartmentIds, dept.id]});
                    else setFormData({...formData, permittedDepartmentIds: formData.permittedDepartmentIds.filter(id => id !== dept.id)});
                 }} />
                 {dept.name}
               </label>
             ))}
          </div>
        </div>
      )}

      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
        <label style={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '0.75rem' }}>Impacting Services (Optional Link)</label>
        <div style={{ background: '#f8fafc', padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
           {services?.map(s => (
             <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#334155' }}>
               <input 
                 type="checkbox" 
                 checked={selectedServiceIds.includes(s.id)}
                 onChange={e => {
                   if (e.target.checked) setSelectedServiceIds([...selectedServiceIds, s.id]);
                   else setSelectedServiceIds(selectedServiceIds.filter(id => id !== s.id));
                 }}
                 style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
               />
               <strong style={{ color: '#0f172a' }}>{s.customer?.name}</strong>: {s.name} <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>(ID: {s.id})</span>
             </label>
           ))}
           {(!services || services.length === 0) && (
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>No active services found in Inventory.</div>
           )}
        </div>
      </div>

      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
        <label style={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '0.75rem' }}>Job Category (Optional)</label>
        <select value={formData.jobCategoryId} onChange={e => setFormData({...formData, jobCategoryId: e.target.value})}>
          <option value="">-- Select Category --</option>
          {categories?.map(c => <option key={c.id} value={c.id}>{c.name} (+{c.score} pts)</option>)}
        </select>
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
