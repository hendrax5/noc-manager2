'use client';
import {useState} from 'react';
import styles from './asset-master-list.module.css';

/** Local search and pagination; API writes remain with the existing parent handlers. */
export default function AssetMasterList({title,columns,rows,addLabel,onAdd}) {
  const [query,setQuery]=useState(''),[page,setPage]=useState(1);
  const matches=rows.filter(row=>row.search.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const pageSize=15,pageCount=Math.max(1,Math.ceil(matches.length/pageSize)),current=Math.min(page,pageCount);
  if(page!==current)setPage(current);
  return <section className={styles.list} aria-label={title}>
    <div className={styles.toolbar}><label>Cari {title.toLowerCase()}<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Ketik nama atau kode"/></label>{onAdd&&<button type="button" onClick={onAdd}>{addLabel}</button>}</div>
    <p role="status">{matches.length} hasil</p>
    <div className={styles.scroll}><table aria-label={title}><thead><tr>{columns.map(c=><th scope="col" key={c}>{c}</th>)}</tr></thead><tbody>{matches.slice((current-1)*pageSize,current*pageSize).map(row=><tr key={row.id}>{row.cells.map((cell,i)=><td key={columns[i]} data-label={columns[i]}>{cell}</td>)}</tr>)}</tbody></table></div>
    {!matches.length&&<p>Tidak ada hasil yang cocok.</p>}
    {pageCount>1&&<nav className={styles.pagination} aria-label={`Halaman ${title}`}><span>Halaman {current} dari {pageCount}</span><div><button type="button" disabled={current<=1} onClick={()=>setPage(current-1)}>Sebelumnya</button><button type="button" disabled={current>=pageCount} onClick={()=>setPage(current+1)}>Berikutnya</button></div></nav>}
  </section>;
}
