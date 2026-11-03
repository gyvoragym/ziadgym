export const gymPages = ['Members','Attendance','Sessions','Finance','Workout programs','Settings','Products','Profile'] as const;
export type GymAction = 'create' | 'edit' | 'delete';
export const routeAreas: Record<string,string> = {'/members':'Members','/memberships':'Members','/attendance':'Attendance','/sessions':'Sessions','/trainers':'Workout programs','/workouts':'Workout programs','/products':'Products','/finance':'Finance','/gym':'Profile','/staff':'Settings','/settings':'Settings','/qr':'Members','/activity':'Settings','/dashboard':'Dashboard'};
export function canView(role:string,permissions:string[],area:string) { return role==='Owner'||role==='super_admin'||permissions.includes(area); }
export function canChange(role:string,permissions:string[],area:string,action:GymAction) { return role==='Owner'||role==='super_admin'||permissions.includes(`${area}:${action}`); }
/** Human-readable permissions grouped by feature, e.g. "Workout programs: Create, Edit, Delete". */
export function formatPermissions(permissions:string[]):string {
  const groups=new Map<string,string[]>();
  for(const p of permissions){
    const i=p.indexOf(':');
    if(i<0){if(!groups.has(p))groups.set(p,[]);continue;}
    const area=p.slice(0,i),action=p.slice(i+1);
    const label=action.charAt(0).toUpperCase()+action.slice(1);
    groups.set(area,[...(groups.get(area)??[]),label]);
  }
  return [...groups.entries()].map(([area,actions])=>actions.length?`${area}: ${actions.join(', ')}`:area).join(' · ');
}