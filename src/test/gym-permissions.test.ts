import {describe,it,expect} from 'vitest';
import {canView,canChange,formatPermissions} from '@/lib/gym-permissions';
import {copyProgram} from '@/lib/programs';
describe('gym member and staff permissions',()=>{
 it('regular membership grants no management actions',()=>{expect(canChange('Client',[],'Workout programs','edit')).toBe(false);});
 it('page-only staff permission is view-only',()=>{expect(canView('Trainer',['Workout programs'],'Workout programs')).toBe(true);expect(canChange('Trainer',['Workout programs'],'Workout programs','edit')).toBe(false);});
 it('staff edit never implies create or delete',()=>{const p=['Workout programs','Workout programs:edit'];expect(canChange('Trainer',p,'Workout programs','edit')).toBe(true);expect(canChange('Trainer',p,'Workout programs','create')).toBe(false);expect(canChange('Trainer',p,'Workout programs','delete')).toBe(false);});
 it('staff cannot view a page outside their grant',()=>{expect(canView('Trainer',['Workout programs'],'Finance')).toBe(false);});
 it('saved workout copy edits do not change the gym original',()=>{const original={id:'gym-plan',name:'Fictional workout',trainer:'',notes:'',exercises:[{name:'Squat',sets:3,reps:'10'}]};const copy=copyProgram(original);copy.exercises[0]?.name;const exercise=copy.exercises[0];if(exercise)exercise.name='Personal squat';expect(original.exercises[0]?.name).toBe('Squat');expect(copy.id).not.toBe(original.id);});
 it('groups permissions by feature with readable actions',()=>{
  expect(formatPermissions(['Workout programs','Workout programs:create','Workout programs:edit','Workout programs:delete','Members','Finance:edit'])).toBe('Workout programs: Create, Edit, Delete · Members · Finance: Edit');
  expect(formatPermissions([])).toBe('');
 });
});