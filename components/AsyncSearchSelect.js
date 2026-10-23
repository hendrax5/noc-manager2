"use client";
import React, { useState, useEffect, useRef } from "react";

export default function AsyncSearchSelect({ value, onChange, placeholder, apiRoute, disabled }) {
  const [searchTerm, setSearchTerm] = useState(value || "");
  const [options, setOptions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const debounceTimer = useRef(null);

  // Sync internal state if value provided externally changes
  useEffect(() => {
    if (value && value !== searchTerm && !isOpen) {
      setSearchTerm(value);
    }
  }, [value, isOpen]);

  // Handle clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchOptions = async (query) => {
    if (!query || query.length < 3) {
      setOptions([]);
      setIsOpen(false);
      return;
    }
    
    setLoading(true);
    setIsOpen(true);
    try {
      const res = await fetch(`${apiRoute}?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setOptions(data);
      }
    } catch (e) {
      console.error("AsyncSearchSelect fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    onChange(val); // Send raw typed text to parent so they can just save it if they want to override

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    
    debounceTimer.current = setTimeout(() => {
      fetchOptions(val);
    }, 500); // 500ms debounce
  };

  const handleSelectOption = (opt) => {
    setSearchTerm(opt.value);
    onChange(opt.value);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input 
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={() => { if(searchTerm.length >= 3) fetchOptions(searchTerm); }}
        disabled={disabled}
        placeholder={placeholder}
        className="ui-static-5b3a2ff5f2" style={{width: '100%'}}
      />
      
      {isOpen && (searchTerm.length >= 3) && (
        <div className="ui-static-4c5f93b5d3" style={{position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, maxHeight: '200px', overflowY: 'auto'}}>
          {loading ? (
            <div className="ui-static-abaa5b1f0b" style={{textAlign: 'center'}}>Searching...</div>
          ) : options.length > 0 ? (
            <ul className="ui-static-0d59a3d063" style={{listStyle: 'none'}}>
              {options.map((opt, i) => (
                <li 
                  key={i} 
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectOption(opt);
                  }}
                  className="ui-static-d58296cc67" style={{cursor: 'pointer'}}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {opt.label}
                </li>
              ))}
            </ul>
          ) : (
            <div className="ui-static-abaa5b1f0b" style={{textAlign: 'center'}}>No exact matches found.</div>
          )}
        </div>
      )}
    </div>
  );
}
