'use client';
import {formatCustomerId} from '@/lib/customers/identity';
import styles from './customer-services.module.css';

export default function CustomerInventoryRow({customer,serviceCount,totalServiceCount,pendingCount,expanded,onToggle,children}) {
  const panelId=`customer-services-${customer.id}`;
  return <article className={styles.group}>
    <button type="button" className={styles.customer} aria-expanded={expanded} aria-controls={panelId} onClick={onToggle}>
      <span className={styles.customerName}><span aria-hidden="true">{expanded?'−':'+'}</span> {customer.name}<small>{formatCustomerId(customer)}</small></span>
      <span>{serviceCount===totalServiceCount?`${serviceCount} layanan`:`${serviceCount} dari ${totalServiceCount} layanan`}</span>
      {pendingCount>0&&<span className={styles.pendingCount}>{pendingCount} Pending</span>}
    </button>
    <div id={panelId} hidden={!expanded} className={styles.detail}>{expanded&&children}</div>
  </article>;
}
