"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import styles from "./ticket-list.module.css";

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
      type="button"
      onClick={handleTake}
      disabled={loading}
      className={styles.takeBtn}
    >
      {loading ? "..." : "Take It"}
    </button>
  );
}
