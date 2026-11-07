import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { DataTable, Field, Panel, selectCls, td } from "./kit";
import { useStore, saveState, type RecurringExpense } from "@/lib/store";
import { nextPayment, recurringSchema } from "@/lib/validation";
import { markRecurringPaid } from "@/lib/gym-updates";
import { expenseCategories } from "@/lib/mock";
import { money as egp, currencyOf } from "@/lib/store";
import { generateId } from "@/lib/utils";

const blank = (): RecurringExpense => ({
  id: generateId(),
  name: "",
  category: "Rent",
  frequency: "Monthly",
  next: nextPayment("Monthly"),
  start: new Date().toISOString().slice(0, 10),
  amount: 1,
});

const frequencies = ["Weekly", "Monthly", "Yearly", "Custom"] as const;

export function RecurringExpenses() {
  const list = useStore((s) => s.recurring);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState(blank);
  const [paying, setPaying] = useState<RecurringExpense | null>(null);
  const [payDate, setPayDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [busy, setBusy] = useState(false);
  const up = (p: Partial<RecurringExpense>) => setF((x) => ({ ...x, ...p }));
  const failure = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Could not save recurring expense");

  const section = (frequency: (typeof frequencies)[number]) => {
    const rows = list.filter((r) => r.frequency === frequency);
    if (!rows.length) return null;
    const scheduled = rows.reduce((a, r) => a + r.amount, 0);
    return (
      <Panel
        key={frequency}
        title={`${frequency} Invoices`}
        className="mb-6"
        action={
          <span className="text-sm text-muted-foreground">
            Scheduled total: <strong className="text-foreground">{egp(scheduled)}</strong>
          </span>
        }
      >
        <DataTable head={["Name", "Category", "Frequency", "Next payment", "Amount", "Actions"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={td}>{r.name}</td>
              <td className={td}>{r.category}</td>
              <td className={td}>{r.frequency}</td>
              <td className={td}>{r.next}</td>
              <td className={td}>{egp(r.amount)}</td>
              <td className={td}>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPaying(r);
                      setPayDate(format(new Date(), "yyyy-MM-dd"));
                    }}
                  >
                    Mark as Paid
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(true);
                      setF({ ...r });
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    );
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Scheduled amounts are not paid expenses — only recorded payments count.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(false);
            setF(blank());
            setOpen(true);
          }}
        >
          New recurring
        </Button>
      </div>
      {frequencies.map(section)}
      {!list.length && (
        <Panel>
          <p className="py-6 text-sm text-muted-foreground">No recurring expenses.</p>
        </Panel>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit recurring expense" : "New recurring expense"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const v = recurringSchema.safeParse(f);
              if (!v.success) {
                toast.error(v.error.issues[0]?.message ?? "Check expense details");
                return;
              }
              setBusy(true);
              try {
                await saveState((s) => ({
                  recurring: editing
                    ? s.recurring.map((r) => (r.id === f.id ? { ...v.data, lastPaidOccurrence: r.lastPaidOccurrence } : r))
                    : [...s.recurring, v.data],
                }));
                setOpen(false);
              } catch (error) {
                failure(error);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Name">
              <Input required maxLength={100} value={f.name} onChange={(e) => up({ name: e.target.value })} />
            </Field>
            <Field label="Category">
              <Input
                list="expense-categories"
                required
                maxLength={100}
                value={f.category}
                onChange={(e) => up({ category: e.target.value })}
              />
              <datalist id="expense-categories">
                {expenseCategories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </datalist>
            </Field>
            <Field label="Frequency">
              <select
                className={selectCls}
                value={f.frequency}
                onChange={(e) => {
                  const frequency = e.target.value as RecurringExpense["frequency"];
                  up({ frequency, next: nextPayment(frequency) });
                }}
              >
                {frequencies.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Next Payment">
              <Input type="date" required value={f.next} onChange={(e) => up({ next: e.target.value })} />
            </Field>
            <Field label={`Amount (${currencyOf()})`}>
              <Input
                type="number"
                min={0.01}
                step="0.01"
                required
                value={f.amount}
                onChange={(e) => up({ amount: Number(e.target.value) })}
              />
            </Field>
            <DialogFooter>
              {editing && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={async () => {
                    if (!window.confirm("Delete this recurring expense?")) return;
                    setBusy(true);
                    try {
                      await saveState((s) => ({ recurring: s.recurring.filter((r) => r.id !== f.id) }));
                      setOpen(false);
                    } catch (error) {
                      failure(error);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!paying} onOpenChange={(v) => !v && setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Paid — {paying?.name}</DialogTitle>
          </DialogHeader>
          {paying && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await saveState((s) => markRecurringPaid(s.recurring, s.transactions, paying.id, payDate));
                  toast.success("Payment recorded");
                  setPaying(null);
                } catch (error) {
                  failure(error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p className="text-sm text-muted-foreground">
                Scheduled for {paying.next} · {egp(paying.amount)}. This records a paid expense and
                advances the next payment date.
              </p>
              <Field label="Payment date">
                <Input
                  aria-label="Payment date"
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPaying(null)}>
                  Cancel
                </Button>
                <Button disabled={busy}>{busy ? "Recording…" : "Record payment"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
