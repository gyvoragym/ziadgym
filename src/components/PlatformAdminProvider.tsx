import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useCloud } from './CloudProvider';
import { getDemoSession, useDemoStore } from '@/lib/demo';
import { demoAdminNotifications, markDemoAdminRead, type PlatformNotification } from '@/lib/platform-admin';
import { getPlatformNotifications, markPlatformNotificationsRead } from '@/lib/platform-admin.functions';
import { readPreviewSession } from '@/lib/preview-session';
const Context=createContext({notifications:[] as PlatformNotification[],error:'',loading:false,markRead:async (_ids:string[])=>{}});
export const usePlatformAdmin=()=>useContext(Context);
export function PlatformAdminProvider({children}:{children:ReactNode}){
 const c=useCloud(); const requests=useDemoStore(s=>s.requests);const fetchRows=useServerFn(getPlatformNotifications);const readRows=useServerFn(markPlatformNotificationsRead);
 const [notifications,setNotifications]=useState<PlatformNotification[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;async function load(){try{if(c.role!=='super_admin')return;const rows=getDemoSession()||!!readPreviewSession()?.adminToken?demoAdminNotifications():await fetchRows();if(active){setNotifications(rows);setError('');}}catch(e){if(active)setError(e instanceof Error?e.message:'Could not load notifications');}finally{if(active)setLoading(false);}}void load();const timer=setInterval(()=>void load(),15000);return()=>{active=false;clearInterval(timer);};},[c.role,c.profile?.id,requests]);
 async function markRead(ids:string[]){if(getDemoSession()||!!readPreviewSession()?.adminToken)markDemoAdminRead(ids);else await readRows({data:{ids}});setNotifications(rows=>rows.map(n=>ids.includes(n.id)?{...n,read:true}:n));}
 return <Context.Provider value={{notifications,error,loading,markRead}}>{children}</Context.Provider>;
}