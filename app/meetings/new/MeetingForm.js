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
    <div className="card ui-static-ff227d0632" style={{maxWidth: '800px'}}>
      <form onSubmit={handleSubmit} className="ui-static-0410aac9fd" style={{display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)'}}>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="ui-static-78d7af8b7e" >Meeting Title</label>
          <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. NOC Core Weekly Sync" />
        </div>
        
        <div className="form-group">
          <label className="ui-static-78d7af8b7e" >Scheduled Date & Time</label>
          <input 
            type="datetime-local" 
            required 
            className="ui-static-b1c5641fa6" style={{width: '100%'}}
            value={formData.scheduledAt} 
            onChange={e => setFormData({...formData, scheduledAt: e.target.value})} 
          />
        </div>

        <div className="form-group" style={{ gridRow: 'span 2' }}>
          <label className="ui-static-78d7af8b7e" >Invite Attendees</label>
          <SearchableAttendeeSelect 
             users={users} 
             departments={departments}
             selectedIds={formData.attendees}
             onChange={(newIds) => setFormData({...formData, attendees: newIds})}
          />
        </div>

        <div className="form-group">
          <label className="ui-static-78d7af8b7e" >Agenda Topics</label>
          <textarea 
            rows="4" 
            className="ui-static-077b25649f" style={{width: '100%'}}
            value={formData.agenda} 
            onChange={e => setFormData({...formData, agenda: e.target.value})}
            placeholder="Bullet points of topics to discuss..."
          ></textarea>
        </div>
        
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="ui-static-78d7af8b7e" >Known Problems to Address</label>
          <textarea 
            rows="3" 
            className="ui-static-077b25649f" style={{width: '100%'}}
            value={formData.problems} 
            onChange={e => setFormData({...formData, problems: e.target.value})}
            placeholder="Outline systemic issues or pain points..."
          ></textarea>
        </div>

        <div className="ui-static-14b98d08ef" style={{gridColumn: '1 / -1'}}>
          <button type="submit" className="primary-btn ui-static-59859585a7" disabled={loading} style={{width: '100%'}}>
            {loading ? 'Scheduling...' : 'Launch Meeting Room'}
          </button>
        </div>
      </form>
    </div>
  );
}
