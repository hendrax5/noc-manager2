'use client';
import {isDarkFiber,readPairCount} from '@/lib/services/productUnits';
import Link from 'next/link';
import {getServiceCid} from '@/lib/services/cid';
import {readServiceBandwidthMbps} from '@/lib/services/capacity';
import styles from './customer-services.module.css';
import ServiceTicketActions from './ServiceTicketActions';
const statusLabels={Active:'Aktif',Pending:'Pending',Suspended:'Ditangguhkan',Terminated:'Terminasi'};

export default function CustomerServiceList({customer,services,canManage}) {
  if(!services.length)return <p className={styles.empty}>Belum ada layanan terdaftar untuk customer ini.</p>;
  const cells=service=>{
    const cid=getServiceCid(service);
    const bandwidth=service.customData?.bandwidthMbps===0||service.customData?.bandwidthMbps==='0'?0:readServiceBandwidthMbps(service);
    return [<span key="cid" className={styles.cid}>{cid||'CID belum tertaut'}{(service.identifiers||[]).filter(i=>i.code!==cid).map(i=><small key={i.code}>Kode lama: {i.code}</small>)}</span>,<Link key="site" href={`/assets/${service.id}`}>{service.name}</Link>,service.company||'Belum dipetakan',service.template?.name||'Belum ditentukan',isDarkFiber(service.template)?(readPairCount(service)===null?'Belum diisi':readPairCount(service)+' pair'):bandwidth===null?'Belum diisi':Number(bandwidth/1000).toLocaleString('id-ID',{maximumFractionDigits:9})+' Gbps',<span key="status" className={`${styles.status} ${service.status==='Pending'?styles.pending:service.status==='Active'?styles.active:''}`}>{statusLabels[service.status]||service.status||'Belum ditentukan'}</span>,service._count?.tickets||0,<ServiceTicketActions key="actions" service={service} canManage={canManage}/>];
  };
  const labels=['CID','Site','Perusahaan','Tipe layanan','Kapasitas','Status layanan','Tiket','Aksi'];
  return <>
    <div className={styles.desktopServices}><table aria-label={`Layanan ${customer.name}`}><thead><tr>{labels.map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{services.map(service=><tr key={service.id}>{cells(service).map((cell,i)=><td key={labels[i]}>{cell}</td>)}</tr>)}</tbody></table></div>
    <ul className={styles.mobileServices} aria-label={`Layanan ${customer.name}`}>{services.map(service=><li key={service.id}><dl>{cells(service).map((cell,i)=><div key={labels[i]}><dt>{labels[i]}</dt><dd>{cell}</dd></div>)}</dl></li>)}</ul>
  </>;
}
