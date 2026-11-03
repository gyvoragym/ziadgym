import type { Invoice } from "@/lib/store";
import { expenseCategories } from "@/lib/mock";
import { currencyOf } from "@/lib/store";
import { Field, selectCls } from "./kit";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
export function InvoiceFields({
  value,
  onChange,
}: {
  value: Invoice;
  onChange: (p: Partial<Invoice>) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Invoice Name">
        <Input
          aria-label="Invoice Name"
          required
          maxLength={100}
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </Field>
      <Field label="Category">
        <Input
          aria-label="Category"
          required
          list="invoice-categories"
          maxLength={100}
          value={value.category}
          onChange={(e) => onChange({ category: e.target.value })}
        />
        <datalist id="invoice-categories">
          {expenseCategories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label={`Amount (${currencyOf()})`}>
        <Input
          aria-label={`Amount (${currencyOf()})`}
          required
          type="number"
          min={0.01}
          step="0.01"
          value={Math.abs(value.amount) || ""}
          onChange={(e) =>
            onChange({ amount: (value.type === "Expense" ? -1 : 1) * Number(e.target.value) })
          }
        />
      </Field>
      <Field label="Date">
        <Input
          aria-label="Date"
          required
          type="date"
          value={value.date}
          onChange={(e) => onChange({ date: e.target.value })}
        />
      </Field>
      <Field label="Method">
        <select
          aria-label="Method"
          className={selectCls}
          value={value.method}
          onChange={(e) => onChange({ method: e.target.value })}
        >
          {["Cash", "Card", "Bank", "Wallet"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </Field>
      <Field label="Type">
        <Input aria-label="Type" readOnly value={value.type} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description">
          <Textarea
            aria-label="Description"
            maxLength={500}
            value={value.description}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}
