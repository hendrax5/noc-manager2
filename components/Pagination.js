"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function Pagination({ totalCount, pageSize = 10 }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPage = Number(searchParams.get("page")) || 1;
  const totalPages = Math.ceil(totalCount / pageSize);

  if (totalPages <= 1) return null;

  const createPageURL = (pageNumber) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
        Showing <strong>{((currentPage - 1) * pageSize) + 1}</strong> to <strong>{Math.min(currentPage * pageSize, totalCount)}</strong> of <strong>{totalCount}</strong> entries
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Link 
          href={currentPage > 1 ? createPageURL(currentPage - 1) : '#'} 
          style={{ 
            padding: '0.5rem 1rem', 
            background: currentPage > 1 ? 'white' : '#f1f5f9', 
            color: currentPage > 1 ? '#3b82f6' : '#94a3b8', 
            border: '1px solid #cbd5e1', 
            borderRadius: '4px', 
            textDecoration: 'none', 
            pointerEvents: currentPage > 1 ? 'auto' : 'none',
            fontSize: '0.85rem',
            fontWeight: 'bold'
          }}
        >
          &laquo; Prev
        </Link>
        
        <span style={{ padding: '0.5rem 1rem', background: 'white', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold' }}>
          Page {currentPage} of {totalPages}
        </span>
        
        <Link 
          href={currentPage < totalPages ? createPageURL(currentPage + 1) : '#'} 
          style={{ 
            padding: '0.5rem 1rem', 
            background: currentPage < totalPages ? 'white' : '#f1f5f9', 
            color: currentPage < totalPages ? '#3b82f6' : '#94a3b8', 
            border: '1px solid #cbd5e1', 
            borderRadius: '4px', 
            textDecoration: 'none', 
            pointerEvents: currentPage < totalPages ? 'auto' : 'none',
            fontSize: '0.85rem',
            fontWeight: 'bold'
          }}
        >
          Next &raquo;
        </Link>
      </div>
    </div>
  );
}
