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
      const res = await fetch(`/api/tickets/${encodeURIComponent(ticket.trackingId)}/csat`, {
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
    <div className="container ui-static-6a6452713b" style={{maxWidth: 720}}>
      <p className="ui-static-0068c9ed2c" style={{textTransform: "uppercase"}}>
        Public ticket status
      </p>
      <h1 className="ui-static-c312289912" >{ticket.title}</h1>
      <p className="font-mono ui-static-a64efbfeda" >
        {ticket.trackingId}
      </p>

      <div className="card ui-static-9f4fe52257" >
        <div className="ui-static-af81cc4264" style={{display: "grid", gridTemplateColumns: "1fr 1fr"}}>
          <div>
            <div className="ui-static-3df13491a1" style={{textTransform: "uppercase"}}>Status</div>
            <div className="ui-static-b8f3c0ff5c" >{ticket.status}</div>
          </div>
          <div>
            <div className="ui-static-3df13491a1" style={{textTransform: "uppercase"}}>Priority</div>
            <div className="ui-static-5c05f4afaf" >{ticket.priority}</div>
          </div>
          <div>
            <div className="ui-static-3df13491a1" style={{textTransform: "uppercase"}}>Type</div>
            <div>{ticket.ticketType || "Incident"}</div>
          </div>
          <div>
            <div className="ui-static-3df13491a1" style={{textTransform: "uppercase"}}>Updated</div>
            <div className="font-mono ui-static-6393964ce2" >
              {new Date(ticket.updatedAt).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="card ui-static-14b98d08ef" >
        <h2 className="ui-static-c312289912" >Public updates</h2>
        {ticket.comments.length === 0 && (
          <p className="ui-static-054e197f0f" >No public updates yet.</p>
        )}
        <ul className="ui-static-d4913812e7" style={{listStyle: "none"}}>
          {ticket.comments.map((c) => (
            <li key={c.id} className="ui-static-5658e5e449" >
              <div className="ui-static-2188c20d97" >
                {c.author?.name || "Staff"} · {new Date(c.createdAt).toLocaleString()}
              </div>
              <p className="ui-static-1eb05797c2" style={{whiteSpace: "pre-wrap"}}>{c.text}</p>
            </li>
          ))}
        </ul>
      </div>

      {ticket.canCsat && !done && (
        <form className="card ui-static-14b98d08ef"  onSubmit={submitCsat}>
          <h2 className="ui-static-c312289912" >Rate this resolution</h2>
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
        <div className="card ui-static-14b98d08ef" >
          <p className="ui-static-ff227d0632" >
            Thank you. Rating recorded{ticket.csatScore ? `: ${ticket.csatScore}/5` : ""}.
          </p>
        </div>
      )}
    </div>
  );
}
