"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import SearchableAttendeeSelect from "@/components/SearchableAttendeeSelect";

export default function MeetingForm({ users, departments }) {
  const router = useRouter();
  const [formData, setFormData] = useState({ 
    title: "", 
    agenda: "", 
    problems: "",
    scheduledAt: "",
    attendees: [],
    visibility: "Public",
    permittedDepartmentIds: []
  });
  const [loading, setLoading] = useState(false);

  const toggleAttendee = (userId) => {
    setFormData(prev => {
      if (prev.attendees.includes(userId)) {
        return { ...prev, attendees: prev.attendees.filter(id => id !== userId) };
      } else {
        return { ...prev, attendees: [...prev.attendees, userId] };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formData,
        scheduledAt: new Date(formData.scheduledAt).toISOString()
      })
    });
    
    if (res.ok) {
      router.push("/meetings");
      router.refresh();
    } else {
      const err = await res.json();
      alert(`System Error: ${err.error || 'Failed to schedule meeting'}`);
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '0' }}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)', gap: '2rem' }}>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontWeight: 'bold' }}>Meeting Title</label>
          <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. NOC Core Weekly Sync" />
        </div>
        
        <div className="form-group">
          <label style={{ fontWeight: 'bold' }}>Scheduled Date & Time</label>
          <input 
            type="datetime-local" 
            required 
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
            value={formData.scheduledAt} 
            onChange={e => setFormData({...formData, scheduledAt: e.target.value})} 
          />
        </div>

        <div className="form-group" style={{ gridRow: 'span 2' }}>
          <label style={{ fontWeight: 'bold' }}>Invite Attendees</label>
          <SearchableAttendeeSelect 
             users={users} 
             departments={departments}
             selectedIds={formData.attendees}
             onChange={(newIds) => setFormData({...formData, attendees: newIds})}
          />
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 'bold' }}>Agenda Topics</label>
          <textarea 
            rows="4" 
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontFamily: 'inherit' }}
            value={formData.agenda} 
            onChange={e => setFormData({...formData, agenda: e.target.value})}
            placeholder="Bullet points of topics to discuss..."
          ></textarea>
        </div>
        
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontWeight: 'bold' }}>Known Problems to Address</label>
          <textarea 
            rows="3" 
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontFamily: 'inherit' }}
            value={formData.problems} 
            onChange={e => setFormData({...formData, problems: e.target.value})}
            placeholder="Outline systemic issues or pain points..."
          ></textarea>
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <label style={{ fontWeight: 'bold' }}>Meeting Privacy & Visibility</label>
          <select 
            value={formData.visibility} 
            onChange={e => setFormData({...formData, visibility: e.target.value})}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#f8fafc' }}
          >
            <option value="Public">🌐 Public (Visible to all staff members)</option>
            <option value="Private">🔒 Private (Strictly visible only to Organizer and invited Attendees)</option>
            <option value="Restricted">🏢 Restricted (Visible only to Organizer, Attendees, & selected Departments)</option>
          </select>
        </div>

        {formData.visibility === 'Restricted' && (
          <div className="form-group" style={{ gridColumn: '1 / -1', background: '#fef2f2', padding: '1rem', borderLeft: '4px solid #ef4444', borderRadius: '6px' }}>
            <label style={{ fontWeight: 'bold', color: '#b91c1c' }}>Permitted Departments</label>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#7f1d1d' }}>Select which departments can access and view this meeting's details on their dashboard.</p>
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
               {(!departments || departments.length === 0) && <span style={{fontSize:'0.85rem', color:'#b91c1c'}}>No departments available.</span>}
            </div>
          </div>
        )}

        <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
          <button type="submit" className="primary-btn" disabled={loading} style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}>
            {loading ? 'Scheduling...' : 'Launch Meeting Room'}
          </button>
        </div>
      </form>
    </div>
  );
}
