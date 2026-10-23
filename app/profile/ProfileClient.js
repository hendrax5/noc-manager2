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
    <div className="ui-static-0410aac9fd" style={{display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(0, 2fr)', alignItems: 'flex-start'}}>
      
      {/* Read-Only Stats & Avatar Card */}
      <div className="card ui-static-39c1d6c828" style={{textAlign: 'center'}}>
        <div className="ui-static-bca5898176" style={{position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'}}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span className="ui-static-96b2547c3a" ></span>
          )}
          <div 
             onClick={() => fileInputRef.current?.click()}
             className="ui-static-4c69d84c46" style={{position: 'absolute', bottom: 0, left: 0, right: 0, cursor: 'pointer'}}
          >
             Upload
          </div>
          <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" style={{ display: 'none' }} />
        </div>
        
        <h2 className="ui-static-8fc28424f0" >{user.name || "NOC Member"}</h2>
        <p className="ui-static-2eab973988" >{user.email}</p>
        
        <div className="ui-static-e087a4e644" style={{textAlign: 'left', display: 'grid'}}>
           <div>
             <span className="ui-static-a62c2220e9" style={{display: 'block', textTransform: 'uppercase'}}>Role Authorization</span>
             <span className="ui-static-51a577857b" >{user.role.name}</span>
           </div>
           <div>
             <span className="ui-static-a62c2220e9" style={{display: 'block', textTransform: 'uppercase'}}>Department Tag</span>
             <span className="ui-static-51a577857b" >{user.department.name}</span>
           </div>
        </div>
      </div>

      {/* Edit Form Card */}
      <div className="card ui-static-39c1d6c828" >
        <h2 className="ui-static-cf0b454385" >Configuration Pipeline</h2>
        
        {message && (
          <div className="ui-static-edeb725f55" style={{background: message.type === 'success' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`, color: message.type === 'success' ? '#065f46' : '#991b1b'}}>
            {message.type === 'success' ? '✅' : '🚨'} {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="ui-static-92254f43e7" style={{display: 'grid'}}>
          
          <div>
            <h3 className="ui-static-f924731e8b" >General Identity</h3>
            <div className="form-group ui-static-3e8220669e" >
              <label className="ui-static-a0ab726de6" >Display Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="ui-static-4234f20878" style={{width: '100%'}} />
            </div>
            <div className="form-group">
              <label className="ui-static-a0ab726de6" >Communication Signature</label>
              <p className="ui-static-df3f8b78c5" >This block will be automatically appended to the bottom of your Ticket Replies.</p>
              <textarea rows="4" value={signature} onChange={e => setSignature(e.target.value)} placeholder="--\nHendra (NOC L1)\nPT Telematika" className="ui-static-22c3168f4e" style={{width: '100%'}} />
            </div>
          </div>

          <div>
            <h3 className="ui-static-17dfefe4d7" >Security Credentials</h3>
            <p className="ui-static-3b451fbe3b" >Leave fields blank if you do not wish to mutate your existing password.</p>
            
            <div className="ui-static-af81cc4264" style={{display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 1fr)'}}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="ui-static-a0ab726de6" >Current Password</label>
                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="ui-static-4234f20878" style={{width: '100%'}} />
              </div>
              <div className="form-group">
                <label className="ui-static-a0ab726de6" >New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="ui-static-4234f20878" style={{width: '100%'}} />
              </div>
              <div className="form-group">
                <label className="ui-static-a0ab726de6" >Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="ui-static-4234f20878" style={{width: '100%'}} />
              </div>
            </div>
          </div>

          <div className="ui-static-14b98d08ef" style={{display: 'flex', justifyContent: 'flex-end'}}>
            <button type="submit" disabled={saving} className="primary-btn ui-static-8daebf9218" >
              {saving ? 'Processing...' : 'Apply Modifications'}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
