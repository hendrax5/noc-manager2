'use client';

import { useEffect, useId, useRef, useState } from 'react';
import styles from './master-picker.module.css';

/**
 * Select-only combobox (WAI-ARIA APG): button trigger + listbox popup.
 * Replaces native <select> in master-data and ticket forms so options share the
 * house spacing and dark mode, with arrow/Home/End navigation and typeahead.
 *
 * options: [{ value, label, disabled? }]
 */
export default function MasterPicker({ id, value, options = [], onChange, placeholder = 'Pilih…', disabled = false, describedBy, invalid = false, emptyLabel = 'Tidak ada pilihan' }) {
  const listboxId = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [placement, setPlacement] = useState('bottom');
  const typed = useRef({ text: '', timer: null });

  const selectedIndex = options.findIndex(option => String(option.value) === String(value));
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const firstEnabled = options.findIndex(option => !option.disabled);
  const lastEnabled = options.reduce((last, option, index) => option.disabled ? last : index, -1);
  const optionId = index => `${listboxId}-option-${index}`;

  useEffect(() => {
    if (!open) return undefined;
    const close = event => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (!open || highlight < 0) return;
    document.getElementById(optionId(highlight))?.scrollIntoView({ block: 'nearest' });
  }, [open, highlight]);

  useEffect(() => () => clearTimeout(typed.current.timer), []);

  const enabledFrom = (index, delta) => {
    let next = index;
    for (let step = 0; step < options.length; step += 1) {
      next = (next + delta + options.length) % options.length;
      if (!options[next].disabled) return next;
    }
    return -1;
  };

  function openList(delta = 0) {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    const spaceBelow = rect ? window.innerHeight - rect.bottom : 0;
    setPlacement(spaceBelow < 260 && (rect?.top ?? 0) > 260 ? 'top' : 'bottom');
    const base = selectedIndex >= 0 && !options[selectedIndex]?.disabled ? selectedIndex : firstEnabled;
    setOpen(true);
    setHighlight(delta === 0 ? base : enabledFrom(base, delta));
  }

  function select(option) {
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function move(delta) {
    if (!options.length) return;
    const next = highlight < 0 ? (delta > 0 ? firstEnabled : lastEnabled) : enabledFrom(highlight, delta);
    if (next >= 0) setHighlight(next);
  }

  function jump(index) {
    if (index >= 0) setHighlight(index);
  }

  function typeahead(character) {
    clearTimeout(typed.current.timer);
    typed.current.text += character.toLowerCase();
    typed.current.timer = setTimeout(() => { typed.current.text = ''; }, 600);
    const term = typed.current.text;
    const start = Math.max(highlight, 0);
    for (let step = 0; step < options.length; step += 1) {
      const index = (start + step) % options.length;
      const option = options[index];
      if (!option.disabled && String(option.label).toLowerCase().startsWith(term)) { setHighlight(index); return; }
    }
  }

  function onKeyDown(event) {
    if (disabled) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) openList(1); else move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!open) openList(-1); else move(-1);
        break;
      case 'Home':
        if (!open) return;
        event.preventDefault(); jump(firstEnabled);
        break;
      case 'End':
        if (!open) return;
        event.preventDefault(); jump(lastEnabled);
        break;
      case 'Enter':
        event.preventDefault();
        if (open) select(options[highlight]); else openList();
        break;      case ' ':
        if (!open) { event.preventDefault(); openList(); } else { event.preventDefault(); select(options[highlight]); }
        break;
      case 'Escape':
        if (!open) return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        if (!open) return;
        if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          typeahead(event.key);
        }
    }
  }

  return <div ref={rootRef} className={styles.picker} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={triggerRef} id={id} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open}
      aria-controls={listboxId} aria-activedescendant={open && highlight >= 0 ? optionId(highlight) : undefined}
      aria-describedby={describedBy} aria-invalid={invalid ? 'true' : undefined}
      className={styles.trigger} disabled={disabled} onClick={() => (open ? setOpen(false) : openList())} onKeyDown={onKeyDown}>
      <span className={selected ? styles.value : styles.placeholder}>{selected ? selected.label : placeholder}</span>
      <svg className={styles.chevron} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>
    </button>
    {open && <ul id={listboxId} role="listbox" className={styles.listbox} data-placement={placement} aria-label="Pilihan">
      {options.map((option, index) => <li key={String(option.value)} id={optionId(index)} role="option"
        aria-selected={index === selectedIndex} aria-disabled={option.disabled ? 'true' : undefined}
        className={styles.option} data-highlight={index === highlight ? 'true' : undefined}
        onMouseDown={event => event.preventDefault()}
        onMouseMove={() => { if (!option.disabled && index !== highlight) setHighlight(index); }}
        onClick={() => select(option)}>
        <span className={styles.optionLabel}>{option.label}</span>
        {index === selectedIndex && <svg className={styles.check} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3.5 8.5 3 3 6-7" /></svg>}
      </li>)}
      {!options.length && <li className={styles.empty} role="presentation">{emptyLabel}</li>}
    </ul>}
  </div>;
}
