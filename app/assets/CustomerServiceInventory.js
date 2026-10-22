'use client';
import { formatCustomerId } from '@/lib/customers/identity';
import { useState } from 'react';
import Link from 'next/link';
import { getServiceCid, getServiceSearchText } from '@/lib/services/cid';
import { readServiceBandwidthMbps } from '@/lib/services/capacity';
import styles from './customer-services.module.css';
import ui from './assets-ui.module.css';

export default function CustomerServiceInventory({ customers = [], services = [], canManage = false }) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState({});
  const [page,setPage]=useState(1);
  const pageSize=25;
  const groups = new Map(customers.map(customer => [customer.id, { customer, services: [] }]));
  for (const service of services) {
    const id = service.customerId ?? service.customer?.id;
    if (!groups.has(id)) groups.set(id, { customer: service.customer || { name: 'Customer belum tersedia' }, services: [] });
    groups.get(id).services.push(service);
  }
  const search = query.trim().toLowerCase();
  const matchesCustomer=customer=>`${customer.name} ${formatCustomerId(customer)}`.toLowerCase().includes(search);
  const matches = [...groups.entries()].map(([id, group]) => ({
    id, ...group,
    visible: matchesCustomer(group.customer) ? group.services : group.services.filter(service => getServiceSearchText(service).toLowerCase().includes(search)),
  })).filter(group => !search || matchesCustomer(group.customer) || group.visible.length)
    .sort((a, b) => a.customer.name.localeCompare(b.customer.name));
  return <section className={styles.inventory} aria-label="Layanan per customer">
    <label htmlFor="inventory-search">Cari customer, CID, layanan, atau tipe layanan</label>
    <input id="inventory-search" type="search" value={query} onChange={event => {setQuery(event.target.value);setPage(1);}} placeholder="Contoh: nama customer atau SAP-C-1243-0003" />
    <p>{matches.length} customer · {services.length} layanan terdaftar. Buka customer untuk melihat seluruh layanannya.</p>
    {matches.slice((page-1)*pageSize,page*pageSize).map(group => <div key={group.id ?? 'missing'} className={styles.group}>
      <button className={styles.customer} type="button" aria-expanded={!!search || !!expanded[group.id]} aria-controls={`customer-services-${group.id}`} onClick={() => setExpanded(previous => ({ ...previous, [group.id]: !previous[group.id] }))}>
        <span>{search || expanded[group.id] ? '−' : '+'} {group.customer.name}<small style={{display:"block",fontWeight:400,marginTop:".35rem"}}>{formatCustomerId(group.customer)}</small></span>
        <span>{group.services.length} layanan</span>
      </button>
      {(search || expanded[group.id]) && <div id={`customer-services-${group.id}`} className={styles.scroll}>
        {group.visible.length ? <table aria-label={`Layanan ${group.customer.name}`}>
          <thead><tr>{['CID', 'Service Component / Site', 'Tipe layanan', 'Kapasitas', 'Status', 'Tiket', 'Aksi'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{group.visible.map(service => <tr key={service.id}>
            <td>{getServiceCid(service) || <span className={styles.missing}>CID belum tertaut</span>}{(service.identifiers||[]).filter(item=>item.code!==getServiceCid(service)).map(item=><small key={item.code} style={{display:"block"}}>Kode lama: {item.code}</small>)}</td>
            <th scope="row"><Link href={`/assets/${service.id}`}>{service.name}</Link></th>
            <td>{service.template?.name || 'Belum ditentukan'}</td>
            <td>{readServiceBandwidthMbps(service) === null ? '—' : `${readServiceBandwidthMbps(service)} Mbps`}</td>
            <td><span className={`${ui.badge} ${service.status === 'Active' ? ui.active : service.status === 'Pending' ? ui.pending : ''}`}>{service.status === 'Active' ? 'Aktif' : service.status === 'Pending' ? 'Pending · perlu diperiksa' : service.status}</span></td><td>{service._count?.tickets || 0}</td>
            <td><Link href={`/assets/${service.id}`}>Detail & riwayat</Link><br />{getServiceCid(service)&&<Link href={`/tickets/new?workType=Trouble&serviceId=${service.id}`}>Buat Trouble</Link>}{!getServiceCid(service) && canManage && <><br /><Link href="/assets#sap-circuits">Tautkan CID</Link></>}</td>
          </tr>)}</tbody>
        </table> : <p className={styles.empty}>Belum ada layanan terdaftar untuk customer ini.</p>}
      </div>}
    </div>)}
    {matches.length>pageSize&&<nav className={styles.pagination} aria-label="Halaman customer"><button type="button" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Sebelumnya</button><span>Halaman {page} dari {Math.ceil(matches.length/pageSize)}</span><button type="button" disabled={page*pageSize>=matches.length} onClick={()=>setPage(p=>p+1)}>Berikutnya</button></nav>}
    {!matches.length && <p>Tidak ada customer atau layanan yang cocok.</p>}
  </section>;
}
