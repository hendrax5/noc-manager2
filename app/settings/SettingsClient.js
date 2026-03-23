"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SettingsClient({ initialFields, initialCategories }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("custom_fields");
  const [fields, setFields] = useState(initialFields);
  const [categories, setCategories] = useState(initialCategories || []);
  
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
          <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
            <p>This settings module segment is strictly locked in the prototype phase.</p>
          </div>
        )}
      </div>
    </div>
  );
}
