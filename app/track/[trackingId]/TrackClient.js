"use client";
import { useState } from "react";

export default function TrackClient({ ticket }) {
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(!!ticket.csatScore);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submitCsat = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/csat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  return (
    <div className="container" style={{ maxWidth: 720, paddingTop: "2.5rem" }}>
      <p style={{ color: "var(--muted-text)", fontSize: "0.8rem", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
        Public ticket status
      </p>
      <h1 style={{ marginTop: 0 }}>{ticket.title}</h1>
      <p className="font-mono" style={{ color: "var(--muted-text)" }}>
        {ticket.trackingId}
      </p>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted-text)", textTransform: "uppercase" }}>Status</div>
            <div style={{ fontWeight: 700, color: "var(--heading-color)" }}>{ticket.status}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted-text)", textTransform: "uppercase" }}>Priority</div>
            <div style={{ fontWeight: 600 }}>{ticket.priority}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted-text)", textTransform: "uppercase" }}>Type</div>
            <div>{ticket.ticketType || "Incident"}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted-text)", textTransform: "uppercase" }}>Updated</div>
            <div className="font-mono" style={{ fontSize: "0.9rem" }}>
              {new Date(ticket.updatedAt).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Public updates</h2>
        {ticket.comments.length === 0 && (
          <p style={{ color: "var(--muted-text)", margin: 0 }}>No public updates yet.</p>
        )}
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {ticket.comments.map((c) => (
            <li key={c.id} style={{ padding: "0.75rem 0", borderTop: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--muted-text)" }}>
                {c.author?.name || "Staff"} · {new Date(c.createdAt).toLocaleString()}
              </div>
              <p style={{ margin: "0.35rem 0 0", whiteSpace: "pre-wrap" }}>{c.text}</p>
            </li>
          ))}
        </ul>
      </div>

      {ticket.canCsat && !done && (
        <form className="card" style={{ marginTop: "1rem" }} onSubmit={submitCsat}>
          <h2 style={{ marginTop: 0 }}>Rate this resolution</h2>
          <div className="form-group">
            <label>Score (1–5)</label>
            <select value={score} onChange={(e) => setScore(parseInt(e.target.value, 10))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Comment (optional)</label>
            <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="primary-btn" disabled={saving}>
            {saving ? "Submitting..." : "Submit rating"}
          </button>
        </form>
      )}

      {(done || ticket.csatScore) && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <p style={{ margin: 0 }}>
            Thank you. Rating recorded{ticket.csatScore ? `: ${ticket.csatScore}/5` : ""}.
          </p>
        </div>
      )}
    </div>
  );
}
