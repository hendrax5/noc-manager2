"use client";
import React, { useState, useEffect, useRef } from "react";

export default function SearchableSelect({ options = [], value, onChange, placeholder, disabled, required }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const safeOptions = (options || []).map(o => 
    typeof o === 'object' && o !== null ? o : { value: o, label: o }
  );

  // Sync search input or display value when selection changes
  const selectedOption = safeOptions.find(o => {
    if (value === undefined || value === null || value === '') {
      return o.value === undefined || o.value === null || o.value === '';
    }
    return String(o.value) === String(value);
  });

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm(selectedOption ? selectedOption.label : "");
    }
  }, [value, isOpen, selectedOption]);

  // Handle clicking outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = safeOptions.filter(o => 
    String(o.label || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  const handleSelectOption = (opt) => {
    onChange(opt.value);
    setSearchTerm(opt.label);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
    setSearchTerm("");
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
        <input 
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => {
            setIsOpen(true);
            setSearchTerm("");
          }}
          disabled={disabled}
          placeholder={placeholder}
          required={required && !value}
          style={{ 
            width: '100%', 
            padding: '0.75rem 2rem 0.75rem 0.75rem', 
            border: '1px solid var(--border-color, #cbd5e1)', 
            borderRadius: '4px', 
            background: disabled ? 'var(--hover-bg, #f1f5f9)' : 'var(--input-bg, white)', 
            color: 'var(--input-text, #0f172a)',
            outline: 'none',
            fontSize: '0.95rem'
          }}
        />
        {value && !disabled && (
          <button 
            type="button" 
            onClick={handleClear}
            style={{ 
              position: 'absolute', 
              right: '0.75rem', 
              background: 'none', 
              border: 'none', 
              color: '#94a3b8', 
              cursor: 'pointer',
              fontSize: '1rem',
              padding: 0
            }}
          >
            ✕
          </button>
        )}
      </div>
      
      {isOpen && !disabled && (
        <div style={{ 
          position: 'absolute', 
          top: '100%', 
          left: 0, 
          right: 0, 
          marginTop: '4px', 
          background: 'var(--card-bg, white)', 
          border: '1px solid var(--border-color, #cbd5e1)', 
          borderRadius: '4px', 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
          zIndex: 99, 
          maxHeight: '200px', 
          overflowY: 'auto' 
        }}>
          {filteredOptions.length > 0 ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {filteredOptions.map((opt, i) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <li 
                    key={opt.value || i} 
                    onClick={() => handleSelectOption(opt)}
                    style={{ 
                      padding: '0.75rem', 
                      cursor: 'pointer', 
                      borderBottom: '1px solid var(--border-color, #f1f5f9)', 
                      fontSize: '0.9rem', 
                      color: isSelected ? 'var(--primary-color, #2563eb)' : 'var(--text-color, #334155)',
                      fontWeight: isSelected ? 'bold' : 'normal',
                      background: isSelected ? 'var(--hover-bg, #f1f5f9)' : 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--hover-bg, #f1f5f9)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {opt.label}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div style={{ padding: '0.75rem', color: '#64748b', fontSize: '0.9rem', textAlign: 'center' }}>No results found</div>
          )}
        </div>
      )}
    </div>
  );
}
