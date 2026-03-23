"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UserTableClient({ users, roles, departments }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    password: "",
    roleId: "",
    departmentId: ""
  });

  const handleEditClick = (u) => {
    setEditingUserId(u.id);
    setEditForm({
      name: u.name || "",
      email: u.email || "",
      password: "", 
      roleId: u.roleId || "",
      departmentId: u.departmentId || ""
    });
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
  };

  const handleSaveEdit = async (uId) => {
    setLoadingId(uId);
    
    const payload = { ...editForm, roleId: parseInt(editForm.roleId), departmentId: parseInt(editForm.departmentId) };
    if (!payload.password) delete payload.password; 
    
    await fetch(`/api/users/${uId}`, { 
      method: "PATCH", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(payload) 
    });
    
    setEditingUserId(null);
    setLoadingId(null);
    router.refresh();
  };

  const handleDelete = async (userId) => {
    if (confirm("Are you sure you want to delete this user?")) {
      setLoadingId(userId);
      await fetch(`/api/users/${userId}`, { method: "DELETE" });
      setLoadingId(null); router.refresh();
    }
  };

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Name / Email</th>
          <th>Password</th>
          <th>System Role</th>
          <th>Assigned Department</th>
          <th style={{ width: '150px' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map(u => {
          const isEditing = editingUserId === u.id;
          return (
            <tr key={u.id} style={{ opacity: loadingId === u.id ? 0.5 : 1 }}>
              {isEditing ? (
                <>
                  <td>
                    <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} style={{ width: '100%', marginBottom: '0.4rem', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} placeholder="Name" />
                    <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} style={{ width: '100%', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} placeholder="Email" />
                  </td>
                  <td>
                    <input type="text" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} style={{ width: '100%', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} placeholder="(Leave blank to reserve)" />
                  </td>
                  <td>
                    <select value={editForm.roleId} onChange={e => setEditForm({...editForm, roleId: e.target.value})} style={{ padding: '0.4rem', width: '100%', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={editForm.departmentId} onChange={e => setEditForm({...editForm, departmentId: e.target.value})} style={{ padding: '0.4rem', width: '100%', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => handleSaveEdit(u.id)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
                      <button onClick={handleCancelEdit} style={{ background: '#94a3b8', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td>
                    <div style={{ fontWeight: '600' }}>{u.name || 'Staff User'}</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{u.email}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>••••••••</div>
                  </td>
                  <td>
                    <div style={{ padding: '0.4rem' }}>{roles.find(r => r.id === u.roleId)?.name}</div>
                  </td>
                  <td>
                    <div style={{ padding: '0.4rem' }}>{departments.find(d => d.id === u.departmentId)?.name}</div>
                  </td>
                  <td>
                     <div>
                        <select defaultValue="" onChange={(e) => {
                          if (e.target.value === 'edit') handleEditClick(u);
                          if (e.target.value === 'delete') handleDelete(u.id);
                          e.target.value = '';
                        }} style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', background: '#f8fafc', fontWeight: 'bold' }}>
                          <option value="" disabled>Actions ▾</option>
                          <option value="edit">✎ Edit</option>
                          <option value="delete">🗑 Delete</option>
                        </select>
                     </div>
                  </td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
