'use client';
import CapacityInput from '@/components/CapacityInput';
import {isDarkFiber,isPairField,readPairCount} from '@/lib/services/productUnits';


import {minimumBandwidthGbps} from '@/lib/services/productBandwidth';
import {isBandwidthField,isPlaceholderField} from '@/lib/services/fields';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ServiceForm({ session, customers, templates, ticketSetup = false }) {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    customerId: '',
    templateId: '',
    name: '',
    cid: '',
    status: ticketSetup ? 'Pending' : 'Active',
    company: 'ION',
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

  useEffect(()=>{if(isDarkFiber(selectedTemplate))setCustomData(d=>({...d,pairCount:readPairCount({customData:d})??1}));if(minimumBandwidthGbps(selectedTemplate)===10&&!(Number(customData.bandwidthMbps)>=10000))setCustomData(d=>({...d,bandwidthMbps:10000}));},[formData.templateId]);
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
    if (ticketSetup && !formData.cid.trim()) return alert('Isi CID circuit sebelum melanjutkan ke tiket instalasi.');
    
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        ...(ticketSetup ? { status: 'Pending' } : {}),
        customData,
        hops: hops.filter(h => h.location || h.deviceName) // filters empty hops out
      };
      
      const res = await fetch('/api/assets/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const created = await res.json();
        router.push(ticketSetup ? `/tickets/new?workType=ServiceWork&serviceId=${created.id}&operation=Installation` : '/assets');
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
      <header className="page-header ui-static-a5e927dc66" >
        <Link href="/assets" className="ui-static-0c7b8f63ec" style={{textDecoration: 'none', display: 'inline-block'}}>← Back to Inventory</Link>
        <h1 className="ui-static-084dc32886" >Provision New Service Asset</h1>
        {ticketSetup && <p>Daftarkan customer dan CID untuk instalasi baru. Circuit disimpan sebagai Pending; setelah ini lanjut membuat tiket instalasi. Layanan diaktifkan saat tiket Resolve.</p>}
      </header>

      <div className="ui-static-b7efa54e0b" style={{display: 'flex', justifyContent: 'space-between', position: 'relative'}}>
         <div className="ui-static-b3d82d4be4" style={{position: 'absolute', top: '50%', left: '2rem', right: '2rem', height: '3px', zIndex: 0, transform: 'translateY(-50%)'}}></div>
         <div className="ui-static-ef5a4549cc" style={{position: 'absolute', top: '50%', left: '2rem', height: '3px', zIndex: 1, width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : 'calc(100% - 4rem)', transition: 'all 0.4s ease', transform: 'translateY(-50%)'}}></div>
         
         {['Basic Info', 'Parameters', 'Topology Hops'].map((label, idx) => {
           const stepNum = idx + 1;
           const isActive = currentStep >= stepNum;
           return (
             <div key={stepNum} className="ui-static-30f523173e" style={{zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
               <div className="ui-static-66daff2a8d" style={{background: isActive ? 'var(--primary-color)' : 'var(--card-bg)', color: isActive ? 'white' : 'var(--text-color)', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: isActive ? 'var(--primary-color)' : 'var(--border-color)', transition: 'all 0.3s'}}>
                 {isActive && currentStep > stepNum ? '✓' : stepNum}
               </div>
               <span className="ui-static-fc155e091a" style={{fontWeight: isActive ? 'bold' : 'normal', color: isActive ? 'var(--primary-color)' : 'var(--text-color)'}}>{label}</span>
             </div>
           );
         })}
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
          
          {/* STEP 1: Basic Config */}
          {currentStep === 1 && (
            <div className="bg-white-card scale-in ui-static-f932d0c67a" style={{flexGrow: 1}}>
              <h2 className="ui-static-06cb2ac976" > Step 1: Core Configuration</h2>
              
              <div className="ui-static-908f0c3ed9" style={{display: 'flex', flexDirection: 'column', maxWidth: '600px'}}>
                <div>
                  <label className="ui-static-955921f9b4" style={{display: 'block'}}>Select Customer</label>
                  <select className="input-field ui-static-90fb66f0af" required value={formData.customerId} onChange={e => setFormData({...formData, customerId: e.target.value})} >
                    <option value="">-- Assign Customer --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="ui-static-955921f9b4" style={{display: 'block'}}>Service Bundle / Template</label>
                  <select className="input-field ui-static-90fb66f0af" required value={formData.templateId} onChange={e => setFormData({...formData, templateId: e.target.value})} >
                    <option value="">-- Select Framework --</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="service-company" className="ui-static-955921f9b4" style={{display: 'block'}}>Perusahaan layanan</label>
                  <select id="service-company" className="input-field ui-static-90fb66f0af" required value={formData.company} onChange={e=>setFormData({...formData,company:e.target.value})}>
                    <option value="ION">ION</option><option value="SDC">SDC</option>
                  </select>
                  <small>Satu customer dapat memiliki CID ION dan SDC.</small>
                </div>
                
                <div>
                  <label className="ui-static-955921f9b4" style={{display: 'block'}}>Service Alias / Reference Name</label>
                  <input type="text" className="input-field ui-static-90fb66f0af" required placeholder="e.g. IPLC Jakarta-Singapore 10G" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}  />
                </div>
                <div>
                  <label htmlFor="service-cid" className="ui-static-ffdc3ed5d1" style={{display: 'block'}}>CID layanan / link</label>
                  <input id="service-cid" type="text" className="input-field" required={ticketSetup} maxLength={100} value={formData.cid} onChange={e => setFormData({ ...formData, cid: e.target.value })} placeholder="CID unik untuk layanan ini" />
                  <small>Digunakan untuk menautkan trouble dan laporan SLA per layanan.</small>
                </div>
                <div>
                  <CapacityInput id="service-capacity" unit={isDarkFiber(selectedTemplate)?'pair':'Gbps'} min={isDarkFiber(selectedTemplate)?1:minimumBandwidthGbps(selectedTemplate)} value={isDarkFiber(selectedTemplate)?customData.pairCount??1:customData.bandwidthMbps==null?'':customData.bandwidthMbps/1000} onChange={e=>setCustomData({...customData,...(isDarkFiber(selectedTemplate)?{pairCount:e.target.value===''?'':Number(e.target.value)}:{bandwidthMbps:e.target.value===''?null:Number(e.target.value)*1000})})}/>
                  <small>Kapasitas awal untuk Inventory. Kapasitas tujuan dapat dilengkapi pada tiket instalasi.</small>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Parameters */}
          {currentStep === 2 && (
            <div className="bg-white-card scale-in ui-static-20066c994c" style={{flexGrow: 1}}>
              <h2 className="ui-static-3ce93dbefa" > Step 2: Technical Parameters</h2>
              
              {dynamicFields.length === 0 ? (
                <div className="ui-static-0dfa991ce7" style={{textAlign: 'center'}}>
                   <div className="ui-static-917c0011b7" >✓</div>
                   <h3>No specialized technical parameters are required for this Template.</h3>
                   <p>You may proceed directly to Step 3.</p>
                </div>
              ) : (
                <div className="ui-static-92254f43e7" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))'}}>
                  {dynamicFields.filter(f=>!isBandwidthField(f.name)&&!isPlaceholderField(f.name)&&!isPairField(f.name)).map((f, i) => (
                    <div key={i} className="bg-white-card ui-static-cb39be5cc9" >
                      <label className="ui-static-98c683fce1" style={{display: 'block'}}>{f.name}</label>
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
            <div className="bg-white-card scale-in ui-static-f932d0c67a" style={{flexGrow: 1}}>
              <div className="ui-static-6809ba0885" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h2 className="ui-static-ee96dc83fb" > Step 3: Architecture & Hops</h2>
                <button type="button" onClick={addHop} className="ui-static-95d7382751" style={{cursor: 'pointer'}}>+ Add New Node</button>
              </div>

              <div className="ui-static-92254f43e7" style={{display: 'flex', flexDirection: 'column'}}>
                {hops.map((hop, i) => (
                  <div key={i} className="ui-static-792facd00f" style={{position: 'relative'}}>
                    <div className="ui-static-0cb6e7183c" style={{position: 'absolute', top: '-14px', left: '-16px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{i + 1}</div>
                    
                    {hops.length > 1 && (
                      <button type="button" onClick={() => removeHop(i)} className="ui-static-5bf62bc694" style={{position: 'absolute', top: '0.8rem', right: '1rem', height: '30px', width: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'}}>×</button>
                    )}

                    <div className="ui-static-92254f43e7" style={{display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)'}}>
                      <div>
                        <label className="ui-static-f256375bc1" style={{display: 'block'}}>Location / POP</label>
                        <input type="text" placeholder="e.g. Cyber-1 lantai 2" list="topology-locations" className="input-field ui-static-6811bec797"  value={hop.location} onChange={e => handleHopChange(i, 'location', e.target.value)} />
                      </div>
                      <div>
                        <label className="ui-static-f256375bc1" style={{display: 'block'}}>Router / Device</label>
                        <input type="text" placeholder="e.g. CSR-01-JKT" list="topology-devices" className="input-field ui-static-6811bec797"  value={hop.deviceName} onChange={e => handleHopChange(i, 'deviceName', e.target.value)} />
                      </div>
                      <div>
                        <label className="ui-static-f256375bc1" style={{display: 'block'}}>Port Name</label>
                        <input type="text" placeholder="e.g. xe-0/0/0" list="topology-ports" className="input-field ui-static-6811bec797"  value={hop.portName} onChange={e => handleHopChange(i, 'portName', e.target.value)} />
                      </div>
                      <div>
                        <label className="ui-static-f256375bc1" style={{display: 'block'}}>Cross-Connect (XC) / Desc</label>
                        <input type="text" placeholder="e.g. Patchcord to ODF" className="input-field ui-static-6811bec797"  value={hop.description} onChange={e => handleHopChange(i, 'description', e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* CONTROLS */}
        <div className="ui-static-c09db111b1" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
           <div>
             {currentStep === 1 && <Link href="/assets" className="secondary-btn" style={{ textDecoration: 'none' }}>Cancel</Link>}
             {currentStep > 1 && <button type="button" onClick={handleBack} className="secondary-btn ui-static-2d6f137a15" >← Back</button>}
           </div>
           
           <div>
             {currentStep < 3 ? (
                <button type="button" onClick={handleNext} className="primary-btn ui-static-3c6a0e9c89" >Next Step →</button>
             ) : (
                <button type="submit" disabled={isSubmitting} className="primary-btn ui-static-5651b260d2" >
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
