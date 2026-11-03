import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Plus, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, PageHeader } from "@/components/kit";
import { currencyOf, saveState, useStore } from "@/lib/store";
import { deletePlan } from "@/lib/gym-updates";
import { seo } from "@/lib/seo";
import { generateId } from "@/lib/utils";
import { useCloud } from '@/components/CloudProvider';
import { canChange } from '@/lib/gym-permissions';
import { MonthDurationInput } from '@/components/MonthDurationInput';
import { monthLabel, planMonths, positiveMonths } from '@/lib/membership-dates';

export const Route = createFileRoute("/_gym/memberships")({
  head: () => seo("Membership plans", "Create and manage membership plans, durations and pricing."),
  component: Memberships,
});

function Memberships() {
  const c=useCloud();const may=(action:'create'|'edit'|'delete')=>canChange(c.role,c.permissions,'Members',action);
  const plans = useStore((s) => s.plans);
  const members = useStore((s) => s.members);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("1");
  const [price, setPrice] = useState(0);
  const [features, setFeatures] = useState<string[]>([""]);
  const reset = () => {
    setEditing(null);
    setName("");
    setDuration("1");
    setPrice(0);
    setFeatures([""]);
  };

  return (
    <>
      <PageHeader
        title="Membership plans"
        subtitle="Create and manage your plans"
        actions={
          <Button
            disabled={!may('create')}
            onClick={() => {
              reset();
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New plan
          </Button>
        }
      />
      <div className="grid gap-5 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.id}
            className={`panel flex flex-col p-6 ${p.featured ? "border-primary/50" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="eyebrow">{planMonths(p) ? monthLabel(planMonths(p) ?? 1) : p.duration}</span>
              {p.featured && (
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                  Most popular
                </span>
              )}
            </div>
            <h2 className="mt-3 text-2xl font-semibold">{p.name}</h2>
            <div className="mt-4 font-display text-3xl text-primary">
              {currencyOf()} {p.price.toLocaleString()}
            </div>
            <ul className="mt-6 flex-1 space-y-2.5 text-sm text-muted-foreground">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
              <span>{members.filter((m) => m.plan === p.name).length} members</span>
              <Button
                disabled={!may('edit')}
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEditing(p.id);
                  setName(p.name);
                  setDuration(String(planMonths(p) ?? 1));
                  setPrice(p.price);
                  setFeatures([...p.features]);
                  setOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit plan" : "New plan"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const durationMonths = Number(duration);
                if (!positiveMonths(durationMonths)) throw new Error('Duration must be a positive whole number of months.');
                await saveState((s) => ({
                  plans: editing
                    ? s.plans.map((p) =>
                        p.id === editing
                          ? {
                              ...p,
                              name: name.trim(),
                              duration: monthLabel(durationMonths),
                              durationMonths,
                              price,
                              features: features.map((f) => f.trim()).filter(Boolean),
                            }
                          : p,
                      )
                    : [
                        ...s.plans,
                        {
                          id: generateId(),
                          name: name.trim(),
                          duration: monthLabel(durationMonths),
                          durationMonths,
                          price,
                          features: features.map((f) => f.trim()).filter(Boolean),
                        },
                      ],
                }));

                toast.success("Plan saved");
                setOpen(false);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not save plan");
              }
            }}
          >
            <Field label="Plan name">
              <Input
                required
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duration in months">
                <MonthDurationInput value={duration} onChange={setDuration} />
              </Field>
              <Field label={`Price (${currencyOf()})`}>
                <Input
                  type="number"
                  min={0}
                  required
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                />
              </Field>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Features</div>
              {features.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    maxLength={80}
                    value={f}
                    placeholder={`Feature ${i + 1}`}
                    onChange={(e) =>
                      setFeatures(features.map((x, j) => (j === i ? e.target.value : x)))
                    }
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Remove feature"
                    onClick={() => setFeatures(features.filter((_, j) => j !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setFeatures([...features, ""])}
              >
                <Plus className="h-4 w-4" />
                Add feature
              </Button>
            </div>
            <DialogFooter>
              {editing && may('delete') && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={async () => {
                    if (!window.confirm("Delete this membership plan?")) return;
                    try {
                      await saveState((s) => ({ plans: deletePlan(s.plans, s.members, editing) }));
                      toast.success("Plan deleted");
                      setOpen(false);
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not delete plan");
                    }
                  }}
                >
                  Delete plan
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
