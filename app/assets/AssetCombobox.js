'use client';
import { useEffect, useId, useRef, useState } from 'react';
import styles from './assets-ui.module.css';

/** Controlled value is always an option ID; typed text is never submitted as an ID. */
export default function AssetCombobox({label,options=[],value,onChange,placeholder='Cari atau pilih',disabled=false,required=false}) {
  const id=useId(),input=useRef(null);
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0);
  const selected=options.find(option=>String(option.value)===String(value));
  const matches=options.filter(option=>option.label.toLowerCase().includes(query.toLowerCase()));
  const visible=matches.slice(0,80),index=Math.min(active,visible.length-1);
  useEffect(()=>{if(open)document.getElementById(`${id}-option-${index}`)?.scrollIntoView({block:'nearest'});},[open,index,id]);
  function choose(option){onChange(option.value);setOpen(false);input.current?.focus();}
  function keyDown(event){
    if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);return;}
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();if(!open){setQuery('');setOpen(true);setActive(0);return;}
      setActive(previous=>event.key==='Home'?0:event.key==='End'?visible.length-1:Math.max(0,Math.min(visible.length-1,previous+(event.key==='ArrowDown'?1:-1))));
    }
    if(event.key==='Enter'&&open){event.preventDefault();if(visible[index])choose(visible[index]);}
  }
  return <div className={styles.combo} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
    <label htmlFor={id}>{label}</label>
    <input ref={input} id={id} role="combobox" aria-expanded={open&&!disabled} aria-controls={`${id}-options`} aria-autocomplete="list" aria-activedescendant={open&&visible[index]?`${id}-option-${index}`:undefined} autoComplete="off" required={required} disabled={disabled} placeholder={placeholder} value={open?query:selected?.label||''} onFocus={()=>{setQuery('');setOpen(true);setActive(0);}} onChange={event=>{setQuery(event.target.value);setOpen(true);setActive(0);if(value!==''&&value!=null)onChange('');}} onKeyDown={keyDown}/>
    {open&&!disabled&&<><ul id={`${id}-options`} role="listbox" aria-label={`${label} pilihan`} className={styles.options}>
      {visible.map((option,i)=><li id={`${id}-option-${i}`} key={option.value} role="option" aria-selected={i===index} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(option)}>{option.label}</li>)}
      {!visible.length&&<li role="option" aria-disabled="true">Tidak ada pilihan yang cocok.</li>}
    </ul>{matches.length>80&&<small>Menampilkan 80 hasil. Ketik untuk mempersempit pencarian.</small>}</>}
  </div>;
}
