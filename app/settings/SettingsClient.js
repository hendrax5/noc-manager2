"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import IntegrationsPanel from "./IntegrationsPanel";

export default function SettingsClient({ initialFields, initialCategories, initialConfig, departments = [] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("custom_fields");
  const [fields, setFields] = useState(initialFields);
  const [categories, setCategories] = useState(initialCategories || []);
  const [dashboardConfig, setDashboardConfig] = useState(initialConfig.dashboardDeptConfig || {});
  
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

  const [masterError, setMasterError] = useState("");
  const [masterNotice, setMasterNotice] = useState("");

  const handleUpdateDashboardConfig = (deptName, key, value) => {
    setDashboardConfig(prev => ({
      ...prev,
      [deptName]: {
        ...prev[deptName],
        [key]: value
      }
    }));
  };

  const handleToggleWidget = (deptName, widgetKey) => {
    const currentDeptConfig = dashboardConfig[deptName] || {};
    const currentWidgets = currentDeptConfig.widgets || ["kpi", "category_monitor", "live_ops", "my_followups", "shifts", "charts"];
    const newWidgets = currentWidgets.includes(widgetKey)
      ? currentWidgets.filter(w => w !== widgetKey)
      : [...currentWidgets, widgetKey];
    
    handleUpdateDashboardConfig(deptName, "widgets", newWidgets);
  };

  const handleToggleCategory = (deptName, catName) => {
    const currentDeptConfig = dashboardConfig[deptName] || {};
    const currentCats = currentDeptConfig.categories || [];
    const newCats = currentCats.includes(catName)
      ? currentCats.filter(c => c !== catName)
      : [...currentCats, catName];

    handleUpdateDashboardConfig(deptName, "categories", newCats);
  };

  const handleSaveDashboardConfig = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/settings/dashboard-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dashboardConfig)
    });
    if (res.ok) {
      setMasterNotice("Konfigurasi dashboard per departemen tersimpan.");
      router.refresh();
    } else {
      setMasterError("Konfigurasi dashboard gagal disimpan.");
    }
  };

  const handleAddField = async (e) => {
    e.preventDefault();
    setMasterError(""); setMasterNotice("");
    const res = await fetch("/api/settings/fields", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newField)
    });
    const saved = await res.json().catch(() => ({}));
    if (!res.ok) { setMasterError(saved.error || "Field gagal disimpan."); return; }
    setFields([...fields, saved]);
    setNewField({ name: "", type: "text", options: "", position: "bottom", required: false });
    setMasterNotice(`Field "${saved.name}" ditambahkan.`);
    router.refresh();
  };

  const handleDeleteField = async (id) => {
    if(confirm("Delete this custom field? Existing ticket data will NOT be deleted, but the field will no longer appear.")){
      setMasterError(""); setMasterNotice("");
      const res = await fetch(`/api/settings/fields/${id}`, { method: "DELETE" });
      if (!res.ok) { const body = await res.json().catch(() => ({})); setMasterError(body.error || "Field gagal dihapus."); return; }
      setFields(fields.filter(f => f.id !== id));
      setMasterNotice("Field dihapus.");
      router.refresh();
    }
  };

  const handleEditField = (field) => {
    setEditingFieldId(field.id);
    setEditFieldData({ name: field.name, type: field.type, options: field.options || "", position: field.position || "bottom", required: field.required, active: field.active !== false });
  };

  const handleSaveField = async (id) => {
    setMasterError("");
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
    } else {
      const body = await res.json().catch(() => ({}));
      setMasterError(body.error || "Field gagal diperbarui.");
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    setMasterError(""); setMasterNotice("");
    const res = await fetch("/api/settings/job-categories", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newCat)
    });
    const saved = await res.json().catch(() => ({}));
    if (!res.ok) { setMasterError(saved.error || "Job Category gagal disimpan."); return; }
    setCategories([...categories, saved]);
    setNewCat({ name: "", score: "" });
    setMasterNotice(`Job Category "${saved.name}" ditambahkan.`);
    router.refresh();
  };

  const handleDeleteCategory = async (id) => {
    if(confirm("Delete this Job Category? It might orphan previously resolved tickets missing native historical scores if unresolved.")){
      setMasterError(""); setMasterNotice("");
      const res = await fetch(`/api/settings/job-categories/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMasterError(body.error ? `${body.error} Nonaktifkan kategori ini bila masih dipakai tiket.` : "Job Category gagal dihapus. Nonaktifkan kategori ini bila masih dipakai tiket.");
        return;
      }
      setCategories(categories.filter(c => c.id !== id));
      setMasterNotice("Job Category dihapus.");
      router.refresh();
    }
  };

  const handleEditCategory = (cat) => {
    setEditingCategoryId(cat.id);
    setEditCategoryData({ name: cat.name, score: cat.score, active: cat.active });
  };

  const handleSaveCategory = async (id) => {
    setMasterError("");
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
    } else {
      const body = await res.json().catch(() => ({}));
      setMasterError(body.error || "Job Category gagal diperbarui.");
    }
  };

  const handleSaveBranding = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/settings/branding", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(branding)
    });
    if (res.ok) {
      setMasterNotice("Konfigurasi branding tersimpan.");
      router.refresh();
    } else {
      setMasterError("Konfigurasi branding gagal disimpan.");
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
          headers: { "Content-Type": "text/plain" },
          body: backupStr
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
    <div className="card ui-static-bcb0a0d8bd" style={{overflow: 'hidden'}}>
      <div className="ui-static-7ad892b6d2" style={{display: 'flex'}}>
        {['custom_fields', 'job_categories', 'preferences', 'dashboard_settings', 'integrations'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="ui-static-7d67a0faa0" style={{flex: 1, background: activeTab === tab ? "var(--ui-surface)" : 'transparent', borderBottom: activeTab === tab ? '3px solid var(--primary-color)' : '3px solid transparent', fontWeight: activeTab === tab ? 'bold' : 'normal', cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.2s'}}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="ui-static-39c1d6c828" >
        {masterError && <p role="alert" className="error-text">{masterError}</p>}
        {masterNotice && <p role="status">{masterNotice}</p>}
        {activeTab === 'integrations' && <IntegrationsPanel departments={departments} />}

        {activeTab === 'custom_fields' && (
          <div>
            <div className="ui-static-8bd9dc7312" >
              <h2>Ticket Custom Fields</h2>
              <p className="ui-static-31a03a7301" >Define extra variables for users to fill out when creating a new ticket.</p>
            </div>
            
            <form onSubmit={handleAddField} className="ui-static-2d649ec674" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 13rem), 1fr))', alignItems: 'end'}}>
              <div>
                <label htmlFor="field-name" className="ui-static-628a93e017" style={{display: 'block'}}>Field Name</label>
                <input id="field-name" type="text" required value={newField.name} onChange={e => setNewField({...newField, name: e.target.value})} className="ui-static-2bf089dea9" style={{width: '100%'}} placeholder="e.g. Server Node ID" />
              </div>
              <div>
                <label htmlFor="field-type" className="ui-static-628a93e017" style={{display: 'block'}}>Input Type</label>
                <select id="field-type" value={newField.type} onChange={e => setNewField({...newField, type: e.target.value})} className="ui-static-2bf089dea9" style={{width: '100%'}}>
                  <option value="text">Text Box</option>
                  <option value="textarea">Text Area</option>
                  <option value="date">Date Picker</option>
                  <option value="select">Dropdown Menu</option>
                </select>
              </div>
              <div>
                <label htmlFor="field-options" className="ui-static-628a93e017" style={{display: 'block'}}>Dropdown Params</label>
                <input id="field-options" type="text" value={newField.options} onChange={e => setNewField({...newField, options: e.target.value})} disabled={newField.type !== 'select'} className="ui-static-2bf089dea9" style={{width: '100%', opacity: newField.type === 'select' ? 1 : 0.5}} placeholder="Linux, Windows, MacOS" />
              </div>
              <div>
                <label htmlFor="field-position" className="ui-static-628a93e017" style={{display: 'block'}}>Positioning</label>
                <select id="field-position" value={newField.position} onChange={e => setNewField({...newField, position: e.target.value})} className="ui-static-2bf089dea9" style={{width: '100%'}}>
                  <option value="bottom">Default (Below Attachments)</option>
                  <option value="below_subject">Below Subject</option>
                  <option value="below_description">Below Message Content</option>
                  <option value="below_priority">Below Priority</option>
                  <option value="below_department">Below Department</option>
                  <option value="below_job_category">Below Job Category</option>
                  {fields.map(f => <option key={f.id} value={`below_custom_${f.id}`}>Below Custom: {f.name}</option>)}
                </select>
              </div>
              <div className="ui-static-30f523173e" style={{display: 'flex', alignItems: 'center', height: '38px'}}>
                <input type="checkbox" checked={newField.required} onChange={e => setNewField({...newField, required: e.target.checked})} id="required_cb" />
                <label htmlFor="required_cb" className="ui-static-20a3233352" style={{cursor: 'pointer'}}>Required</label>
              </div>
              <button type="submit" className="primary-btn ui-static-7f62800e8e" style={{height: '38px'}}>+ Add Field</button>
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
                {fields.length === 0 && <tr><td colSpan="6" className="ui-static-bd68909f2e" style={{textAlign: 'center'}}>Belum ada custom field.</td></tr>}
                {fields.map(f => {
                  if (editingFieldId === f.id) {
                    return (
                      <tr key={f.id}>
                        <td><input type="text" value={editFieldData.name} onChange={e => setEditFieldData({...editFieldData, name: e.target.value})} className="ui-static-2bf089dea9" style={{width: '100%'}} /></td>
                        <td>
                          <select value={editFieldData.type} onChange={e => setEditFieldData({...editFieldData, type: e.target.value})} className="ui-static-2bf089dea9" style={{width: '100%'}}>
                            <option value="text">Text Box</option>
                            <option value="textarea">Text Area</option>
                            <option value="date">Date Picker</option>
                            <option value="select">Dropdown Menu</option>
                          </select>
                        </td>
                        <td><input type="text" value={editFieldData.options} onChange={e => setEditFieldData({...editFieldData, options: e.target.value})} disabled={editFieldData.type !== 'select'} className="ui-static-2bf089dea9" style={{width: '100%'}} /></td>
                        <td>
                          <select value={editFieldData.position} onChange={e => setEditFieldData({...editFieldData, position: e.target.value})} className="ui-static-2bf089dea9" style={{width: '100%'}}>
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
                        <td className="ui-static-30f523173e" style={{display: 'flex'}}>
                          <button onClick={() => handleSaveField(f.id)} className="ui-static-66e91e8487" style={{cursor: 'pointer'}}>Save</button>
                          <button onClick={() => setEditingFieldId(null)} className="ui-static-52dfaadc78" style={{cursor: 'pointer'}}>Cancel</button>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={f.id}>
                      <td className="ui-static-5c05f4afaf" >{f.name}</td>
                      <td><span className="badge ui-static-ff7bdbad96" style={{textTransform: 'uppercase'}}>{f.type}</span></td>
                      <td className="ui-static-b9010af219" >{f.options || '-'}</td>
                      <td><span className="badge badge-info ui-static-8471ddfa31" >{f.position?.replace('_', ' ') || 'bottom'}</span></td>
                      <td>{f.required ? <strong className="ui-static-d087b501d0" >Mandatory</strong> : 'Optional'}</td>
                      <td>
                        <select defaultValue="" onChange={(e) => {
                          if (e.target.value === 'edit') handleEditField(f);
                          if (e.target.value === 'delete') handleDeleteField(f.id);
                          e.target.value = '';
                        }} className="ui-static-2b848f090e" style={{cursor: 'pointer'}}>
                          <option value="" disabled>Actions ▾</option>
                          <option value="edit"> Edit</option>
                          <option value="delete"> Delete</option>
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
            <div className="ui-static-8bd9dc7312" >
              <h2>Job Performance Categories</h2>
              <p className="ui-static-31a03a7301" >Assign specific scores to various task domains. Score rewards are processed automatically upon resolution. Nama kategori yang mengandung &quot;Daily Report&quot; atau &quot;Laporan Harian&quot; hanya tampil di dashboard PIC-nya (Manager/Admin tetap melihat semua) dan disembunyikan dari Live Operations Board.</p>
            </div>
            
            <form onSubmit={handleAddCategory} className="ui-static-2d649ec674" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 14rem), 1fr))', alignItems: 'end'}}>
              <div>
                <label htmlFor="cat-name" className="ui-static-628a93e017" style={{display: 'block'}}>Job Descriptor</label>
                <input id="cat-name" type="text" required value={newCat.name} onChange={e => setNewCat({...newCat, name: e.target.value})} className="ui-static-2bf089dea9" style={{width: '100%'}} placeholder="e.g. Metro Diagnostics" />
              </div>
              <div>
                <label htmlFor="cat-score" className="ui-static-628a93e017" style={{display: 'block'}}>Score Value</label>
                <input id="cat-score" type="number" required value={newCat.score} onChange={e => setNewCat({...newCat, score: e.target.value})} className="ui-static-2bf089dea9" style={{width: '100%'}} placeholder="e.g. 10" />
              </div>
              <button type="submit" className="primary-btn ui-static-644c48fe70" style={{height: '38px'}}>+ Register Category</button>
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
                {categories.length === 0 && <tr><td colSpan="4" className="ui-static-bd68909f2e" style={{textAlign: 'center'}}>No point-based job categories established natively.</td></tr>}
                {categories.map(c => {
                  if (editingCategoryId === c.id) {
                    return (
                      <tr key={c.id}>
                        <td>
                          <input type="text" value={editCategoryData.name} onChange={e => setEditCategoryData({...editCategoryData, name: e.target.value})} className="ui-static-2bf089dea9" style={{width: '100%'}} />
                        </td>
                        <td>
                          <input type="number" value={editCategoryData.score} onChange={e => setEditCategoryData({...editCategoryData, score: e.target.value})} className="ui-static-2bf089dea9" style={{width: '100px'}} />
                        </td>
                        <td>
                          <select value={editCategoryData.active ? 'true' : 'false'} onChange={e => setEditCategoryData({...editCategoryData, active: e.target.value === 'true'})} className="ui-static-2bf089dea9" >
                            <option value="true">Operational</option>
                            <option value="false">Frozen</option>
                          </select>
                        </td>
                        <td className="ui-static-30f523173e" style={{display: 'flex'}}>
                          <button onClick={() => handleSaveCategory(c.id)} className="ui-static-66e91e8487" style={{cursor: 'pointer'}}>Save</button>
                          <button onClick={() => setEditingCategoryId(null)} className="ui-static-52dfaadc78" style={{cursor: 'pointer'}}>Cancel</button>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={c.id}>
                      <td className="ui-static-5c05f4afaf" >{c.name}</td>
                      <td><span className="badge ui-static-4ad8c23727" >+ {c.score} Pts</span></td>
                      <td className="ui-static-b9010af219" ><span className="badge" style={c.active ? {background:'var(--ui-success-bg)',color:'var(--ui-success)'} : {background:'var(--ui-warning-bg)',color:'var(--ui-warning)'}}>{c.active ? 'Operational' : 'Frozen'}</span></td>
                      <td>
                        <select defaultValue="" onChange={(e) => {
                          if (e.target.value === 'edit') handleEditCategory(c);
                          if (e.target.value === 'delete') handleDeleteCategory(c.id);
                          e.target.value = '';
                        }} className="ui-static-2b848f090e" style={{cursor: 'pointer'}}>
                          <option value="" disabled>Actions ▾</option>
                          <option value="edit"> Edit</option>
                          <option value="delete"> Delete</option>
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
            <div className="ui-static-a5e927dc66" >
              <h2 className="ui-static-d409cdab07" >Application Branding (White-labeling)</h2>
              <p className="ui-static-9d7e95f546" >Customize text artifacts rendering natively across standard client views.</p>
              
              <form onSubmit={handleSaveBranding} className="ui-static-fd6fbe88f4" style={{display: 'flex', flexDirection: 'column'}}>
                <div className="ui-static-af81cc4264" style={{display: 'grid', gridTemplateColumns: 'revert'}}>
                  <div>
                    <label className="ui-static-628a93e017" style={{display: 'block'}}>Dashboard App Name (Sidebar Header)</label>
                    <input type="text" value={branding.appName} onChange={e => setBranding({...branding, appName: e.target.value})} className="ui-static-3d0c9aaeb0" style={{width: '100%'}} required />
                  </div>
                  <div>
                    <label className="ui-static-628a93e017" style={{display: 'block'}}>Login Panel Title</label>
                    <input type="text" value={branding.loginTitle} onChange={e => setBranding({...branding, loginTitle: e.target.value})} className="ui-static-3d0c9aaeb0" style={{width: '100%'}} required />
                  </div>
                  <div>
                    <label className="ui-static-628a93e017" style={{display: 'block'}}>Login Panel Subtitle</label>
                    <input type="text" value={branding.loginSubtitle} onChange={e => setBranding({...branding, loginSubtitle: e.target.value})} className="ui-static-3d0c9aaeb0" style={{width: '100%'}} />
                  </div>
                  <div className="ui-static-f708b23f21" >
                    <label className="ui-static-628a93e017" style={{display: 'block'}}>Multi-Company Routing Identities (Comma-separated)</label>
                    <input type="text" value={branding.companyNames || "ION, SDC, Sistercompany"} onChange={e => setBranding({...branding, companyNames: e.target.value})} className="ui-static-3d0c9aaeb0" style={{width: '100%'}} placeholder="e.g. ION, SDC, Subsidiary Group" />
                    <p className="ui-static-24def7178d" >Defines dropdown options for 'Order Origin' and 'Executing Vendor' when creating or filtering tickets.</p>
                  </div>
                  <div className="ui-static-f708b23f21" >
                    <label className="ui-static-628a93e017" style={{display: 'block'}}>External API Key (Incidents Integrations)</label>
                    <input type="password" autoComplete="new-password" value={branding.externalApiKey || ""} onChange={e => setBranding({...branding, externalApiKey: e.target.value})} className="ui-static-3d0c9aaeb0" style={{width: '100%'}} placeholder="Enter secret API key for other applications to create tickets..." />
                    <p className="ui-static-24def7178d" >This key will be validated against the 'X-API-Key' request header. If the environment variable 'EXTERNAL_API_KEY' is set, it will take precedence over this setting.</p>
                  </div>
                  <div className="ui-static-f708b23f21" >
                    <label className="ui-static-628a93e017" style={{display: 'block'}}>Gemini AI API Key (Performance Analysis)</label>
                    <input type="password" autoComplete="new-password" value={branding.geminiApiKey || ""} onChange={e => setBranding({...branding, geminiApiKey: e.target.value})} className="ui-static-3d0c9aaeb0" style={{width: '100%'}} placeholder="Enter Google Gemini API Key..." />
                    <p className="ui-static-24def7178d" >Used for AI-based performance narrative analysis in the NOC Member Comparison Leaderboard.</p>
                  </div>
                  <div className="ui-static-f708b23f21" >
                    <label className="ui-static-628a93e017" style={{display: 'block'}}>Gemini AI Model ID</label>
                    <select value={branding.geminiModel || "gemini-1.5-flash"} onChange={e => setBranding({...branding, geminiModel: e.target.value})} className="ui-static-3d0c9aaeb0" style={{width: '100%'}}>
                      <option value="gemini-1.5-flash">gemini-1.5-flash (Fast & Standard)</option>
                      <option value="gemini-1.5-pro">gemini-1.5-pro (Advanced Reasoning)</option>
                      <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp (Experimental)</option>
                      <option value="gemini-2.5-flash">gemini-2.5-flash (Next Gen)</option>
                    </select>
                    <p className="ui-static-24def7178d" >Select the model version ID you want to use. Make sure your API Key has access to the selected model.</p>
                  </div>
                </div>
                <div className="ui-static-084dc32886" style={{display: 'flex', justifyContent: 'flex-start'}}>
                   <button type="submit" className="primary-btn ui-static-43949a34ef" >Apply Branding Config</button>
                </div>
              </form>
            </div>

            <div className="ui-static-f27f5099e4" >
              <h2 className="ui-static-1d56842ec7" style={{display: 'flex', alignItems: 'center'}}>
                <span className="ui-static-7f8da12489" ></span> System Core Wipes & Restorations
              </h2>
              <p className="ui-static-624cc348c5" >Destructive Operations. Data erased via these functions CANNOT be mathematically recovered.</p>
              
              <div className="ui-static-628983d0ce" style={{display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)'}}>
                <div className="ui-static-f62440e54e" style={{display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
                  <div>
                    <h3 className="ui-static-808d0cd29f" >Export Database (Backup)</h3>
                    <p className="ui-static-276d3f1044" >Download a complete pure JSON snapshot of the entire operational PostgreSQL database, universally portable.</p>
                  </div>
                  <button onClick={handleBackup} className="ui-static-05234f143d" style={{cursor: 'pointer'}}>
                    Download Schema & Data (.json)
                  </button>
                </div>
                
                <div className="ui-static-f62440e54e" style={{display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
                  <div>
                    <h3 className="ui-static-c946cea1ba" >Import Database (Restore)</h3>
                    <p className="ui-static-9d7e95f546" >Upload a `.json` backup. This will <strong className="ui-static-d087b501d0" >DESTROY</strong> the current DB schema and inject the JSON payload strictly mapping original Sequence IDs.</p>
                  </div>
                  <div>
                    <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleRestoreUpload} />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isRestoring} className="ui-static-60d7433ac4" style={{width: '100%', cursor: isRestoring ? 'wait' : 'pointer', opacity: isRestoring ? 0.7 : 1}}>
                      {isRestoring ? 'Injecting Nodes...' : 'Upload & Restore (.json)'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="ui-static-87e9c996e4" style={{display: 'flex', flexDirection: 'column'}}>
                 <h3 className="ui-static-328773f56c" >Manual Factory Reset Selection</h3>
                
                <label className="ui-static-e3651b0429" style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                   <input type="checkbox" checked={wipeOpts.wipeTransactional} onChange={e => setWipeOpts({...wipeOpts, wipeTransactional: e.target.checked})} style={{ width: '1.2rem', height: '1.2rem', accentColor: "var(--ui-danger)" }} />
                   <div>
                     <strong className="ui-static-d087b501d0" style={{display: 'block'}}>Wipe Transactional Data (Tickets, Reports, Meetings & Logs)</strong>
                     <span className="ui-static-9c12a079bd" >Destroys all history related to incidents and communications.</span>
                   </div>
                </label>

                <label className="ui-static-e3651b0429" style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                   <input type="checkbox" checked={wipeOpts.wipeAssets} onChange={e => setWipeOpts({...wipeOpts, wipeAssets: e.target.checked})} style={{ width: '1.2rem', height: '1.2rem', accentColor: "var(--ui-danger)" }} />
                   <div>
                     <strong className="ui-static-d087b501d0" style={{display: 'block'}}>Wipe Master Assets (Customers, Active Services, Port Topologies)</strong>
                     <span className="ui-static-9c12a079bd" >Destroys established inventory topologies completely.</span>
                   </div>
                </label>

                <label className="ui-static-e3651b0429" style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                   <input type="checkbox" checked={wipeOpts.wipeUsers} onChange={e => setWipeOpts({...wipeOpts, wipeUsers: e.target.checked})} style={{ width: '1.2rem', height: '1.2rem', accentColor: "var(--ui-danger)" }} />
                   <div>
                     <strong className="ui-static-d087b501d0" style={{display: 'block'}}>Wipe Human Resources (Users database EXCEPT your own Admin account)</strong>
                     <span className="ui-static-9c12a079bd" >Disconnects all staffs. Retains structural roles/departments.</span>
                   </div>
                </label>

                <div className="ui-static-94c59e255c" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                   <p className="ui-static-1cc3fb4326" style={{flex: 1}}>Execute deletion matrix by typing confirmation passphrase natively mapped in backend.</p>
                   <button onClick={handleWipeDatabase} className="ui-static-b2c8572168" style={{cursor: 'pointer'}}>
                      DESTROY SELECTED
                   </button>
                </div>

              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard_settings' && (
          <div>
            <div className="ui-static-8bd9dc7312" >
              <h2>Dashboard Layout per Departemen</h2>
              <p className="ui-static-b9010af219" >Sesuaikan widget, kategori pekerjaan, dan default cakupan tiket yang tampil pada dashboard masing-masing departemen.</p>
            </div>

            <form onSubmit={handleSaveDashboardConfig}>
              <div className="ui-static-0410aac9fd" style={{display: 'flex', flexDirection: 'column'}}>
                {departments.map((dept) => {
                  const deptConfig = dashboardConfig[dept.name] || {};
                  const activeWidgets = deptConfig.widgets || ["kpi", "category_monitor", "live_ops", "my_followups", "shifts", "charts"];
                  const activeCategories = deptConfig.categories || [];
                  const defaultScope = deptConfig.defaultScope || "me";

                  return (
                    <div key={dept.id} className="ui-static-fc1e6ec884" style={{overflow: 'hidden'}}>
                      {/* Dept Header */}
                      <div className="ui-static-4396adcb29" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h3 className="ui-static-9c15ba00ea" style={{display: 'flex', alignItems: 'center'}}>
                          <span></span> {dept.name}
                        </h3>
                        
                        {/* Default Scope Selection */}
                        <div className="ui-static-30f523173e" style={{display: 'flex', alignItems: 'center'}}>
                          <label className="ui-static-f44d951558" >Default Scope:</label>
                          <select 
                            value={defaultScope} 
                            onChange={(e) => handleUpdateDashboardConfig(dept.name, "defaultScope", e.target.value)}
                            className="ui-static-893b2f04a7" style={{outline: 'none'}}
                          >
                            <option value="all"> Global (Semua)</option>
                            <option value="dept"> Dept (Departemen & Me)</option>
                            <option value="me"> Me (Assigned Hanya ke Saya)</option>
                          </select>
                        </div>
                      </div>

                      {/* Settings grid */}
                      <div className="ui-static-6c2ede9992" style={{display: 'grid', gridTemplateColumns: '1fr 1fr'}}>
                        
                        {/* Widget Selection */}
                        <div>
                          <h4 className="ui-static-06bf473fa6" >Aktifkan Widget Dashboard:</h4>
                          <div className="ui-static-e59a73fd03" style={{display: 'grid', gridTemplateColumns: '1fr 1fr'}}>
                            {[
                              { key: "kpi", label: "KPI Summary Cards" },
                              { key: "category_monitor", label: "Job Category Monitor" },
                              { key: "live_ops", label: "Live Operations Board" },
                              { key: "my_followups", label: "My Follow-Ups List" },
                              { key: "shifts", label: "Weekly Shift Schedules" },
                              { key: "charts", label: "Analytics Trends & Charts" }
                            ].map(widget => (
                              <label key={widget.key} className="ui-static-b5951f3a87" style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                                <input 
                                  type="checkbox" 
                                  checked={activeWidgets.includes(widget.key)} 
                                  onChange={() => handleToggleWidget(dept.name, widget.key)}
                                  style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                                />
                                {widget.label}
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Job Category Selection */}
                        <div>
                          <h4 className="ui-static-06bf473fa6" >Filter Job Category (Kosongkan untuk menampilkan semua):</h4>
                          <div className="ui-static-e59a73fd03" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', maxHeight: '120px', overflowY: 'auto'}}>
                            {categories.map(cat => (
                              <label key={cat.id} className="ui-static-b5951f3a87" style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                                <input 
                                  type="checkbox" 
                                  checked={activeCategories.includes(cat.name)} 
                                  onChange={() => handleToggleCategory(dept.name, cat.name)}
                                  style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                                />
                                {cat.name}
                              </label>
                            ))}
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="ui-static-7cfb9c49e5" style={{display: 'flex', justifyContent: 'flex-end'}}>
                <button type="submit" className="primary-btn ui-static-e340022637" >
                   Simpan Konfigurasi Dashboard
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
