"use client";
import { formatCustomerId } from '@/lib/customers/identity';
import { useEffect, useId, useRef, useState } from "react";
import { WORK_TYPES, WORK_TYPE_LABELS } from "@/lib/tickets/workClassification";
import ServiceWorkFields from "./ServiceWorkFields";
import { getServiceCid, getServiceSearchText } from "@/lib/services/cid";

const inputStyle = { width: "100%", padding: "0.65rem", border: "1px solid var(--border-color)", borderRadius: "4px", background: "var(--input-bg)", color: "var(--input-text)" };

function MasterSelect({ kind, value, snapshot, onChange }) {
  const id = useId();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    fetch(`/api/trouble-masters?kind=${kind}`)
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { if (active) setItems(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind]);
  const current = items.find(item => String(item.id) === String(value));
  const selectedLabel = current?.name || (value ? snapshot || "Pilihan tersimpan" : "");
  const options = items.filter(item => item.active !== false && `${item.name} ${item.description || ""}`.toLowerCase().includes((search || "").toLowerCase()));
  const label = kind === "symptom" ? "Gejala" : "Penyebab";
  useEffect(() => {
    inputRef.current?.setCustomValidity(value ? "" : `Pilih ${label.toLowerCase()} dari daftar.`);
  }, [value, search, label]);
  const choose = item => {
    onChange(item.id, item.name);
    setSearch(null);
    setOpen(false);
    setHighlight(-1);
  };
  return <div style={{ position: "relative" }}>
    <label htmlFor={id}>{label} *</label>
    <input ref={inputRef} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open}
      aria-controls={`${id}-options`} aria-activedescendant={open && highlight >= 0 && options[highlight] ? `${id}-option-${options[highlight].id}` : undefined}
      aria-describedby={`${id}-help`} autoComplete="off" style={inputStyle} required
      value={search === null ? selectedLabel : search} placeholder={`Ketik atau pilih ${label.toLowerCase()}…`}
      onFocus={() => { setOpen(true); setHighlight(-1); }}
      onClick={() => setOpen(true)}
      onBlur={() => { setOpen(false); setSearch(null); setHighlight(-1); }}
      onChange={event => { setSearch(event.target.value); setOpen(true); setHighlight(-1); onChange(null, null); }}
      onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setOpen(true);
          setHighlight(previous => options.length ? (event.key === "ArrowDown" ? Math.min(previous + 1, options.length - 1) : previous <= 0 ? options.length - 1 : previous - 1) : -1);
        } else if (event.key === "Enter" && open) {
          event.preventDefault();
          if (options[highlight]) choose(options[highlight]);
        } else if (event.key === "Escape") {
          event.preventDefault(); setOpen(false); setSearch(null); setHighlight(-1);
        }
      }} />
    {open && <div id={`${id}-options`} role="listbox" aria-label={`Pilihan ${label.toLowerCase()}`}
      style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, maxHeight: "240px", overflowY: "auto", background: "var(--input-bg)", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
      {options.map((item, index) => <div key={item.id} id={`${id}-option-${item.id}`} role="option" aria-selected={String(item.id) === String(value)}
        style={{ padding: "0.65rem", cursor: "pointer", background: highlight === index ? "var(--border-color)" : undefined }}
        ref={element => { if (element && highlight === index) element.scrollIntoView({ block: "nearest" }); }}
        onMouseDown={event => event.preventDefault()} onClick={() => choose(item)}>{item.name}</div>)}
      {!options.length && <p role="status" style={{ padding: "0.65rem" }}>{loading ? "Memuat pilihan…" : error ? "Pilihan gagal dimuat." : "Tidak ada pilihan yang cocok."}</p>}
    </div>}
    <small id={`${id}-help`}>{kind === 'symptom' ? 'Pilih gejala yang terlihat, misalnya Down atau Packet Loss.' : 'Pilih penyebab gangguan; gunakan “Belum diketahui” jika masih investigasi.'}</small>
    {/^\s*SAP-/i.test(search || "") && <p role="alert">Teks ini terlihat seperti CID. Gunakan kolom Cari &amp; pilih CID layanan di atas.</p>}
    {loading && <p role="status">Memuat pilihan {label.toLowerCase()}…</p>}
    {!loading && !error && !items.length && <p>Hubungi Admin untuk mengisi Master Data Trouble.</p>}
    {error && <p role="alert">Master {label.toLowerCase()} gagal dimuat. Muat ulang halaman untuk mencoba lagi.</p>}
  </div>;
}

export function TicketServicePicker({ services, selectedIds, onChange, single = false }) {
  const id = useId();
  const [search, setSearch] = useState("");
  const matches = services.filter(service => getServiceSearchText(service).toLowerCase().includes(search.toLowerCase()));
  return <fieldset style={{ border: "1px solid var(--border-color)", margin: "1rem 0", minWidth: 0, overflowWrap: "anywhere" }}>
    <legend>Layanan / CID terkait</legend>
    <label htmlFor={id}>Cari &amp; pilih CID layanan</label>
    <input id={id} style={inputStyle} value={search} onChange={event => setSearch(event.target.value)} placeholder="Ketik CID, nama customer, atau nama layanan" />
    <small>{single ? 'Pilih satu circuit untuk pekerjaan ini.' : 'Centang circuit yang terganggu.'} Customer mengikuti layanan yang dipilih.</small>
    <div style={{ maxHeight: "200px", overflow: "auto" }}>
      {matches.map(service => <label key={service.id} style={{ display: "block", padding: "0.4rem" }}>
        <input type={single ? "radio" : "checkbox"} name={`${id}-service`} checked={selectedIds.includes(service.id)} onChange={event => onChange(single ? [service.id] : event.target.checked ? [...selectedIds, service.id] : selectedIds.filter(value => value !== service.id))} />{" "}
        {getServiceCid(service) || "CID belum tersedia"} — {formatCustomerId({id:service.customerId??service.customer?.id})} — {service.customer?.name || "Tanpa pelanggan"} / {service.name}
      </label>)}
      {!matches.length && <p>Tidak ada layanan yang cocok. Kode circuit dari tiket lama dapat dilengkapi oleh pengelola melalui <a href="/assets">Assets &amp; Services → Penautan CID</a>.</p>}
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
      <p>1. Pilih CID layanan yang terganggu. 2. Pilih gejala yang terlihat. 3. Pilih penyebab; gunakan “Belum diketahui” jika masih investigasi.</p>
      <TicketServicePicker services={services} selectedIds={value.serviceIds || []} onChange={serviceIds=>onChange({serviceIds})} />
      <MasterSelect kind="symptom" value={value.symptomId} snapshot={value.symptomLabel} onChange={(symptomId, symptomLabel) => onChange({ symptomId, symptomLabel })} />
      <MasterSelect kind="cause" value={value.causeId} snapshot={value.causeLabel} onChange={(causeId, causeLabel) => onChange({ causeId, causeLabel })} />
    </div>}
  </fieldset>;
}
