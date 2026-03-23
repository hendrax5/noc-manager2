"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function ProfileClient({ user }) {
  const router = useRouter();
  
  const [name, setName] = useState(user.name || "");
  const [signature, setSignature] = useState(user.signature || "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
  
  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  
  const fileInputRef = useRef(null);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("file", file);
    
    // Using the existing upload API which streams files to Next.js storage
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (res.ok) {
      const data = await res.json();
      setAvatarUrl(data.url);
      setMessage({ type: "success", text: "Avatar uploaded. Click Save to apply changes." });
    } else {
      setMessage({ type: "error", text: "Failed to upload avatar." });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match." });
      return;
    }
    
    setSaving(true);
    setMessage(null);

    const payload = { name, avatarUrl, signature };
    if (newPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setMessage({ type: "success", text: "Profile updated successfully! If you changed your password, please relogin." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      // Force refresh to pull new session data onto Navbar
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      const err = await res.json();
      setMessage({ type: "error", text: err.error || "Update failed." });
    }
    setSaving(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(0, 2fr)', gap: '2rem', alignItems: 'flex-start' }}>
      
      {/* Read-Only Stats & Avatar Card */}
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 1.5rem', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '4px solid white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '3rem', color: '#94a3b8' }}>👤</span>
          )}
          <div 
             onClick={() => fileInputRef.current?.click()}
             style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.75rem', padding: '0.4rem 0', cursor: 'pointer', fontWeight: 'bold' }}
          >
             Upload
          </div>
          <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" style={{ display: 'none' }} />
        </div>
        
        <h2 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>{user.name || "NOC Member"}</h2>
        <p style={{ margin: '0 0 1.5rem 0', color: '#64748b', fontSize: '0.9rem' }}>{user.email}</p>
        
        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'left', display: 'grid', gap: '0.75rem' }}>
           <div>
             <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>Role Authorization</span>
             <span style={{ color: '#1e293b', fontWeight: '500' }}>{user.role.name}</span>
           </div>
           <div>
             <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>Department Tag</span>
             <span style={{ color: '#1e293b', fontWeight: '500' }}>{user.department.name}</span>
           </div>
        </div>
      </div>

      {/* Edit Form Card */}
      <div className="card" style={{ padding: '2rem' }}>
        <h2 style={{ margin: '0 0 1.5rem 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', color: '#0f172a' }}>Configuration Pipeline</h2>
        
        {message && (
          <div style={{ padding: '1rem', marginBottom: '1.5rem', borderRadius: '6px', background: message.type === 'success' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`, color: message.type === 'success' ? '#065f46' : '#991b1b', fontWeight: 'bold', fontSize: '0.9rem' }}>
            {message.type === 'success' ? '✅' : '🚨'} {message.text}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'grid', gap: '1.5rem' }}>
          
          <div>
            <h3 style={{ fontSize: '1rem', color: '#334155', marginBottom: '1rem' }}>General Identity</h3>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Display Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ padding: '0.75rem', width: '100%', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
            </div>
            <div className="form-group">
              <label style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Communication Signature</label>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.5rem 0' }}>This block will be automatically appended to the bottom of your Ticket Replies.</p>
              <textarea rows="4" value={signature} onChange={e => setSignature(e.target.value)} placeholder="--\nHendra (NOC L1)\nPT Telematika" style={{ padding: '0.75rem', width: '100%', borderRadius: '4px', border: '1px solid #cbd5e1', fontFamily: 'inherit' }} />
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '1rem', color: '#334155', marginBottom: '1rem', borderTop: '1px dashed #e2e8f0', paddingTop: '1.5rem' }}>Security Credentials</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem 0' }}>Leave fields blank if you do not wish to mutate your existing password.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 1fr)', gap: '1rem' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Current Password</label>
                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={{ padding: '0.75rem', width: '100%', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ padding: '0.75rem', width: '100%', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ padding: '0.75rem', width: '100%', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="submit" disabled={saving} className="primary-btn" style={{ padding: '0.75rem 2rem', fontWeight: 'bold' }}>
              {saving ? 'Processing...' : 'Apply Modifications'}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
