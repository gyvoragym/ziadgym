import { createFileRoute, Link } from '@tanstack/react-router';
import { ClientShell } from '@/components/ClientShell';
import { ClientGymCard } from '@/components/ClientGymCard';
import { Button } from '@/components/ui/button';
import { useClientGyms } from '@/lib/client-portal';
import { joinedProgramGyms } from '@/lib/client-management';
import { seo } from '@/lib/seo';
export const Route = createFileRoute('/member/browse')({head:()=>seo('Browse gym programs','Choose your joined gym and view its saved workout programs.'),component:Browse});
function Browse(){const p=useClientGyms();const gyms=joinedProgramGyms(p.directory,p.links,p.memberships);return <ClientShell title="Browse Gym Programs">{p.error&&<p role="alert" className="text-destructive">{p.error}</p>}<div className="grid gap-4 sm:grid-cols-2">{gyms.map(g=><ClientGymCard key={g.id} gym={g} page="Workouts" actions={<Button asChild><Link to="/member/gym/$id" params={{id:g.id}} search={{page:'Workouts'}}>View Programs</Link></Button>}/>)}</div>{!gyms.length&&<p className="py-8 text-muted-foreground">No joined gyms yet.</p>}</ClientShell>;}
