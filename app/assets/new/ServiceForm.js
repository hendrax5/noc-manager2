'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ServiceForm({ session, customers, templates }) {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    customerId: '',
    templateId: '',
    name: '',
    status: 'Active',
    monthlyCost: '',
    currency: 'IDR',
    contractEnd: ''
  });
  
  const [customData, setCustomData] = useState({});
  const [hops, setHops] = useState([{ location: '', deviceName: '', portName: '', description: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [hints, setHints] = useState({ locations: [], devices: [], ports: [] });

  useEffect(() => {
    fetch('/api/assets/topology-hints')
      .then(res => res.json())
      .then(data => {
         if (data.locations) setHints(data);
      })
      .catch(e => console.error(e));
  }, []);

  const selectedTemplate = templates.find(t => t.id === parseInt(formData.templateId));
  const dynamicFields = selectedTemplate && selectedTemplate.fields ? (typeof selectedTemplate.fields === 'string' ? JSON.parse(selectedTemplate.fields) : selectedTemplate.fields) : [];

  const handleHopChange = (index, field, value) => {
    const newHops = [...hops];
    newHops[index][field] = value;
    setHops(newHops);
  };
  
  const addHop = () => setHops([...hops, { location: '', deviceName: '', portName: '', description: '' }]);
  const removeHop = (i) => setHops(hops.filter((_, idx) => idx !== i));

  const handleNext = () => {
    if (currentStep === 1) {
      if (!formData.customerId || !formData.templateId || !formData.name) {
         return alert('⚠️ Customer, Template, and Service Name are required to proceed.');
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (currentStep < 3) {
      handleNext();
      return;
    }
    if (!formData.customerId || !formData.templateId || !formData.name) return alert('Please fill core fields');
    
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        customData,
        hops: hops.filter(h => h.location || h.deviceName) // filters empty hops out
      };
      
      const res = await fetch('/api/assets/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        router.push('/assets');
        router.refresh();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save service');
      }
    } catch (e) {
      console.error(e);
      alert('Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="container" style={{ maxWidth: '1000px' }}>
      <header className="page-header" style={{ marginBottom: '2rem' }}>
        <Link href="/assets" style={{ color: 'var(--text-color)', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'inline-block' }}>← Back to Inventory</Link>
        <h1 style={{ marginTop: '0.5rem' }}>Provision New Service Asset</h1>
      </header>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2.5rem', position: 'relative', padding: '0 2rem' }}>
         <div style={{ position: 'absolute', top: '50%', left: '2rem', right: '2rem', height: '3px', background: 'var(--border-color)', zIndex: 0, transform: 'translateY(-50%)' }}></div>
         <div style={{ position: 'absolute', top: '50%', left: '2rem', height: '3px', background: 'var(--primary-color)', zIndex: 1, width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : 'calc(100% - 4rem)', transition: 'all 0.4s ease', transform: 'translateY(-50%)' }}></div>
         
         {['Basic Info', 'Parameters', 'Topology Hops'].map((label, idx) => {
           const stepNum = idx + 1;
           const isActive = currentStep >= stepNum;
           return (
             <div key={stepNum} style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
               <div style={{ background: isActive ? 'var(--primary-color)' : 'var(--card-bg)', color: isActive ? 'white' : 'var(--text-color)', width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', border: '3px solid', borderColor: isActive ? 'var(--primary-color)' : 'var(--border-color)', transition: 'all 0.3s' }}>
                 {isActive && currentStep > stepNum ? '✓' : stepNum}
               </div>
               <span style={{ fontSize: '0.8rem', fontWeight: isActive ? 'bold' : 'normal', color: isActive ? 'var(--primary-color)' : 'var(--text-color)' }}>{label}</span>
             </div>
           );
         })}
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
          
          {/* STEP 1: Basic Config */}
          {currentStep === 1 && (
            <div className="bg-white-card scale-in" style={{ padding: '2.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', flexGrow: 1 }}>
              <h2 style={{ margin: '0 0 2rem 0', color: 'var(--heading-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>📦 Step 1: Core Configuration</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.95rem', color: 'var(--heading-color)' }}>Select Customer</label>
                  <select className="input-field" required value={formData.customerId} onChange={e => setFormData({...formData, customerId: e.target.value})} style={{ padding: '0.8rem', fontSize: '1.05rem' }}>
                    <option value="">-- Assign Customer --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.95rem', color: 'var(--heading-color)' }}>Service Bundle / Template</label>
                  <select className="input-field" required value={formData.templateId} onChange={e => setFormData({...formData, templateId: e.target.value})} style={{ padding: '0.8rem', fontSize: '1.05rem' }}>
                    <option value="">-- Select Framework --</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.95rem', color: 'var(--heading-color)' }}>Service Alias / Reference Name</label>
                  <input type="text" className="input-field" required placeholder="e.g. IPLC Jakarta-Singapore 10G" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ padding: '0.8rem', fontSize: '1.05rem' }} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Parameters */}
          {currentStep === 2 && (
            <div className="bg-white-card scale-in" style={{ padding: '2.5rem', borderRadius: '12px', border: '1px dashed var(--primary-color)', background: 'rgba(59,130,246,0.01)', flexGrow: 1 }}>
              <h2 style={{ margin: '0 0 2rem 0', color: 'var(--primary-color)', borderBottom: '1px solid var(--primary-color)', paddingBottom: '0.5rem' }}>⚙️ Step 2: Technical Parameters</h2>
              
              {dynamicFields.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-color)' }}>
                   <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
                   <h3>No specialized technical parameters are required for this Template.</h3>
                   <p>You may proceed directly to Step 3.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                  {dynamicFields.map((f, i) => (
                    <div key={i} className="bg-white-card" style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-color)' }}>{f.name}</label>
                      <input 
                        type={f.type === 'number' ? 'number' : 'text'} 
                        className="input-field" 
                        placeholder={`Enter ${f.name}...`} 
                        required={f.required}
                        value={customData[f.name] || ''}
                        onChange={e => setCustomData({...customData, [f.name]: e.target.value})}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Route Topology */}
          {currentStep === 3 && (
            <div className="bg-white-card scale-in" style={{ padding: '2.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h2 style={{ margin: 0, color: 'var(--heading-color)' }}>🖧 Step 3: Architecture & Hops</h2>
                <button type="button" onClick={addHop} style={{ background: 'var(--primary-color)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>+ Add New Node</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {hops.map((hop, i) => (
                  <div key={i} style={{ position: 'relative', background: 'var(--hover-bg)', padding: '2rem 1.5rem 1.5rem 1.5rem', borderRadius: '12px', borderLeft: '5px solid var(--primary-color)', borderTop: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ position: 'absolute', top: '-14px', left: '-16px', background: 'var(--primary-color)', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem', border: '3px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>{i + 1}</div>
                    
                    {hops.length > 1 && (
                      <button type="button" onClick={() => removeHop(i)} style={{ position: 'absolute', top: '0.8rem', right: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', height: '30px', width: '30px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>×</button>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-color)', marginBottom: '0.3rem', display: 'block' }}>Location / POP</label>
                        <input type="text" placeholder="e.g. Cyber-1 lantai 2" list="topology-locations" className="input-field" style={{ padding: '0.8rem', fontSize: '0.9rem' }} value={hop.location} onChange={e => handleHopChange(i, 'location', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-color)', marginBottom: '0.3rem', display: 'block' }}>Router / Device</label>
                        <input type="text" placeholder="e.g. CSR-01-JKT" list="topology-devices" className="input-field" style={{ padding: '0.8rem', fontSize: '0.9rem' }} value={hop.deviceName} onChange={e => handleHopChange(i, 'deviceName', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-color)', marginBottom: '0.3rem', display: 'block' }}>Port Name</label>
                        <input type="text" placeholder="e.g. xe-0/0/0" list="topology-ports" className="input-field" style={{ padding: '0.8rem', fontSize: '0.9rem' }} value={hop.portName} onChange={e => handleHopChange(i, 'portName', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-color)', marginBottom: '0.3rem', display: 'block' }}>Cross-Connect (XC) / Desc</label>
                        <input type="text" placeholder="e.g. Patchcord to ODF" className="input-field" style={{ padding: '0.8rem', fontSize: '0.9rem' }} value={hop.description} onChange={e => handleHopChange(i, 'description', e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* CONTROLS */}
        <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 -4px 10px rgba(0,0,0,0.02)' }}>
           <div>
             {currentStep === 1 && <Link href="/assets" className="secondary-btn" style={{ textDecoration: 'none' }}>Cancel</Link>}
             {currentStep > 1 && <button type="button" onClick={handleBack} className="secondary-btn" style={{ padding: '0 2rem' }}>← Back</button>}
           </div>
           
           <div>
             {currentStep < 3 ? (
                <button type="button" onClick={handleNext} className="primary-btn" style={{ fontSize: '1.05rem', padding: '0 2.5rem' }}>Next Step →</button>
             ) : (
                <button type="submit" disabled={isSubmitting} className="primary-btn" style={{ background: '#10b981', fontSize: '1.05rem', padding: '0 2.5rem', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)' }}>
                  {isSubmitting ? 'Provisioning...' : '✅ Provision Service Core'}
                </button>
             )}
           </div>
        </div>
      </form>

      {/* Global Datalists for Autocomplete */}
      <datalist id="topology-locations">
         {hints.locations.map((loc, i) => <option key={i} value={loc} />)}
      </datalist>
      <datalist id="topology-devices">
         {hints.devices.map((dev, i) => <option key={i} value={dev} />)}
      </datalist>
      <datalist id="topology-ports">
         {hints.ports.map((p, i) => <option key={i} value={p} />)}
      </datalist>

    </main>
  );
}
