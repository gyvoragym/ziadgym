import { RecurringExpenses } from "@/components/RecurringExpenses";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Wallet, TrendingUp, TrendingDown, Eye, Pencil, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, PageHeader, Panel, StatCard, td, selectCls, Field } from "@/components/kit";
import { InvoiceFields } from "@/components/InvoiceFields";
import { gymToday, recordedTotals, revenueReports, reportingEvents } from "@/lib/gym-reporting";
import { money as egp, currencyOf } from "@/lib/store";
import { useStore, saveState, readFile, type Invoice } from "@/lib/store";
import {
  createInvoice,
  deleteInvoice,
  invoiceSchema,
  nextInvoiceNumber,
  reportRange,
  reportInvoices,
  groupInvoices,
  dailySummary,
  type ReportPeriod,
} from "@/lib/gym-updates";
import { seo } from "@/lib/seo";
import { generateId } from "@/lib/utils";
export const Route = createFileRoute("/_gym/finance")({
  head: () =>
    seo("Finance", "Gym invoices, expenses, recurring costs and date-filtered invoice reports."),
  component: Finance,
});
const blank = (): Invoice => ({
  id: generateId(),
  name: "",
  category: "",
  description: "",
  date: format(new Date(), "yyyy-MM-dd"),
  amount: 0,
  type: "Expense",
  method: "Cash",
});
function Finance() {
  const gym = useStore(s => s.gym);
  const sessions = useStore(s => s.sessions);
  const savedEvents = useStore(s => s.membershipEvents);
  const members = useStore(s => s.members);
  const events = reportingEvents(savedEvents ?? [], members);
  const localToday = gymToday(gym);
  const localNow = new Date(`${localToday}T12:00:00`);
  const records = useStore((s) => s.transactions);
  const reports = revenueReports(sessions, events ?? [], records, localToday);
  const revenueSeries = Array.from({ length: Number(localToday.slice(5, 7)) }, (_, i) => {
    const month = `${localToday.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`;
    return { month, ...recordedTotals(sessions, events ?? [], records, { from: `${month}-01`, to: month === localToday.slice(0, 7) ? localToday : `${month}-31` }) };
  });
  const tx = records.filter((r) => !r.deleted);
  const [draft, setDraft] = useState(() => ({ ...blank(), date: localToday }));
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [from, setFrom] = useState(localToday);
  const [to, setTo] = useState(from);
  const [group, setGroup] = useState<"daily" | "weekly" | "monthly" | "yearly">("daily");
  const [cashPeriod, setCashPeriod] = useState<ReportPeriod>("month");
  const [cashFrom, setCashFrom] = useState(localToday);
  const [cashTo, setCashTo] = useState(cashFrom);
  const [day, setDay] = useState(localToday);
  const cashRange = reportRange(cashPeriod, localNow, { from: cashFrom, to: cashTo });
  const cashInvalid = cashRange.from > cashRange.to;
  const cash = cashInvalid ? { income: 0, expenses: 0, net: 0 } : recordedTotals(sessions, events ?? [], records, cashRange);
  const today = dailySummary(records, day);
  const range = reportRange(period, localNow, { from, to });
  const invalid = range.from > range.to;
  const matches = invalid ? [] : reportInvoices(records, range);
  const groups = groupInvoices(matches, group);
  const failure = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Could not save invoice");
  const reportTable = (
    <DataTable head={["Invoice #", "Name", "Category", "Date", "Amount", "Description"]}>
      {matches.map((r) => (
        <tr key={r.id}>
          <td className={td}>{r.number}</td>
          <td className={td}>{r.name}</td>
          <td className={td}>{r.category}</td>
          <td className={td}>{r.date}</td>
          <td className={td}>{egp(r.amount)}</td>
          <td className={`${td} max-w-xs whitespace-normal`}>{r.description || "—"}</td>
        </tr>
      ))}
    </DataTable>
  );
  return (
    <>
      <PageHeader title="Finance" subtitle="Every financial movement in one place" />
      <Tabs defaultValue="tx">
        <TabsList className="mb-6 flex h-auto flex-wrap justify-start bg-card">
          {[
            ["tx", "Transactions"],
            ["exp", "Expenses"],
            ["rec", "Recurring"],
            ["cash", "Cash register"],
            ["rep", "Reports"],
          ].map(([v, label]) => (
            <TabsTrigger key={v} value={v ?? ""}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="tx">
          <Panel>
            <DataTable
              head={[
                "Invoice #",
                "Name",
                "Date",
                "Type",
                "Category",
                "Method",
                "Amount",
                "Actions",
              ]}
            >
              {tx.map((t) => (
                <tr key={t.id}>
                  <td className={td}>{t.number ?? "—"}</td>
                  <td className={td}>{t.name}</td>
                  <td className={td}>{t.date}</td>
                  <td className={td}>{t.type}</td>
                  <td className={td}>{t.category}</td>
                  <td className={td}>{t.method}</td>
                  <td className={`${td} ${t.amount < 0 ? "text-destructive" : "text-success"}`}>
                    {t.amount < 0 ? "−" : "+"}
                    {egp(t.amount)}
                  </td>
                  <td className={td}>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`View invoice ${t.name}`}
                        title="View invoice"
                        onClick={() => {
                          setSelected({ ...t });
                          setMode("view");
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit invoice ${t.name}`}
                        title="Edit invoice"
                        onClick={() => {
                          setSelected({ ...t });
                          setMode("edit");
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
            {!tx.length && <p className="py-6 text-sm text-muted-foreground">No transactions.</p>}
          </Panel>
        </TabsContent>
        <TabsContent value="exp">
          <Panel title="Add expense" className="max-w-2xl">
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await saveState((s) => ({ transactions: createInvoice(s.transactions, draft) }));
                  toast.success("Expense saved");
                  setDraft({ ...blank(), date: localToday });
                } catch (error) {
                  failure(error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="text-sm text-muted-foreground">
                Invoice #{nextInvoiceNumber(records)}
              </div>
              <InvoiceFields value={draft} onChange={(p) => setDraft((v) => ({ ...v, ...p }))} />
              <Field label="Invoice">
                <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed bg-surface px-3 text-sm text-muted-foreground">
                  <Upload className="h-4 w-4" />
                  {uploading ? "Uploading…" : draft.attachment ? "Invoice attached" : "Upload file"}
                  <Input
                    aria-label="Invoice attachment"
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    disabled={uploading || busy}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 1000000) {
                        toast.error("Invoice attachment must be 1 MB or smaller");
                        return;
                      }
                      setUploading(true);
                      try {
                        const attachment = await readFile(file);
                        setDraft((v) => ({ ...v, attachment }));
                      } catch (error) {
                        failure(error);
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                </label>
              </Field>
              <Button disabled={busy || uploading}>{busy ? "Saving…" : "Save expense"}</Button>
            </form>
          </Panel>
        </TabsContent>
        <TabsContent value="rec">
          <RecurringExpenses />
        </TabsContent>
        <TabsContent value="cash">
          <div className="mb-6 flex flex-wrap items-end gap-3">
            <Field label="Period">
              <select
                aria-label="Cash register period"
                className={selectCls}
                value={cashPeriod}
                onChange={(e) => setCashPeriod(e.target.value as ReportPeriod)}
              >
                {[
                  ["today", "Today"],
                  ["week", "This Week"],
                  ["month", "This Month"],
                  ["year", "This Year"],
                  ["custom", "Custom Date Range"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            {cashPeriod === "custom" && (
              <>
                <Field label="From">
                  <Input
                    aria-label="Cash register from"
                    type="date"
                    required
                    value={cashFrom}
                    onChange={(e) => setCashFrom(e.target.value)}
                  />
                </Field>
                <Field label="To">
                  <Input
                    aria-label="Cash register to"
                    type="date"
                    required
                    value={cashTo}
                    onChange={(e) => setCashTo(e.target.value)}
                  />
                </Field>
              </>
            )}
          </div>
          {cashInvalid ? (
            <p role="alert" className="text-destructive">
              End date must not precede start date.
            </p>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {cashRange.from} – {cashRange.to} · Recorded sessions and subscriptions; only paid expenses are subtracted.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Total recorded income" value={egp(cash.income)} icon={TrendingUp} tone="good" />
                <StatCard label="Total paid expenses" value={egp(cash.expenses)} icon={TrendingDown} tone="bad" />
                <StatCard
                  label="Net profit"
                  value={`${cash.net < 0 ? '−' : ''}${egp(cash.net)}`}
                  icon={Wallet}
                  tone={cash.net >= 0 ? "good" : "bad"}
                  delta="Income − paid expenses"
                />
              </div>
            </>
          )}
          <Panel title="Daily expense invoice summary" className="mt-8 max-w-2xl">
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <Field label="Date">
                <Input
                  aria-label="Summary date"
                  type="date"
                  required
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </Field>
            </div>
            <p className="text-sm text-muted-foreground">
              {day}: <strong className="text-foreground">{today.count}</strong> expense{" "}
              {today.count === 1 ? "invoice" : "invoices"} · Total{" "}
              <strong className="text-foreground">{egp(today.total)}</strong>
            </p>
          </Panel>
        </TabsContent>
        <TabsContent value="rep">
          <section className="mb-8 space-y-4">
            <h2 className="text-lg font-semibold">Entered invoices</h2>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Period">
                <select
                  aria-label="Report period"
                  className={selectCls}
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
                >
                  {[
                    ["today", "Today"],
                    ["week", "This Week"],
                    ["month", "This Month"],
                    ["year", "This Year"],
                    ["custom", "Custom Date Range"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              {period === "custom" && (
                <>
                  <Field label="From">
                    <Input
                      aria-label="Report from"
                      type="date"
                      required
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </Field>
                  <Field label="To">
                    <Input
                      aria-label="Report to"
                      type="date"
                      required
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </Field>
                </>
              )}
              <Field label="Group by">
                <select
                  aria-label="Group invoices"
                  className={selectCls}
                  value={group}
                  onChange={(e) => setGroup(e.target.value as typeof group)}
                >
                  {["daily", "weekly", "monthly", "yearly"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
            </div>
            {invalid ? (
              <p role="alert" className="text-destructive">
                End date must not precede start date.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {range.from} – {range.to} · {matches.length} invoices ·{" "}
                  <strong className="text-foreground">
                    Total {egp(matches.reduce((a, r) => a + Math.abs(r.amount), 0))}
                  </strong>
                </p>
                {reportTable}
                {!matches.length && (
                  <p className="py-4 text-sm text-muted-foreground">
                    No entered invoices in this period.
                  </p>
                )}
                {groups.length > 0 && (
                  <DataTable head={["Period", "Total amount"]}>
                    {groups.map(([date, total]) => (
                      <tr key={date}>
                        <td className={td}>{date}</td>
                        <td className={td}>{egp(total)}</td>
                      </tr>
                    ))}
                  </DataTable>
                )}
              </>
            )}
          </section>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Daily revenue" value={egp(reports.daily.income)} icon={TrendingUp} />
            <StatCard label="Monthly revenue" value={egp(reports.monthly.income)} icon={TrendingUp} />
            <StatCard label="Yearly revenue" value={egp(reports.yearly.income)} icon={TrendingUp} />
            <StatCard
              label="Net profit (YTD)"
              value={`${reports.yearly.net < 0 ? "−" : ""}${egp(reports.yearly.net)}`}
              icon={Wallet}
              tone="good"
              delta="Expenses deducted"
            />
          </div>
          <Panel title="Monthly revenue">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={revenueSeries}>
                  <XAxis
                    dataKey="month"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                    cursor={{ fill: "var(--secondary)" }}
                  />
                  <Bar dataKey="revenue" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
      <Dialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === "view" ? "Invoice details" : "Edit invoice"}</DialogTitle>
          </DialogHeader>
          {selected && (
            <>
              {mode === "view" ? (
                <>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    {Object.entries({
                      "Invoice #": selected.number ?? "—",
                      Name: selected.name,
                      Type: selected.type,
                      Category: selected.category,
                      Amount: egp(selected.amount),
                      Date: selected.date,
                      Method: selected.method,
                      Description: selected.description || "—",
                    }).map(([key, v]) => (
                      <div key={key} className={key === "Description" ? "col-span-2" : ""}>
                        <dt className="text-muted-foreground">{key}</dt>
                        <dd className="mt-1 break-words whitespace-pre-wrap">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {selected.attachment && (
                    <a
                      href={selected.attachment}
                      download={`${selected.name}-invoice`}
                      className="text-primary underline"
                    >
                      Download invoice attachment
                    </a>
                  )}
                  <DialogFooter>
                    <Button onClick={() => setMode("edit")}>Edit invoice</Button>
                  </DialogFooter>
                </>
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    try {
                      const row = invoiceSchema.parse(selected);
                      await saveState((s) => ({
                        transactions: s.transactions.map((r) => (r.id === row.id ? row : r)),
                      }));
                      toast.success("Invoice saved");
                      setSelected(null);
                    } catch (error) {
                      failure(error);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <p className="text-sm text-muted-foreground">Invoice #{selected.number ?? "—"}</p>
                  <InvoiceFields
                    value={selected}
                    onChange={(p) => setSelected((v) => (v ? { ...v, ...p } : v))}
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={busy}
                      onClick={async () => {
                        if (!window.confirm("Delete this invoice?")) return;
                        setBusy(true);
                        try {
                          await saveState((s) => ({
                            transactions: deleteInvoice(s.transactions, selected.id),
                          }));
                          toast.success("Invoice deleted");
                          setSelected(null);
                        } catch (error) {
                          failure(error);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Delete invoice
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                      Cancel
                    </Button>
                    <Button disabled={busy}>{busy ? "Saving…" : "Save invoice"}</Button>
                  </DialogFooter>
                </form>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
