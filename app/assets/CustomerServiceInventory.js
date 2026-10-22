'use client';
import {useState} from 'react';
import Link from 'next/link';
import {selectServiceInventory} from '@/lib/customers/serviceInventoryView';
import {getServiceCid} from '@/lib/services/cid';
import {readServiceBandwidthMbps} from '@/lib/services/capacity';
import AssetCombobox from './AssetCombobox';
import CustomerInventoryRow from './CustomerInventoryRow';
import styles from './customer-services.module.css';
import ui from './assets-ui.module.css';

export default function CustomerServiceInventory({customers=[],services=[],canManage=false}) {
  const [filters,setFilters]=useState({query:'',templateId:'',status:''});
  const [page,setPage]=useState(1),[expandedCustomerId,setExpandedCustomerId]=useState(null);
  const view=selectServiceInventory({customers,services,...filters,page});
  if(page!==view.page)setPage(view.page);
  if(expandedCustomerId!==null&&!view.groups.some(g=>g.customer.id===expandedCustomerId))setExpandedCustomerId(null);
  const products=[...new Map(services.filter(s=>s.templateId??s.template?.id).map(s=>[String(s.templateId??s.template.id),{value:String(s.templateId??s.template.id),label:s.template?.name||'Produk '+s.templateId}])).values()].sort((a,b)=>a.label.localeCompare(b.label));
  function updateFilters(patch){const next={...filters,...patch};const result=selectServiceInventory({customers,services,...next});setFilters(next);setPage(1);setExpandedCustomerId(result.customerCount===1?result.groups[0].customer.id:null);}
  function reset(){setFilters({query:'',templateId:'',status:''});setPage(1);setExpandedCustomerId(null);}
  return <section className={styles.inventory} aria-label="Layanan per customer">
    <div className={styles.toolbar}>
      <label htmlFor="inventory-search">Cari customer, Customer ID, atau CID<input id="inventory-search" type="search" value={filters.query} onChange={e=>updateFilters({query:e.target.value})} placeholder="Nama customer atau kode circuit"/></label>
      <AssetCombobox label="Tipe layanan" value={filters.templateId} options={[{value:'',label:'Semua tipe'},...products]} onChange={value=>updateFilters({templateId:value})}/>
      <AssetCombobox label="Status layanan" value={filters.status} options={[{value:'',label:'Semua status'},{value:'Active',label:'Aktif'},{value:'Pending',label:'Pending'},{value:'Suspended',label:'Ditangguhkan'},{value:'Terminated',label:'Terminasi'}]} onChange={value=>updateFilters({status:value})}/>
      <button type="button" onClick={reset}>Reset filter</button>
    </div>
    <p role="status" className={styles.summary}>{view.customerCount} customer · {view.serviceCount} layanan</p>
    <div className={styles.customerList}>{view.groups.map(group=><CustomerInventoryRow key={group.customer.id} customer={group.customer} serviceCount={group.services.length} totalServiceCount={group.totalServiceCount} pendingCount={group.pendingCount} expanded={expandedCustomerId===group.customer.id} onToggle={()=>setExpandedCustomerId(expandedCustomerId===group.customer.id?null:group.customer.id)}>
{group.services.length ? <table aria-label={`Layanan ${group.customer.name}`}>
          <thead><tr>{['CID', 'Service Component / Site', 'Tipe layanan', 'Kapasitas', 'Status', 'Tiket', 'Aksi'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{group.services.map(service => <tr key={service.id}>
            <td>{getServiceCid(service) || <span className={styles.missing}>CID belum tertaut</span>}{(service.identifiers||[]).filter(item=>item.code!==getServiceCid(service)).map(item=><small key={item.code} style={{display:"block"}}>Kode lama: {item.code}</small>)}</td>
            <th scope="row"><Link href={`/assets/${service.id}`}>{service.name}</Link></th>
            <td>{service.template?.name || 'Belum ditentukan'}</td>
            <td>{readServiceBandwidthMbps(service) === null ? '—' : `${readServiceBandwidthMbps(service)} Mbps`}</td>
            <td><span className={`${ui.badge} ${service.status === 'Active' ? ui.active : service.status === 'Pending' ? ui.pending : ''}`}>{service.status === 'Active' ? 'Aktif' : service.status === 'Pending' ? 'Pending · perlu diperiksa' : service.status}</span></td><td>{service._count?.tickets || 0}</td>
            <td><Link href={`/assets/${service.id}`}>Detail & riwayat</Link><br />{getServiceCid(service)&&<Link href={`/tickets/new?workType=Trouble&serviceId=${service.id}`}>Buat Trouble</Link>}{!getServiceCid(service) && canManage && <><br /><Link href="/assets#sap-circuits">Tautkan CID</Link></>}</td>
          </tr>)}</tbody>
        </table> : <p className={styles.empty}>Belum ada layanan terdaftar untuk customer ini.</p>}
      
    </CustomerInventoryRow>)}</div>
    {!view.customerCount&&<div className={styles.empty}><p>Tidak ada customer atau layanan yang cocok.</p><button type="button" onClick={reset}>Reset filter</button></div>}
    {view.pageCount>1&&<nav className={styles.pagination} aria-label="Halaman customer"><span>Menampilkan {(view.page-1)*25+1}–{Math.min(view.page*25,view.customerCount)} dari {view.customerCount} customer</span><div><button type="button" disabled={view.page<=1} onClick={()=>{setPage(view.page-1);setExpandedCustomerId(null);}}>Sebelumnya</button><span> {view.page}/{view.pageCount} </span><button type="button" disabled={view.page>=view.pageCount} onClick={()=>{setPage(view.page+1);setExpandedCustomerId(null);}}>Berikutnya</button></div></nav>}
  </section>;
}