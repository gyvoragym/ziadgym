import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "./CountUp";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("panel p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, icon: Icon, delta, tone = "default" }: { label: string; value: string; icon: LucideIcon; delta?: string; tone?: "default" | "good" | "bad" }) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-4 font-display text-2xl font-semibold tabular-nums"><CountUp value={value} /></div>
      {delta && (
        <div className={cn("mt-1 text-xs", tone === "good" && "text-success", tone === "bad" && "text-destructive", tone === "default" && "text-muted-foreground")}>{delta}</div>
      )}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "Active" || status === "In stock"
      ? "bg-success/15 text-success"
      : status === "Expiring" || status === "Low stock"
        ? "bg-warning/15 text-warning"
        : "bg-destructive/15 text-destructive";
  return <span key={status} className={cn("status-pop inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", tone)}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>;
}

export function Avatar({ initials, size = "md" }: { initials: string; size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-20 w-20 text-2xl" : "h-10 w-10 text-sm";
  return <span className={cn("grid shrink-0 place-items-center rounded-full bg-accent font-display font-semibold text-primary", s)}>{initials}</span>;
}

export function DataTable({ head, children, minWidth = 640, widths }: { head: string[]; children: ReactNode; minWidth?: number; widths?: (string | undefined)[] | undefined }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b text-left">
            {head.map((h, i) => <th key={h} style={widths?.[i] ? { width: widths[i] } : undefined} className="eyebrow pb-3 pr-4 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export const td = "py-3.5 pr-4 align-middle";

export const selectCls = "h-10 w-full rounded-md border bg-surface px-3 text-sm";

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-2", className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

/** Placeholder rows shown while a table's saved data loads (same pulse as gallery photos). */
export function TableSkeleton({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Loading" className="panel space-y-3 p-5">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }, (_, c) => <div key={c} className="h-4 animate-pulse rounded bg-secondary" />)}
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Chart-shaped placeholder for charts whose data is still loading. */
export function ChartSkeleton({ className = "h-52" }: { className?: string }) {
  return <div role="status" aria-label="Loading chart" className={cn(className, "flex items-end gap-2 rounded-lg bg-secondary/40 p-4")}>{[40, 65, 50, 80, 55, 70, 45].map((h, i) => <div key={i} className="flex-1 animate-pulse rounded-t bg-secondary" style={{ height: `${h}%` }} />)}</div>;
}
