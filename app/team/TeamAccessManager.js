"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import UserTableClient from "./UserTableClient";

export default function TeamAccessManager({ users, roles, departments, companies = ["ION", "SDC", "Sistercompany"], initialDeptMap = {}, initialAutoRouteMap = {}, canManageUsers = false, canManageRoles = false, canManageDepartments = false }) {
  const router = useRouter();
  const availableTabs = [
    canManageUsers && 'users',
    canManageRoles && 'roles',
    canManageDepartments && 'departments'
  ].filter(Boolean);
  const [activeTab, setActiveTab] = useState(availableTabs[0] || 'users');
  const [newRole, setNewRole] = useState("");
  const [newDept, setNewDept] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [userSort, setUserSort] = useState("name"); // name | department
  const userPageSize = 10;

  const [newUser, setNewUser] = useState({
    name: "", email: "", password: "", roleId: roles[0]?.id || "", departmentId: departments[0]?.id || ""
  });

  const [editingRoleId, setEditingRoleId] = useState(null);
  const [editRoleName, setEditRoleName] = useState("");
  const [editRolePermissions, setEditRolePermissions] = useState([]);

  const [editingDeptId, setEditingDeptId] = useState(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [editDeptCompany, setEditDeptCompany] = useState("");
  const [editDeptAutoRoute, setEditDeptAutoRoute] = useState("");
  const [deptCompanyMap, setDeptCompanyMap] = useState(initialDeptMap);
  const [deptAutoRouteMap, setDeptAutoRouteMap] = useState(initialAutoRouteMap);

  const handleAddRole = async (e) => {
    e.preventDefault();
    await fetch("/api/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newRole }) });
    setNewRole(""); router.refresh();
  };

  const handleDeleteRole = async (id) => {
    if (confirm("Are you sure? Note: Deletion fails if users are still assigned to this role (Prisma constraint).")) {
      await fetch(`/api/roles/${id}`, { method: "DELETE" });
      router.refresh();
    }
  };

  const handleAddDept = async (e) => {
    e.preventDefault();
    await fetch("/api/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newDept }) });
    setNewDept(""); router.refresh();
  };

  const handleDeleteDept = async (id) => {
    if (confirm("Are you sure? Note: Deletion fails if users/tickets are attached to it.")) {
      await fetch(`/api/departments/${id}`, { method: "DELETE" });
      router.refresh();
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    await fetch("/api/users", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newUser)
    });
    setNewUser({ ...newUser, name: "", email: "" }); router.refresh();
  };

  const handleEditRole = (role) => {
    setEditingRoleId(role.id);
    setEditRoleName(role.name);
    setEditRolePermissions(role.permissions || []);
  };
  const handleToggleRolePermission = (perm) => {
    setEditRolePermissions(prev => 
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };
  const handleSaveRole = async (id) => {
    if (!editRoleName.trim()) return;
    await fetch(`/api/roles/${id}`, { 
      method: "PATCH", 
      headers: {"Content-Type": "application/json"}, 
      body: JSON.stringify({ name: editRoleName, permissions: editRolePermissions }) 
    });
    setEditingRoleId(null);
    router.refresh();
  };

  const handleEditDept = (dept) => {
    setEditingDeptId(dept.id);
    setEditDeptName(dept.name);
    setEditDeptCompany(deptCompanyMap[dept.id] || "");
    setEditDeptAutoRoute(deptAutoRouteMap[dept.id] || "");
  };
  const handleSaveDept = async (id) => {
    if (!editDeptName.trim()) return;
    await fetch(`/api/departments/${id}`, { method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ name: editDeptName }) });
    
    // Save Routing Map
    const resMap = await fetch(`/api/settings/dept-routing`, { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ departmentId: String(id), companyName: editDeptCompany, targetSupportDeptId: editDeptAutoRoute }) });
    if(resMap.ok) {
       const mappedData = await resMap.json();
       setDeptCompanyMap(mappedData.deptCompanyMap);
       setDeptAutoRouteMap(mappedData.deptAutoRouteMap || {});
    }

    setEditingDeptId(null);
    router.refresh();
  };

  const filteredUsers = users
    .filter((u) => {
      const q = userSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q));
      const matchDept = !deptFilter || String(u.departmentId) === String(deptFilter);
      return matchSearch && matchDept;
    })
    .slice()
    .sort((a, b) => {
      if (userSort === "department") {
        const da = departments.find((d) => d.id === a.departmentId)?.name || "";
        const db = departments.find((d) => d.id === b.departmentId)?.name || "";
        const cmp = da.localeCompare(db, "id", { sensitivity: "base" });
        if (cmp !== 0) return cmp;
      }
      const na = a.name || a.email || "";
      const nb = b.name || b.email || "";
      return na.localeCompare(nb, "id", { sensitivity: "base" });
    });

  return (
    <div className="card ui-static-bcb0a0d8bd" style={{overflow: 'hidden'}}>
      <div className="ui-static-7ad892b6d2" style={{display: 'flex'}}>
        {availableTabs.map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="ui-static-7d67a0faa0" style={{flex: 1, background: activeTab === tab ? "var(--ui-surface)" : 'transparent', borderBottom: activeTab === tab ? '3px solid var(--primary-color)' : '3px solid transparent', fontWeight: activeTab === tab ? 'bold' : 'normal', cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.2s'}}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="ui-static-39c1d6c828" >
        {activeTab === 'users' && (
          <div>
            <div className="ui-static-be5b2f6887" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'}}>
              <div className="ui-static-e59a73fd03" style={{display: 'flex', alignItems: 'center', flexWrap: 'wrap'}}>
                <h2 className="ui-static-ff227d0632" >Manage Users</h2>
                <span className="ui-static-09a5a64ca2" >
                  {filteredUsers.length} user{filteredUsers.length === 1 ? '' : 's'}
                  {deptFilter ? ` · ${departments.find(d => String(d.id) === String(deptFilter))?.name || 'dept'}` : ''}
                </span>
              </div>
              <div className="ui-static-30f523173e" style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center'}}>
                <select
                  value={deptFilter}
                  onChange={(e) => { setDeptFilter(e.target.value); setUserPage(1); }}
                  className="ui-static-f1182528bd" style={{minWidth: 180}}
                  title="Filter by department"
                >
                  <option value="">All departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <select
                  value={userSort}
                  onChange={(e) => { setUserSort(e.target.value); setUserPage(1); }}
                  className="ui-static-f1182528bd"
                  title="Sort users"
                >
                  <option value="name">Sort: Name A–Z</option>
                  <option value="department">Sort: Department</option>
                </select>
                <input 
                  type="search" 
                  placeholder="Search name or email…" 
                  value={userSearchQuery}
                  onChange={e => {setUserSearchQuery(e.target.value); setUserPage(1);}}
                  className="ui-static-ea9e089afc" style={{width: '260px', outline: 'none'}}
                />
              </div>
            </div>
            <form onSubmit={handleAddUser} className="ui-static-2d649ec674" style={{display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)'}}>
              <input type="text" placeholder="Full Name" required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="ui-static-2bf089dea9"  />
              <input type="email" placeholder="Email Address" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="ui-static-2bf089dea9"  />
              <input type="text" placeholder="Password" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="ui-static-2bf089dea9"  />
              <select value={newUser.roleId} onChange={e => setNewUser({...newUser, roleId: e.target.value})} required className="ui-static-2bf089dea9" >
                <option value="" disabled>Select Role...</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <select value={newUser.departmentId} onChange={e => setNewUser({...newUser, departmentId: e.target.value})} required className="ui-static-2bf089dea9" >
                <option value="" disabled>Select Dept...</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button type="submit" className="primary-btn ui-static-7f62800e8e" >+ Create User</button>
            </form>
            <UserTableClient users={filteredUsers.slice((userPage-1)*userPageSize, userPage*userPageSize)} roles={roles} departments={departments} />
            
            {filteredUsers.length > userPageSize && (
              <div className="ui-static-dd3681565c" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div className="ui-static-dd90b11840" >
                  Showing <strong>{((userPage - 1) * userPageSize) + 1}</strong> to <strong>{Math.min(userPage * userPageSize, filteredUsers.length)}</strong> of <strong>{filteredUsers.length}</strong> entries
                </div>
                <div className="ui-static-30f523173e" style={{display: 'flex'}}>
                  <button onClick={() => setUserPage(p => Math.max(1, p - 1))} disabled={userPage === 1} className="ui-static-bf2977b962" style={{background: userPage > 1 ? "var(--ui-surface)" : "var(--ui-surface)", color: userPage > 1 ? "var(--ui-info)" : "var(--ui-info)", cursor: userPage > 1 ? 'pointer' : 'not-allowed'}}>&laquo; Prev</button>
                  <span className="ui-static-028aa61c6d" >Page {userPage}</span>
                  <button onClick={() => setUserPage(p => Math.min(Math.ceil(filteredUsers.length / userPageSize), p + 1))} disabled={userPage >= Math.ceil(filteredUsers.length / userPageSize)} className="ui-static-bf2977b962" style={{background: userPage < Math.ceil(filteredUsers.length / userPageSize) ? "var(--ui-surface)" : "var(--ui-surface)", color: userPage < Math.ceil(filteredUsers.length / userPageSize) ? "var(--ui-info)" : "var(--ui-info)", cursor: userPage < Math.ceil(filteredUsers.length / userPageSize) ? 'pointer' : 'not-allowed'}}>Next &raquo;</button>
                </div>
              </div>
            )}
            
            {filteredUsers.length === 0 && (
              <div className="ui-static-8324dd8abf" style={{textAlign: 'center', fontStyle: 'italic'}}>
                No users found
                {userSearchQuery ? ` matching "${userSearchQuery}"` : ''}
                {deptFilter ? ` in selected department` : ''}.
              </div>
            )}
          </div>
        )}

        {activeTab === 'roles' && (
          <div>
            <h2>Manage Roles</h2>
            <form onSubmit={handleAddRole} className="ui-static-7b101c5d25" style={{display: 'flex'}}>
              <input type="text" placeholder="New Role Name" required value={newRole} onChange={e => setNewRole(e.target.value)} className="ui-static-b9ca49b7f6" style={{width: '300px'}} />
              <button type="submit" className="primary-btn ui-static-4577864700" style={{width: 'auto'}}>+ Add Role</button>
            </form>
            <ul className="list-group ui-static-eb0779f480" style={{display: 'flex', flexDirection: 'column', listStyle: 'none'}}>
              {roles.map(r => {
                if (editingRoleId === r.id) {
                  const isAdminRole = r.name === 'Admin';
                  return (
                    <li key={r.id} className="list-item ui-static-90d05461b8" style={{display: 'flex', flexDirection: 'column'}}>
                      <div className="ui-static-af81cc4264" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
                        <input type="text" value={editRoleName} onChange={e => setEditRoleName(e.target.value)} className="ui-static-e6b8be0e4b" style={{flex: 1}} placeholder="Role Name" />
                        <div className="ui-static-30f523173e" style={{display: 'flex'}}>
                          <button onClick={() => handleSaveRole(r.id)} className="ui-static-f0b33b9c0d" style={{cursor: 'pointer'}}> Save</button>
                          <button onClick={() => setEditingRoleId(null)} className="ui-static-26ad8d43e4" style={{cursor: 'pointer'}}>✕ Cancel</button>
                        </div>
                      </div>
                      
                      {/* Permission checklist grid */}
                      <div style={{ width: '100%' }}>
                        <h4 className="ui-static-f2f8d52d13" >Configure Permissions (Capabilities):</h4>
                        {isAdminRole ? (
                          <div className="ui-static-1af8047d5b" style={{display: 'flex', alignItems: 'center'}}>
                            <span></span> Role 'Admin' has hardlocked full permissions to prevent administrative lock-out.
                          </div>
                        ) : (
                          <div className="ui-static-e59a73fd03" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))'}}>
                            {[
                              { key: "view_all_tickets", label: "🌐 View All Tickets (Global Scope)" },
                              { key: "manage_tickets", label: "🎫 Manage Tickets (Master Permission)" },
                              { key: "create_tickets", label: "➕ Create Tickets" },
                              { key: "modify_tickets", label: "✏️ Modify Tickets (Status/Assign/Category Shorthand)" },
                              { key: "change_ticket_status", label: "🔄 Change Ticket Status (Open/Resolve)" },
                              { key: "assign_tickets", label: "🎯 Assign Tickets (Staff/Tim/Priority)" },
                              { key: "change_job_category", label: "🏷️ Change Job Category & Performance Score" },
                              { key: "delete_tickets", label: "🗑️ Delete Tickets" },
                              { key: "edit_own_tickets", label: "✍️ Edit Tickets Created by Self" },
                              { key: "edit_other_tickets", label: "📝 Edit Tickets Created by Others" },
                              { key: "manage_sla", label: "⏱️ Manage SLA Configuration" },
                              { key: "view_internal_notes", label: "👁️ View Internal Notes" },
                              { key: "manage_ticket_notes", label: "✍️ Write Internal Notes" },
                              { key: "view_live_ops", label: "📡 View Live Operations Dashboard" },
                              { key: "manage_users", label: "👥 Manage Team & NOC Staff" },
                              { key: "manage_roles", label: "🔐 Manage Security Roles & Permissions" },
                              { key: "manage_departments", label: "🏢 Manage Sub-Departments & Routing" },
                              { key: "manage_settings", label: "⚙️ Manage Settings, Fields & Routing" },
                              { key: "manage_trouble_master", label: "Manage Master Data Trouble" },
                              { key: "manage_service_work", label: "Kelola Jenis Pekerjaan Layanan" },
                              { key: "view_reports", label: "📊 View Performance Analytics" },
                              { key: "manage_schedules", label: "🗓️ Manage Shift Schedules & Types" },
                              { key: "manage_knowledge", label: "📚 Manage Knowledge Base Articles" },
                              { key: "manage_assets", label: "🗄️ Manage Customer Assets & Services" },
                              { key: "manage_meetings", label: "🤝 Manage Meetings & Attendance" }
                            ].map(p => {
                              const isChecked = editRolePermissions.includes(p.key);
                              return (
                                <label key={p.key} className="ui-static-b1a5d7e3bc" style={{display: 'flex', alignItems: 'center', cursor: 'pointer', transition: 'all 0.15s'}}>
                                  <input 
                                    type="checkbox" 
                                    checked={isChecked}
                                    onChange={() => handleToggleRolePermission(p.key)}
                                    style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                                  />
                                  <span>{p.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                }
                const isSystemRole = ['Admin', 'Manager', 'User'].includes(r.name);
                const rolePerms = r.permissions || [];
                return (
                  <li key={r.id} className="list-item ui-static-aa8677f079" style={{display: 'flex', flexDirection: 'column'}}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <strong className="ui-static-c4618ca26a" >{r.name}</strong>
                      <div>
                        <select defaultValue="" onChange={(e) => {
                          if (e.target.value === 'edit') handleEditRole(r);
                          if (e.target.value === 'delete') handleDeleteRole(r.id);
                          e.target.value = '';
                        }} className="ui-static-2b848f090e" style={{cursor: 'pointer'}}>
                          <option value="" disabled>Actions ▾</option>
                          <option value="edit"> Edit & Permissions</option>
                          {!isSystemRole && <option value="delete"> Delete</option>}
                        </select>
                      </div>
                    </div>
                    <div className="ui-static-950dea6c48" style={{display: 'flex', flexWrap: 'wrap'}}>
                      {rolePerms.length === 0 ? (
                        <span className="ui-static-f0ec965903" style={{fontStyle: 'italic'}}>No custom capabilities assigned (Basic staff access only)</span>
                      ) : (
                        rolePerms.map(p => (
                          <span key={p} className="ui-static-4a3c2b8c21" style={{textTransform: 'capitalize'}}>
                            {p.replace(/_/g, ' ')}
                          </span>
                        ))
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {activeTab === 'departments' && (
          <div>
            <h2>Manage Departments</h2>
            <form onSubmit={handleAddDept} className="ui-static-7b101c5d25" style={{display: 'flex'}}>
              <input type="text" placeholder="New Dept Name" required value={newDept} onChange={e => setNewDept(e.target.value)} className="ui-static-b9ca49b7f6" style={{width: '300px'}} />
              <button type="submit" className="primary-btn ui-static-4577864700" style={{width: 'auto'}}>+ Add Department</button>
            </form>
            <ul className="list-group">
              {departments.map(d => {
                if (editingDeptId === d.id) {
                  return (
                    <li key={d.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="ui-static-f534b4fb6a" style={{display: 'flex', flex: 1, flexWrap: 'wrap'}}>
                        <input type="text" value={editDeptName} onChange={e => setEditDeptName(e.target.value)} className="ui-static-2bf089dea9" style={{minWidth: '200px'}} placeholder="Dept Name..." />
                        <select value={editDeptCompany} onChange={e => setEditDeptCompany(e.target.value)} className="ui-static-2bf089dea9" style={{minWidth: '150px'}}>
                          <option value="">-- No Configured Company --</option>
                          {companies.map((c, i) => <option key={i} value={c}>{c}</option>)}
                        </select>
                        <select value={editDeptAutoRoute} onChange={e => setEditDeptAutoRoute(e.target.value)} className="ui-static-2bf089dea9" style={{minWidth: '200px'}}>
                          <option value="">-- No Default Ticket Route --</option>
                          {departments.map(tDept => <option key={tDept.id} value={tDept.id}>{tDept.name}</option>)}
                        </select>
                      </div>
                      <div className="ui-static-30f523173e" style={{display: 'flex'}}>
                        <button onClick={() => handleSaveDept(d.id)} className="ui-static-66e91e8487" style={{cursor: 'pointer'}}>Save</button>
                        <button onClick={() => setEditingDeptId(null)} className="ui-static-52dfaadc78" style={{cursor: 'pointer'}}>Cancel</button>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={d.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="ui-static-af81cc4264" style={{display: 'flex', alignItems: 'center', flexWrap: 'wrap'}}>
                      <strong>{d.name}</strong>
                      {deptCompanyMap[d.id] && (
                        <span className="ui-static-c527fed352" >
                            Entity: {deptCompanyMap[d.id]}
                        </span>
                      )}
                      {deptAutoRouteMap[d.id] && (
                        <span className="ui-static-c527fed352" >
                            Routes to: {departments.find(x => String(x.id) === String(deptAutoRouteMap[d.id]))?.name || "Unknown"}
                        </span>
                      )}
                    </div>
                    <div>
                        <select defaultValue="" onChange={(e) => {
                          if (e.target.value === 'edit') handleEditDept(d);
                          if (e.target.value === 'delete') handleDeleteDept(d.id);
                          e.target.value = '';
                        }} className="ui-static-2b848f090e" style={{cursor: 'pointer'}}>
                          <option value="" disabled>Actions ▾</option>
                          <option value="edit"> Edit</option>
                          <option value="delete"> Delete</option>
                        </select>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
