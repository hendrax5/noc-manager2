"use client";
import { useEffect, useState, Fragment } from "react";
import toast from "react-hot-toast";

const DEFAULT_SCOPES = [
  "tickets:create",
  "tickets:read",
  "tickets:comment",
  "tickets:update",
  "tickets:read:full",
  "schedules:read",
  "meetings:read",
  "dashboard:read",
  "reports:daily:read",
  "reports:ops:read",
  "reports:performance:read",
  "reports:sla:read",
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
      toast.error("Pilih minimal satu scope");
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
        toast.error(data.error || "Gagal menyimpan scopes");
        return;
      }
      setEditingId(null);
      setEditScopes([]);
      toast.success("Scopes updated");
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
      toast.error(data.error || "Failed");
      return;
    }
    setCreatedKey(data.apiKey);
    toast.success("Integration app created");
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(data.error || "Gagal merotasi kunci"); return; }
    if (data.apiKey) setCreatedKey(data.apiKey);
    await load();
  };

  const toggleActive = async (app) => {
    const res = await fetch(`/api/integrations/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !app.active }),
    });
    if (!res.ok) { const body = await res.json().catch(() => ({})); toast.error(body.error || "Gagal mengubah status integrasi"); return; }
    await load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this integration app?")) return;
    const res = await fetch(`/api/integrations/${id}`, { method: "DELETE" });
    if (!res.ok) { const body = await res.json().catch(() => ({})); toast.error(body.error || "Gagal menghapus integrasi"); return; }
    await load();
  };

  return (
    <div>
      <div className="ui-static-8bd9dc7312" >
        <h3 className="ui-static-c312289912" >Integration Apps (API v1)</h3>
        <p className="ui-static-8513c719f9" >
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
          className="ui-static-44397b3b80"
        >
          <strong>API key (copy now — shown once):</strong>
          <pre className="ui-static-0d79798c88" style={{wordBreak: "break-all"}}>{createdKey}</pre>
          <button type="button" className="btn ui-static-084dc32886"  onClick={() => setCreatedKey(null)}>
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={createApp} className="ui-static-67c42c59ef" style={{display: "grid", maxWidth: 640}}>
        <input
          className="form-control"
          aria-label="Nama aplikasi integrasi"
          placeholder="App name (e.g. Zabbix, Customer Portal)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          className="form-control"
          aria-label="Deskripsi integrasi"
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <input
          className="form-control"
          aria-label="URL webhook"
          placeholder="Webhook URL (optional)"
          value={form.webhookUrl}
          onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
        />
        <select
          className="form-control"
          aria-label="Departemen default"
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
        <div className="ui-static-30f523173e" role="group" aria-label="Scope akses integrasi" style={{display: "flex", flexWrap: "wrap"}}>
          {availableScopes.map((s) => (
            <label key={s} className="ui-static-8af4b6ba2f" style={{display: "flex", alignItems: "center"}}>
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
        <p className="ui-static-bf4b678785" >No integration apps yet. Legacy EXTERNAL_API_KEY still works for create.</p>
      ) : (
        <table className="table ui-static-6393964ce2" style={{width: "100%"}}>
          <caption className="sr-only">Aplikasi integrasi, prefix kunci, scope, webhook, dan status</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Key prefix</th>
              <th scope="col">Scopes</th>
              <th scope="col">Webhook</th>
              <th scope="col">Status</th>
              <th scope="col">Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <Fragment key={app.id}>
                <tr>
                  <td>
                    <strong>{app.name}</strong>
                    {app.description ? (
                      <div className="ui-static-2ddb68e1f2" >{app.description}</div>
                    ) : null}
                  </td>
                  <td>
                    <code>{app.keyPrefix}…</code>
                  </td>
                  <td style={{ maxWidth: 240 }}>{(app.scopes || []).join(", ") || "—"}</td>
                  <td>{app.webhookUrl ? "Yes" : "—"}</td>
                  <td><span className="badge" style={app.active ? {background: "var(--ui-success-bg)", color: "var(--ui-success)"} : {background: "var(--ui-warning-bg)", color: "var(--ui-warning)"}}>{app.active ? "Active" : "Disabled"}</span></td>
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
                    <button type="button" className="btn btn-danger-ghost" onClick={() => remove(app.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
                {editingId === app.id ? (
                  <tr>
                    <td colSpan={6} className="ui-static-cbc5ff71a2" >
                      <div className="ui-static-5963e47692" >
                        Edit scopes — {app.name}
                      </div>
                      <div className="ui-static-bcc03ba549" style={{display: "flex", flexWrap: "wrap"}}>
                        {availableScopes.map((s) => (
                          <label
                            key={s}
                            className="ui-static-8af4b6ba2f" style={{display: "flex", alignItems: "center"}}
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
                      <div className="ui-static-02685c1976" >
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
