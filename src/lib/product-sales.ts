import { z } from "zod";
import type { Product } from "./store";

export const soldQuantitySchema = z
  .number()
  .finite()
  .int("Quantity must be a whole number")
  .min(0, "Quantity cannot be negative")
  .max(Number.MAX_SAFE_INTEGER);
export const productSchema = z
  .object({
    id: z.string().min(1).max(100).optional(),
    name: z.string().trim().min(1, "Enter a product name").max(60),
    image: z.string().max(7_000_000).optional(),
    price: z.number().finite().min(0, "Price cannot be negative").max(Number.MAX_SAFE_INTEGER),
    qty: soldQuantitySchema,
    sales: soldQuantitySchema,
    min: soldQuantitySchema,
  })
  .refine(
    (p) => Number.isFinite(p.price * p.sales) && p.price * p.sales <= Number.MAX_SAFE_INTEGER,
    "Total sales is too large",
  );

export const productKey = (p: Product) => p.id ?? p.name;
export const totalSales = (p: Product) => p.price * p.sales;
export function saveProduct(rows: Product[], draft: Product, editingKey?: string) {
  const existing = rows.find((p) => productKey(p) === editingKey);
  const parsed = productSchema.parse({ ...draft, sales: existing?.sales ?? 0 });
  if (
    rows.some(
      (p) => productKey(p) !== editingKey && p.name.toLowerCase() === parsed.name.toLowerCase(),
    )
  )
    throw new Error("A product with this name exists");
  if (editingKey && !rows.some((p) => productKey(p) === editingKey))
    throw new Error("Product no longer exists");
  return editingKey
    ? rows.map((p) => (productKey(p) === editingKey ? parsed : p))
    : [...rows, parsed];
}
export function updateSoldQuantity(rows: Product[], key: string, quantity: number) {
  const sales = soldQuantitySchema.parse(quantity);
  const existing = rows.find((p) => productKey(p) === key);
  if (!existing) throw new Error("Product no longer exists");
  const difference = sales - existing.sales;
  if (difference > existing.qty)
    throw new Error(`Not enough stock. Only ${existing.qty} units available.`);
  return rows.map((p) =>
    productKey(p) === key ? productSchema.parse({ ...p, sales, qty: p.qty - difference }) : p,
  );
}
export function deleteProduct(rows: Product[], key: string) {
  const existing = rows.find((p) => productKey(p) === key);
  if (!existing) throw new Error("Product no longer exists");
  if (existing.sales > 0)
    throw new Error(
      "This product has recorded sales and cannot be deleted. Reverse the sales first if they were entered by mistake.",
    );
  return rows.filter((p) => productKey(p) !== key);
}
/** Validate snapshot transitions as well as fields before the locked Cloud write. */
export function validateProductChanges(previous: Product[], next: Product[]) {
  for (const old of previous) {
    const current = next.find((p) => productKey(p) === productKey(old));
    if (!current) {
      deleteProduct(previous, productKey(old));
      continue;
    }
    const difference = current.sales - old.sales;
    if (difference !== 0 && (difference > old.qty || current.qty !== old.qty - difference))
      throw new Error("Sales must adjust available stock by only the change in quantity sold.");
  }
  for (const row of next) {
    if (!previous.some((p) => productKey(p) === productKey(row)) && row.sales !== 0)
      throw new Error("New products must start with zero sold.");
  }
}
