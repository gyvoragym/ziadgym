import {createFileRoute,useNavigate,Link} from '@tanstack/react-router';
import {useCloud} from '@/components/CloudProvider';
import {Button} from '@/components/ui/button';
import {PageHeader} from '@/components/kit';
import {seo} from '@/lib/seo';
export const Route=createFileRoute('/gyms')({head:()=>seo('Select gym','Choose which IronHaus gym account to open.'),component:Gyms});
function Gyms(){const c=useCloud();const navigate=useNavigate();return <div className="mx-auto max-w-2xl px-6 py-16"><PageHeader title="Your gyms"/><div className="space-y-3">{c.gyms.map(g=><Button key={g.id} variant="secondary" className="h-auto w-full justify-between py-5" onClick={async()=>{const role=await c.selectGym(g.id);await navigate({to:role==='Client'||!role?'/member':'/dashboard'});}}>{g.name}<span>→</span></Button>)}</div>{!c.gyms.length&&<p className="text-muted-foreground">You have no gym access yet. Accept an invitation or ask reception to link your Member ID.</p>}<Button asChild className="mt-6" variant="outline"><Link to="/member">My account</Link></Button></div>;}