"use client";
import { useEffect, useId, useState } from "react";
import { TicketServicePicker } from "./TicketWorkClassification";
import { readServiceBandwidthMbps } from "@/lib/services/capacity";

const inputStyle = { width: "100%", boxSizing: "border-box", minWidth: 0, padding: "0.65rem", border: "1px solid var(--border-color)", borderRadius: "4px", background: "var(--input-bg)", color: "var(--input-text)" };

function templateFields(template) {
  try {
    const fields = typeof template?.fields === "string" ? JSON.parse(template.fields) : template?.fields;
    return Array.isArray(fields) ? fields.filter(field => field && typeof field.name === "string") : [];
  } catch { return []; }
}

export default function ServiceWorkFields({ value, onChange, services = [], serviceTemplates = [], onTypeChange }) {
  const id = useId();
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/service-work-types").then(response => {
      if (!response.ok) throw new Error("Jenis pekerjaan gagal dimuat. Muat ulang halaman untuk mencoba lagi.");
      return response.json();
    }).then(data => { if (active) setTypes(Array.isArray(data) ? data.filter(type => type.active !== false) : []); })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const selectedIds = value.serviceIds || [];
  const service = services.find(item => Number(item.id) === Number(selectedIds[0]));
  const type = types.find(item => Number(item.id) === Number(value.serviceWorkTypeId));
  const request = value.serviceChange || {};
  const operation = type?.operation;
  const terminating = operation === "Terminate";
  const target = serviceTemplates.find(item => Number(item.id) === Number(request.targetTemplateId || service?.templateId));
  const current = serviceTemplates.find(item => Number(item.id) === Number(service?.templateId));
  const bandwidth = service ? readServiceBandwidthMbps(service) : null;
  const updateRequest = patch => onChange({ serviceChange: { ...request, ...patch } });
  const requiredFields = templateFields(target).filter(field => field.required && !['bandwidthMbps','Bandwidth Mbps','Bandwidth (Mbps)','bandwidth_mbps'].includes(field.name) && !/^(cid|sid|id layanan|service id|circuit\s*id)$/i.test(field.name.trim()));

  return <div style={{ display: "grid", gap: "1rem", minWidth: 0, overflowWrap: "anywhere" }}>
    <TicketServicePicker services={services} selectedIds={selectedIds} single onChange={serviceIds => onChange({ serviceIds, serviceChange: {} })} />
    <p style={{ margin: 0 }}>Satu CID per pekerjaan. Untuk circuit baru, <a href="/assets/new?ticketSetup=1" target="_blank" rel="noopener noreferrer">daftarkan CID dan lanjutkan tiket instalasi di tab baru</a>.</p>
    {selectedIds.length > 1 && <p role="alert">Pilih tepat satu CID untuk pekerjaan layanan.</p>}
    <label htmlFor={`${id}-type`}>Jenis pekerjaan layanan *</label>
    <select id={`${id}-type`} required style={inputStyle} value={value.serviceWorkTypeId || ""} onChange={event => {
      const next = types.find(item => String(item.id) === event.target.value);
      onChange({ serviceWorkTypeId: next?.id || "", serviceChange: {} });
      if (next) onTypeChange?.(next);
    }}>
      <option value="">{loading ? "Memuat jenis pekerjaan…" : "Pilih jenis pekerjaan"}</option>
      {value.serviceWorkTypeId && !type && <option value={value.serviceWorkTypeId} disabled>{value.serviceWorkTypeLabel || "Jenis tersimpan"} (tidak tersedia)</option>}
      {types.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    {error && <p role="alert">{error}</p>}
    {!loading && !error && !types.length && <p role="alert">Belum ada jenis pekerjaan aktif. Hubungi Admin untuk mengatur master.</p>}
    {service && <div style={{ background: "var(--hover-bg)", padding: "0.75rem", borderRadius: "4px" }}>
      <strong>Kondisi saat ini</strong>
      <p style={{ marginBottom: 0 }}>Pelanggan: {service.customer?.name || "—"}<br />Produk/Layanan: {current?.name || service.template?.name || "Belum tersedia"}<br />Kapasitas: {bandwidth === null ? "Belum diketahui — perlu ditinjau" : `${bandwidth} Mbps`}<br />Status: {service.status || "—"}</p>
    </div>}
    {type && <>
      {!terminating && <>
        <label htmlFor={`${id}-product`}>Produk/Layanan tujuan *</label>
        <select id={`${id}-product`} style={inputStyle} required value={request.targetTemplateId || service?.templateId || ""} onChange={event => updateRequest({ targetTemplateId: Number(event.target.value), targetCustomData: {} })}>
          <option value="">Pilih produk/layanan</option>
          {serviceTemplates.filter(template => template.active !== false).map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
        <label htmlFor={`${id}-capacity`}>Kapasitas tujuan (Mbps){["Upgrade", "Downgrade", "Installation"].includes(operation) ? " *" : " (opsional)"}</label>
        <input id={`${id}-capacity`} style={inputStyle} type="number" min="0.001" step="any" required={["Upgrade", "Downgrade", "Installation"].includes(operation)} value={request.bandwidthMbps ?? ""} onChange={event => updateRequest({ bandwidthMbps: event.target.value === "" ? undefined : Number(event.target.value) })} />
        {["Upgrade", "Downgrade"].includes(operation) && <small>{operation === "Upgrade" ? "Kapasitas tujuan harus lebih besar dari kondisi saat ini." : "Kapasitas tujuan harus lebih kecil dari kondisi saat ini."}</small>}
        {requiredFields.map((field, index) => <div key={field.name}>
          <label htmlFor={`${id}-field-${index}`}>{field.name} *</label>
          {field.type === 'select' ? <select id={`${id}-field-${index}`} style={inputStyle} required value={request.targetCustomData?.[field.name] ?? service?.customData?.[field.name] ?? ''} onChange={event => updateRequest({ targetCustomData: { ...request.targetCustomData, [field.name]: event.target.value } })}><option value="">Pilih {field.name}</option>{(Array.isArray(field.options) ? field.options : String(field.options || '').split(/[,\n]/).map(value=>value.trim()).filter(Boolean)).map(option=><option key={option} value={option}>{option}</option>)}</select> : <input id={`${id}-field-${index}`} style={inputStyle} required type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={request.targetCustomData?.[field.name] ?? service?.customData?.[field.name] ?? ""} onChange={event => updateRequest({ targetCustomData: { ...request.targetCustomData, [field.name]: field.type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value } })} />}
        </div>)}
      </>}
      {terminating && <p>Resolve akan menonaktifkan layanan ini. CID dan riwayat tetap tersimpan.</p>}
      <label htmlFor={`${id}-date`}>Tanggal efektif *</label>
      <input id={`${id}-date`} style={inputStyle} required type="date" value={request.effectiveDate || ""} onChange={event => updateRequest({ effectiveDate: event.target.value })} />
      <small>Tanggal pelaksanaan aktual; tanggal masa depan tidak dapat di-Resolve.</small>
      <label htmlFor={`${id}-reason`}>{terminating ? "Alasan terminasi *" : "Alasan / catatan perubahan"}</label>
      <textarea id={`${id}-reason`} style={inputStyle} required={terminating} rows={3} value={request.reason || ""} onChange={event => updateRequest({ reason: event.target.value })} />
      <p>Perubahan diterapkan ke Inventory saat Resolve. Kondisi sebelum/sesudah tersimpan pada riwayat tiket.</p>
    </>}
  </div>;
}
