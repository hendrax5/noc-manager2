"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TicketQuickActions({ ticketId, isUnassigned }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleTake = async () => {
    setLoading(true);
    await fetch(`/api/tickets/${ticketId}/take`, { method: "POST" });
    router.refresh();
    setLoading(false);
  };

  if (!isUnassigned) return null;

  return (
    <button 
      onClick={handleTake} 
      disabled={loading}
      style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '0.5rem' }}>
      {loading ? '...' : 'Take It'}
    </button>
  );
}
