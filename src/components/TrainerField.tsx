import { useId } from "react";
import { Field, selectCls } from "./kit";
import { Input } from "./ui/input";
import type { Trainer } from "@/lib/store";

export function TrainerField({ trainers, value, onChange }: {
  trainers: Trainer[];
  value: string;
  onChange: (name: string) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Gym trainer">
        <select aria-label="Gym trainer" className={selectCls}
          value={trainers.some((t) => t.name === value) ? value : ""}
          onChange={(e) => onChange(e.target.value)}>
          <option value="">Select a trainer…</option>
          {trainers.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="Trainer name">
        <Input id={id} aria-label="Trainer name" maxLength={100} value={value}
          onChange={(e) => onChange(e.target.value)} />
      </Field>
    </div>
  );
}