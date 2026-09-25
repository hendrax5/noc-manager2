"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function TicketQuickActions({ ticketId, isUnassigned }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleTake = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/take`, { method: "POST" });
      if (res.ok) {
        toast.success("Ticket taken");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to take ticket");
      }
    } catch {
      toast.error("Failed to take ticket");
    } finally {
      setLoading(false);
    }
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
