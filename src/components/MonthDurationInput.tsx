import { Input } from './ui/input';

export function MonthDurationInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="flex min-w-0 items-center gap-1">
    <Input aria-label="Duration in months" type="number" min={1} step={1} required value={value}
      onChange={e => { if (/^\d*$/.test(e.target.value) && e.target.value !== '0') onChange(e.target.value); }}
      onKeyDown={e => { if (['.', ',', '-', '+', 'e', 'E'].includes(e.key)) e.preventDefault(); }} className="min-w-0" />
    <span className="text-xs text-muted-foreground">months</span>
  </div>;
}