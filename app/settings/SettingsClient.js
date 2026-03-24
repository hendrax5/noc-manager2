"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function SettingsClient({ initialFields, initialCategories, initialConfig }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("custom_fields");
  const [fields, setFields] = useState(initialFields);
  const [categories, setCategories] = useState(initialCategories || []);
  
  const [branding, setBranding] = useState(initialConfig || {
    appName: "NOC Manager",
    loginTitle: "Welcome",
    loginSubtitle: "Sign in"
  });
  
  const [wipeOpts, setWipeOpts] = useState({
    wipeTransactional: true,
    wipeAssets: false,
    wipeUsers: false
  });
  
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef(null);
  
  const [newField, setNewField] = useState({ name: "", type: "text", options: "", position: "bottom", required: false });
  const [newCat, setNewCat] = useState({ name: "", score: "" });

  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editCategoryData, setEditCategoryData] = useState({ name: "", score: "", active: true });

  const [editingFieldId, setEditingFieldId] = useState(null);
  const [editFieldData, setEditFieldData] = useState({ name: "", type: "text", options: "", position: "bottom", required: false, active: true });

  const handleAddField = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/settings/fields", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newField)
    });
    const saved = await res.json();
    setFields([...fields, saved]);
    setNewField({ name: "", type: "text", options: "", position: "bottom", required: false });
    router.refresh();
  };

  const handleDeleteField = async (id) => {
    if(confirm("Delete this custom field? Existing ticket data will NOT be deleted, but the field will no longer appear.")){
      await fetch(`/api/settings/fields/${id}`, { method: "DELETE" });
      setFields(fields.filter(f => f.id !== id));
      router.refresh();
    }
  };

  const handleEditField = (field) => {
    setEditingFieldId(field.id);
    setEditFieldData({ name: field.name, type: field.type, options: field.options || "", position: field.position || "bottom", required: field.required, active: field.active !== false });
  };

  const handleSaveField = async (id) => {
    const res = await fetch(`/api/settings/fields/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editFieldData)
    });
    if (res.ok) {
      const updated = await res.json();
      setFields(fields.map(f => f.id === id ? updated : f));
      setEditingFieldId(null);
      router.refresh();
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/settings/job-categories", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newCat)
    });
    const saved = await res.json();
    setCategories([...categories, saved]);
    setNewCat({ name: "", score: "" });
    router.refresh();
  };

  const handleDeleteCategory = async (id) => {
    if(confirm("Delete this Job Category? It might orphan previously resolved tickets missing native historical scores if unresolved.")){
      await fetch(`/api/settings/job-categories/${id}`, { method: "DELETE" });
      setCategories(categories.filter(c => c.id !== id));
      router.refresh();
    }
  };

  const handleEditCategory = (cat) => {
    setEditingCategoryId(cat.id);
    setEditCategoryData({ name: cat.name, score: cat.score, active: cat.active });
  };

  const handleSaveCategory = async (id) => {
    const res = await fetch(`/api/settings/job-categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editCategoryData)
    });
    if (res.ok) {
      const updated = await res.json();
      setCategories(categories.map(c => c.id === id ? updated : c));
      setEditingCategoryId(null);
      router.refresh();
    }
  };

  const handleSaveBranding = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/settings/branding", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(branding)
    });
    if (res.ok) {
      alert("Branding configuration updated successfully!");
      router.refresh();
    }
  };

  const handleBackup = () => {
    window.location.href = "/api/settings/database/backup";
  };

  const handleRestoreUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm("CRITICAL WARNING: Restoring from a backup will DESTROY all current database contents and replace them precisely with the JSON snapshot! Are you absolutely sure?")) {
      e.target.value = "";
      return;
    }

    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const backupStr = event.target.result;
      try {
        const res = await fetch("/api/settings/database/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backupStr })
        });
        if (res.ok) {
          alert("Database Restoration Completed Successfully! The system will now reload.");
          window.location.href = "/";
        } else {
          const err = await res.json();
          alert("Restore Failed: " + err.error);
        }
      } catch (err) {
        alert("Restore Crash: " + err.message);
      }
      setIsRestoring(false);
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleWipeDatabase = async () => {
    const confirmation = prompt(`WARNING: This is a DESTRUCTIVE operation!\n\nOptions selected:\n- Transactions/Tickets: ${wipeOpts.wipeTransactional}\n- Asset Topologies:     ${wipeOpts.wipeAssets}\n- User Database:        ${wipeOpts.wipeUsers}\n\nPlease type "CONFIRM" exactly to permanently DESTROY selected records.`);
    if (confirmation !== "CONFIRM") {
      alert("Database Wipe Aborted. Incorrect confirmation phrase.");
      return;
    }
    
    try {
       const res = await fetch("/api/settings/database/wipe", {
         method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(wipeOpts)
       });
       if (res.ok) {
         alert("Database Wipe Completed Successfully! You will be redirected.");
         window.location.href = "/dashboard";
       } else {
         const err = await res.json();
         alert("Wipe Failed: " + err.error);
       }
    } catch (e) {
       console.error("Wipe crash", e);
    }
  };

  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: '#f8fafc' }}>
        {['custom_fields', 'job_categories', 'preferences'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{ 
              flex: 1, padding: '1rem', border: 'none', background: activeTab === tab ? 'white' : 'transparent', 
              borderBottom: activeTab === tab ? '3px solid var(--primary-color)' : '3px solid transparent',
              fontWeight: activeTab === tab ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1rem', textTransform: 'capitalize', transition: 'all 0.2s'
            }}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div style={{ padding: '2rem' }}>
        {activeTab === 'custom_fields' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2>Ticket Custom Fields</h2>
              <p style={{ color: '#64748b', marginBottom: '0.5rem' }}>Define extra variables for users to fill out when creating a new ticket.</p>
            </div>
            
            <form onSubmit={handleAddField} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 150px minmax(200px, 1fr) 180px 100px auto', gap: '1rem', marginBottom: '2rem', background: '#f1f5f9', padding: '1.5rem', borderRadius: '6px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 'bold' }}>Field Name</label>
                <input type="text" required value={newField.name} onChange={e => setNewField({...newField, name: e.target.value})} style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} placeholder="e.g. Server Node ID" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 'bold' }}>Input Type</label>
                <select value={newField.type} onChange={e => setNewField({...newField, type: e.target.value})} style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                  <option value="text">Text Box</option>
                  <option value="textarea">Text Area</option>
                  <option value="date">Date Picker</option>
                  <option value="select">Dropdown Menu</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 'bold' }}>Dropdown Params</label>
                <input type="text" value={newField.options} onChange={e => setNewField({...newField, options: e.target.value})} disabled={newField.type !== 'select'} style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px', opacity: newField.type === 'select' ? 1 : 0.5 }} placeholder="Linux, Windows, MacOS" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 'bold' }}>Positioning</label>
                <select value={newField.position} onChange={e => setNewField({...newField, position: e.target.value})} style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                  <option value="bottom">Default (Below Attachments)</option>
                  <option value="below_subject">Below Subject</option>
                  <option value="below_description">Below Message Content</option>
                  <option value="below_priority">Below Priority</option>
                  <option value="below_department">Below Department</option>
                  <option value="below_job_category">Below Job Category</option>
                  {fields.map(f => <option key={f.id} value={`below_custom_${f.id}`}>Below Custom: {f.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', height: '38px', gap: '0.5rem' }}>
                <input type="checkbox" checked={newField.required} onChange={e => setNewField({...newField, required: e.target.checked})} id="required_cb" />
                <label htmlFor="required_cb" style={{ fontSize: '0.9rem', cursor: 'pointer', fontWeight: 'bold' }}>Required</label>
              </div>
              <button type="submit" className="primary-btn" style={{ padding: '0.6rem 1rem', height: '38px' }}>+ Add Field</button>
            </form>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Dynamic Parameter Name</th>
                  <th>Input Architecture</th>
                  <th>Enumerations (For Selects)</th>
                  <th>Position</th>
                  <th>Constraint</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {fields.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No custom fields added.</td></tr>}
                {fields.map(f => {
                  if (editingFieldId === f.id) {
                    return (
                      <tr key={f.id}>
                        <td><input type="text" value={editFieldData.name} onChange={e => setEditFieldData({...editFieldData, name: e.target.value})} style={{ width: '100%', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} /></td>
                        <td>
                          <select value={editFieldData.type} onChange={e => setEditFieldData({...editFieldData, type: e.target.value})} style={{ width: '100%', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                            <option value="text">Text Box</option>
                            <option value="textarea">Text Area</option>
                            <option value="date">Date Picker</option>
                            <option value="select">Dropdown Menu</option>
                          </select>
                        </td>
                        <td><input type="text" value={editFieldData.options} onChange={e => setEditFieldData({...editFieldData, options: e.target.value})} disabled={editFieldData.type !== 'select'} style={{ width: '100%', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} /></td>
                        <td>
                          <select value={editFieldData.position} onChange={e => setEditFieldData({...editFieldData, position: e.target.value})} style={{ width: '100%', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                            <option value="bottom">Below Attachments</option>
                            <option value="below_subject">Below Subject</option>
                            <option value="below_description">Below Message</option>
                            <option value="below_priority">Below Priority</option>
                            <option value="below_department">Below Department</option>
                            <option value="below_job_category">Below Job Category</option>
                            {fields.map(cf => f.id !== cf.id ? <option key={cf.id} value={`below_custom_${cf.id}`}>Below: {cf.name}</option> : null)}
                          </select>
                        </td>
                        <td><input type="checkbox" checked={editFieldData.required} onChange={e => setEditFieldData({...editFieldData, required: e.target.checked})} /> Req</td>
                        <td style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleSaveField(f.id)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
                          <button onClick={() => setEditingFieldId(null)} style={{ background: '#64748b', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={f.id}>
                      <td style={{ fontWeight: '600' }}>{f.name}</td>
                      <td><span className="badge" style={{ background: '#3b82f6', textTransform: 'uppercase' }}>{f.type}</span></td>
                      <td style={{ color: '#64748b' }}>{f.options || '-'}</td>
                      <td><span className="badge" style={{ background: '#94a3b8' }}>{f.position?.replace('_', ' ') || 'bottom'}</span></td>
                      <td>{f.required ? <strong style={{ color: '#ef4444' }}>Mandatory</strong> : 'Optional'}</td>
                      <td>
                        <select defaultValue="" onChange={(e) => {
                          if (e.target.value === 'edit') handleEditField(f);
                          if (e.target.value === 'delete') handleDeleteField(f.id);
                          e.target.value = '';
                        }} style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', background: '#f8fafc', fontWeight: 'bold' }}>
                          <option value="" disabled>Actions ▾</option>
                          <option value="edit">✎ Edit</option>
                          <option value="delete">🗑 Delete</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'job_categories' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2>Job Performance Categories</h2>
              <p style={{ color: '#64748b', marginBottom: '0.5rem' }}>Assign specific scores to various task domains. Score rewards are processed automatically upon resolution.</p>
            </div>
            
            <form onSubmit={handleAddCategory} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 150px auto', gap: '1rem', marginBottom: '2rem', background: '#f1f5f9', padding: '1.5rem', borderRadius: '6px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 'bold' }}>Job Descriptor</label>
                <input type="text" required value={newCat.name} onChange={e => setNewCat({...newCat, name: e.target.value})} style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} placeholder="e.g. Metro Diagnostics" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 'bold' }}>Score Value</label>
                <input type="number" required value={newCat.score} onChange={e => setNewCat({...newCat, score: e.target.value})} style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} placeholder="e.g. 10" />
              </div>
              <button type="submit" className="primary-btn" style={{ padding: '0.6rem 1rem', height: '38px', background: '#10b981' }}>+ Register Category</button>
            </form>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Target Operation / Job String</th>
                  <th>Evaluated Point Metric</th>
                  <th>Active Toggle</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No point-based job categories established natively.</td></tr>}
                {categories.map(c => {
                  if (editingCategoryId === c.id) {
                    return (
                      <tr key={c.id}>
                        <td>
                          <input type="text" value={editCategoryData.name} onChange={e => setEditCategoryData({...editCategoryData, name: e.target.value})} style={{ width: '100%', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                        </td>
                        <td>
                          <input type="number" value={editCategoryData.score} onChange={e => setEditCategoryData({...editCategoryData, score: e.target.value})} style={{ width: '100px', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                        </td>
                        <td>
                          <select value={editCategoryData.active ? 'true' : 'false'} onChange={e => setEditCategoryData({...editCategoryData, active: e.target.value === 'true'})} style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                            <option value="true">Operational</option>
                            <option value="false">Frozen</option>
                          </select>
                        </td>
                        <td style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleSaveCategory(c.id)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
                          <button onClick={() => setEditingCategoryId(null)} style={{ background: '#64748b', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: '600' }}>{c.name}</td>
                      <td><span className="badge" style={{ background: '#10b981', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>+ {c.score} Pts</span></td>
                      <td style={{ color: '#64748b' }}>{c.active ? '🟢 Operational' : '🔴 Frozen'}</td>
                      <td>
                        <select defaultValue="" onChange={(e) => {
                          if (e.target.value === 'edit') handleEditCategory(c);
                          if (e.target.value === 'delete') handleDeleteCategory(c.id);
                          e.target.value = '';
                        }} style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', background: '#f8fafc', fontWeight: 'bold' }}>
                          <option value="" disabled>Actions ▾</option>
                          <option value="edit">✎ Edit</option>
                          <option value="delete">🗑 Delete</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ color: 'var(--heading-color)', marginBottom: '0.2rem' }}>Application Branding (White-labeling)</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Customize text artifacts rendering natively across standard client views.</p>
              
              <form onSubmit={handleSaveBranding} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.5rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'revert', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 'bold' }}>Dashboard App Name (Sidebar Header)</label>
                    <input type="text" value={branding.appName} onChange={e => setBranding({...branding, appName: e.target.value})} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--input-bg)' }} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 'bold' }}>Login Panel Title</label>
                    <input type="text" value={branding.loginTitle} onChange={e => setBranding({...branding, loginTitle: e.target.value})} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--input-bg)' }} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 'bold' }}>Login Panel Subtitle</label>
                    <input type="text" value={branding.loginSubtitle} onChange={e => setBranding({...branding, loginSubtitle: e.target.value})} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--input-bg)' }} />
                  </div>
                  <div style={{ borderTop: '1px dotted var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', fontWeight: 'bold' }}>Multi-Company Routing Identities (Comma-separated)</label>
                    <input type="text" value={branding.companyNames || "ION, SDC, Sistercompany"} onChange={e => setBranding({...branding, companyNames: e.target.value})} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--input-bg)' }} placeholder="e.g. ION, SDC, Subsidiary Group" />
                    <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>Defines dropdown options for 'Order Origin' and 'Executing Vendor' when creating or filtering tickets.</p>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.5rem' }}>
                   <button type="submit" className="primary-btn" style={{ background: '#3b82f6', padding: '0.6rem 2rem' }}>Apply Branding Config</button>
                </div>
              </form>
            </div>

            <div style={{ marginTop: '3rem', borderTop: '2px dashed #f87171', paddingTop: '2rem' }}>
              <h2 style={{ color: '#ef4444', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>☢️</span> System Core Wipes & Restorations
              </h2>
              <p style={{ color: '#b91c1c', fontSize: '0.9rem', marginBottom: '1.5rem', fontWeight: 'bold' }}>Destructive Operations. Data erased via these functions CANNOT be mathematically recovered.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#166534' }}>Export Database (Backup)</h3>
                    <p style={{ color: '#15803d', fontSize: '0.85rem' }}>Download a complete pure JSON snapshot of the entire operational PostgreSQL database, universally portable.</p>
                  </div>
                  <button onClick={handleBackup} style={{ background: '#22c55e', color: 'white', fontWeight: 'bold', padding: '0.8rem 2rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem', marginTop: '1rem', boxShadow: '0 4px 6px -1px rgba(34, 197, 94, 0.4)' }}>
                    Download Schema & Data (.json)
                  </button>
                </div>
                
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e3a8a' }}>Import Database (Restore)</h3>
                    <p style={{ color: '#1d4ed8', fontSize: '0.85rem' }}>Upload a `.json` backup. This will <strong style={{color:'#dc2626'}}>DESTROY</strong> the current DB schema and inject the JSON payload strictly mapping original Sequence IDs.</p>
                  </div>
                  <div>
                    <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleRestoreUpload} />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isRestoring} style={{ width: '100%', background: '#3b82f6', color: 'white', fontWeight: 'bold', padding: '0.8rem 2rem', border: 'none', borderRadius: '6px', cursor: isRestoring ? 'wait' : 'pointer', fontSize: '1rem', marginTop: '1rem', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.4)', opacity: isRestoring ? 0.7 : 1 }}>
                      {isRestoring ? 'Injecting Nodes...' : 'Upload & Restore (.json)'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                 <h3 style={{ margin: 0, color: '#991b1b', borderBottom: '1px solid #fecaca', paddingBottom: '0.5rem' }}>Manual Factory Reset Selection</h3>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', padding: '0.8rem', background: 'var(--card-bg)', borderRadius: '6px', border: '1px solid #fecaca' }}>
                   <input type="checkbox" checked={wipeOpts.wipeTransactional} onChange={e => setWipeOpts({...wipeOpts, wipeTransactional: e.target.checked})} style={{ width: '1.2rem', height: '1.2rem', accentColor: '#ef4444' }} />
                   <div>
                     <strong style={{ display: 'block', color: '#991b1b' }}>Wipe Transactional Data (Tickets, Reports, Meetings & Logs)</strong>
                     <span style={{ fontSize: '0.8rem', color: '#dc2626' }}>Destroys all history related to incidents and communications.</span>
                   </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', padding: '0.8rem', background: 'var(--card-bg)', borderRadius: '6px', border: '1px solid #fecaca' }}>
                   <input type="checkbox" checked={wipeOpts.wipeAssets} onChange={e => setWipeOpts({...wipeOpts, wipeAssets: e.target.checked})} style={{ width: '1.2rem', height: '1.2rem', accentColor: '#ef4444' }} />
                   <div>
                     <strong style={{ display: 'block', color: '#991b1b' }}>Wipe Master Assets (Customers, Active Services, Port Topologies)</strong>
                     <span style={{ fontSize: '0.8rem', color: '#dc2626' }}>Destroys established inventory topologies completely.</span>
                   </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', padding: '0.8rem', background: 'var(--card-bg)', borderRadius: '6px', border: '1px solid #fecaca' }}>
                   <input type="checkbox" checked={wipeOpts.wipeUsers} onChange={e => setWipeOpts({...wipeOpts, wipeUsers: e.target.checked})} style={{ width: '1.2rem', height: '1.2rem', accentColor: '#ef4444' }} />
                   <div>
                     <strong style={{ display: 'block', color: '#991b1b' }}>Wipe Human Resources (Users database EXCEPT your own Admin account)</strong>
                     <span style={{ fontSize: '0.8rem', color: '#dc2626' }}>Disconnects all staffs. Retains structural roles/departments.</span>
                   </div>
                </label>

                <div style={{ marginTop: '1rem', borderTop: '1px solid #fca5a5', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <p style={{ fontSize: '0.85rem', color: '#7f1d1d', margin: 0, flex: 1 }}>Execute deletion matrix by typing confirmation passphrase natively mapped in backend.</p>
                   <button onClick={handleWipeDatabase} style={{ background: '#dc2626', color: 'white', fontWeight: 'bold', padding: '0.8rem 2rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1.05rem', boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.4)' }}>
                      DESTROY SELECTED
                   </button>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
