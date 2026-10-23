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
    <div className="ui-static-1c19c02772" style={{position: 'relative'}}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="ui-static-59b9754e68" style={{cursor: 'pointer', display: 'flex', flexWrap: 'wrap', minHeight: '45px', alignItems: 'center'}}
      >
        {selectedIds.length === 0 ? (
          <span className="ui-static-b9010af219" >Search and select attendees or departments...</span>
        ) : (
          <>
            <span className="ui-static-bc10addb02" >
              {selectedIds.length} Selected
            </span>
            {selectedIds.slice(0, 3).map(id => {
               const u = users.find(x => x.id === id);
               return <span key={id} className="ui-static-9474462b7b" >{u ? (u.name || u.email) : id}</span>;
            })}
            {selectedIds.length > 3 && <span className="ui-static-bb72f3d5d6" >+{selectedIds.length - 3} more</span>}
          </>
        )}
      </div>

      {isOpen && (
        <div className="ui-static-b3b196dde1" style={{position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '350px'}}>
          
          <div className="ui-static-62b743f2aa" >
            <input 
              type="text" 
              placeholder="Type name, email, or department..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="ui-static-2bf089dea9" style={{width: '100%', outline: 'none'}}
              onClick={e => e.stopPropagation()}
            />
          </div>

          <div className="ui-static-ce5f724e09" style={{overflowY: 'auto', flex: 1}}>
            {filteredDepartments.map(deptName => {
              const uIds = depMap[deptName] || [];
              const allSelected = uIds.length > 0 && uIds.every(id => selectedIds.includes(id));
              const someSelected = uIds.some(id => selectedIds.includes(id));
              
              const usersInGroup = filteredUsers.filter(u => (u.department?.name || 'General') === deptName);
              
              if (usersInGroup.length === 0 && uIds.length === 0) return null;

              return (
                <div key={deptName} className="ui-static-3e8220669e" >
                  <div 
                    onClick={(e) => toggleDepartment(e, deptName)}
                    className="ui-static-24abe90875" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'}}
                  >
                    <span> {deptName}</span>
                    <span className="ui-static-f56af988b5" style={{color: allSelected ? '#10b981' : (someSelected ? '#f59e0b' : '#64748b')}}>
                      {allSelected ? 'All Selected ✓' : (someSelected ? 'Partially Selected' : 'Select All')}
                    </span>
                  </div>
                  
                  <div className="ui-static-bac7f5ca1d" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))'}}>
                    {usersInGroup.map(u => {
                      const selected = selectedIds.includes(u.id);
                      return (
                        <label key={u.id} className="ui-static-5f8a509eb8" style={{display: 'flex', alignItems: 'center', background: selected ? '#dbeafe' : 'white', border: selected ? '1px solid #bfdbfe' : '1px solid #e2e8f0', cursor: 'pointer'}}>
                          <input type="checkbox" checked={selected} onChange={() => toggleUser(u.id)} className="ui-static-ff227d0632"  />
                          <span className="ui-static-fc155e091a" style={{color: selected ? '#1e40af' : '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{u.name || u.email}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            
            {filteredUsers.length === 0 && (
              <div className="ui-static-85197fa8ca" style={{textAlign: 'center'}}>No users or departments found matching "{searchTerm}"</div>
            )}
          </div>
          
          <div className="ui-static-1acdaaf0e0" style={{display: 'flex', justifyContent: 'flex-end'}}>
             <button onClick={(e) => { e.preventDefault(); setIsOpen(false); }} className="primary-btn ui-static-7f44db8657" >Done Picking</button>
          </div>
        </div>
      )}
    </div>
  );
}
