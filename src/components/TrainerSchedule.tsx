import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import type { TrainerDay } from "@/lib/store";
export function TrainerSchedule({
  value,
  onChange,
}: {
  value: TrainerDay[];
  onChange: (rows: TrainerDay[]) => void;
}) {
  return (
    <div className="space-y-3">
      {value.map((d, i) => (
        <div
          key={d.day}
          className="grid grid-cols-[7rem_1fr] items-center gap-3 sm:grid-cols-[7rem_5rem_1fr_1fr]"
        >
          <span className="text-sm">{d.day}</span>
          <label className="flex items-center gap-2 text-xs">
            <Switch
              aria-label={`${d.day} available`}
              checked={d.available}
              onCheckedChange={(available) =>
                onChange(value.map((r, j) => (i === j ? { ...r, available } : r)))
              }
            />
            {d.available ? "Available" : "Off"}
          </label>
          <Input
            aria-label={`${d.day} start`}
            type="time"
            disabled={!d.available}
            required={d.available}
            value={d.start}
            onChange={(e) =>
              onChange(value.map((r, j) => (i === j ? { ...r, start: e.target.value } : r)))
            }
          />
          <Input
            aria-label={`${d.day} end`}
            type="time"
            disabled={!d.available}
            required={d.available}
            value={d.end}
            onChange={(e) =>
              onChange(value.map((r, j) => (i === j ? { ...r, end: e.target.value } : r)))
            }
          />
        </div>
      ))}
    </div>
  );
}
