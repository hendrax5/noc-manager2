"use client";
import { useState, useMemo } from "react";

export default function SearchableAttendeeSelect({ users, departments, selectedIds, onChange }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Group users by department for easier selection logic internally
  const depMap = useMemo(() => {
    const map = {};
    if (departments) {
      departments.forEach(d => map[d.name] = []);
    }
    users.forEach(u => {
      const dName = u.department?.name || 'General';
      if (!map[dName]) map[dName] = [];
      map[dName].push(u.id);
    });
    return map;
  }, [users, departments]);

  const toggleUser = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const toggleDepartment = (e, deptName) => {
    e.stopPropagation();
    const uIds = depMap[deptName] || [];
    const allSelectedInDept = uIds.every(id => selectedIds.includes(id));
    if (allSelectedInDept) {
      // Remove all
      onChange(selectedIds.filter(id => !uIds.includes(id)));
    } else {
      // Add all missing
      const newSelections = [...selectedIds];
      uIds.forEach(id => {
        if (!newSelections.includes(id)) newSelections.push(id);
      });
      onChange(newSelections);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchTerm.toLowerCase();
    if (!q) return users;
    return users.filter(u => 
      (u.name && u.name.toLowerCase().includes(q)) || 
      (u.email && u.email.toLowerCase().includes(q)) || 
      (u.department?.name && u.department.name.toLowerCase().includes(q))
    );
  }, [searchTerm, users]);

  // Find unique departments within the filtered users
  const filteredDepartments = useMemo(() => {
    const set = new Set();
    filteredUsers.forEach(u => set.add(u.department?.name || 'General'));
    if (departments) {
       departments.forEach(d => {
         if (d.name.toLowerCase().includes(searchTerm.toLowerCase())) set.add(d.name);
       });
    }
    return Array.from(set).sort();
  }, [filteredUsers, searchTerm, departments]);

  return (
    <div style={{ position: 'relative', fontFamily: 'inherit' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', cursor: 'pointer', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', minHeight: '45px', alignItems: 'center' }}
      >
        {selectedIds.length === 0 ? (
          <span style={{ color: '#94a3b8' }}>Search and select attendees or departments...</span>
        ) : (
          <>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#3b82f6', background: '#dbeafe', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
              {selectedIds.length} Selected
            </span>
            {selectedIds.slice(0, 3).map(id => {
               const u = users.find(x => x.id === id);
               return <span key={id} style={{ fontSize: '0.8rem', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>{u ? (u.name || u.email) : id}</span>;
            })}
            {selectedIds.length > 3 && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>+{selectedIds.length - 3} more</span>}
          </>
        )}
      </div>

      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.5rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '350px' }}>
          
          <div style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <input 
              type="text" 
              placeholder="Type name, email, or department..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none' }}
              onClick={e => e.stopPropagation()}
            />
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem' }}>
            {filteredDepartments.map(deptName => {
              const uIds = depMap[deptName] || [];
              const allSelected = uIds.length > 0 && uIds.every(id => selectedIds.includes(id));
              const someSelected = uIds.some(id => selectedIds.includes(id));
              
              const usersInGroup = filteredUsers.filter(u => (u.department?.name || 'General') === deptName);
              
              if (usersInGroup.length === 0 && uIds.length === 0) return null;

              return (
                <div key={deptName} style={{ marginBottom: '1rem' }}>
                  <div 
                    onClick={(e) => toggleDepartment(e, deptName)}
                    style={{ background: '#f1f5f9', padding: '0.5rem 0.75rem', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', color: '#334155' }}
                  >
                    <span>🏢 {deptName}</span>
                    <span style={{ fontSize: '0.75rem', color: allSelected ? '#10b981' : (someSelected ? '#f59e0b' : '#64748b') }}>
                      {allSelected ? 'All Selected ✓' : (someSelected ? 'Partially Selected' : 'Select All')}
                    </span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.4rem', marginTop: '0.5rem', paddingLeft: '0.5rem' }}>
                    {usersInGroup.map(u => {
                      const selected = selectedIds.includes(u.id);
                      return (
                        <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem', background: selected ? '#dbeafe' : 'white', border: selected ? '1px solid #bfdbfe' : '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', margin: 0 }}>
                          <input type="checkbox" checked={selected} onChange={() => toggleUser(u.id)} style={{ margin: 0 }} />
                          <span style={{ fontSize: '0.8rem', color: selected ? '#1e40af' : '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name || u.email}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            
            {filteredUsers.length === 0 && (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>No users or departments found matching "{searchTerm}"</div>
            )}
          </div>
          
          <div style={{ padding: '0.75rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
             <button onClick={(e) => { e.preventDefault(); setIsOpen(false); }} className="primary-btn" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>Done Picking</button>
          </div>
        </div>
      )}
    </div>
  );
}
