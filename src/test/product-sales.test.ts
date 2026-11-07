import { describe, expect, it } from "vitest";
import {
  deleteProduct,
  productSchema,
  saveProduct,
  totalSales,
  updateSoldQuantity,
  validateProductChanges,
} from "../lib/product-sales";
const product = {
  id: "product-1",
  name: "Shaker",
  image: "",
  qty: 10,
  min: 10,
  sales: 0,
  price: 240,
};
describe("gym stock and sales separation", () => {
  it("creates the requested 100 stock example with zero sales and total", () => {
    const row = saveProduct([], { ...product, qty: 100, sales: 100 })[0];
    expect(row?.qty).toBe(100);
    expect(row?.sales).toBe(0);
    expect(totalSales(row ?? product)).toBe(0);
  });
  it("selling 2 from 100 leaves 98 available", () => {
    const row = updateSoldQuantity([{ ...product, qty: 100 }], "product-1", 2)[0];
    expect(row?.sales).toBe(2);
    expect(row?.qty).toBe(98);
    expect(totalSales(row ?? product)).toBe(480);
  });
  it("reversing 1 of 2 sales returns stock to 99", () => {
    const row = updateSoldQuantity([{ ...product, qty: 98, sales: 2 }], "product-1", 1)[0];
    expect(row?.sales).toBe(1);
    expect(row?.qty).toBe(99);
    expect(totalSales(row ?? product)).toBe(240);
  });
  it("adds 10 available and zero sold even if a draft supplies sold units", () => {
    const rows = saveProduct([], { ...product, sales: 10 });
    expect(rows[0]?.qty).toBe(10);
    expect(rows[0]?.sales).toBe(0);
    expect(totalSales(rows[0] ?? product)).toBe(0);
  });
  it("records one sale as 9 available, 1 sold and one unit price", () => {
    const row = updateSoldQuantity([product], "product-1", 1)[0];
    expect(row?.qty).toBe(9);
    expect(row?.sales).toBe(1);
    expect(totalSales(row ?? product)).toBe(240);
  });
  it("reverses one sale back to 10 available and zero sold", () => {
    const rows = updateSoldQuantity(updateSoldQuantity([product], "product-1", 1), "product-1", 0);
    expect(rows[0]?.qty).toBe(10);
    expect(rows[0]?.sales).toBe(0);
  });
  it("edits stock and price without changing recorded quantity sold", () => {
    const sold = updateSoldQuantity([product], "product-1", 2);
    const rows = saveProduct(
      sold,
      { ...product, name: "New shaker", price: 300, qty: 20, sales: 99 },
      "product-1",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("product-1");
    expect(rows[0]?.qty).toBe(20);
    expect(rows[0]?.sales).toBe(2);
    expect(totalSales(rows[0] ?? product)).toBe(600);
  });
  it("direct sold edits apply only the difference, including reversals", () => {
    const first = updateSoldQuantity([product], "product-1", 3);
    const next = updateSoldQuantity(first, "product-1", 7);
    expect(next[0]?.qty).toBe(3);
    expect(next[0]?.sales).toBe(7);
    const reversed = updateSoldQuantity(next, "product-1", 5);
    expect(reversed[0]?.qty).toBe(5);
    expect(reversed[0]?.sales).toBe(5);
  });
  it("blocks sale deltas greater than remaining stock but allows selling exactly the remainder", () => {
    const rows = updateSoldQuantity([product], "product-1", 7);
    expect(() => updateSoldQuantity(rows, "product-1", 11)).toThrow("Not enough stock");
    expect(updateSoldQuantity(rows, "product-1", 10)[0]?.qty).toBe(0);
  });
  it("rejects negative and fractional quantities", () => {
    expect(() => updateSoldQuantity([product], "product-1", -1)).toThrow();
    expect(() => updateSoldQuantity([product], "product-1", 1.5)).toThrow();
    expect(productSchema.safeParse({ ...product, qty: -1 }).success).toBe(false);
  });
  it("blocks deletion of a product with sales and permits deletion without sales", () => {
    expect(() => deleteProduct([{ ...product, sales: 1 }], "product-1")).toThrow("recorded sales");
    expect(deleteProduct([product], "product-1")).toEqual([]);
  });
  it("validates Cloud transitions against the prior snapshot", () => {
    expect(() =>
      validateProductChanges([product], [{ ...product, qty: 9, sales: 1 }]),
    ).not.toThrow();
    expect(() => validateProductChanges([product], [{ ...product, qty: 10, sales: 1 }])).toThrow();
    expect(() => validateProductChanges([product], [{ ...product, qty: 20 }])).not.toThrow();
    expect(() => validateProductChanges([{ ...product, sales: 1 }], [])).toThrow();
    expect(() => validateProductChanges([], [{ ...product, sales: 1 }])).toThrow();
  });
  it("rejects empty names, negative prices and duplicate names", () => {
    expect(productSchema.safeParse({ ...product, name: " " }).success).toBe(false);
    expect(productSchema.safeParse({ ...product, price: -1 }).success).toBe(false);
    expect(() => saveProduct([product], { ...product, id: "other", name: "shaker" })).toThrow();
  });
});
