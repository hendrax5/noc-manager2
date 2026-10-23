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
          className="ui-static-992dbde99b" style={{width: '100%', background: disabled ? 'var(--hover-bg, #f1f5f9)' : 'var(--input-bg, white)', outline: 'none'}}
        />
        {value && !disabled && (
          <button 
            type="button" 
            onClick={handleClear}
            className="ui-static-4037a8dc46" style={{position: 'absolute', right: '0.75rem', cursor: 'pointer'}}
          >
            ✕
          </button>
        )}
      </div>
      
      {isOpen && !disabled && (
        <div className="ui-static-4a72d3d804" style={{position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, maxHeight: '200px', overflowY: 'auto'}}>
          {filteredOptions.length > 0 ? (
            <ul className="ui-static-0d59a3d063" style={{listStyle: 'none'}}>
              {filteredOptions.map((opt, i) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <li 
                    key={opt.value || i} 
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectOption(opt);
                    }}
                    className="ui-static-6b40bc7f96" style={{cursor: 'pointer', color: isSelected ? 'var(--primary-color, #2563eb)' : 'var(--text-color, #334155)', fontWeight: isSelected ? 'bold' : 'normal', background: isSelected ? 'var(--hover-bg, #f1f5f9)' : 'transparent'}}
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
            <div className="ui-static-abaa5b1f0b" style={{textAlign: 'center'}}>No results found</div>
          )}
        </div>
      )}
    </div>
  );
}
