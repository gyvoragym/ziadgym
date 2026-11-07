import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, Paperclip, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader, Panel, Field, DataTable, td, selectCls, StatCard } from "@/components/kit";
import {
  useDemoStore,
  savePlatformExpense,
  deletePlatformExpense,
  filterExpenses,
  type PlatformExpense,
} from "@/lib/demo";
import { readFile } from "@/lib/store";
import { egp } from "@/lib/mock";
import { seo } from "@/lib/seo";
import { toast } from "sonner";
import { generateId } from "@/lib/utils";

export const Route = createFileRoute("/super-admin/expenses")({
  head: () =>
    seo(
      "Platform expenses & bills",
      "Saved demo platform expenses, bills, receipts and period totals, separate from gym finances.",
    ),
  component: Expenses,
});
const blank = (): PlatformExpense => ({
  id: generateId(),
  name: "",
  category: "Operations",
  amount: 0,
  date: new Date().toISOString().slice(0, 10),
  method: "",
  notes: "",
});
const money = (n: number) => `${n < 0 ? "−" : ""}${egp(n)}`;

function Expenses() {
  const expenses = useDemoStore((s) => s.expenses);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [form, setForm] = useState<PlatformExpense | null>(null);
  const [deleting, setDeleting] = useState<PlatformExpense | null>(null);
  const [busy, setBusy] = useState(false);
  const categories = Array.from(
    new Set([
      "Operations",
      "Software",
      "Marketing",
      "Utilities",
      "Professional services",
      ...expenses.map((e) => e.category),
    ]),
  );
  const rows = filterExpenses(expenses, q, category, from, to);
  const total = rows.reduce((s, e) => s + e.amount, 0);
  const editing = expenses.some((e) => e.id === form?.id);
  const up = (p: Partial<PlatformExpense>) => setForm((f) => (f ? { ...f, ...p } : f));
  async function attach(file?: File) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Receipt must be 2 MB or smaller");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
      toast.error("Choose a JPG, PNG, WebP or PDF receipt");
      return;
    }
    setBusy(true);
    try {
      up({ receipt: await readFile(file), receiptName: file.name });
    } catch {
      toast.error("Could not read receipt");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Expenses & Bills"
        subtitle="Platform records · demo figures"
        actions={
          <Button onClick={() => setForm(blank())}>
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        }
      />
      <div className="mb-6 max-w-sm">
        <StatCard
          label="Expenses (demo)"
          value={money(total)}
          icon={Wallet}
          delta={`${rows.length} records in selected period`}
        />
      </div>
      <Panel title="Platform expenses">
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            aria-label="Search expenses"
            placeholder="Search expenses"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className={selectCls}
            aria-label="Filter category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <Field label="From">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <DataTable
          head={[
            "Expense / bill",
            "Category",
            "Amount (demo)",
            "Date",
            "Payment method",
            "Receipt",
            "Actions",
          ]}
        >
          {rows.map((e) => (
            <tr key={e.id}>
              <td className={td}>
                <p className="font-medium">{e.name}</p>
                {e.notes && (
                  <p className="max-w-60 break-words text-xs text-muted-foreground">{e.notes}</p>
                )}
              </td>
              <td className={td}>{e.category}</td>
              <td className={td}>{money(e.amount)}</td>
              <td className={td}>{e.date}</td>
              <td className={td}>{e.method || "—"}</td>
              <td className={td}>
                {e.receipt ? (
                  <Button asChild size="sm" variant="ghost">
                    <a href={e.receipt} download={e.receiptName ?? "receipt"}>
                      <Paperclip className="h-4 w-4" />
                      Receipt
                    </a>
                  </Button>
                ) : (
                  "—"
                )}
              </td>
              <td className={td}>
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="secondary"
                    aria-label={`Edit ${e.name}`}
                    title="Edit expense"
                    onClick={() => setForm({ ...e })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${e.name}`}
                    title="Delete expense"
                    onClick={() => setDeleting(e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
        {!rows.length && (
          <p className="py-6 text-sm text-muted-foreground">No expenses in this period.</p>
        )}
      </Panel>
      <Dialog
        open={Boolean(form)}
        onOpenChange={(v) => {
          if (!v) setForm(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          {form && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  savePlatformExpense(form);
                  toast.success("Demo expense saved");
                  setForm(null);
                } catch {
                  toast.error("Complete the fields with a positive amount.");
                }
              }}
            >
              <Field label="Name">
                <Input
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => up({ name: e.target.value })}
                />
              </Field>
              <Field label="Category">
                <Input
                  aria-label="Category"
                  required
                  maxLength={100}
                  list="expense-categories"
                  value={form.category}
                  onChange={(e) => up({ category: e.target.value })}
                />
                <datalist id="expense-categories">
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </datalist>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Amount (EGP)">
                  <Input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount || ""}
                    onChange={(e) => up({ amount: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Expense Date">
                  <Input
                    required
                    type="date"
                    value={form.date}
                    onChange={(e) => up({ date: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Payment Method">
                <select
                  className={selectCls}
                  value={form.method}
                  onChange={(e) => up({ method: e.target.value })}
                >
                  <option value="">Not specified</option>
                  {["Cash", "Card", "Bank transfer", "Wallet", "Other"].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Notes">
                <Textarea
                  maxLength={2000}
                  value={form.notes}
                  onChange={(e) => up({ notes: e.target.value })}
                />
              </Field>
              <Field label="Receipt / Invoice (optional, max 2 MB)">
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => void attach(e.target.files?.[0])}
                />
              </Field>
              {form.receiptName && (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{form.receiptName}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Remove receipt"
                    onClick={() => up({ receipt: undefined, receiptName: undefined })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Cancel
                </Button>
                <Button disabled={busy}>{busy ? "Reading receipt…" : "Save Expense"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(v) => {
          if (!v) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete expense?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleting?.name} will be permanently removed from these demo records.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleting) return;
                deletePlatformExpense(deleting.id);
                setDeleting(null);
                toast.success("Demo expense deleted");
              }}
            >
              Delete Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
