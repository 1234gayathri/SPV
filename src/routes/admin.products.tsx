import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Search, Edit3, Trash2, ImagePlus, X, Check } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { Product } from "@/lib/products";

// ─── Server Functions ──────────────────────────────────────────────────────────

export const getProductsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getProducts } = await import("@/lib/db");
    return await getProducts();
  },
);

export const addProductFn = createServerFn({ method: "POST" })
  .inputValidator((data: Omit<Product, "id">) => data)
  .handler(async ({ data }) => {
    const { addProduct } = await import("@/lib/db");
    return await addProduct(data);
  });

export const updateProductFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; updates: Partial<Product> }) => data)
  .handler(async ({ data }) => {
    const { updateProduct } = await import("@/lib/db");
    return await updateProduct(data.id, data.updates);
  });

export const deleteProductFn = createServerFn({ method: "POST" })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { deleteProduct } = await import("@/lib/db");
    return await deleteProduct(id);
  });

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/products")({
  component: ProductsPage,
  loader: () => getProductsFn(),
  head: () => ({ meta: [{ title: "Products — SPV Export Admin" }] }),
});

// ─── Component ────────────────────────────────────────────────────────────────

function ProductsPage() {
  const router = useRouter();
  const products = Route.useLoaderData();

  // Filters
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");

  // Add modal
  const [modal, setModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit modal
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // Add form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Turmeric");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [quantity, setQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [tagline, setTagline] = useState("");
  const [image, setImage] = useState("");

  const list = products.filter((p) => {
    const matchQ =
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.category.toLowerCase().includes(q.toLowerCase());
    const matchCat =
      categoryFilter === "All categories" || p.category === categoryFilter;
    return matchQ && matchCat;
  });

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string) => void,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setter(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const openAdd = () => {
    setName("");
    setCategory("Turmeric");
    setPrice("");
    setStock("");
    setQuantity("");
    setDescription("");
    setTagline("");
    setImage("");
    setModal(true);
  };

  const handleAddProduct = async () => {
    if (!name || !price || !stock) return;
    setIsSubmitting(true);
    try {
      await addProductFn({
        data: {
          name,
          category: category as Product["category"],
          price: Number(price),
          stock: Number(stock),
          quantity: quantity || undefined,
          description,
          tagline,
          rating: 0,
          reviews: 0,
          image: image || "https://via.placeholder.com/150",
          ingredients: [],
        },
      });
      setModal(false);
      await router.invalidate();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSave = async () => {
    if (!editProduct) return;
    setIsEditSubmitting(true);
    try {
      await updateProductFn({
        data: { id: editProduct.id, updates: editProduct },
      });
      setEditProduct(null);
      await router.invalidate();
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this product permanently?")) {
      await deleteProductFn({ data: id });
      await router.invalidate();
    }
  };

  return (
    <AdminShell
      title="Products"
      subtitle="Manage your catalog, stock and pricing."
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded-full border bg-card pl-9 pr-4 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-full border bg-card px-4 py-2 text-sm outline-none"
        >
          <option>All categories</option>
          <option>Turmeric</option>
          <option>Chilli</option>
          <option>Cardamom</option>
        </select>
        <button
          onClick={openAdd}
          className="ml-auto inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add product
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Product</th>
              <th className="px-5 py-3 text-left font-medium">Category</th>
              <th className="px-5 py-3 text-left font-medium">Price</th>
              <th className="px-5 py-3 text-left font-medium">Quantity</th>
              <th className="px-5 py-3 text-left font-medium">Stock</th>
              <th className="px-5 py-3 text-left font-medium">Rating</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t hover:bg-muted/20 transition">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={p.image}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://via.placeholder.com/40";
                      }}
                    />
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.tagline}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">{p.category}</td>
                <td className="px-5 py-3 font-semibold">₹{p.price}</td>
                <td className="px-5 py-3">{p.quantity ?? 0}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      p.stock > 50
                        ? "bg-secondary/15 text-secondary"
                        : p.stock > 20
                          ? "bg-primary/15 text-primary"
                          : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {p.stock} units
                  </span>
                </td>
                <td className="px-5 py-3">
                  {p.rating ? `★ ${p.rating}` : "—"}
                </td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setEditProduct({ ...p })}
                      className="p-2 rounded-lg hover:bg-accent/10"
                      title="Edit"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center text-muted-foreground"
                >
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add Product Modal ── */}
      {modal && (
        <Modal title="Add new product" onClose={() => setModal(false)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Product name"
              value={name}
              onChange={(e: any) => setName(e.target.value)}
              className="sm:col-span-2"
            />
            <label className="block">
              <span className="text-xs text-muted-foreground">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              >
                <option value="Turmeric">Turmeric</option>
                <option value="Chilli">Chilli</option>
                <option value="Cardamom">Cardamom</option>
              </select>
            </label>
            <Field
              label="Price (₹)"
              type="number"
              value={price}
              onChange={(e: any) => setPrice(e.target.value)}
            />
            <Field
              label="Stock"
              type="number"
              value={stock}
              onChange={(e: any) => setStock(e.target.value)}
            />
            <Field
              label="Quantity"
              type="text"
              value={quantity}
              onChange={(e: any) => setQuantity(e.target.value)}
            />
            <Field
              label="Tagline"
              value={tagline}
              onChange={(e: any) => setTagline(e.target.value)}
              className="sm:col-span-2"
            />
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">
                Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">Image</label>
              <div className="mt-1 relative flex items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/30 py-10 text-sm text-muted-foreground hover:bg-muted/50 transition cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, setImage)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                {image ? (
                  <img
                    src={image}
                    alt="Preview"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <>
                    <ImagePlus className="mr-2 h-5 w-5" /> Click to upload or
                    drag & drop
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => setModal(false)}
              className="rounded-full border px-5 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleAddProduct}
              disabled={isSubmitting || !name || !price || !stock}
              className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              {isSubmitting ? "Saving…" : "Save product"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit Product Modal ── */}
      {editProduct && (
        <Modal title="Edit product" onClose={() => setEditProduct(null)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Product name"
              value={editProduct.name}
              onChange={(e: any) =>
                setEditProduct({ ...editProduct, name: e.target.value })
              }
              className="sm:col-span-2"
            />
            <label className="block">
              <span className="text-xs text-muted-foreground">Category</span>
              <select
                value={editProduct.category}
                onChange={(e) =>
                  setEditProduct({
                    ...editProduct,
                    category: e.target.value as Product["category"],
                  })
                }
                className="mt-1 w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              >
                <option value="Turmeric">Turmeric</option>
                <option value="Chilli">Chilli</option>
                <option value="Cardamom">Cardamom</option>
              </select>
            </label>
            <Field
              label="Price (₹)"
              type="number"
              value={String(editProduct.price)}
              onChange={(e: any) =>
                setEditProduct({
                  ...editProduct,
                  price: Number(e.target.value),
                })
              }
            />
            <Field
              label="Stock"
              type="number"
              value={String(editProduct.stock)}
              onChange={(e: any) =>
                setEditProduct({
                  ...editProduct,
                  stock: Number(e.target.value),
                })
              }
            />
            <Field
              label="Quantity"
              type="text"
              value={String(editProduct.quantity ?? "")}
              onChange={(e: any) =>
                setEditProduct({ ...editProduct, quantity: e.target.value })
              }
            />
            <Field
              label="Tagline"
              value={editProduct.tagline}
              onChange={(e: any) =>
                setEditProduct({ ...editProduct, tagline: e.target.value })
              }
              className="sm:col-span-2"
            />
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">
                Description
              </label>
              <textarea
                rows={3}
                value={editProduct.description}
                onChange={(e) =>
                  setEditProduct({
                    ...editProduct,
                    description: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">Image</label>
              <div className="mt-1 relative flex items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/30 py-10 text-sm text-muted-foreground hover:bg-muted/50 transition cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleImageUpload(e, (v) =>
                      setEditProduct((prev) =>
                        prev ? { ...prev, image: v } : null,
                      ),
                    )
                  }
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                {editProduct.image ? (
                  <img
                    src={editProduct.image}
                    alt="Preview"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <>
                    <ImagePlus className="mr-2 h-5 w-5" /> Click to change image
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => setEditProduct(null)}
              className="rounded-full border px-5 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleEditSave}
              disabled={isEditSubmitting}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {isEditSubmitting ? "Saving…" : "Save changes"}
            </button>
          </div>
        </Modal>
      )}
    </AdminShell>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card p-6 shadow-elegant"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-2xl font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted/40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, className = "", ...p }: any) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        {...p}
        className="mt-1 w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
