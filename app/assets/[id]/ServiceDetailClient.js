'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ServiceDetailClient({ service, session }) {
  const router = useRouter();
  const isAdmin = session?.user?.role === 'Admin' || session?.user?.role === 'Manager';
  const [isEditingHops, setIsEditingHops] = useState(false);
  const [editableHops, setEditableHops] = useState(service.hops || []);
  const [isSaving, setIsSaving] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({
    name: service.name,
    status: service.status,
    customData: service.customData || {}
  });

  const [mounted, setMounted] = useState(false);
  const [hints, setHints] = useState({ locations: [], devices: [], ports: [] });
  
  useEffect(() => { 
    setMounted(true); 
    fetch('/api/assets/topology-hints')
      .then(res => res.json())
      .then(data => { if (data.locations) setHints(data); })
      .catch(e => console.error(e));
  }, []);

  const templateFields = service.template?.fields ? (typeof service.template.fields === 'string' ? JSON.parse(service.template.fields) : service.template.fields) : [];

  const handleDelete = async () => {
    if (!confirm('Are you absolutely sure you want to delete this service and clear all topology records?')) return;
    try {
      const res = await fetch(`/api/assets/services/${service.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/assets');
        router.refresh();
      }
    } catch (e) { console.error(e); }
  };

  const handleHopChange = (index, field, value) => {
    const newHops = [...editableHops];
    newHops[index][field] = value;
    setEditableHops(newHops);
  };
  
  const addHop = () => setEditableHops([...editableHops, { location: '', deviceName: '', portName: '', description: '' }]);
  const removeHop = (i) => setEditableHops(editableHops.filter((_, idx) => idx !== i));

  const saveHops = async () => {
    setIsSaving(true);
    try {
      const validHops = editableHops.filter(h => h.location || h.deviceName);
      const res = await fetch(`/api/assets/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hops: validHops })
      });
      if (res.ok) {
        setIsEditingHops(false);
        router.refresh(); // Fetch new server data
      } else {
        alert('Failed to save topology');
      }
    } catch (err) { console.error(err); } finally { setIsSaving(false); }
  };

  const handleSaveCore = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(`/api/assets/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      if (res.ok) {
        setShowEditModal(false);
        router.refresh();
      } else {
        alert('Failed to update service details');
      }
    } catch (err) { console.error(err); } finally { setIsSaving(false); }
  };

  return (
    <main className="container" style={{ maxWidth: '1100px' }}>
      <header className="page-header" style={{ marginBottom: '2rem' }}>
        <Link href="/assets" style={{ color: 'var(--text-color)', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '1rem', display: 'inline-block' }}>← Back to Inventory</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.5rem' }}>
               <h1 style={{ margin: 0 }}>{service.name}</h1>
               <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: service.status === 'Active' ? '#10b981' : '#ef4444', background: service.status === 'Active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '0.3rem 0.8rem', borderRadius: '12px' }}>
                  {service.status}
               </span>
             </div>
             <p style={{ margin: 0, color: 'var(--text-color)', fontSize: '1.1rem' }}>
               <strong style={{ color: 'var(--heading-color)' }}>{service.customer?.name}</strong> • {service.template?.name}
             </p>
             <div style={{ fontSize: '0.85rem', color: 'var(--text-color)', marginTop: '0.5rem' }}>
                Provisioned: {mounted ? new Date(service.createdAt).toLocaleString() : ''}
             </div>
          </div>
          
          {isAdmin && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setShowEditModal(true)} className="secondary-btn">✏️ Edit Details</button>
              <button onClick={handleDelete} className="secondary-btn" style={{ color: '#ef4444', borderColor: '#fca5a5' }}>Delete Service</button>
            </div>
          )}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        
        {/* Left Col: Params & Tickets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div className="bg-white-card" style={{ padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--heading-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Technical Parameters</h3>
            {service.customData && Object.keys(service.customData).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                 {Object.entries(service.customData).map(([key, val]) => (
                    <div key={key}>
                       <div style={{ fontSize: '0.8rem', color: 'var(--text-color)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>{key}</div>
                       <div style={{ fontSize: '1.05rem', color: 'var(--heading-color)', background: 'var(--hover-bg)', padding: '0.5rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontFamily: 'monospace' }}>{val || '-'}</div>
                    </div>
                 ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-color)', fontSize: '0.9rem' }}>No custom network parameters defined.</p>
            )}
          </div>

          <div className="bg-white-card" style={{ padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--heading-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Linked Incident Tickets</h3>
            {service.tickets && service.tickets.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                 {service.tickets.map(t => (
                    <li key={t.id} style={{ padding: '1rem', background: 'var(--hover-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                       <Link href={`/tickets/${t.id}`} style={{ textDecoration: 'none', color: 'var(--heading-color)', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>
                         {t.trackingId ? `#${t.trackingId.split('-')[0]}` : `Ticket #${t.id}`} - {t.title}
                       </Link>
                       <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-color)' }}>
                         <span style={{ color: t.status === 'Resolved' ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>{t.status}</span>
                         <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                       </div>
                    </li>
                 ))}
              </ul>
            ) : (
              <p style={{ color: 'var(--text-color)', fontSize: '0.9rem' }}>Clean record. No networking incidents found.</p>
            )}
          </div>

        </div>

        {/* Right Col: Circuit Hop Topology */}
        <div>
          <div className="bg-white-card" style={{ padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', minHeight: '100%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, color: 'var(--heading-color)' }}>Circuit Topology (Hops)</h3>
              {isAdmin && !isEditingHops && (
                <button onClick={() => { setEditableHops(service.hops || []); setIsEditingHops(true); }} className="secondary-btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>✏️ Edit Route</button>
              )}
              {isEditingHops && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                   <button onClick={() => setIsEditingHops(false)} className="secondary-btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>Cancel</button>
                   <button onClick={saveHops} disabled={isSaving} className="primary-btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: '#10b981' }}>{isSaving ? '...' : 'Save Hops'}</button>
                </div>
              )}
            </div>
            
            {isEditingHops ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <button type="button" onClick={addHop} style={{ background: 'var(--primary-color)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem', alignSelf: 'flex-start' }}>+ Add Network Node</button>
                {editableHops.map((hop, i) => (
                  <div key={i} style={{ position: 'relative', background: 'var(--hover-bg)', padding: '1.5rem', borderRadius: '8px', borderLeft: '4px solid var(--primary-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                       <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>Node #{i + 1}</span>
                       <button onClick={() => removeHop(i)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '0.2rem 0.5rem', fontWeight: 'bold' }}>Delete</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem' }}>
                      <div>
                         <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Location</label>
                         <input type="text" list="service-locations" className="input-field" value={hop.location} onChange={e => handleHopChange(i, 'location', e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
                      </div>
                      <div>
                         <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Device Name</label>
                         <input type="text" list="service-devices" className="input-field" value={hop.deviceName} onChange={e => handleHopChange(i, 'deviceName', e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
                      </div>
                      <div>
                         <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Port Name</label>
                         <input type="text" list="service-ports" className="input-field" value={hop.portName} onChange={e => handleHopChange(i, 'portName', e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
                      </div>
                      <div>
                         <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Description (XC)</label>
                         <input type="text" className="input-field" value={hop.description || ''} onChange={e => handleHopChange(i, 'description', e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : service.hops && service.hops.length > 0 ? (
              <div style={{ position: 'relative', paddingLeft: '2rem' }}>
                {/* Vertical Line Connector */}
                <div style={{ position: 'absolute', top: '10px', bottom: '20px', left: '11px', width: '2px', background: 'var(--border-color)', zIndex: 0 }}></div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'relative', zIndex: 1 }}>
                  {service.hops.map((hop, i) => (
                    <div key={hop.id} style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '-33px', top: '0', background: 'var(--primary-color)', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem', boxShadow: '0 0 0 4px var(--card-bg)' }}>
                        {i + 1}
                      </div>
                      
                      <div style={{ background: 'var(--hover-bg)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)' }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <strong style={{ fontSize: '1.1rem', color: 'var(--heading-color)' }}>{hop.location}</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 'bold', background: 'rgba(59,130,246,0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>Hop #{i+1}</span>
                         </div>
                         
                         <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem', marginTop: '1rem', fontSize: '0.9rem' }}>
                           <div>
                             <div style={{ color: 'var(--text-color)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Device / Router</div>
                             <div style={{ color: 'var(--heading-color)', fontWeight: 'bold', fontFamily: 'monospace', marginTop: '0.2rem' }}>{hop.deviceName || '-'}</div>
                           </div>
                           <div>
                             <div style={{ color: 'var(--text-color)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Port Intf</div>
                             <div style={{ color: 'var(--heading-color)', fontWeight: 'bold', fontFamily: 'monospace', marginTop: '0.2rem' }}>{hop.portName || '-'}</div>
                           </div>
                         </div>
                         
                         {hop.description && (
                           <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', color: 'var(--text-color)', fontSize: '0.85rem' }}>
                             <strong style={{ color: 'var(--heading-color)' }}>Patch Notes:</strong> {hop.description}
                           </div>
                         )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--hover-bg)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                <span style={{ fontSize: '2rem' }}>🪢</span>
                <p style={{ color: 'var(--text-color)', marginTop: '1rem' }}>No topological nodes bounded strictly measuring this subscription flow.</p>
              </div>
            )}
            
          </div>
        </div>

      </div>

      {/* EDIT CORE MODAL */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="bg-white-card scale-in" style={{ width: '100%', maxWidth: '500px', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--heading-color)' }}>Edit Asset Details</h2>
            <form onSubmit={handleSaveCore}>
               <div style={{ marginBottom: '1rem' }}>
                 <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: 'var(--heading-color)', fontSize: '0.9rem' }}>Service Name / Alias</label>
                 <input type="text" required className="input-field" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} style={{ width: '100%', padding: '0.8rem' }} />
               </div>
               
               <div style={{ marginBottom: '1.5rem' }}>
                 <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: 'var(-- heading-color)', fontSize: '0.9rem' }}>Operational Status</label>
                 <select className="input-field" value={editData.status} onChange={e => setEditData({...editData, status: e.target.value})} style={{ width: '100%', padding: '0.8rem' }}>
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Archived">Archived</option>
                 </select>
               </div>

               {templateFields.length > 0 && (
                 <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'var(--hover-bg)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                   <h4 style={{ margin: '0 0 1rem 0', color: 'var(--heading-color)' }}>Technical Parameters</h4>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                     {templateFields.map((f, i) => (
                       <div key={i}>
                         <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: 'var(--text-color)', fontSize: '0.85rem' }}>{f.name}</label>
                         <input 
                           type={f.type === 'number' ? 'number' : 'text'} 
                           className="input-field" 
                           value={editData.customData[f.name] || ''} 
                           onChange={e => setEditData({ ...editData, customData: { ...editData.customData, [f.name]: e.target.value } })} 
                           style={{ width: '100%', padding: '0.6rem' }} 
                         />
                       </div>
                     ))}
                   </div>
                 </div>
               )}

               <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                 <button type="button" onClick={() => setShowEditModal(false)} className="secondary-btn">Cancel</button>
                 <button type="submit" disabled={isSaving} className="primary-btn">{isSaving ? 'Updating...' : 'Save Changes'}</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Datalists for Autocomplete */}
      <datalist id="service-locations">
         {hints.locations.map((loc, i) => <option key={i} value={loc} />)}
      </datalist>
      <datalist id="service-devices">
         {hints.devices.map((dev, i) => <option key={i} value={dev} />)}
      </datalist>
      <datalist id="service-ports">
         {hints.ports.map((p, i) => <option key={i} value={p} />)}
      </datalist>

    </main>
  );
}
