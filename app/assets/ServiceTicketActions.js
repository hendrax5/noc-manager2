'use client';
import {useRef} from 'react';
import Link from 'next/link';
import {getServiceCid} from '@/lib/services/cid';
import styles from './customer-services.module.css';

export default function ServiceTicketActions({service,canManage}) {
  const disclosure=useRef(null);
  function escape(event){
    if(event.key==='Escape'&&disclosure.current?.open){event.preventDefault();event.stopPropagation();disclosure.current.open=false;disclosure.current.querySelector('summary').focus();}
  }
  return <span className={styles.actions}>
    <Link href={`/assets/${service.id}`}>Detail & riwayat</Link>
    {getServiceCid(service)?<details ref={disclosure} className={styles.ticketActions} onKeyDown={escape}>
      <summary>Buat tiket</summary>
      <div><Link href={`/tickets/new?workType=Trouble&serviceId=${service.id}`}>Trouble</Link><Link href={`/tickets/new?workType=ServiceWork&serviceId=${service.id}`}>Pekerjaan layanan</Link></div>
    </details>:canManage&&<Link href="/assets#sap-circuits">Tautkan CID</Link>}
  </span>;
}
