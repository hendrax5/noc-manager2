"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MeetingForm({ users }) {
  const router = useRouter();
  const [formData, setFormData] = useState({ 
    title: "", 
    agenda: "", 
    problems: "",
    scheduledAt: "",
    attendees: []
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            {users.map(u => {
              const selected = formData.attendees.includes(u.id);
              return (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: selected ? '#dbeafe' : 'white', border: selected ? '1px solid #bfdbfe' : '1px solid #cbd5e1', padding: '0.4rem 0.8rem', borderRadius: '20px', cursor: 'pointer', transition: 'all 0.2s', margin: 0, boxShadow: selected ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
                  <input 
                    type="checkbox" 
                    checked={selected}
                    onChange={() => toggleAttendee(u.id)}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: selected ? 'bold' : '500', color: selected ? '#1e40af' : '#475569' }}>
                    {u.name || u.email}
                  </span>
                </label>
              );
            })}
          </div>
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

        <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
          <button type="submit" className="primary-btn" disabled={loading} style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}>
            {loading ? 'Scheduling...' : 'Launch Meeting Room'}
          </button>
        </div>
      </form>
    </div>
  );
}
