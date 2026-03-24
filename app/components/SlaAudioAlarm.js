"use client";
import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

export default function SlaAudioAlarm() {
  const { data: session } = useSession();
  const [isAlerting, setIsAlerting] = useState(false);
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

  useEffect(() => {
    if (!session || !session.user) return;
    
    const userRole = session.user.role;
    const userDept = session.user.department || "";
    
    // Only mount interval loop for Customer Service, Managers, and Admins
    const isTargetAudience = userDept.toLowerCase().includes('cs') || 
                             userDept.toLowerCase().includes('customer') || 
                             userRole === 'Admin' || 
                             userRole === 'Manager';
                             
    if (!isTargetAudience) return;

    const checkSlaTicks = async () => {
      try {
        const res = await fetch('/api/tickets/sla-alert');
        if (res.ok) {
           const data = await res.json();
           if (data.triggerAlarm) {
             setIsAlerting(true);
             playBeep();
           } else {
             setIsAlerting(false);
           }
        }
      } catch (err) {
        console.warn("SLA alarm ping failed", err);
      }
    };

    // Run check every 60 seconds
    const interval = setInterval(checkSlaTicks, 60000);
    
    // Defer the very first check by 5 seconds to let UI hydrate fully
    setTimeout(checkSlaTicks, 5000);

    return () => clearInterval(interval);
  }, [session]);

  // Optional: Visual indicator could be rendered here, but Audio is the main feature.
  // Rendering null so this component is fully invisible.
  if(!isAlerting) return null;
  
  return (
    <div style={{ position: 'fixed', bottom: '1rem', right: '1rem', background: '#ef4444', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 'bold', zIndex: 9999, boxShadow: '0 4px 6px rgba(0,0,0,0.1)', pointerEvents: 'none', animation: 'pulse 2s infinite' }}>
      🚨 SLA Alarm Triggered
    </div>
  );
}
