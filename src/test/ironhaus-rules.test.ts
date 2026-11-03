import {describe,it,expect} from 'vitest';
import {nextPayment,invitationStatus,programSchema,planSchema,sessionSchema} from '@/lib/validation';
import {periodRange} from '@/components/StaffAttendance';
import {copyProgram} from '@/lib/programs';
describe('IronHaus requested rules',()=>{
 it('weekly payment is seven days later',()=>expect(nextPayment('Weekly',new Date(2026,9,18))).toBe('2026-10-25'));
 it('monthly payment clamps end-of-month',()=>expect(nextPayment('Monthly',new Date(2026,0,31))).toBe('2026-02-28'));
 it('yearly payment preserves the date',()=>expect(nextPayment('Yearly',new Date(2026,9,18))).toBe('2027-10-18'));
 it('expired invitation cannot remain pending',()=>expect(invitationStatus('Pending','2026-10-17',new Date('2026-10-18').getTime())).toBe('Expired'));
 it('cancelled invitation stays cancelled',()=>expect(invitationStatus('Cancelled','2027-10-17')).toBe('Cancelled'));
 it('last seven days includes today and six previous dates',()=>expect(periodRange('Last 7 Days',new Date(2026,9,18))).toEqual({start:'2026-10-12',end:'2026-10-18'}));
 it('last month means preceding calendar month',()=>expect(periodRange('Last Month',new Date(2026,9,18))).toEqual({start:'2026-09-01',end:'2026-09-30'}));
 it('programs require at least one exercise',()=>expect(programSchema.safeParse({name:'Strength',exercises:[]}).success).toBe(false));
 it('exercise sets must be positive',()=>expect(programSchema.safeParse({name:'Strength',exercises:[{name:'Squat',sets:0,reps:'5'}]}).success).toBe(false));
 it('saving a copy never mutates the gym definition',()=>{const original={id:'gym-program',name:'Strength',trainer:'',notes:'',exercises:[{name:'Squat',sets:3,reps:'5'}]};const copy=copyProgram(original);const exercise=copy.exercises[0];if(!exercise)throw new Error('Missing copied exercise');exercise.name='Bench';expect(copy.id).not.toBe(original.id);expect(original.exercises[0]?.name).toBe('Squat');});
 it('plan price cannot be negative',()=>expect(planSchema.safeParse({id:'plan',name:'Basic',duration:'1 month',price:-1,features:[]}).success).toBe(false));
 it('session price cannot be negative',()=>expect(sessionSchema.safeParse({id:'s',name:'Client',trainer:'',price:-1,date:'2026-10-18',type:'PT',method:'Cash'}).success).toBe(false));
});
