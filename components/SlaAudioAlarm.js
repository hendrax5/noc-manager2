"use client";
import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SlaAudioAlarm() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isAlerting, setIsAlerting] = useState(false);
  const [breachingTickets, setBreachingTickets] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const audioContextRef = useRef(null);
  
  // Strict CS Isolation
  if (session && session.user) {
    const userDept = session.user.department || "";
    const isCS = userDept.toLowerCase().includes('cs') || userDept.toLowerCase().includes('customer');
    if (!isCS) return null;
  }
  
  // Create an artificial beep using the Web Audio API (No MP3 file required)
  const playBeep = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Resume context if browser suspended it
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      
      const ctx = audioContextRef.current;
      
      // First Tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
      
      // Second Tone (Higher, 150ms later for urgency)
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1046.50, ctx.currentTime); // C6 note
        gain2.gain.setValueAtTime(1, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.5);
      }, 150);
      
    } catch (e) {
      console.warn("Unable to play SLA audio alarm natively: ", e);
    }
  };

  const checkSlaTicks = async () => {
    try {
      const res = await fetch('/api/tickets/sla-alert');
      if (res.ok) {
         const data = await res.json();
         if (data.triggerAlarm) {
           setIsAlerting(true);
           setBreachingTickets(data.tickets || []);
           // Only play beep if we have tickets, to avoid phantom beeps
           if (data.tickets && data.tickets.length > 0) {
             playBeep();
           }
         } else {
           setIsAlerting(false);
           setBreachingTickets([]);
           setIsOpen(false);
         }
      }
    } catch (err) {
      console.warn("SLA alarm ping failed", err);
    }
  };

  useEffect(() => {
    if (!session || !session.user) return;
    
    // Mount interval loop
    // Run check every 60 seconds
    const interval = setInterval(checkSlaTicks, 60000);
    
    // Defer the very first check by 5 seconds to let UI hydrate fully
    setTimeout(checkSlaTicks, 5000);

    return () => clearInterval(interval);
  }, [session]);

  const handleSnooze = async (ticketId) => {
    try {
       const res = await fetch(`/api/tickets/${ticketId}/sla/snooze`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ minutes: 15 })
       });
       
       if (res.ok) {
          // Refresh list locally
          checkSlaTicks();
          router.refresh();
       } else {
          alert("Failed to snooze SLA.");
       }
    } catch (error) {
       console.error(error);
       alert("Error occurred while snoozing.");
    }
  };

  if(!isAlerting || breachingTickets.length === 0) return null;
  
  return (
    <div style={{ position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      
      {isOpen && (
        <div style={{ marginBottom: '0.5rem', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', width: '320px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', color: '#1f2937' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Breaching Tickets</h4>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {breachingTickets.map(ticket => (
              <div key={ticket.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.8rem', padding: '0.4rem', background: '#f9fafb', borderRadius: '4px' }}>
                <div style={{ flex: 1, marginRight: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <Link href={`/tickets/${ticket.id}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 'bold' }}>
                    {ticket.trackingId}
                  </Link>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ticket.title}
                  </div>
                </div>
                <button 
                  onClick={() => handleSnooze(ticket.id)}
                  style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.3rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}
                >
                  Snooze 15m
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ background: '#ef4444', color: 'white', padding: '0.5rem 1rem', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', animation: isOpen ? 'none' : 'pulse 2s infinite', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        🚨 SLA Alarm Triggered ({breachingTickets.length})
      </div>

    </div>
  );
}
