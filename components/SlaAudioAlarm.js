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
    
    const userRole = session.user.role;
    const userDept = session.user.department || "";
    
    // Only mount interval loop for Customer Service, Admins, or users with ticket/SLA permissions
    const isTargetAudience = userDept.toLowerCase().includes('cs') || 
                             userDept.toLowerCase().includes('customer') || 
                             userRole === 'Admin' || 
                             session.user.permissions?.includes('manage_sla') ||
                             session.user.permissions?.includes('manage_tickets') ||
                             session.user.permissions?.includes('view_all_tickets');
                             
    if (!isTargetAudience) return;

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
        <div className="ui-static-5426012ce6" style={{width: '320px'}}>
          <h4 className="ui-static-8af5b76c4d" >Breaching Tickets</h4>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {breachingTickets.map(ticket => (
              <div key={ticket.id} className="ui-static-347752c5aa" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div className="ui-static-5ed417d1fb" style={{flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                  <Link href={`/tickets/${ticket.id}`} className="ui-static-b674ec9d7d" style={{textDecoration: 'none'}}>
                    {ticket.trackingId}
                  </Link>
                  <div className="ui-static-c43e2a331a" style={{overflow: 'hidden', textOverflow: 'ellipsis'}}>
                    {ticket.title}
                  </div>
                </div>
                <button 
                  onClick={() => handleSnooze(ticket.id)}
                  className="ui-static-b00e0dab7c" style={{cursor: 'pointer'}}
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
        className="ui-static-d0da835da9" style={{cursor: 'pointer', animation: isOpen ? 'none' : 'pulse 2s infinite', display: 'flex', alignItems: 'center'}}
      >
         SLA Alarm Triggered ({breachingTickets.length})
      </div>

    </div>
  );
}
