'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AssetClient({ session, initialCustomers, initialTemplates, initialServices }) {
  const [activeTab, setActiveTab] = useState('inventory');
  
  const [customers, setCustomers] = useState(initialCustomers || []);
  const [templates, setTemplates] = useState(initialTemplates || []);
  const [services, setServices] = useState(initialServices || []);
  
  const [blastQuery, setBlastQuery] = useState('');
  
  // Modals Data
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editCustomerId, setEditCustomerId] = useState(null);
  const [customerData, setCustomerData] = useState({ name: '', contactEmail: '', contactPhone: '' });
  
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState(null);
  const [templateData, setTemplateData] = useState({ name: '' });
  const [templateFields, setTemplateFields] = useState([{ name: '', type: 'text', required: true }]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = true; // Temporary global access override for creating assets/services from 1-Apr Request

  return (
    <main className="container">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
           <h1>🏢 Telecom Asset Inventory</h1>
           <p>Manage Customers, Service Subscriptions, and Topology Hops.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
           <Link href="/assets/new" className="primary-btn" style={{ textDecoration: 'none' }}>+ New Asset/Service</Link>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <button 
           onClick={() => setActiveTab('inventory')}
           style={{ background: 'transparent', border: 'none', padding: '1rem 0', fontWeight: 'bold', fontSize: '1.05rem', color: activeTab === 'inventory' ? 'var(--primary-color)' : 'var(--text-color)', borderBottom: activeTab === 'inventory' ? '3px solid var(--primary-color)' : '3px solid transparent', cursor: 'pointer' }}
        >
          Active Subscriptions ({services.length})
        </button>
        <button 
           onClick={() => setActiveTab('customers')}
           style={{ background: 'transparent', border: 'none', padding: '1rem 0', fontWeight: 'bold', fontSize: '1.05rem', color: activeTab === 'customers' ? 'var(--primary-color)' : 'var(--text-color)', borderBottom: activeTab === 'customers' ? '3px solid var(--primary-color)' : '3px solid transparent', cursor: 'pointer' }}
        >
          Customers Registry ({customers.length})
        </button>
        <button 
           onClick={() => setActiveTab('templates')}
           style={{ background: 'transparent', border: 'none', padding: '1rem 0', fontWeight: 'bold', fontSize: '1.05rem', color: activeTab === 'templates' ? 'var(--primary-color)' : 'var(--text-color)', borderBottom: activeTab === 'templates' ? '3px solid var(--primary-color)' : '3px solid transparent', cursor: 'pointer' }}
        >
          Service Templates ({templates.length})
        </button>
        <button 
           onClick={() => setActiveTab('blast')}
           style={{ background: 'transparent', border: 'none', padding: '1rem 0', fontWeight: 'bold', fontSize: '1.05rem', color: activeTab === 'blast' ? '#ef4444' : 'var(--text-color)', borderBottom: activeTab === 'blast' ? '3px solid #ef4444' : '3px solid transparent', cursor: 'pointer' }}
        >
          💣 Blast Radius Analysis
        </button>
      </div>

      {activeTab === 'inventory' && (
        <div className="bg-white-card" style={{ borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--hover-bg)' }}>
                <th style={{ padding: '1rem', color: 'var(--heading-color)', borderBottom: '2px solid var(--border-color)' }}>ID</th>
                <th style={{ padding: '1rem', color: 'var(--heading-color)', borderBottom: '2px solid var(--border-color)' }}>Customer</th>
                <th style={{ padding: '1rem', color: 'var(--heading-color)', borderBottom: '2px solid var(--border-color)' }}>Service Component</th>
                <th style={{ padding: '1rem', color: 'var(--heading-color)', borderBottom: '2px solid var(--border-color)' }}>Type</th>
                <th style={{ padding: '1rem', color: 'var(--heading-color)', borderBottom: '2px solid var(--border-color)' }}>Status</th>
                <th style={{ padding: '1rem', color: 'var(--heading-color)', borderBottom: '2px solid var(--border-color)' }}>Tickets</th>
              </tr>
            </thead>
            <tbody>
              {services.map(srv => (
                <tr key={srv.id} className="hover-bg" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem', color: 'var(--text-color)', fontWeight: 'bold' }}>#{srv.id}</td>
                  <td style={{ padding: '1rem', color: 'var(--heading-color)', fontWeight: 'bold' }}>{srv.customer?.name}</td>
                  <td style={{ padding: '1rem' }}>
                    <Link href={`/assets/${srv.id}`} style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 'bold' }}>
                      {srv.name}
                    </Link>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-color)' }}>
                    <span style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      {srv.template?.name}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: srv.status === 'Active' ? '#10b981' : '#ef4444', background: srv.status === 'Active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                      {srv.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: '#f59e0b', fontWeight: 'bold' }}>{srv._count?.tickets || 0}</td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr>
                   <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-color)' }}>No service assets recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'customers' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
           {customers.map(c => (
              <div key={c.id} className="bg-white-card hover-lift" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--heading-color)' }}>🏢 {c.name}</h3>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-color)', marginBottom: '1rem' }}>
                   <div>📧 {c.contactEmail || 'No email provided'}</div>
                   <div>📞 {c.contactPhone || 'No phone provided'}</div>
                </div>
                 <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-color)' }}>Active Services: <strong style={{ color: 'var(--heading-color)' }}>{c._count?.services}</strong></span>
                 </div>
                 {isAdmin && (
                    <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                       <button onClick={() => {
                          setEditCustomerId(c.id);
                          setCustomerData({ name: c.name, contactEmail: c.contactEmail || '', contactPhone: c.contactPhone || '' });
                          setShowCustomerModal(true);
                       }} style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-color)' }}>Edit</button>
                       <button onClick={async () => {
                          try {
                             const res = await fetch(`/api/assets/customers/${c.id}`, { method: 'DELETE' });
                             if (res.ok) {
                                setCustomers(prev => prev.filter(x => x.id !== c.id));
                             } else {
                                const d = await res.json();
                                alert(d.error);
                             }
                          } catch (e) {}
                       }} style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#ef4444' }}>Delete</button>
                    </div>
                 )}
              </div>
           ))}
           {isAdmin && (
              <div onClick={() => { setEditCustomerId(null); setCustomerData({ name: '', contactEmail: '', contactPhone: '' }); setShowCustomerModal(true); }} className="bg-white-card hover-lift" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px dashed var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: '150px' }}>
                <span style={{ color: 'var(--primary-color)', fontWeight: 'bold', fontSize: '1.1rem' }}>+ Add New Customer</span>
              </div>
           )}
        </div>
      )}

      {activeTab === 'templates' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
           {templates.map(t => {
              const fieldsObj = typeof t.fields === 'string' ? JSON.parse(t.fields) : t.fields;
              const fieldItems = Array.isArray(fieldsObj) ? fieldsObj : [];
              return (
                <div key={t.id} className="bg-white-card" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, color: 'var(--heading-color)' }}>{t.name} (Template)</h3>
                    <span style={{ fontSize: '0.75rem', background: t.active ? '#dcfce7' : '#fee2e2', color: t.active ? '#166534' : '#991b1b', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>
                      {t.active ? 'Active' : 'Archived'}
                    </span>
                  </div>
                  <div style={{ background: 'var(--hover-bg)', padding: '1rem', borderRadius: '8px' }}>
                    <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--heading-color)', marginBottom: '0.5rem' }}>Dynamic Fields ({fieldItems.length}):</strong>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-color)', fontSize: '0.85rem' }}>
                       {fieldItems.map((f, i) => <li key={i}>{f.name} <span style={{ opacity: 0.6 }}>[{f.type}]</span></li>)}
                    </ul>
                  </div>
                  {isAdmin && (
                    <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                       <button onClick={() => {
                          setEditTemplateId(t.id);
                          setTemplateData({ name: t.name });
                          setTemplateFields(fieldItems.length > 0 ? fieldItems : [{ name: '', type: 'text', required: true }]);
                          setShowTemplateModal(true);
                       }} style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-color)' }}>Edit</button>
                       <button onClick={async () => {
                          if (!confirm(`Delete template ${t.name}?`)) return;
                          try {
                             const res = await fetch(`/api/assets/templates/${t.id}`, { method: 'DELETE' });
                             if (res.ok) setTemplates(templates.filter(x => x.id !== t.id));
                             else alert(await res.json().then(d => d.error));
                          } catch (e) {}
                       }} style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#ef4444' }}>Delete</button>
                    </div>
                 )}
                </div>
              );
           })}
           {isAdmin && (
              <div onClick={() => { setEditTemplateId(null); setTemplateData({ name: '' }); setTemplateFields([{ name: '', type: 'text', required: true }]); setShowTemplateModal(true); }} className="bg-white-card hover-lift" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px dashed var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: '150px' }}>
                <span style={{ color: 'var(--primary-color)', fontWeight: 'bold', fontSize: '1.1rem' }}>+ Define New Service Template</span>
              </div>
           )}
        </div>
      )}

      {activeTab === 'blast' && (
        <div>
          <div className="bg-white-card" style={{ padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--heading-color)' }}>Trace Upstream Impact (Blast Radius)</h3>
            <p style={{ color: 'var(--text-color)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>Search for a Datacenter, Router device, or port name to instantly discover which Customer Services pass through that node. Very useful for mass notification during unexpected outages.</p>
            <input 
              type="text" 
              placeholder="e.g. Cyber-1, xe-0/0/0, MKT-ROUTER..." 
              value={blastQuery}
              onChange={e => setBlastQuery(e.target.value)}
              className="input-field" 
              style={{ padding: '1rem', fontSize: '1.1rem', borderRadius: '8px', width: '100%', maxWidth: '600px' }}
            />
          </div>

          {blastQuery.length > 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {services.filter(s => s.hops && s.hops.some(h => 
                  (h.location && h.location.toLowerCase().includes(blastQuery.toLowerCase())) ||
                  (h.deviceName && h.deviceName.toLowerCase().includes(blastQuery.toLowerCase())) ||
                  (h.portName && h.portName.toLowerCase().includes(blastQuery.toLowerCase()))
              )).map(srv => {
                 const matchedHops = srv.hops.filter(h => 
                    (h.location && h.location.toLowerCase().includes(blastQuery.toLowerCase())) ||
                    (h.deviceName && h.deviceName.toLowerCase().includes(blastQuery.toLowerCase())) ||
                    (h.portName && h.portName.toLowerCase().includes(blastQuery.toLowerCase()))
                 );
                 return (
                  <div key={srv.id} className="bg-white-card hover-lift" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid #fca5a5', background: 'rgba(239, 68, 68, 0.02)' }}>
                    <div style={{ marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px', textTransform: 'uppercase' }}>Affected Customer</span>
                      <h3 style={{ margin: '0.5rem 0 0.2rem 0', color: 'var(--heading-color)' }}>{srv.customer?.name}</h3>
                      <Link href={`/assets/${srv.id}`} style={{ color: 'var(--text-color)', fontSize: '0.9rem', fontWeight: 'bold', textDecoration: 'none' }}>{srv.name}</Link>
                    </div>
                    
                    <div style={{ background: 'var(--hover-bg)', padding: '1rem', borderRadius: '6px', border: '1px dashed var(--border-color)' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-color)', fontWeight: 'bold', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Compromised Nodes:</div>
                      {matchedHops.map((h, i) => (
                        <div key={i} style={{ fontSize: '0.85rem', color: 'var(--heading-color)', marginBottom: '0.3rem', display: 'flex', gap: '0.5rem' }}>
                          <span style={{ color: '#ef4444' }}>💥</span>
                          <span><strong>{h.location}</strong> ({h.deviceName} • {h.portName})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                 );
              })}
              {services.filter(s => s.hops && s.hops.some(h => 
                  (h.location && h.location.toLowerCase().includes(blastQuery.toLowerCase())) ||
                  (h.deviceName && h.deviceName.toLowerCase().includes(blastQuery.toLowerCase())) ||
                  (h.portName && h.portName.toLowerCase().includes(blastQuery.toLowerCase()))
              )).length === 0 && (
                 <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--text-color)', background: 'var(--hover-bg)', borderRadius: '12px' }}>
                   No customers are passing through this point of failure.
                 </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CUSTOMER MODAL */}
      {showCustomerModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="bg-white-card scale-in" style={{ width: '100%', maxWidth: '400px', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--heading-color)' }}>{editCustomerId ? 'Edit Customer' : 'Register Customer'}</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmitting(true);
              try {
                const isEdit = !!editCustomerId;
                const url = isEdit ? `/api/assets/customers/${editCustomerId}` : '/api/assets/customers';
                const method = isEdit ? 'PATCH' : 'POST';
                const res = await fetch(url, {
                   method,
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify(customerData)
                });
                if (res.ok) {
                   const newCust = await res.json();
                   if (isEdit) {
                       setCustomers(prev => prev.map(c => c.id === editCustomerId ? newCust : c).sort((a,b) => a.name.localeCompare(b.name)));
                   } else {
                       setCustomers(prev => [...prev, newCust].sort((a,b) => a.name.localeCompare(b.name)));
                   }
                   setShowCustomerModal(false);
                } else {
                   const err = await res.json(); alert(err.error);
                }
              } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: 'var(--heading-color)', fontSize: '0.9rem' }}>Company Name</label>
                <input type="text" required className="input-field" value={customerData.name} onChange={e => setCustomerData(p => ({...p, name: e.target.value}))} style={{ width: '100%', padding: '0.8rem' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: 'var(--heading-color)', fontSize: '0.9rem' }}>Email</label>
                <input type="email" className="input-field" value={customerData.contactEmail} onChange={e => setCustomerData(p => ({...p, contactEmail: e.target.value}))} style={{ width: '100%', padding: '0.8rem' }} />
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: 'var(--heading-color)', fontSize: '0.9rem' }}>Phone/NOC String</label>
                <input type="text" className="input-field" value={customerData.contactPhone} onChange={e => setCustomerData(p => ({...p, contactPhone: e.target.value}))} style={{ width: '100%', padding: '0.8rem' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setShowCustomerModal(false)} className="secondary-btn">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="primary-btn">{isSubmitting ? 'Saving...' : 'Register'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEMPLATE MODAL */}
      {showTemplateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="bg-white-card scale-in" style={{ width: '100%', maxWidth: '500px', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--heading-color)' }}>{editTemplateId ? 'Edit Template' : 'Define Service Template'}</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmitting(true);
              try {
                const isEdit = !!editTemplateId;
                const url = isEdit ? `/api/assets/templates/${editTemplateId}` : '/api/assets/templates';
                const method = isEdit ? 'PATCH' : 'POST';
                const payload = { name: templateData.name, fields: templateFields.filter(f => f.name.trim() !== '') };
                
                const res = await fetch(url, {
                   method,
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify(payload)
                });
                if (res.ok) {
                   const newTmpl = await res.json();
                   if (isEdit) {
                       setTemplates(prev => prev.map(t => t.id === editTemplateId ? newTmpl : t).sort((a,b) => a.name.localeCompare(b.name)));
                   } else {
                       setTemplates(prev => [...prev, newTmpl].sort((a,b) => a.name.localeCompare(b.name)));
                   }
                   setShowTemplateModal(false);
                } else {
                   const err = await res.json(); alert(err.error);
                }
              } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
            }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: 'var(--heading-color)', fontSize: '0.9rem' }}>Template Name</label>
                <input type="text" required placeholder="e.g. IPLC DWDM" className="input-field" value={templateData.name} onChange={e => setTemplateData(p => ({...p, name: e.target.value}))} style={{ width: '100%', padding: '0.8rem' }} />
              </div>
              
              <div style={{ marginBottom: '2rem', padding: '1rem', background: 'var(--hover-bg)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                   <label style={{ fontWeight: 'bold', color: 'var(--heading-color)', fontSize: '0.9rem' }}>Extended Parameters</label>
                   <button type="button" onClick={() => setTemplateFields([...templateFields, { name: '', type: 'text', required: false }])} style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>+ Add Field</button>
                </div>
                {templateFields.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input type="text" placeholder="Field Name (e.g. Bandwidth)" required value={f.name} onChange={e => { const arr = [...templateFields]; arr[i].name = e.target.value; setTemplateFields(arr); }} className="input-field" style={{ flexGrow: 1, padding: '0.5rem' }} />
                    <select value={f.type} onChange={e => { const arr = [...templateFields]; arr[i].type = e.target.value; setTemplateFields(arr); }} className="input-field" style={{ padding: '0.5rem' }}>
                       <option value="text">Text / String</option>
                       <option value="number">Number</option>
                    </select>
                    {templateFields.length > 1 && (
                      <button type="button" onClick={() => setTemplateFields(templateFields.filter((_, idx) => idx !== i))} style={{ background: '#fca5a5', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', width: '30px' }}>×</button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setShowTemplateModal(false)} className="secondary-btn">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="primary-btn">{isSubmitting ? 'Saving...' : 'Save Template'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}
