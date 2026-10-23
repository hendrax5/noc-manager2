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
    <div className="ui-static-4d8d135adf" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'}}>
      <div className="ui-static-92254f43e7" style={{display: 'flex', alignItems: 'center'}}>
        <div className="ui-static-dd90b11840" >
          Showing <strong>{totalCount === 0 ? 0 : ((currentPage - 1) * pageSize) + 1}</strong> to <strong>{Math.min(currentPage * pageSize, totalCount)}</strong> of <strong>{totalCount}</strong> entries
        </div>
        <div className="ui-static-596ee12917" style={{display: 'flex', alignItems: 'center'}}>
          <span className="ui-static-c326169b80" >Rows per page:</span>
          <select 
            value={pageSize}
            onChange={handleLimitChange}
            className="ui-static-af99833d35" style={{cursor: 'pointer'}}
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
        <div className="ui-static-30f523173e" style={{display: 'flex'}}>
          <Link 
            href={currentPage > 1 ? createPageURL(currentPage - 1) : '#'} 
            className="ui-static-b9b9634cb1" style={{background: currentPage > 1 ? "var(--ui-surface)" : "var(--ui-surface)", color: currentPage > 1 ? "var(--ui-info)" : "var(--ui-info)", textDecoration: 'none', pointerEvents: currentPage > 1 ? 'auto' : 'none'}}
          >
            &laquo; Prev
          </Link>
          
          <span className="ui-static-d778a87bc3" >
            Page {currentPage} of {totalPages}
          </span>
          
          <Link 
            href={currentPage < totalPages ? createPageURL(currentPage + 1) : '#'} 
            className="ui-static-b9b9634cb1" style={{background: currentPage < totalPages ? "var(--ui-surface)" : "var(--ui-surface)", color: currentPage < totalPages ? "var(--ui-info)" : "var(--ui-info)", textDecoration: 'none', pointerEvents: currentPage < totalPages ? 'auto' : 'none'}}
          >
            Next &raquo;
          </Link>
        </div>
      )}
    </div>
  );
}
