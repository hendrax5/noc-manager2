"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import UserTableClient from "./UserTableClient";

export default function TeamAccessManager({ users, roles, departments }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("users");
  const [newRole, setNewRole] = useState("");
  const [newDept, setNewDept] = useState("");

  const [newUser, setNewUser] = useState({
    name: "", email: "", password: "", roleId: roles[0]?.id || "", departmentId: departments[0]?.id || ""
  });

  const [editingRoleId, setEditingRoleId] = useState(null);
  const [editRoleName, setEditRoleName] = useState("");

  const [editingDeptId, setEditingDeptId] = useState(null);
  const [editDeptName, setEditDeptName] = useState("");

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
  };
  const handleSaveRole = async (id) => {
    if (!editRoleName.trim()) return;
    await fetch(`/api/roles/${id}`, { method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ name: editRoleName }) });
    setEditingRoleId(null);
    router.refresh();
  };

  const handleEditDept = (dept) => {
    setEditingDeptId(dept.id);
    setEditDeptName(dept.name);
  };
  const handleSaveDept = async (id) => {
    if (!editDeptName.trim()) return;
    await fetch(`/api/departments/${id}`, { method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ name: editDeptName }) });
    setEditingDeptId(null);
    router.refresh();
  };

  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: '#f8fafc' }}>
        {['users', 'roles', 'departments'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{ 
              flex: 1, padding: '1rem', border: 'none', background: activeTab === tab ? 'white' : 'transparent', 
              borderBottom: activeTab === tab ? '3px solid var(--primary-color)' : '3px solid transparent',
              fontWeight: activeTab === tab ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1rem', textTransform: 'capitalize', transition: 'all 0.2s'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ padding: '2rem' }}>
        {activeTab === 'users' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
              <h2>Manage Users</h2>
            </div>
            <form onSubmit={handleAddUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', marginBottom: '2rem', background: '#f1f5f9', padding: '1.5rem', borderRadius: '6px' }}>
              <input type="text" placeholder="Full Name" required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} style={{ padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
              <input type="email" placeholder="Email Address" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} style={{ padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
              <input type="text" placeholder="Password" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} style={{ padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
              <select value={newUser.roleId} onChange={e => setNewUser({...newUser, roleId: e.target.value})} required style={{ padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                <option value="" disabled>Select Role...</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <select value={newUser.departmentId} onChange={e => setNewUser({...newUser, departmentId: e.target.value})} required style={{ padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                <option value="" disabled>Select Dept...</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button type="submit" className="primary-btn" style={{ padding: '0.6rem 1rem' }}>+ Create User</button>
            </form>
            <UserTableClient users={users} roles={roles} departments={departments} />
          </div>
        )}

        {activeTab === 'roles' && (
          <div>
            <h2>Manage Roles</h2>
            <form onSubmit={handleAddRole} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
              <input type="text" placeholder="New Role Name" required value={newRole} onChange={e => setNewRole(e.target.value)} style={{ padding: '0.75rem', width: '300px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
              <button type="submit" className="primary-btn" style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>+ Add Role</button>
            </form>
            <ul className="list-group">
              {roles.map(r => {
                if (editingRoleId === r.id) {
                  return (
                    <li key={r.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <input type="text" value={editRoleName} onChange={e => setEditRoleName(e.target.value)} style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px', flex: 1, marginRight: '1rem' }} />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleSaveRole(r.id)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
                        <button onClick={() => setEditingRoleId(null)} style={{ background: '#64748b', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={r.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{r.name}</strong>
                    <div>
                        <select defaultValue="" onChange={(e) => {
                          if (e.target.value === 'edit') handleEditRole(r);
                          if (e.target.value === 'delete') handleDeleteRole(r.id);
                          e.target.value = '';
                        }} style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', background: '#f8fafc', fontWeight: 'bold' }}>
                          <option value="" disabled>Actions ▾</option>
                          <option value="edit">✎ Edit</option>
                          <option value="delete">🗑 Delete</option>
                        </select>
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
            <form onSubmit={handleAddDept} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
              <input type="text" placeholder="New Dept Name" required value={newDept} onChange={e => setNewDept(e.target.value)} style={{ padding: '0.75rem', width: '300px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
              <button type="submit" className="primary-btn" style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>+ Add Department</button>
            </form>
            <ul className="list-group">
              {departments.map(d => {
                if (editingDeptId === d.id) {
                  return (
                    <li key={d.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <input type="text" value={editDeptName} onChange={e => setEditDeptName(e.target.value)} style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px', flex: 1, marginRight: '1rem' }} />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleSaveDept(d.id)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
                        <button onClick={() => setEditingDeptId(null)} style={{ background: '#64748b', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={d.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{d.name}</strong>
                    <div>
                        <select defaultValue="" onChange={(e) => {
                          if (e.target.value === 'edit') handleEditDept(d);
                          if (e.target.value === 'delete') handleDeleteDept(d.id);
                          e.target.value = '';
                        }} style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', background: '#f8fafc', fontWeight: 'bold' }}>
                          <option value="" disabled>Actions ▾</option>
                          <option value="edit">✎ Edit</option>
                          <option value="delete">🗑 Delete</option>
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
