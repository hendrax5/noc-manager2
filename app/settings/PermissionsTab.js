"use client";
import { useState, useEffect, Fragment } from "react";

const GROUP_LABELS = {
  tickets: '🎫 Tickets',
  meetings: '🤝 Meetings',
  knowledge: '📚 Knowledge Base',
  reports: '📊 Reports',
  team: '👥 Team',
  settings: '⚙️ Settings',
};

export default function PermissionsTab() {
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [subTab, setSubTab] = useState('roles'); // roles | users
  
  // User overrides state
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userRolePerms, setUserRolePerms] = useState([]);
  const [userOverrides, setUserOverrides] = useState([]);
  const [userLoading, setUserLoading] = useState(false);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const res = await fetch('/api/permissions');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setPermissions(data.permissions);
      setRoles(data.roles);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isRoleChecked = (role, permId) => {
    return role.permissions?.some(rp => rp.permission.id === permId);
  };

  const handleToggleRolePerm = async (role, permId) => {
    const currentIds = role.permissions?.map(rp => rp.permission.id) || [];
    let newIds;
    if (currentIds.includes(permId)) {
      newIds = currentIds.filter(id => id !== permId);
    } else {
      newIds = [...currentIds, permId];
    }

    setSaving(role.id);
    try {
      await fetch(`/api/permissions/roles/${role.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionIds: newIds }),
      });
      await fetchPermissions();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(null);
    }
  };

  const searchUsers = async (q) => {
    if (!q || q.length < 2) { setUserResults([]); return; }
    try {
      const res = await fetch(`/api/users?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setUserResults(Array.isArray(data) ? data : data.users || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectUser = async (user) => {
    setSelectedUser(user);
    setUserResults([]);
    setUserSearch("");
    setUserLoading(true);
    try {
      const res = await fetch(`/api/permissions/users/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setUserRolePerms(data.rolePermissions || []);
        setUserOverrides(data.userOverrides || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUserLoading(false);
    }
  };

  const addUserOverride = async (perm, granted) => {
    const existing = userOverrides.filter(o => o.permissionId !== perm.id);
    const newOverrides = [...existing, { permissionId: perm.id, key: perm.key, label: perm.label, group: perm.group, granted }];
    setUserOverrides(newOverrides);
    await saveUserOverrides(newOverrides);
  };

  const removeUserOverride = async (permId) => {
    const newOverrides = userOverrides.filter(o => o.permissionId !== permId);
    setUserOverrides(newOverrides);
    await saveUserOverrides(newOverrides);
  };

  const saveUserOverrides = async (overrides) => {
    if (!selectedUser) return;
    try {
      await fetch(`/api/permissions/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: overrides.map(o => ({ permissionId: o.permissionId, granted: o.granted })) }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Group permissions by group
  const grouped = {};
  permissions.forEach(p => {
    if (!grouped[p.group]) grouped[p.group] = [];
    grouped[p.group].push(p);
  });

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading permissions...</div>;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2>🔐 Permission Management</h2>
        <p style={{ color: '#64748b', marginBottom: '1rem' }}>Configure role defaults and per-user permission overrides.</p>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setSubTab('roles')} style={{ padding: '0.5rem 1.25rem', borderRadius: '20px', border: subTab === 'roles' ? '2px solid var(--primary-color)' : '1px solid #cbd5e1', background: subTab === 'roles' ? 'var(--primary-color)' : 'white', color: subTab === 'roles' ? 'white' : '#334155', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
          Role Defaults
        </button>
        <button onClick={() => setSubTab('users')} style={{ padding: '0.5rem 1.25rem', borderRadius: '20px', border: subTab === 'users' ? '2px solid #8b5cf6' : '1px solid #cbd5e1', background: subTab === 'users' ? '#8b5cf6' : 'white', color: subTab === 'users' ? 'white' : '#334155', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
          User Overrides
        </button>
      </div>

      {/* ROLE DEFAULTS TAB */}
      {subTab === 'roles' && (
        <div style={{ overflowX: 'auto' }}>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
            ✅ Centang permission yang dimiliki setiap role secara default. Semua user dengan role tersebut akan otomatis mendapat hak akses ini.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', minWidth: '250px' }}>Permission</th>
                {roles.map(r => (
                  <th key={r.id} style={{ padding: '0.75rem 0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', minWidth: '100px' }}>
                    <span style={{ display: 'inline-block', background: r.name === 'Admin' ? '#dc2626' : r.name === 'Manager' ? '#2563eb' : '#059669', color: 'white', padding: '0.2rem 0.75rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>{r.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([group, perms]) => (
                <Fragment key={group}>
                  <tr key={`g-${group}`}>
                    <td colSpan={roles.length + 1} style={{ padding: '0.75rem 1rem', fontWeight: 'bold', fontSize: '0.9rem', background: '#f8fafc', borderTop: '2px solid #e2e8f0', color: '#1e293b' }}>
                      {GROUP_LABELS[group] || group}
                    </td>
                  </tr>
                  {perms.map(perm => (
                    <tr key={perm.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.6rem 1rem', paddingLeft: '2rem', color: '#334155' }}>
                        {perm.label}
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>{perm.key}</span>
                      </td>
                      {roles.map(role => (
                        <td key={`${role.id}-${perm.id}`} style={{ textAlign: 'center', padding: '0.5rem' }}>
                          <input
                            type="checkbox"
                            checked={isRoleChecked(role, perm.id)}
                            onChange={() => handleToggleRolePerm(role, perm.id)}
                            disabled={saving === role.id}
                            style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer', accentColor: role.name === 'Admin' ? '#dc2626' : '#2563eb' }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
            ⚠️ Perubahan disimpan otomatis. User perlu re-login agar permission baru berlaku.
          </p>
        </div>
      )}

      {/* USER OVERRIDES TAB */}
      {subTab === 'users' && (
        <div>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
            🔍 Cari user untuk menambahkan atau mencabut permission khusus di luar role default mereka.
          </p>
          <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
            <input
              type="text"
              placeholder="Cari nama atau email user..."
              value={userSearch}
              onChange={e => { setUserSearch(e.target.value); searchUsers(e.target.value); }}
              style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
            />
            {userResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '0 0 8px 8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                {userResults.map(u => (
                  <div key={u.id} onClick={() => selectUser(u)} style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onMouseEnter={e => e.currentTarget.style.background='#f8fafc'} onMouseLeave={e => e.currentTarget.style.background='white'}>
                    <div>
                      <strong>{u.name || u.email}</strong>
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>{u.email}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedUser && (
            <div style={{ background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{selectedUser.name || selectedUser.email}</h3>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{selectedUser.email}</span>
                </div>
                <button onClick={() => { setSelectedUser(null); setUserOverrides([]); setUserRolePerms([]); }} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>✕ Close</button>
              </div>

              {userLoading ? (
                <p style={{ color: '#64748b' }}>Loading user permissions...</p>
              ) : (
                <>
                  {/* Role defaults display */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Role Defaults (dari role)</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {userRolePerms.length === 0 && <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>No role permissions assigned</span>}
                      {userRolePerms.map(p => (
                        <span key={p.id} style={{ background: '#dbeafe', color: '#1e40af', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '500' }}>
                          {p.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* User overrides display */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>User Overrides (khusus user ini)</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {userOverrides.length === 0 && <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>Tidak ada override — user menggunakan role defaults</span>}
                      {userOverrides.map(o => (
                        <span key={o.permissionId} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: o.granted ? '#dcfce7' : '#fee2e2', color: o.granted ? '#166534' : '#991b1b', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', border: `1px solid ${o.granted ? '#bbf7d0' : '#fecaca'}` }}>
                          {o.granted ? '✅' : '🚫'} {o.label}
                          <span onClick={() => removeUserOverride(o.permissionId)} style={{ marginLeft: '0.3rem', cursor: 'pointer', color: '#94a3b8', fontWeight: 'normal' }}>✕</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Add override */}
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                    <h4 style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Tambah / Ubah Override</h4>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      {Object.entries(grouped).map(([group, perms]) => (
                        <div key={group}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569', marginBottom: '0.3rem', marginTop: '0.5rem' }}>{GROUP_LABELS[group] || group}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                            {perms.map(perm => {
                              const override = userOverrides.find(o => o.permissionId === perm.id);
                              const isInRole = userRolePerms.some(rp => rp.id === perm.id);
                              return (
                                <div key={perm.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}>
                                  <span style={{ color: '#334155' }}>{perm.label}</span>
                                  {!isInRole && !override?.granted && (
                                    <button onClick={() => addUserOverride(perm, true)} style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: '3px', padding: '0.15rem 0.35rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }} title="Grant">+</button>
                                  )}
                                  {(isInRole || override?.granted) && !override?.granted === false && (
                                    <button onClick={() => addUserOverride(perm, false)} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '3px', padding: '0.15rem 0.35rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }} title="Revoke">−</button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
