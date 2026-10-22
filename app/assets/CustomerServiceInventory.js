'use client';
import { useState } from 'react';
import Link from 'next/link';
import { getServiceCid } from '@/lib/services/cid';
import { readServiceBandwidthMbps } from '@/lib/services/capacity';
import styles from './customer-services.module.css';

export default function CustomerServiceInventory({ customers = [], services = [], canManage = false }) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState({});
  const groups = new Map(customers.map(customer => [customer.id, { customer, services: [] }]));
  for (const service of services) {
    const id = service.customerId ?? service.customer?.id;
    if (!groups.has(id)) groups.set(id, { customer: service.customer || { name: 'Customer belum tersedia' }, services: [] });
    groups.get(id).services.push(service);
  }
  const search = query.trim().toLowerCase();
  const matches = [...groups.entries()].map(([id, group]) => ({
    id, ...group,
    visible: group.customer.name.toLowerCase().includes(search) ? group.services : group.services.filter(service => `${getServiceCid(service)} ${service.name} ${service.template?.name || ''}`.toLowerCase().includes(search)),
  })).filter(group => !search || group.customer.name.toLowerCase().includes(search) || group.visible.length)
    .sort((a, b) => a.customer.name.localeCompare(b.customer.name));
  return <section className={styles.inventory} aria-label="Layanan per customer">
    <label htmlFor="inventory-search">Cari customer, CID, layanan, atau tipe layanan</label>
    <input id="inventory-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Contoh: nama customer atau SAP-C-1243-0003" />
    <p>{matches.length} customer · {services.length} layanan terdaftar. Buka customer untuk melihat seluruh layanannya.</p>
    {matches.map(group => <div key={group.id ?? 'missing'} className={styles.group}>
      <button className={styles.customer} type="button" aria-expanded={!!search || !!expanded[group.id]} aria-controls={`customer-services-${group.id}`} onClick={() => setExpanded(previous => ({ ...previous, [group.id]: !previous[group.id] }))}>
        <span>{search || expanded[group.id] ? '−' : '+'} {group.customer.name}</span>
        <span>{group.services.length} layanan</span>
      </button>
      {(search || expanded[group.id]) && <div id={`customer-services-${group.id}`} className={styles.scroll}>
        {group.visible.length ? <table aria-label={`Layanan ${group.customer.name}`}>
          <thead><tr>{['CID', 'Service Component / Site', 'Tipe layanan', 'Kapasitas', 'Status', 'Tiket', 'Aksi'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{group.visible.map(service => <tr key={service.id}>
            <td>{getServiceCid(service) || <span className={styles.missing}>CID belum tertaut</span>}</td>
            <th scope="row"><Link href={`/assets/${service.id}`}>{service.name}</Link></th>
            <td>{service.template?.name || 'Belum ditentukan'}</td>
            <td>{readServiceBandwidthMbps(service) === null ? '—' : `${readServiceBandwidthMbps(service)} Mbps`}</td>
            <td>{service.status}</td><td>{service._count?.tickets || 0}</td>
            <td><Link href={`/assets/${service.id}`}>Detail & riwayat</Link>{!getServiceCid(service) && canManage && <><br /><Link href="/assets#sap-circuits">Tautkan CID SAP</Link></>}</td>
          </tr>)}</tbody>
        </table> : <p className={styles.empty}>Belum ada layanan terdaftar untuk customer ini.</p>}
      </div>}
    </div>)}
    {!matches.length && <p>Tidak ada customer atau layanan yang cocok.</p>}
  </section>;
}
