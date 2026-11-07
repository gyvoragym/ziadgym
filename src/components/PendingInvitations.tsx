import {useEffect,useState} from 'react';
import {supabase} from '@/integrations/supabase/client';
import type {Database} from '@/integrations/supabase/types';
import {useCloud} from './CloudProvider';
import {Button} from './ui/button';
import {Popover,PopoverTrigger,PopoverContent} from './ui/popover';
import {Bell} from 'lucide-react';
import {toast} from 'sonner';
import {getDemoSession,useDemoStore,pendingDemoInvitations,respondDemoInvitation} from '@/lib/demo';
export function PendingInvitations(){
 const c=useCloud();const demo=getDemoSession();const invitations=useDemoStore(s=>s.invitations);const [rows,setRows]=useState<Database['public']['Tables']['staff_invitations']['Row'][]>([]);const [busy,setBusy]=useState(false);
 const pending=demo?pendingDemoInvitations(c.profile?.email??'',invitations):rows;
 async function load(){if(demo||!c.profile)return;const {data,error}=await supabase.rpc('my_staff_invitations');if(error)toast.error(error.message);else setRows((data??[]) as unknown as Database['public']['Tables']['staff_invitations']['Row'][]);}
 useEffect(()=>{setRows([]);void load();},[c.profile?.email]);
 async function respond(id:string,accept:boolean){setBusy(true);try{if(demo)respondDemoInvitation(id,accept);else{const {error}=await supabase.rpc('respond_invitation',{invitation_id:id,accept});if(error)throw error;}toast.success(accept?'Invitation accepted — your gym role has been added':'Invitation declined');await load();await c.refresh();}catch(e){toast.error(e instanceof Error?e.message:'Could not respond');}finally{setBusy(false);}}
 return <Popover><PopoverTrigger asChild><Button variant="outline" size="icon" aria-label={`Notifications${pending.length?` (${pending.length} pending)`:''}`} className="relative shrink-0"><Bell className="h-4 w-4"/>{pending.length>0&&<span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs text-primary-foreground">{pending.length}</span>}</Button></PopoverTrigger><PopoverContent align="end" className="max-h-96 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto"><h2 className="mb-3 font-semibold">Notifications</h2>{!pending.length&&<p className="text-sm text-muted-foreground">No pending invitations.</p>}{pending.map(i=><section key={i.id} className="border-b py-4 last:border-0"><h3 className="font-medium">{'gym_name' in i?String(i.gym_name??'Gym'):c.gyms.find(g=>g.id===i.gym_id)?.name??'Gym'}</h3><p className="mt-1 text-sm">Invited as {i.role}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(i.created_at).toLocaleDateString()} · {i.status}</p><div className="mt-3 flex gap-2"><Button size="sm" disabled={busy} onClick={()=>void respond(i.id,true)}>Accept</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>void respond(i.id,false)}>Decline</Button></div></section>)}</PopoverContent></Popover>;
}
