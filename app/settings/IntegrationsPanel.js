"use client";
import { useEffect, useState, Fragment } from "react";

const DEFAULT_SCOPES = [
  "tickets:create",
  "tickets:read",
  "tickets:comment",
  "tickets:update",
  "schedules:read",
  "meetings:read",
  "reports:daily:read",
  "reports:ops:read",
];

export default function IntegrationsPanel({ departments = [] }) {
  const [apps, setApps] = useState([]);
  const [availableScopes, setAvailableScopes] = useState(DEFAULT_SCOPES);
  const [loading, setLoading] = useState(true);
  const [createdKey, setCreatedKey] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editScopes, setEditScopes] = useState([]);
  const [savingScopes, setSavingScopes] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    scopes: ["tickets:create", "tickets:read"],
    webhookUrl: "",
    defaultDepartmentId: "",
    rateLimitPerMinute: 60,
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setApps(data.apps || []);
      setAvailableScopes(data.availableScopes || DEFAULT_SCOPES);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleScope = (scope) => {
    setForm((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  const toggleEditScope = (scope) => {
    setEditScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const startEditScopes = (app) => {
    setEditingId(app.id);
    setEditScopes([...(app.scopes || [])]);
  };

  const cancelEditScopes = () => {
    setEditingId(null);
    setEditScopes([]);
  };

  const saveScopes = async (id) => {
    if (!editScopes.length) {
      alert("Pilih minimal satu scope");
      return;
    }
    setSavingScopes(true);
    try {
      const res = await fetch(`/api/integrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopes: editScopes }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal menyimpan scopes");
        return;
      }
      setEditingId(null);
      setEditScopes([]);
      await load();
    } finally {
      setSavingScopes(false);
    }
  };

  const createApp = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        defaultDepartmentId: form.defaultDepartmentId || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed");
      return;
    }
    setCreatedKey(data.apiKey);
    setForm({
      name: "",
      description: "",
      scopes: ["tickets:create", "tickets:read"],
      webhookUrl: "",
      defaultDepartmentId: "",
      rateLimitPerMinute: 60,
    });
    await load();
  };

  const rotateKey = async (id) => {
    if (!confirm("Rotate API key? Old key stops working immediately.")) return;
    const res = await fetch(`/api/integrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotateKey: true }),
    });
    const data = await res.json();
    if (data.apiKey) setCreatedKey(data.apiKey);
    await load();
  };

  const toggleActive = async (app) => {
    await fetch(`/api/integrations/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !app.active }),
    });
    await load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this integration app?")) return;
    await fetch(`/api/integrations/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Integration Apps (API v1)</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Create per-app API keys with scopes. Machine-readable spec:{" "}
          <a href="/api/v1/openapi" target="_blank" rel="noreferrer">
            OpenAPI JSON
          </a>
          . Guide in repo: <code>docs/API_V1.md</code>. Header: <code>X-API-Key</code>. Webhooks signed with{" "}
          <code>X-NOC-Signature</code> (HMAC-SHA256).
        </p>
      </div>

      {createdKey && (
        <div
          style={{
            background: "#ecfdf5",
            border: "1px solid #6ee7b7",
            padding: "1rem",
            borderRadius: 8,
            marginBottom: "1.5rem",
          }}
        >
          <strong>API key (copy now — shown once):</strong>
          <pre style={{ margin: "0.5rem 0 0", wordBreak: "break-all" }}>{createdKey}</pre>
          <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => setCreatedKey(null)}>
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={createApp} style={{ display: "grid", gap: "0.75rem", marginBottom: "2rem", maxWidth: 640 }}>
        <input
          className="form-control"
          placeholder="App name (e.g. Zabbix, Customer Portal)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          className="form-control"
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <input
          className="form-control"
          placeholder="Webhook URL (optional)"
          value={form.webhookUrl}
          onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
        />
        <select
          className="form-control"
          value={form.defaultDepartmentId}
          onChange={(e) => setForm({ ...form, defaultDepartmentId: e.target.value })}
        >
          <option value="">Default department (optional)</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {availableScopes.map((s) => (
            <label key={s} style={{ fontSize: "0.85rem", display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={form.scopes.includes(s)} onChange={() => toggleScope(s)} />
              {s}
            </label>
          ))}
        </div>
        <button type="submit" className="btn btn-primary">
          Create integration + API key
        </button>
      </form>

      {loading ? (
        <p>Loading…</p>
      ) : apps.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No integration apps yet. Legacy EXTERNAL_API_KEY still works for create.</p>
      ) : (
        <table className="table" style={{ width: "100%", fontSize: "0.9rem" }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Key prefix</th>
              <th>Scopes</th>
              <th>Webhook</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <Fragment key={app.id}>
                <tr>
                  <td>
                    <strong>{app.name}</strong>
                    {app.description ? (
                      <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{app.description}</div>
                    ) : null}
                  </td>
                  <td>
                    <code>{app.keyPrefix}…</code>
                  </td>
                  <td style={{ maxWidth: 240 }}>{(app.scopes || []).join(", ") || "—"}</td>
                  <td>{app.webhookUrl ? "Yes" : "—"}</td>
                  <td>{app.active ? "Active" : "Disabled"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className="btn" onClick={() => startEditScopes(app)}>
                      Edit scopes
                    </button>{" "}
                    <button type="button" className="btn" onClick={() => rotateKey(app.id)}>
                      Rotate key
                    </button>{" "}
                    <button type="button" className="btn" onClick={() => toggleActive(app)}>
                      {app.active ? "Disable" : "Enable"}
                    </button>{" "}
                    <button type="button" className="btn" onClick={() => remove(app.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
                {editingId === app.id ? (
                  <tr>
                    <td colSpan={6} style={{ background: "var(--hover-bg, #f8fafc)", padding: "1rem" }}>
                      <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                        Edit scopes — {app.name}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                        {availableScopes.map((s) => (
                          <label
                            key={s}
                            style={{ fontSize: "0.85rem", display: "flex", gap: 6, alignItems: "center" }}
                          >
                            <input
                              type="checkbox"
                              checked={editScopes.includes(s)}
                              onChange={() => toggleEditScope(s)}
                            />
                            {s}
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={savingScopes}
                        onClick={() => saveScopes(app.id)}
                      >
                        {savingScopes ? "Saving…" : "Save scopes"}
                      </button>{" "}
                      <button type="button" className="btn" onClick={cancelEditScopes} disabled={savingScopes}>
                        Cancel
                      </button>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 8 }}>
                        Key tidak berubah — hanya permission scope yang diupdate.
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
