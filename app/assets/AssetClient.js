'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCustomerId } from '@/lib/customers/identity';
import SapCircuitsClient from './SapCircuitsClient';
import ServicePortfolio from './ServicePortfolio';
import CustomerServiceInventory from './CustomerServiceInventory';
import ui from './assets-ui.module.css';
import AssetMasterList from './AssetMasterList';

export default function AssetClient({ session, initialCustomers, initialTemplates, initialServices }) {
  const [activeTab, setActiveTab] = useState('portfolio');
  
  const [customers, setCustomers] = useState(initialCustomers || []);
  const [templates, setTemplates] = useState(initialTemplates || []);
  const [services, setServices] = useState(initialServices || []);
  
  const [blastQuery, setBlastQuery] = useState('');
  useEffect(() => {
    const syncHash = () => setActiveTab(['#sap-circuits','#circuit-candidates'].includes(window.location.hash) ? 'sap' : window.location.hash==='#inventory'?'inventory':'portfolio');
    syncHash(); window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);
  
  // Modals Data
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editCustomerId, setEditCustomerId] = useState(null);
  const [customerData, setCustomerData] = useState({ name: '', contactEmail: '', contactPhone: '' });
  
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState(null);
  const [templateData, setTemplateData] = useState({ name: '' });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = session?.user?.role === 'Admin' || session?.user?.permissions?.includes('manage_assets');

  return (
    <main className={`container ${ui.page}`}>
      <header className={ui.header}>
        <h1>Customer & layanan</h1>
        {isAdmin && <Link href="/assets/new" className="primary-btn">Tambah layanan</Link>}
      </header>
      <nav className={ui.tabs} aria-label="Pengelolaan Assets">
        {[
          ['portfolio','Ringkasan layanan'],['inventory','Daftar circuit'],['customers',`Customers Registry (${customers.length})`],
          ...(isAdmin ? [['sap','Penautan CID']] : []),['templates',`Produk layanan (${templates.length})`],['blast','Analisis dampak']
        ].map(([key,label])=><button key={key} type="button" aria-pressed={activeTab===key} onClick={()=>{setActiveTab(key);window.history.replaceState(null,'',key==='sap'?'#sap-circuits':key==='inventory'?'#inventory':window.location.pathname);}}>{label}</button>)}
      </nav>
      {activeTab === 'sap' && isAdmin && <SapCircuitsClient customers={customers} templates={templates} services={services} onMapped={async()=>{const response=await fetch('/api/assets/services',{cache:'no-store'});if(response.ok)setServices(await response.json());}} onCustomerCreated={customer=>setCustomers(previous=>[...previous,customer].sort((a,b)=>a.name.localeCompare(b.name)))} onManageProducts={()=>setActiveTab('templates')} />}

      {activeTab === 'portfolio' && <ServicePortfolio/>}
      {activeTab === 'inventory' && <CustomerServiceInventory customers={customers} services={services} canManage={isAdmin} />}

      {activeTab === 'customers' && <AssetMasterList title="Customers Registry" columns={['Customer','Customer ID','Kontak','Layanan',...(isAdmin?['Aksi']:[])]} addLabel="Tambah customer" onAdd={isAdmin?()=>{setEditCustomerId(null);setCustomerData({name:'',contactEmail:'',contactPhone:''});setShowCustomerModal(true);}:undefined} rows={customers.map(c=>({id:c.id,search:[c.name,formatCustomerId(c),c.contactEmail,c.contactPhone].filter(Boolean).join(' '),cells:[<strong key="name">{c.name}</strong>,<span key="id" className="font-mono">{formatCustomerId(c)}</span>,<span key="contact">{c.contactEmail||'Belum diisi'}{c.contactPhone&&<small>{c.contactPhone}</small>}</span>,services.filter(service=>(service.customerId??service.customer?.id)===c.id).length,...(isAdmin?[<div key="actions"><button type="button" onClick={()=>{setEditCustomerId(c.id);setCustomerData({name:c.name,contactEmail:c.contactEmail||'',contactPhone:c.contactPhone||''});setShowCustomerModal(true);}}>Edit</button><button type="button" data-danger="true" onClick={async()=>{if(!confirm(`Hapus customer ${c.name}?`))return;try{const res=await fetch(`/api/assets/customers/${c.id}`,{method:'DELETE'});if(res.ok)setCustomers(prev=>prev.filter(x=>x.id!==c.id));else alert((await res.json()).error);}catch{alert('Customer gagal dihapus. Coba lagi.');}}}>Hapus</button></div>]:[])]}))}/>}

      {activeTab === 'templates' && <AssetMasterList title="Produk layanan" columns={['Produk','Status','Layanan',...(isAdmin?['Aksi']:[])]} addLabel="Tambah produk" onAdd={isAdmin?()=>{setEditTemplateId(null);setTemplateData({name:''});setShowTemplateModal(true);}:undefined} rows={templates.map(t=>({id:t.id,search:`${t.name} ${t.active?'Aktif':'Arsip'}`,cells:[<strong key="name">{t.name}</strong>,t.active?'Aktif':'Arsip',services.filter(service=>(service.templateId??service.template?.id)===t.id).length,...(isAdmin?[<div key="actions"><button type="button" onClick={()=>{setEditTemplateId(t.id);setTemplateData({name:t.name});setShowTemplateModal(true);}}>Edit</button><button type="button" data-danger="true" onClick={async()=>{if(!confirm(`Hapus produk ${t.name}?`))return;try{const res=await fetch(`/api/assets/templates/${t.id}`,{method:'DELETE'});if(res.ok)setTemplates(prev=>prev.filter(x=>x.id!==t.id));else alert((await res.json()).error);}catch{alert('Produk gagal dihapus. Coba lagi.');}}}>Hapus</button></div>]:[])]}))}/>}
      {activeTab === 'blast' && (
        <div>
          <div className="bg-white-card ui-static-34b900d735" >
            <h3 className="ui-static-980d0fe234" >Trace Upstream Impact (Blast Radius)</h3>
            <p className="ui-static-2cfd0f3695" >Search for a Datacenter, Router device, or port name to instantly discover which Customer Services pass through that node. Very useful for mass notification during unexpected outages.</p>
            <input 
              type="text" 
              placeholder="e.g. Cyber-1, xe-0/0/0, MKT-ROUTER..." 
              value={blastQuery}
              onChange={e => setBlastQuery(e.target.value)}
              className="input-field ui-static-478acf0431"
              style={{width: '100%', maxWidth: '600px'}}
            />
          </div>

          {blastQuery.length > 1 && (
            <div className="ui-static-92254f43e7" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))'}}>
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
                  <div key={srv.id} className="bg-white-card hover-lift ui-static-884e7dd4e5" >
                    <div className="ui-static-3e8220669e" >
                      <span className="ui-static-76da38e60c" style={{textTransform: 'uppercase'}}>Affected Customer</span>
                      <h3 className="ui-static-61920713ff" >{srv.customer?.name}</h3>
                      <Link href={`/assets/${srv.id}`} className="ui-static-9aa78c862d" style={{textDecoration: 'none'}}>{srv.name}</Link>
                    </div>
                    
                    <div className="ui-static-8acde194b0" >
                      <div className="ui-static-8a898791c6" style={{textTransform: 'uppercase'}}>Compromised Nodes:</div>
                      {matchedHops.map((h, i) => (
                        <div key={i} className="ui-static-44e06c069f" style={{display: 'flex'}}>
                          <span className="ui-static-d087b501d0" ></span>
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
                 <div className="ui-static-a88f6005e3" style={{gridColumn: '1 / -1', textAlign: 'center'}}>
                   No customers are passing through this point of failure.
                 </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CUSTOMER MODAL */}
      {showCustomerModal && (
        <div className="ui-static-a809d66476" style={{position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'}}>
          <div className="bg-white-card scale-in ui-static-239a0228f6" style={{width: '100%', maxWidth: '400px'}}>
            <h2 className="ui-static-1c88149a3f" >{editCustomerId ? 'Edit Customer' : 'Register Customer'}</h2>
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
              <div className="ui-static-3e8220669e" >
                <label className="ui-static-abe0244be5" style={{display: 'block'}}>Company Name</label>
                <input type="text" required className="input-field ui-static-b52e2fe28a" value={customerData.name} onChange={e => setCustomerData(p => ({...p, name: e.target.value}))} style={{width: '100%'}} />
              </div>
              <div className="ui-static-3e8220669e" >
                <label className="ui-static-abe0244be5" style={{display: 'block'}}>Email</label>
                <input type="email" className="input-field ui-static-b52e2fe28a" value={customerData.contactEmail} onChange={e => setCustomerData(p => ({...p, contactEmail: e.target.value}))} style={{width: '100%'}} />
              </div>
              <div className="ui-static-a5e927dc66" >
                <label className="ui-static-abe0244be5" style={{display: 'block'}}>Phone/NOC String</label>
                <input type="text" className="input-field ui-static-b52e2fe28a" value={customerData.contactPhone} onChange={e => setCustomerData(p => ({...p, contactPhone: e.target.value}))} style={{width: '100%'}} />
              </div>
              <div className="ui-static-af81cc4264" style={{display: 'flex', justifyContent: 'flex-end'}}>
                <button type="button" onClick={() => setShowCustomerModal(false)} className="secondary-btn">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="primary-btn">{isSubmitting ? 'Saving...' : 'Register'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEMPLATE MODAL */}
      {showTemplateModal && (
        <div className="ui-static-a809d66476" style={{position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'}}>
          <div className="bg-white-card scale-in ui-static-239a0228f6" style={{width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto'}}>
            <h2 className="ui-static-1c88149a3f" >{editTemplateId ? 'Edit Template' : 'Define Service Template'}</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmitting(true);
              try {
                const isEdit = !!editTemplateId;
                const url = isEdit ? `/api/assets/templates/${editTemplateId}` : '/api/assets/templates';
                const method = isEdit ? 'PATCH' : 'POST';
                const payload = { name: templateData.name };
                
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
              <div className="ui-static-8bd9dc7312" >
                <label className="ui-static-abe0244be5" style={{display: 'block'}}>Template Name</label>
                <input type="text" required placeholder="e.g. IPLC DWDM" className="input-field ui-static-b52e2fe28a" value={templateData.name} onChange={e => setTemplateData(p => ({...p, name: e.target.value}))} style={{width: '100%'}} />
              </div>

              <div className="ui-static-af81cc4264" style={{display: 'flex', justifyContent: 'flex-end'}}>
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
