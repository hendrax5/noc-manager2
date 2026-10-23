'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
export default function BodRefresh(){const router=useRouter();useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState==='visible')router.refresh();},60000);const show=()=>{if(document.visibilityState==='visible')router.refresh();};document.addEventListener('visibilitychange',show);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',show);};},[router]);return null;}
