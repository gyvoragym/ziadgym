import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { CloudGyms } from '@/components/CloudGyms';
import { getDemoSession, useDemoStore, restoreGym, setDemoDeletionNote, isSeededDashboardRecord, type ApprovedGym } from '@/lib/demo';
import { AdminNoteCell } from '@/components/AdminNoteCell';
import { DataTable, PageHeader, td } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { seo } from '@/lib/seo';

export const Route=createFileRoute('/super-admin/deleted-gyms')({head:()=>seo('Deleted gyms','Review suspended gyms, saved deletion reasons and restore gym access.'),component:DeletedGyms});
function DeletedGyms(){return getDemoSession()?<DemoDeletedGyms/>:<CloudGyms deleted/>;}
function DemoDeletedGyms(){
  const gyms=useDemoStore(s=>s.gyms).filter(g=>g.deletedAt&&!isSeededDashboardRecord(g.id));
  const requests=useDemoStore(s=>s.requests).filter(r=>!isSeededDashboardRecord(r.id));
  const [restoring,setRestoring]=useState<ApprovedGym|null>(null);
  return <div><PageHeader title="Deleted Gyms" subtitle={`Total deleted gyms: ${gyms.length} · local demo`}/>
    <DataTable head={['#','Gym Name','Owner','Deletion date','Notes / Reason','Actions']}>{gyms.map((g,i)=><tr key={g.id}><td className={td}>{i+1}</td><td className={td}>{g.name}</td><td className={td}>{requests.find(r=>r.email===g.email)?.ownerName || g.email}</td><td className={td}>{g.deletedAt?new Date(g.deletedAt).toLocaleString():'—'}</td><td className={td}><AdminNoteCell gymName={g.name} note={g.deletionNote || ''} title="Deletion reason" description="Reason this gym was deleted. Separate from freeze notes and request rejection notes." emptyText="–" saveLabel="Save" onSave={note=>setDemoDeletionNote(g.id,note)} /></td><td className={td}><Button size="sm" variant="outline" onClick={()=>setRestoring(g)}>Edit / Restore</Button></td></tr>)}</DataTable>
    {!gyms.length&&<p className="py-6 text-muted-foreground">No deleted gyms.</p>}
    <Dialog open={!!restoring} onOpenChange={open=>{if(!open)setRestoring(null);}}><DialogContent><DialogHeader><DialogTitle>Restore {restoring?.name}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Restore to Approved Gyms? Deletion history and notes are retained. Any separate Freeze restriction remains.</p><p className="whitespace-pre-wrap break-words text-sm">{restoring?.deletionNote || 'No deletion note recorded.'}</p><DialogFooter><Button variant="outline" onClick={()=>setRestoring(null)}>Cancel</Button><Button onClick={()=>{if(!restoring)return;try{restoreGym(restoring.id);setRestoring(null);toast.success('Gym restored to Approved Gyms.');}catch(e){toast.error(e instanceof Error?e.message:'Could not restore gym.');}}}>Restore to Approved</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}