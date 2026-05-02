"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SchedulesClient({ initialShiftTypes, users, locations, departments = [], currentUser }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("calendar");
  const [shiftTypes, setShiftTypes] = useState(initialShiftTypes);
  
  const isAdminOrManager = currentUser.permissions?.includes('team.schedule');

  // --- Calendar Tab State ---
  const [schedules, setSchedules] = useState([]);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calLocation, setCalLocation] = useState("");
  const [calDepartment, setCalDepartment] = useState("");
  const [loadingCal, setLoadingCal] = useState(false);

  // --- Prefernces Tab State ---
  const [editPrefId, setEditPrefId] = useState(null);
  const [prefFormData, setPrefFormData] = useState({});

  // --- Shift Types State ---
  const [shiftFormData, setShiftFormData] = useState({ name: '', startTime: '', endTime: '' });

  // --- Department Rules State ---
  const [editDeptId, setEditDeptId] = useState(null);
  const [deptFormData, setDeptFormData] = useState({});

  // --- Manual Override State ---
  const [editCell, setEditCell] = useState(null);


  // -------------------------
  // Fetch Schedules Logic
  // -------------------------
  const fetchSchedules = async () => {
    setLoadingCal(true);
    const start = new Date(calYear, calMonth, 1).toISOString();
    const end = new Date(calYear, calMonth + 1, 0, 23, 59, 59).toISOString();
    let url = `/api/schedules?start=${start}&end=${end}`;
    if (calLocation) url += `&locationId=${calLocation}`;
    if (calDepartment) url += `&departmentId=${calDepartment}`;
    
    const res = await fetch(url);
    if (res.ok) setSchedules(await res.json());
    setLoadingCal(false);
  };

  useEffect(() => {
    fetchSchedules();
  }, [calMonth, calYear, calLocation, calDepartment]);

  // -------------------------
  // Generator Action
  // -------------------------
  const handleGenerate = async () => {
    if (!isAdminOrManager) return alert("Forbidden");
    if (!confirm('Warning: This will overwrite existing generated shifts for the selected month and location. Proceed?')) return;
    
    const start = new Date(calYear, calMonth, 1).toISOString();
    const end = new Date(calYear, calMonth + 1, 0, 23, 59, 59).toISOString();
    
    const res = await fetch('/api/schedules/generate', {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: start, endDate: end, locationId: calLocation || null, departmentId: calDepartment || null })
    });
    
    if (res.ok) {
      alert("Schedules successfully generated!");
      fetchSchedules();
    } else {
      const err = await res.json();
      alert(`Error: ${err.error}`);
    }
  };

  // -------------------------
  // Preference Handlers
  // -------------------------
  const handleSavePreference = async (userId) => {
    const res = await fetch('/api/schedules/preferences', {
      method: "PATCH", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        userId,
        scheduleMode: prefFormData.scheduleMode,
        fixedShiftId: prefFormData.fixedShiftId,
        fixedOffDays: prefFormData.fixedOffDays
      })
    });
    if (res.ok) {
      alert("Saved Preferences!");
      router.refresh();
      setEditPrefId(null);
    }
  };

  const toggleOffDay = (dayIndex) => {
    setPrefFormData(prev => {
      const current = prev.fixedOffDays || [];
      if (current.includes(dayIndex)) return { ...prev, fixedOffDays: current.filter(d => d !== dayIndex) };
      return { ...prev, fixedOffDays: [...current, dayIndex] };
    });
  };

  // -------------------------
  // Render Helpers
  // -------------------------
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const dayHeaders = Array.from({length: daysInMonth}, (_, i) => i + 1);

  // Group schedules by User for Calendar Grid
  const gridData = {};
  schedules.forEach(s => {
    if (!gridData[s.userId]) gridData[s.userId] = { user: s.user, days: {} };
    const day = new Date(s.date).getDate();
    gridData[s.userId].days[day] = s.shiftType; // could be null if off day
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('calendar')} className={activeTab === 'calendar' ? 'primary-btn' : 'secondary-btn'} style={{ width: 'auto' }}>🗓️ Schedule Grid</button>
        {isAdminOrManager && <button onClick={() => setActiveTab('departments')} className={activeTab === 'departments' ? 'primary-btn' : 'secondary-btn'} style={{ width: 'auto' }}>🏢 Dept Rules</button>}
        {isAdminOrManager && <button onClick={() => setActiveTab('preferences')} className={activeTab === 'preferences' ? 'primary-btn' : 'secondary-btn'} style={{ width: 'auto' }}>⚙️ User Preferences</button>}
        {isAdminOrManager && <button onClick={() => setActiveTab('types')} className={activeTab === 'types' ? 'primary-btn' : 'secondary-btn'} style={{ width: 'auto' }}>⏰ Shift Types</button>}
      </div>

      {activeTab === 'calendar' && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <select value={calMonth} onChange={e => setCalMonth(parseInt(e.target.value))} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                {Array.from({length: 12}).map((_, i) => (
                  <option key={i} value={i}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
                ))}
              </select>
              <select value={calYear} onChange={e => setCalYear(parseInt(e.target.value))} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
              </select>
              <select value={calLocation} onChange={e => setCalLocation(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                <option value="">All Locations</option>
                {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.city}</option>)}
              </select>
              <select value={calDepartment} onChange={e => setCalDepartment(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            {isAdminOrManager && (
              <button onClick={handleGenerate} className="primary-btn" style={{ width: 'auto', background: '#8b5cf6' }}>
                ⚡ Auto-Generate Roster
              </button>
            )}
          </div>
          
          <div style={{ overflowX: 'auto', padding: '1.5rem' }}>
            {loadingCal ? <p>Loading Schedule Matrix...</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '1200px' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.75rem', background: '#e2e8f0', border: '1px solid #cbd5e1', textAlign: 'left', position: 'sticky', left: 0, zIndex: 1 }}>Employee / Team</th>
                    {dayHeaders.map(d => {
                      const dateObj = new Date(calYear, calMonth, d);
                      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                      return (
                        <th key={d} style={{ padding: '0.5rem', background: isWeekend ? '#fecaca' : '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '0.8rem', minWidth: '40px' }}>
                          <div>{d}</div>
                          <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{dateObj.toLocaleDateString('en-US', { weekday: 'short'})}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Object.values(gridData).map(row => (
                    <tr key={row.user.id}>
                      <td style={{ padding: '0.75rem', border: '1px solid var(--border-color)', textAlign: 'left', fontWeight: 'bold', background: 'var(--table-header-bg)', position: 'sticky', left: 0 }}>
                        {row.user.name || row.user.email} <br />
                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'normal' }}>{row.user.location?.city || 'No Location'}</span>
                      </td>
                      {dayHeaders.map(d => {
                        const shift = row.days[d];
                        // If shift logic defined it but shiftType is null => Off day. If undefined => Not generated
                        const isOff = row.days.hasOwnProperty(d) && shift === null;
                        const isPending = !row.days.hasOwnProperty(d);
                        
                        return (
                          <td 
                            key={d} 
                            onClick={() => isAdminOrManager && setEditCell({ userId: row.user.id, userName: row.user.name, date: d, currentShiftId: shift?.id })}
                            style={{ padding: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.75rem', background: isOff ? '#f8fafc' : isPending ? 'white' : '#dbeafe', cursor: isAdminOrManager ? 'pointer' : 'default' }}
                            title="Click to edit"
                          >
                            {isOff ? <span style={{ color: '#94a3b8' }}>OFF</span> : isPending ? <span style={{ color: '#cbd5e1' }}>-</span> : (
                              <div style={{ fontWeight: 'bold', color: '#1e40af' }}>{shift?.name}</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {Object.keys(gridData).length === 0 && (
                    <tr><td colSpan={daysInMonth + 1} style={{ padding: '2rem', color: '#94a3b8' }}>No schedules generated for this range.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {editCell && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: '400px' }}>
            <h3 style={{ marginTop: 0 }}>Edit Shift for {editCell.userName}</h3>
            <p style={{ color: '#64748b' }}>Date: {new Date(calYear, calMonth, editCell.date).toLocaleDateString()}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <button onClick={() => handleSaveManualShift('OFF')} className="secondary-btn" style={{ textAlign: 'left' }}>❌ OFF Day (Clear Shift)</button>
              {shiftTypes.map(st => (
                <button key={st.id} onClick={() => handleSaveManualShift(st.id)} className={editCell.currentShiftId === st.id ? 'primary-btn' : 'secondary-btn'} style={{ textAlign: 'left' }}>
                  {st.name} ({st.startTime} - {st.endTime})
                </button>
              ))}
            </div>
            <button onClick={() => setEditCell(null)} style={{ marginTop: '1.5rem', width: '100%', padding: '0.75rem', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {activeTab === 'departments' && isAdminOrManager && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Department Schedule Rules</h2>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Configure shifting rules for departments. E.g. 3-shift roster or normal office hours.</p>
          
          <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: '1rem', borderBottom: '2px solid #cbd5e1' }}>Department</th>
                <th style={{ padding: '1rem', borderBottom: '2px solid #cbd5e1' }}>Mode</th>
                <th style={{ padding: '1rem', borderBottom: '2px solid #cbd5e1' }}>Allowed Shifts (for Roster)</th>
                <th style={{ padding: '1rem', borderBottom: '2px solid #cbd5e1' }}>Roster Cycle / Off-Days</th>
                <th style={{ padding: '1rem', borderBottom: '2px solid #cbd5e1' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map(d => {
                const rules = d.scheduleRules || { mode: 'USER_PREF', shiftIds: [], daysBeforeOff: 6, offDaysCount: 2, fixedOffDays: [] };
                const isEditing = editDeptId === d.id;
                const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{d.name}</td>
                    
                    {isEditing ? (
                      <>
                        <td style={{ padding: '1rem' }}>
                          <select value={deptFormData.mode} onChange={e => setDeptFormData({...deptFormData, mode: e.target.value})} style={{ padding: '0.5rem' }}>
                            <option value="USER_PREF">Use Employee Prefs (Default)</option>
                            <option value="ROSTER_3_SHIFT">Roster Mode (Sticky Shifts)</option>
                            <option value="OFFICE_5_2">Office 5 Work / 2 Off</option>
                            <option value="OFFICE_6_1">Office 6 Work / 1 Off</option>
                          </select>
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.8rem' }}>
                          {deptFormData.mode === 'ROSTER_3_SHIFT' ? (
                            <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                              {shiftTypes.map(st => (
                                <label key={st.id} style={{ background: deptFormData.shiftIds?.includes(st.id) ? '#dbeafe' : '#f1f5f9', padding: '0.2rem 0.4rem', borderRadius: '4px', cursor: 'pointer', border: deptFormData.shiftIds?.includes(st.id) ? '1px solid #3b82f6' : '1px solid transparent' }}>
                                  <input type="checkbox" style={{ display: 'none' }} checked={deptFormData.shiftIds?.includes(st.id)} onChange={() => toggleDeptShift(st.id)} />
                                  {st.name}
                                </label>
                              ))}
                            </div>
                          ) : '-'}
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.8rem' }}>
                          {deptFormData.mode === 'ROSTER_3_SHIFT' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <label>Days before OFF: <input type="number" min="1" max="14" value={deptFormData.daysBeforeOff} onChange={e => setDeptFormData({...deptFormData, daysBeforeOff: parseInt(e.target.value)})} style={{ width: '50px' }} /></label>
                              <label>OFF days count: <input type="number" min="1" max="7" value={deptFormData.offDaysCount} onChange={e => setDeptFormData({...deptFormData, offDaysCount: parseInt(e.target.value)})} style={{ width: '50px' }} /></label>
                            </div>
                          )}
                          {(deptFormData.mode === 'OFFICE_5_2' || deptFormData.mode === 'OFFICE_6_1') && (
                            <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                              {daysOfWeek.map((dayName, idx) => (
                                <label key={idx} style={{ background: deptFormData.fixedOffDays?.includes(idx) ? '#fca5a5' : '#f1f5f9', padding: '0.2rem 0.4rem', borderRadius: '4px', cursor: 'pointer' }}>
                                  <input type="checkbox" style={{ display: 'none' }} checked={deptFormData.fixedOffDays?.includes(idx)} onChange={() => toggleDeptOffDay(idx)} />
                                  {dayName}
                                </label>
                              ))}
                            </div>
                          )}
                          {deptFormData.mode === 'USER_PREF' && '-'}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <button onClick={() => handleSaveDeptRule(d.id)} className="primary-btn" style={{ width: 'auto', padding: '0.4rem 0.8rem', marginRight: '0.5rem' }}>Save</button>
                          <button onClick={() => setEditDeptId(null)} className="secondary-btn" style={{ width: 'auto', padding: '0.4rem 0.8rem' }}>Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '1rem' }}>
                          <span className="badge" style={{ background: rules.mode === 'ROSTER_3_SHIFT' ? '#8b5cf6' : rules.mode.startsWith('OFFICE') ? '#3b82f6' : '#64748b' }}>{rules.mode}</span>
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>
                          {rules.mode === 'ROSTER_3_SHIFT' && rules.shiftIds ? rules.shiftIds.map(id => shiftTypes.find(s => s.id === id)?.name).filter(Boolean).join(', ') : '-'}
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.8rem' }}>
                          {rules.mode === 'ROSTER_3_SHIFT' && `${rules.daysBeforeOff} work / ${rules.offDaysCount} off`}
                          {rules.mode.startsWith('OFFICE') && rules.fixedOffDays && rules.fixedOffDays.map(day => daysOfWeek[day]).join(', ')}
                          {rules.mode === 'USER_PREF' && '-'}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <button onClick={() => {
                            setDeptFormData({ mode: rules.mode, shiftIds: rules.shiftIds || [], daysBeforeOff: rules.daysBeforeOff || 6, offDaysCount: rules.offDaysCount || 2, fixedOffDays: rules.fixedOffDays || [] });
                            setEditDeptId(d.id);
                          }} style={{ padding: '0.4rem 0.8rem', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>✎ Config</button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'preferences' && isAdminOrManager && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Team Roster Preferences</h2>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Configure the temporal constraints for each employee that the Auto-Generator uses to produce schedules.</p>
          
          <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: '1rem', borderBottom: '2px solid #cbd5e1' }}>User</th>
                <th style={{ padding: '1rem', borderBottom: '2px solid #cbd5e1' }}>Location</th>
                <th style={{ padding: '1rem', borderBottom: '2px solid #cbd5e1' }}>Mode</th>
                <th style={{ padding: '1rem', borderBottom: '2px solid #cbd5e1' }}>Fixed Shift</th>
                <th style={{ padding: '1rem', borderBottom: '2px solid #cbd5e1' }}>Fixed Off-Days</th>
                <th style={{ padding: '1rem', borderBottom: '2px solid #cbd5e1' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const pref = u.schedulePreference || { scheduleMode: 'RANDOM', fixedOffDays: '[]', fixedShiftId: null };
                let offDays = [];
                try { offDays = JSON.parse(pref.fixedOffDays); } catch(e){}
                
                const isEditing = editPrefId === u.id;
                const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{u.name || u.email}</td>
                    <td style={{ padding: '1rem' }}>{u.location?.city || 'Undefined'}</td>
                    
                    {isEditing ? (
                      <>
                        <td style={{ padding: '1rem' }}>
                          <select value={prefFormData.scheduleMode} onChange={e => setPrefFormData({...prefFormData, scheduleMode: e.target.value})} style={{ padding: '0.5rem' }}>
                            <option value="RANDOM">Random Fill</option>
                            <option value="ROTATING">Rotating (Sequential)</option>
                            <option value="FIXED">Fixed Specific Shift</option>
                          </select>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <select disabled={prefFormData.scheduleMode !== 'FIXED'} value={prefFormData.fixedShiftId || ''} onChange={e => setPrefFormData({...prefFormData, fixedShiftId: e.target.value})} style={{ padding: '0.5rem' }}>
                            <option value="">-- Select Shift --</option>
                            {shiftTypes.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                            {daysOfWeek.map((dayName, idx) => (
                              <label key={idx} style={{ background: prefFormData.fixedOffDays.includes(idx) ? '#fca5a5' : '#f1f5f9', padding: '0.2rem 0.4rem', borderRadius: '4px', cursor: 'pointer' }}>
                                <input type="checkbox" style={{ display: 'none' }} checked={prefFormData.fixedOffDays.includes(idx)} onChange={() => toggleOffDay(idx)} />
                                {dayName}
                              </label>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <button onClick={() => handleSavePreference(u.id)} className="primary-btn" style={{ width: 'auto', padding: '0.4rem 0.8rem', marginRight: '0.5rem' }}>Save</button>
                          <button onClick={() => setEditPrefId(null)} className="secondary-btn" style={{ width: 'auto', padding: '0.4rem 0.8rem' }}>Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '1rem' }}>
                          <span className="badge" style={{ background: pref.scheduleMode === 'FIXED' ? '#8b5cf6' : pref.scheduleMode === 'ROTATING' ? '#f59e0b' : '#64748b' }}>{pref.scheduleMode}</span>
                        </td>
                        <td style={{ padding: '1rem', color: '#64748b' }}>{pref.scheduleMode === 'FIXED' && pref.fixedShift ? pref.fixedShift.name : '-'}</td>
                        <td style={{ padding: '1rem', fontSize: '0.8rem' }}>
                          {offDays.length > 0 ? offDays.map(d => daysOfWeek[d]).join(', ') : 'None'}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <button onClick={() => {
                            setPrefFormData({ scheduleMode: pref.scheduleMode, fixedShiftId: pref.fixedShiftId, fixedOffDays: offDays });
                            setEditPrefId(u.id);
                          }} style={{ padding: '0.4rem 0.8rem', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>✎ Config</button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'types' && isAdminOrManager && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <h2 style={{ marginTop: 0 }}>Shift Types</h2>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const res = await fetch('/api/schedules/types', { method: 'POST', body: JSON.stringify(shiftFormData) });
            if (res.ok) {
              setShiftTypes([...shiftTypes, await res.json()]);
              setShiftFormData({ name: '', startTime: '', endTime: '' });
            }
          }} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'flex-end' }}>
             <div style={{ flex: 1 }}>
               <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>Name (e.g. Day Shift)</label>
               <input type="text" required value={shiftFormData.name} onChange={e => setShiftFormData({...shiftFormData, name: e.target.value})} style={{ width: '100%', padding: '0.5rem' }} />
             </div>
             <div>
               <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>Start Time</label>
               <input type="time" required value={shiftFormData.startTime} onChange={e => setShiftFormData({...shiftFormData, startTime: e.target.value})} style={{ padding: '0.5rem' }} />
             </div>
             <div>
               <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>End Time</label>
               <input type="time" required value={shiftFormData.endTime} onChange={e => setShiftFormData({...shiftFormData, endTime: e.target.value})} style={{ padding: '0.5rem' }} />
             </div>
             <button type="submit" className="primary-btn" style={{ width: 'auto', padding: '0.6rem 1rem' }}>Add</button>
          </form>

          <ul style={{ listStyle: 'none', padding: 0 }}>
            {shiftTypes.map(st => (
              <li key={st.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', border: '1px solid #e2e8f0', marginBottom: '0.5rem', borderRadius: '4px', background: '#f8fafc' }}>
                <strong style={{ fontSize: '1.1rem' }}>{st.name}</strong>
                <span style={{ color: '#64748b' }}>{st.startTime} to {st.endTime}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}
