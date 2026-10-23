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
                    <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="ui-static-3e817ea73a" style={{width: '100%'}} placeholder="Name" />
                    <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="ui-static-2bf089dea9" style={{width: '100%'}} placeholder="Email" />
                  </td>
                  <td>
                    <input type="text" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} className="ui-static-2bf089dea9" style={{width: '100%'}} placeholder="(Leave blank to reserve)" />
                  </td>
                  <td>
                    <select value={editForm.roleId} onChange={e => setEditForm({...editForm, roleId: e.target.value})} className="ui-static-11c1bd4406" style={{width: '100%'}}>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={editForm.departmentId} onChange={e => setEditForm({...editForm, departmentId: e.target.value})} className="ui-static-11c1bd4406" style={{width: '100%'}}>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <div className="ui-static-30f523173e" style={{display: 'flex'}}>
                      <button onClick={() => handleSaveEdit(u.id)} className="ui-static-38ea3d73f4" style={{cursor: 'pointer'}}>Save</button>
                      <button onClick={handleCancelEdit} className="ui-static-d3eb43631e" style={{cursor: 'pointer'}}>Cancel</button>
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td>
                    <div className="ui-static-5c05f4afaf" >{u.name || 'Staff User'}</div>
                    <div className="ui-static-dd90b11840" >{u.email}</div>
                  </td>
                  <td>
                    <div className="ui-static-dd90b11840" >••••••••</div>
                  </td>
                  <td>
                    <div className="ui-static-ce5f724e09" >{roles.find(r => r.id === u.roleId)?.name}</div>
                  </td>
                  <td>
                    <div className="ui-static-ce5f724e09" >{departments.find(d => d.id === u.departmentId)?.name}</div>
                  </td>
                  <td>
                     <div>
                        <select defaultValue="" onChange={(e) => {
                          if (e.target.value === 'edit') handleEditClick(u);
                          if (e.target.value === 'delete') handleDelete(u.id);
                          e.target.value = '';
                        }} className="ui-static-bde7137215" style={{cursor: 'pointer'}}>
                          <option value="" disabled>Actions ▾</option>
                          <option value="edit"> Edit</option>
                          <option value="delete"> Delete</option>
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
