import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Minus, AlertTriangle, Package, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DataTable, Field, PageHeader, Panel, StatusPill, td } from "@/components/kit";
import { money as egp, currencyOf } from "@/lib/store";
import { saveState, stockStatus, useStore, type Product } from "@/lib/store";
import { uploadImage, imageUrl } from "@/lib/images";
import {
  deleteProduct,
  productKey,
  saveProduct,
  totalSales,
  updateSoldQuantity,
} from "@/lib/product-sales";
import { seo } from "@/lib/seo";
import { generateId } from "@/lib/utils";
import { useCloud } from "@/components/CloudProvider";
import { canChange } from "@/lib/gym-permissions";

export const Route = createFileRoute("/_gym/products")({
  head: () =>
    seo(
      "Products & sales",
      "Manage gym products, inventory, quantities sold and product sales totals.",
    ),
  component: Products,
});

function Thumb({ p, cls = "h-10 w-10" }: { p: Product; cls?: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    setUrl("");
    if (p.image) {
      if (/^(data:image\/(png|jpeg|webp);base64,|https?:\/\/|\/)/.test(p.image)) setUrl(p.image);
      else
        void imageUrl(p.image)
          .then((value) => {
            if (active) setUrl(value);
          })
          .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [p.image]);
  return url ? (
    <img src={url} alt={p.name} className={`${cls} shrink-0 rounded-lg object-cover`} />
  ) : (
    <span
      className={`grid ${cls} shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground`}
    >
      <Package className="h-5 w-5" />
    </span>
  );
}
function SoldQuantity({
  p,
  disabled,
  onChange,
}: {
  p: Product;
  disabled: boolean;
  onChange: (n: number) => Promise<boolean>;
}) {
  const [value, setValue] = useState(String(p.sales));
  const [error, setError] = useState("");
  useEffect(() => {
    setValue(String(p.sales));
  }, [p.sales]);
  return (
    <div>
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="secondary"
          title="Decrease quantity sold"
          aria-label={`Decrease quantity sold for ${p.name}`}
          disabled={disabled || p.sales === 0}
          onClick={() => void onChange(p.sales - 1)}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          aria-label={`Quantity sold for ${p.name}`}
          type="number"
          min={0}
          step={1}
          value={value}
          disabled={disabled}
          aria-invalid={!!error}
          className="min-w-0 text-center"
          onChange={async (e) => {
            const raw = e.target.value;
            setValue(raw);
            if (!raw.trim() || !Number.isSafeInteger(Number(raw)) || Number(raw) < 0) {
              setError("Enter a non-negative whole number");
              return;
            }
            setError("");
            if (!(await onChange(Number(raw)))) setValue(String(p.sales));
          }}
          onBlur={() => {
            setValue(String(p.sales));
            setError("");
          }}
        />
        <Button
          size="icon"
          variant="secondary"
          title="Increase quantity sold"
          aria-label={`Increase quantity sold for ${p.name}`}
          disabled={disabled}
          onClick={() => void onChange(p.sales + 1)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
function Products() {
  const c=useCloud();const may=(a:"create"|"edit"|"delete")=>canChange(c.role,c.permissions,"Products",a);
  const products = useStore((s) => s.products);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [img, setImg] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [quantity, setQuantity] = useState("1");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewKey, setViewKey] = useState<string | null>(null);
  const viewing = products.find((p) => productKey(p) === viewKey) ?? null;
  const alerts = products.filter((p) => stockStatus(p.qty) !== "In stock");
  async function mutate(fn: Parameters<typeof saveState>[0], success?: string) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    try {
      await saveState(fn);
      if (success) toast.success(success);
      return true;
    } catch (e) {
      const message =
        e instanceof z.ZodError
          ? e.issues[0]?.message
          : e instanceof Error
            ? e.message
            : "Could not save product";
      toast.error(message ?? "Could not save product");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const changeStock = (p: Product, d: number) =>
    void mutate((s) => ({
      products: s.products.map((x) =>
        productKey(x) === productKey(p) ? { ...x, qty: Math.max(0, x.qty + d) } : x,
      ),
    }));
  const openForm = (p: Product | null) => {
    setEditing(p);
    setImg(p?.image ?? "");
    setName(p?.name ?? "");
    setPrice(String(p?.price ?? 0));
    setQuantity(String(p?.qty ?? 1));
    setFormError("");
    setFormOpen(true);
  };
  return (
    <>
      <PageHeader
        title="Products & inventory"
        actions={
          <Button disabled={busy||!may('create')} onClick={() => openForm(null)}>
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        }
      />
      {alerts.length > 0 && (
        <div className="panel mb-6 flex items-center gap-3 border-warning/40 p-4 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          {alerts.length} products need restocking: {alerts.map((p) => p.name).join(", ")}
        </div>
      )}
      <Panel title="Available Products" className="mb-8">
        <DataTable head={["Product", "Available Quantity", "Unit Price", "Stock", "Edit"]}>
          {products.map((p) => (
            <tr
              key={productKey(p)}
              onClick={() => setViewKey(productKey(p))}
              className="cursor-pointer hover:bg-secondary/50"
            >
              <td className={td}>
                <div className="flex items-center gap-3">
                  <Thumb p={p} />
                  <span className="font-medium">{p.name}</span>
                </div>
              </td>
              <td className={td}>{p.qty}</td>
              <td className={td}>{egp(p.price)}</td>
              <td className={td}>
                <StatusPill status={stockStatus(p.qty)} />
              </td>
              <td className={td}>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Edit product and stock"
                  aria-label={`Edit available ${p.name}`}
                  disabled={busy||!may('edit')}
                  onClick={(e) => {
                    e.stopPropagation();
                    openForm(p);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
      <section className="mb-8" aria-label="Sales">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sales</h2>
          {busy && (
            <Loader2
              aria-label="Saving product"
              className="h-4 w-4 animate-spin text-muted-foreground"
            />
          )}
        </div>
        {products.length === 0 ? (
          <div className="border border-dashed p-8 text-center text-muted-foreground">
            <Package className="mx-auto mb-3 h-8 w-8" />
            <p>No products yet</p>
            <Button variant="secondary" className="mt-4" disabled={!may('create')} onClick={() => openForm(null)}>
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((p) => (
              <article
                key={productKey(p)}
                aria-label={`Sales for ${p.name}`}
                className="panel min-w-0 p-4"
              >
                <div className="flex items-start gap-3">
                  <Thumb p={p} cls="h-16 w-16" />
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-semibold">{p.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Unit Price · {egp(p.price)}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0"
                    title="Edit product"
                    aria-label={`Edit ${p.name}`}
                    disabled={busy||!may('edit')}
                    onClick={() => openForm(p)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <div className="my-4 border-t pt-4">
                  <p className="mb-2 text-sm text-muted-foreground">Quantity Sold</p>
                  <SoldQuantity
                    p={p}
                    disabled={busy||!may('edit')}
                    onChange={(n) =>
                      mutate((s) => ({
                        products: updateSoldQuantity(s.products, productKey(p), n),
                      }))
                    }
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Total Sales</span>
                  <strong className="font-display text-xl text-primary">
                    {egp(totalSales(p))}
                  </strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewKey(null)}>
        <SheetContent>
          {viewing && (
            <>
              <SheetHeader>
                <SheetTitle>{viewing.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-5 px-4">
                <Thumb p={viewing} cls="h-48 w-full" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-surface p-3">
                    <div className="eyebrow">Available Quantity</div>
                    <div className="mt-1 font-display text-2xl">{viewing.qty}</div>
                  </div>
                  <div className="rounded-lg bg-surface p-3">
                    <div className="eyebrow">Price</div>
                    <div className="mt-1 font-display text-2xl">{egp(viewing.price)}</div>
                  </div>
                </div>
                <StatusPill status={stockStatus(viewing.qty)} />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    disabled={busy||!may('edit')}
                    onClick={() => changeStock(viewing, 1)}
                  >
                    <Plus className="h-4 w-4" />
                    Increase
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy || !may('edit') || viewing.qty === 0}
                    onClick={() => changeStock(viewing, -1)}
                  >
                    <Minus className="h-4 w-4" />
                    Decrease
                  </Button>
                  <Button onClick={() => openForm(viewing)}>
                    <Pencil className="h-4 w-4" />
                    Edit product
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <Dialog
        open={formOpen}
        onOpenChange={(o) => {
          if (!busy && !uploading) setFormOpen(o);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy || uploading) return;
              if (!price.trim() || !quantity.trim()) {
                setFormError("Enter a unit price and quantity");
                return;
              }
              const draft: Product = {
                ...(editing ?? { sales: 0, min: 10 }),
                id: editing ? productKey(editing) : generateId(),
                image: img,
                name,
                price: Number(price),
                qty: Number(quantity),
              };
              try {
                saveProduct(products, draft, editing ? productKey(editing) : undefined);
              } catch (error) {
                setFormError(
                  error instanceof z.ZodError
                    ? (error.issues[0]?.message ?? "Check product values")
                    : error instanceof Error
                      ? error.message
                      : "Check product values",
                );
                return;
              }
              const ok = await mutate(
                (s) => ({
                  products: saveProduct(
                    s.products,
                    draft,
                    editing ? productKey(editing) : undefined,
                  ),
                }),
                editing ? "Product updated" : "Product added",
              );
              if (ok) {
                if (editing && viewKey === productKey(editing)) setViewKey(productKey(draft));
                setFormOpen(false);
              }
            }}
          >
            <Field label="Product Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={60}
                disabled={busy||!may('edit')}
              />
            </Field>
            <Field label="Product Image">
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy || uploading || !may(editing?'edit':'create')}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setUploading(true);
                  setFormError("");
                  try {
                    setImg(await uploadImage(f));
                  } catch (error) {
                    setFormError(error instanceof Error ? error.message : "Could not upload image");
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </Field>
            {uploading && (
              <p role="status" className="text-sm text-muted-foreground">
                Uploading image…
              </p>
            )}
            {img && (
              <Thumb
                p={{ name, image: img, price: 0, sales: 0, qty: 0, min: 10 }}
                cls="h-20 w-20"
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Unit Price (${currencyOf()})`}>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={busy||!may('edit')}
                  required
                />
              </Field>
              <Field label="Available Quantity">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={busy||!may('edit')}
                  required
                />
              </Field>
            </div>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            <DialogFooter className="flex-wrap gap-2">
              {editing && may('delete') && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy || uploading || !may(editing?'edit':'create')}
                  onClick={() => {
                    if (editing.sales > 0) {
                      setFormError(
                        "This product has recorded sales and cannot be deleted. Reverse the sales first if they were entered by mistake.",
                      );
                      return;
                    }
                    setConfirmDelete(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                disabled={busy || uploading || !may(editing?'edit':'create')}
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || uploading || !may(editing?'edit':'create')}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmDelete} onOpenChange={(o) => !busy && setConfirmDelete(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete product?</DialogTitle>
          </DialogHeader>
          <p className="break-words text-sm text-muted-foreground">
            Delete {editing?.name}? This cannot be undone. Products with recorded sales cannot be
            deleted.
          </p>
          <DialogFooter>
            <Button variant="secondary" disabled={busy||!may('edit')} onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy||!may('edit')}
              onClick={async () => {
                if (!editing) return;
                const ok = await mutate(
                  (s) => ({
                    products: deleteProduct(s.products, productKey(editing)),
                  }),
                  "Product deleted",
                );
                if (ok) {
                  setConfirmDelete(false);
                  setFormOpen(false);
                  if (viewKey === productKey(editing)) setViewKey(null);
                }
              }}
            >
              {busy ? "Deleting…" : "Delete product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
