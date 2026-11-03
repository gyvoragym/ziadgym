import { describe, it, expect } from 'vitest';
import { markRecurringPaid, cashSummary, dailySummary, deletePlan, deleteProgram, createInvoice, deleteInvoice, nextInvoiceNumber, defaultSchedule, scheduleSchema, reportInvoices, reportRange, groupInvoices } from '@/lib/gym-updates';
import { defaultGymHours, initialState, type Invoice } from '@/lib/store';
import { members, plans, trainers } from '@/lib/mock';
import { readDemoGym, writeDemoGym } from '@/lib/demo';
import { generateId } from "@/lib/utils";
import { prototypeStorage } from '@/lib/prototype-storage';
const invoice=(date='2026-10-18'):Invoice=>({id:generateId(),name:'Repairs',category:'Custom category',description:'Fixed treadmill',date,amount:-100,type:'Expense',method:'Cash'});
describe('requested gym updates',()=>{
 it('provides editable default working hours for every day',()=>{expect(defaultGymHours().map(({day,open,close,closed})=>({day,open,close,closed}))).toEqual(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day=>({day,open:'08:00',close:'23:00',closed:false})));});
 it('blocks deletion of a plan assigned to members',()=>{const plan=plans[0];if(!plan)throw new Error('Seed missing');expect(()=>deletePlan([plan],[{...members[0],plan:plan.name} as typeof initialState.members[number]],plan.id)).toThrow('assigned to members');});
 it('deletes only an unused selected plan',()=>{expect(deletePlan([{id:'one',name:'One',duration:'1 month',price:1,features:[]},{id:'two',name:'Two',duration:'1 month',price:2,features:[]}],[],'one').map(p=>p.id)).toEqual(['two']);});
 it('requires an available day to end later than it starts',()=>{const rows=defaultSchedule();rows[0]={day:'Monday',available:true,start:'12:00',end:'11:00'};expect(scheduleSchema.safeParse(rows).success).toBe(false);});
 it('persists distinct weekly hours and off days without changing details',()=>{const trainer=trainers[0];if(!trainer)throw new Error('Missing trainer');const schedule=defaultSchedule();schedule[0]={day:'Monday',available:true,start:'08:00',end:'12:00'};schedule[1]={day:'Tuesday',available:false,start:'09:00',end:'11:00'};writeDemoGym('schedule-test',{...initialState,trainers:[{...trainer,schedule}]});expect(readDemoGym('schedule-test').trainers[0]).toEqual({...trainer,schedule});});
 it('deletes only the gym original, leaving an independent client copy',()=>{const original={id:'a',name:'A',trainer:'',notes:'',exercises:[{name:'Squat',sets:3,reps:'10'}]};const copy=structuredClone(original);expect(deleteProgram([original,{...original,id:'b'}],original).map(p=>p.id)).toEqual(['b']);expect(copy.exercises).toEqual([{name:'Squat',sets:3,reps:'10'}]);});
 it('increments invoice numbers by one after deletion and refresh',()=>{let rows=createInvoice([],invoice());rows=deleteInvoice(rows,rows[0]?.id??'');writeDemoGym('sequence-test',{...initialState,transactions:rows});rows=createInvoice(readDemoGym('sequence-test').transactions,invoice());expect(rows.map(r=>r.number)).toEqual([1,2]);expect(nextInvoiceNumber(rows)).toBe(3);});
 it('preserves legacy gym snapshots and isolates invoices to their gym',()=>{prototypeStorage().setItem('ironhaus-demo-gym:legacy-test',JSON.stringify({...initialState,transactions:undefined}));expect(readDemoGym('legacy-test').transactions).toEqual([]);expect(readDemoGym('other-empty').transactions).toEqual([]);});
 for(const [period,dates] of [['today',['2026-10-18','2026-10-18']],['week',['2026-10-12','2026-10-18']],['month',['2026-10-01','2026-10-31']],['year',['2026-01-01','2026-12-31']]] as const){it(`filters saved invoice dates for ${period}`,()=>{const range=reportRange(period,new Date('2026-10-18T12:00:00'));expect(range).toEqual({from:dates[0],to:dates[1]});expect(reportInvoices([{...invoice(dates[0]),entered:true},{...invoice('2025-12-31'),entered:true}],range)).toHaveLength(1);});}
 it('custom range excludes deleted and unpaid schedules and groups paid invoices once',()=>{const paid={...invoice('2026-10-15'),entered:true};const rows=reportInvoices([paid,{...paid,id:'deleted',deleted:true},{...paid,id:'unpaid',entered:false}],reportRange('custom',new Date(),{from:'2026-10-15',to:'2026-10-15'}));expect(rows).toHaveLength(1);expect(groupInvoices(rows,'monthly')).toEqual([['2026-10',100]]);});
});
describe("recurring payments and cash summaries", () => {
  const recurring = [
    { id: "r1", name: "Rent", category: "Rent", frequency: "Monthly" as const, next: "2026-10-01", start: "2026-01-01", amount: 5000 },
  ];
  it("markRecurringPaid records a paid expense and advances next payment", () => {
    const { recurring: r, transactions: t } = markRecurringPaid(recurring, [], "r1", "2026-10-02");
    expect(t).toHaveLength(1);
    expect(t[0]!.amount).toBe(-5000);
    expect(t[0]!.date).toBe("2026-10-02");
    expect(t[0]!.entered).toBe(true);
    expect(r[0]!.next).toBe("2026-11-01");
    expect(r[0]!.lastPaidOccurrence).toBe("2026-10-01");
  });
  it("blocks recording the same occurrence as paid twice", () => {
    const once = markRecurringPaid(recurring, [], "r1", "2026-10-02");
    const again = [{ ...once.recurring[0]!, next: "2026-10-01" }];
    expect(() => markRecurringPaid(again, once.transactions, "r1", "2026-10-03")).toThrow(/already recorded/);
  });
  it("unpaid recurring expenses do not reduce net profit", () => {
    const rows = [
      { id: "i1", number: 1, name: "Membership", category: "Sales", description: "", date: "2026-10-05", amount: 1000, method: "Cash", type: "Income", entered: true },
    ];
    const cash = cashSummary(rows, { from: "2026-10-01", to: "2026-10-31" });
    expect(cash).toEqual({ income: 1000, expenses: 0, net: 1000 });
  });
  it("cash summary nets income minus paid expenses in the same period", () => {
    const rows = [
      { id: "i1", number: 1, name: "Membership", category: "Sales", description: "", date: "2026-10-05", amount: 1000, method: "Cash", type: "Income", entered: true },
      { id: "i2", number: 2, name: "Rent", category: "Rent", description: "", date: "2026-10-06", amount: -400, method: "Cash", type: "Expense", entered: true },
      { id: "i3", number: 3, name: "Old", category: "Rent", description: "", date: "2026-09-06", amount: -900, method: "Cash", type: "Expense", entered: true },
    ];
    expect(cashSummary(rows, { from: "2026-10-01", to: "2026-10-31" })).toEqual({ income: 1000, expenses: 400, net: 600 });
  });
  it("daily summary counts only entered expenses on the selected date", () => {
    const rows = [
      { id: "i1", number: 1, name: "A", category: "Rent", description: "", date: "2026-10-18", amount: -100, method: "Cash", type: "Expense", entered: true },
      { id: "i2", number: 2, name: "B", category: "Rent", description: "", date: "2026-10-18", amount: -50, method: "Cash", type: "Expense", entered: true, deleted: true },
      { id: "i3", number: 3, name: "C", category: "Sales", description: "", date: "2026-10-18", amount: 999, method: "Cash", type: "Income", entered: true },
    ];
    expect(dailySummary(rows, "2026-10-18")).toEqual({ count: 1, total: 100 });
    expect(dailySummary(rows, "2026-10-19")).toEqual({ count: 0, total: 0 });
  });
});
