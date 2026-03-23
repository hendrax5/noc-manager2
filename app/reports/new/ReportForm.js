"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReportForm() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
    
    if (res.ok) {
      router.push("/reports");
      router.refresh();
    } else {
      alert("Failed to submit report.");
      setLoading(false);
    }
  };

  return (
    <div className="login-card" style={{ maxWidth: '800px', margin: '0' }}>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Report Content</label>
          <textarea 
            required 
            rows="12" 
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontFamily: 'inherit', boxSizing: 'border-box' }}
            value={content} 
            onChange={e => setContent(e.target.value)}
            placeholder="Describe alarms handled, tickets solved, or operations done during your shift..."
          ></textarea>
        </div>
        <button type="submit" className="primary-btn" disabled={loading} style={{ maxWidth: '200px' }}>
          {loading ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
}
