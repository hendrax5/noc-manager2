"use client";

import { useState } from "react";
import Link from "next/link";
import TicketQuickActions from "./TicketQuickActions";
import * as xlsx from "xlsx";

function timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return "just now";
}

export default function TicketTableClient({ tickets = [], resolvedParams = {}, sortParam = "", canViewAll = false }) {
  const [selectedIds, setSelectedIds] = useState([]);

  const isAllSelected = tickets.length > 0 && selectedIds.length === tickets.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < tickets.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(tickets.map(t => t.id));
    }
  };

  const handleSelectRow = (e, id) => {
    // If the click is not exactly on the checkbox input but on a cell, clicking toggles
    // Wait, let's keep it simple: users just click the checkbox.
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const exportSelectedToExcel = () => {
    const selectedTickets = tickets.filter(t => selectedIds.includes(t.id));
    if (selectedTickets.length === 0) return;

    // Formatting data for Excel
    const dataToExport = selectedTickets.map(t => {
      let extractedName = "-";
      const reporterMatch = t.description?.match(/\[Original Reporter: (.*?) -/);
      if (reporterMatch) {
         extractedName = reporterMatch[1];
      } else if (t.services && t.services.length > 0 && t.services[0].customer) {
         extractedName = t.services[0].customer.name;
      } else if (t.customData && typeof t.customData === 'object' && t.customData["Customer Name"]) {
         extractedName = t.customData["Customer Name"];
      }

      return {
        "Tracking ID": t.trackingId,
        "Customer / Origin": extractedName,
        "Order Origin": t.customData && t.customData["Order Origin"] ? t.customData["Order Origin"] : "",
        "Vendor": t.customData && t.customData["Executing Vendor"] ? t.customData["Executing Vendor"] : "",
        "Subject": t.title,
        "Status": t.status,
        "Priority": t.priority,
        "Department": t.department?.name || "-",
        "Assignee": t.assignee?.name || "-",
        "SLA Breaches": t.slaBreaches,
        "Created At": new Date(t.createdAt).toLocaleString(),
        "Updated At": new Date(t.updatedAt).toLocaleString()
      };
    });

    const worksheet = xlsx.utils.json_to_sheet(dataToExport);
    
    // Auto-size columns crudely
    const colWidths = [
      {wch: 15}, {wch: 25}, {wch: 20}, {wch: 20}, {wch: 35}, {wch: 15}, {wch: 15}, {wch: 20}, {wch: 20}, {wch: 15}, {wch: 20}, {wch: 20}
    ];
    worksheet['!cols'] = colWidths;

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Tickets Recap");

    const todayStr = new Date().toISOString().split('T')[0];
    xlsx.writeFile(workbook, `NOC_Tickets_Recap_${todayStr}.xlsx`);
  };

  return (
    <div style={{ position: 'relative' }}>
      
      {/* Export Action Bar */}
      {selectedIds.length > 0 && (
        <div style={{ position: 'absolute', top: '-45px', right: '0', display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '0.4rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', zIndex: 10 }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#334155' }}>
            {selectedIds.length} tickets selected
          </span>
          <button 
            onClick={exportSelectedToExcel}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#10b981', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
          >
            📊 Export to Excel (.xlsx)
          </button>
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: '40px', textAlign: 'center' }}>
              <input 
                 type="checkbox" 
                 checked={isAllSelected}
                 ref={input => {
                   if (input) input.indeterminate = isSomeSelected;
                 }}
                 onChange={handleSelectAll}
                 style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                 title="Select All"
              />
            </th>
            <th>Tracking ID</th>
            <th style={{ cursor: 'pointer' }}>
              <Link href={`/tickets?${new URLSearchParams({...resolvedParams, page: 1, sort: sortParam === 'name_asc' ? 'name_desc' : 'name_asc'}).toString()}`} style={{textDecoration:'none', color:'inherit', display:'flex', alignItems:'center', gap:'0.2rem'}}>
                Name {sortParam === 'name_asc' ? '▲' : sortParam === 'name_desc' ? '▼' : '↕'}
              </Link>
            </th>
            <th>Subject</th>
            <th>Status</th>
            <th>Priority</th>
            <th style={{ cursor: 'pointer' }}>
              <Link href={`/tickets?${new URLSearchParams({...resolvedParams, page: 1, sort: sortParam === 'age_asc' ? 'age_desc' : 'age_asc'}).toString()}`} style={{textDecoration:'none', color:'inherit', display:'flex', alignItems:'center', gap:'0.2rem'}}>
                Age {sortParam === 'age_asc' ? '▲' : sortParam === 'age_desc' ? '▼' : '↕'}
              </Link>
            </th>
            <th style={{ cursor: 'pointer' }}>
              <Link href={`/tickets?${new URLSearchParams({...resolvedParams, page: 1, sort: sortParam === 'dept_asc' ? 'dept_desc' : 'dept_asc'}).toString()}`} style={{textDecoration:'none', color:'inherit', display:'flex', alignItems:'center', gap:'0.2rem'}}>
                Department {sortParam === 'dept_asc' ? '▲' : sortParam === 'dept_desc' ? '▼' : '↕'}
              </Link>
            </th>
            <th>Assignee</th>
          </tr>
        </thead>
        <tbody>
          {tickets.length === 0 && (
            <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>No tickets found matching your filters.</td></tr>
          )}
          {tickets.map(t => {
            const isCritical = t.priority === 'Critical';
            const hoursIdle = (new Date() - new Date(t.updatedAt)) / 3600000;
            const isSLA = (t.status === 'New' && hoursIdle > 2) || (isCritical && hoursIdle > 1 && t.status !== 'Resolved');
            const hasPings = t.slaBreaches > 0;
            
            let expiryDateStr = null;
            if (t.customData && typeof t.customData === 'object') {
              const expiryVal = Object.values(t.customData).find(val => typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val));
              if (expiryVal) expiryDateStr = expiryVal;
            }

            let rowClass = "";
            if (isSLA) rowClass = "ticket-row-sla";
            else if (t.slaBreaches > 2 && t.status !== 'Resolved') rowClass = "ticket-row-critical";
            else if (hasPings && t.status !== 'Resolved') rowClass = "ticket-row-warning";
            else if (expiryDateStr && t.status !== 'Resolved' && new Date(expiryDateStr) < new Date()) rowClass = "ticket-row-expired";
            
            let extractedName = "-";
            const reporterMatch = t.description?.match(/\[Original Reporter: (.*?) -/);
            if (reporterMatch) {
              extractedName = reporterMatch[1];
            } else if (t.services && t.services.length > 0 && t.services[0].customer) {
              extractedName = t.services[0].customer.name;
            } else if (t.customData && typeof t.customData === 'object' && t.customData["Customer Name"]) {
               extractedName = t.customData["Customer Name"];
            }

            const isSelected = selectedIds.includes(t.id);

            return (
              <tr key={t.id} className={rowClass} style={isSelected ? { background: '#f8fafc', boxShadow: 'inset 4px 0 0 #3b82f6' } : {}}>
                <td style={{ textAlign: 'center' }}>
                    <input 
                       type="checkbox" 
                       checked={isSelected}
                       onChange={(e) => handleSelectRow(e, t.id)}
                       style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                </td>
                <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{t.trackingId}</td>
                <td>
                  <span style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem', display: 'block' }}>{extractedName}</span>
                  {t.customData && t.customData["Order Origin"] && (
                    <span style={{ display: 'inline-block', fontSize: '0.7rem', color: '#991b1b', background: '#fef2f2', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #fecaca', fontWeight: 'bold', marginTop: '0.2rem', marginRight: '0.2rem' }} title="Order Origin">
                      🏢 {t.customData["Order Origin"]}
                    </span>
                  )}
                  {t.customData && t.customData["Executing Vendor"] && (
                    <span style={{ display: 'inline-block', fontSize: '0.7rem', color: '#1e40af', background: '#eff6ff', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #bfdbfe', fontWeight: 'bold', marginTop: '0.2rem' }} title="Executing Vendor">
                      🛠️ {t.customData["Executing Vendor"]}
                    </span>
                  )}
                </td>
                <td style={{ fontWeight: '600' }}>
                  <Link href={`/tickets/${t.id}`} style={{color: 'var(--primary-color)'}}>
                    {t.title}
                  </Link>
                  {t.slaBreaches > 0 && t.status !== 'Resolved' && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: 'var(--danger-text, #b91c1c)', fontWeight: 'bold', background: 'var(--danger-bg, #fee2e2)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      🔥 x{t.slaBreaches} CS Pings!
                    </span>
                  )}
                  {expiryDateStr && t.status !== 'Resolved' && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', background: new Date(expiryDateStr) < new Date() ? 'var(--danger-bg, #ef4444)' : 'var(--warning-bg, #d946ef)', color: new Date(expiryDateStr) < new Date() ? 'var(--danger-text, white)' : 'var(--warning-text, white)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>
                      {new Date(expiryDateStr) < new Date() ? '⚠️ EXPIRED' : `⏳ Exp: ${new Date(expiryDateStr).toLocaleDateString()}`}
                    </span>
                  )}
                </td>
                <td>
                  <span className="badge" style={{ backgroundColor: t.status === 'Resolved' ? '#10b981' : (t.status === 'New' ? '#ef4444' : '#f59e0b') }}>
                    {t.status}
                  </span>
                </td>
                <td style={{ fontWeight: isCritical ? 'bold' : 'normal', color: isCritical ? '#ef4444' : 'inherit' }}>{t.priority}</td>
                <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{timeAgo(t.updatedAt)}</td>
                <td>{t.department?.name}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {t.assignee?.name || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>}
                    {canViewAll && <TicketQuickActions ticketId={t.id} isUnassigned={!t.assigneeId} />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
