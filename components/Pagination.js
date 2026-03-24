"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

export default function Pagination({ totalCount, pageSize = 10 }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const currentPage = Number(searchParams.get("page")) || 1;
  const totalPages = Math.ceil(totalCount / pageSize);

  const createPageURL = (pageNumber) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  const handleLimitChange = (e) => {
    const newLimit = e.target.value;
    const params = new URLSearchParams(searchParams);
    params.set("limit", newLimit);
    params.set("page", "1"); // Reset to page 1
    router.push(`${pathname}?${params.toString()}`);
  };

  if (totalCount === 0) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Showing <strong>{totalCount === 0 ? 0 : ((currentPage - 1) * pageSize) + 1}</strong> to <strong>{Math.min(currentPage * pageSize, totalCount)}</strong> of <strong>{totalCount}</strong> entries
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderLeft: '1px solid #cbd5e1', paddingLeft: '1.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 'bold' }}>Rows per page:</span>
          <select 
            value={pageSize}
            onChange={handleLimitChange}
            style={{ padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid #94a3b8', fontSize: '0.85rem', background: 'white', color: '#0f172a', fontWeight: 'bold', cursor: 'pointer' }}
          >
            <option value="6">6</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>

      {totalPages > 1 && (
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
      )}
    </div>
  );
}
