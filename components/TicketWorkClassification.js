"use client";
import { useEffect, useId, useState } from "react";
import { WORK_TYPES, WORK_TYPE_LABELS } from "@/lib/tickets/workClassification";
import ServiceWorkFields from "./ServiceWorkFields";
import { getServiceCid } from "@/lib/services/cid";

const inputStyle = { width: "100%", padding: "0.65rem", border: "1px solid var(--border-color)", borderRadius: "4px", background: "var(--input-bg)", color: "var(--input-text)" };

function MasterSelect({ kind, value, snapshot, onChange }) {
  const id = useId();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`/api/trouble-masters?kind=${kind}`)
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { if (active) setItems(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [kind]);
  const current = items.find(item => String(item.id) === String(value));
  const options = items.filter(item => item.active !== false && (String(item.id) === String(value) || `${item.name} ${item.description || ""}`.toLowerCase().includes(search.toLowerCase())));
  const label = kind === "symptom" ? "Gejala" : "Penyebab";
  return <div>
    <label htmlFor={`${id}-search`}>Cari {label.toLowerCase()}</label>
    <input id={`${id}-search`} style={inputStyle} value={search} onChange={event => setSearch(event.target.value)} placeholder={`Cari ${label.toLowerCase()}…`} />
    <label htmlFor={id}>{label} *</label>
    <select id={id} style={inputStyle} value={value || ""} required onChange={event => {
      const item = items.find(entry => String(entry.id) === event.target.value);
      onChange(item?.id || null, item?.name || null);
    }}>
      <option value="">Pilih {label.toLowerCase()}</option>
      {value && !current && <option value={value}>{snapshot || "Pilihan tersimpan"} (tersimpan)</option>}
      {options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    {error && <p role="alert">Master {label.toLowerCase()} gagal dimuat. Muat ulang halaman untuk mencoba lagi.</p>}
  </div>;
}

export function TicketServicePicker({ services, selectedIds, onChange, single = false }) {
  const id = useId();
  const [search, setSearch] = useState("");
  const matches = services.filter(service => `${getServiceCid(service) || ""} ${service.name || ""} ${service.customer?.name || ""}`.toLowerCase().includes(search.toLowerCase()));
  return <fieldset style={{ border: "1px solid var(--border-color)", margin: "1rem 0", minWidth: 0, overflowWrap: "anywhere" }}>
    <legend>Layanan / CID terkait</legend>
    <label htmlFor={id}>Cari CID, pelanggan, atau layanan</label>
    <input id={id} style={inputStyle} value={search} onChange={event => setSearch(event.target.value)} />
    <div style={{ maxHeight: "200px", overflow: "auto" }}>
      {matches.map(service => <label key={service.id} style={{ display: "block", padding: "0.4rem" }}>
        <input type={single ? "radio" : "checkbox"} name={`${id}-service`} checked={selectedIds.includes(service.id)} onChange={event => onChange(single ? [service.id] : event.target.checked ? [...selectedIds, service.id] : selectedIds.filter(value => value !== service.id))} />{" "}
        {getServiceCid(service) || "CID belum tersedia"} — {service.customer?.name || "Tanpa pelanggan"} / {service.name}
      </label>)}
      {!matches.length && <p>Tidak ada layanan yang cocok.</p>}
    </div>
  </fieldset>;
}

export default function TicketWorkClassification({ value, onChange, services = [], serviceTemplates = [], onServiceWorkTypeChange }) {
  const id = useId();
  return <fieldset style={{ gridColumn: "1 / -1", border: "1px solid var(--border-color)", padding: "1rem", minWidth: 0, marginBottom: "1rem" }}>
    <legend>Klasifikasi pekerjaan</legend>
    <label htmlFor={id}>Jenis pekerjaan</label>
    <select id={id} style={inputStyle} value={value.workType || "Unclassified"} onChange={event => onChange({ workType: event.target.value })}>
      {WORK_TYPES.map(type => <option key={type} value={type}>{WORK_TYPE_LABELS[type] || type}</option>)}
    </select>
    {["Installation", "ServiceWork"].includes(value.workType) && <div>
      <label>Referensi SAP (opsional)
        <input style={inputStyle} value={value.sapReference || ""} onChange={event => onChange({ sapReference: event.target.value })} placeholder="Masukkan referensi SAP secara manual" />
      </label>
      <p>{value.workType === "Installation" ? "Field lama dan waktu downtime tetap tersimpan. Installation tidak dihitung dalam downtime SLA." : "Pekerjaan layanan tidak dihitung dalam downtime SLA."}</p>
    </div>}
    {value.workType === "ServiceWork" && <ServiceWorkFields value={value} onChange={onChange} services={services} serviceTemplates={serviceTemplates} onTypeChange={onServiceWorkTypeChange} />}
    {value.workType === "Trouble" && <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
      <p>Pilih minimal satu layanan dengan CID, gejala, dan penyebab. Gunakan “Belum diketahui” bila penyebab belum diketahui.</p>
      <MasterSelect kind="symptom" value={value.symptomId} snapshot={value.symptomLabel} onChange={(symptomId, symptomLabel) => onChange({ symptomId, symptomLabel })} />
      <MasterSelect kind="cause" value={value.causeId} snapshot={value.causeLabel} onChange={(causeId, causeLabel) => onChange({ causeId, causeLabel })} />
    </div>}
  </fieldset>;
}
