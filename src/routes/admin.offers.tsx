import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Tag, Calendar, Percent, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";

// ─── Server Functions ──────────────────────────────────────────────────────────

export const getCouponsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getCoupons } = await import("@/lib/db");
    return await getCoupons();
  },
);

export const addCouponFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      code: string;
      description: string;
      maxUses: number;
      expiry: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { addCoupon } = await import("@/lib/db");
    return await addCoupon(data);
  });

export const deleteCouponFn = createServerFn({ method: "POST" })
  .inputValidator((code: string) => code)
  .handler(async ({ data: code }) => {
    const { deleteCoupon } = await import("@/lib/db");
    return await deleteCoupon(code);
  });

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/offers")({
  component: Offers,
  loader: () => getCouponsFn(),
  head: () => ({ meta: [{ title: "Offers — SPV Export Admin" }] }),
});

// ─── Component ────────────────────────────────────────────────────────────────

function Offers() {
  const router = useRouter();
  const coupons = Route.useLoaderData();
  const [modal, setModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiry, setExpiry] = useState("");

  const handleAddCoupon = async () => {
    if (!code || !description || !maxUses || !expiry) return;
    setIsSubmitting(true);
    try {
      await addCouponFn({
        data: {
          code: code.toUpperCase().trim(),
          description,
          maxUses: Number(maxUses),
          expiry,
        },
      });
      setModal(false);
      setCode("");
      setDescription("");
      setMaxUses("");
      setExpiry("");
      await router.invalidate();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCoupon = async (couponCode: string) => {
    if (confirm(`Delete coupon ${couponCode}?`)) {
      await deleteCouponFn({ data: couponCode });
      await router.invalidate();
    }
  };

  const activeCoupons = coupons.filter((c) => c.active);
  const expiredCoupons = coupons.filter((c) => !c.active);

  return (
    <AdminShell
      title="Offers & Coupons"
      subtitle="Promotions and discount campaigns."
    >
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {activeCoupons.length} active · {expiredCoupons.length} expired
        </div>
        <button
          onClick={() => setModal(true)}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Create coupon
        </button>
      </div>

      {/* Coupon grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {coupons.map((c) => (
          <div
            key={c.code}
            className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-soft"
          >
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    c.active
                      ? "bg-secondary/15 text-secondary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Tag className="h-3 w-3" /> {c.active ? "Active" : "Expired"}
                </span>
                <div className="flex items-center gap-1">
                  <Percent className="h-4 w-4 text-muted-foreground" />
                  <button
                    onClick={() => handleDeleteCoupon(c.code)}
                    className="p-1 rounded-lg hover:bg-destructive/10 text-destructive"
                    title="Delete coupon"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-4 font-mono text-2xl font-bold text-primary">
                {c.code}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {c.description}
              </div>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-gradient-warm transition-all"
                  style={{
                    width: `${Math.min((c.uses / c.maxUses) * 100, 100)}%`,
                  }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {c.uses} / {c.maxUses} uses
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {c.expiry}
                </span>
              </div>
            </div>
          </div>
        ))}
        {coupons.length === 0 && (
          <p className="col-span-3 py-10 text-center text-muted-foreground">
            No coupons yet. Create one!
          </p>
        )}
      </div>

      {/* Create Coupon Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 backdrop-blur-sm p-4"
          onClick={() => setModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-elegant"
          >
            <h3 className="font-display text-2xl font-semibold">
              Create new coupon
            </h3>
            <div className="mt-5 space-y-4">
              <Field
                label="Coupon Code"
                value={code}
                onChange={(e: any) => setCode(e.target.value)}
                placeholder="e.g. SUMMER25"
                className="font-mono"
              />
              <Field
                label="Description"
                value={description}
                onChange={(e: any) => setDescription(e.target.value)}
                placeholder="e.g. 25% off all orders"
              />
              <Field
                label="Max Uses"
                type="number"
                value={maxUses}
                onChange={(e: any) => setMaxUses(e.target.value)}
                placeholder="e.g. 500"
              />
              <Field
                label="Expiry Date"
                value={expiry}
                onChange={(e: any) => setExpiry(e.target.value)}
                placeholder="e.g. Dec 31, 2026"
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setModal(false)}
                className="rounded-full border px-5 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCoupon}
                disabled={
                  isSubmitting || !code || !description || !maxUses || !expiry
                }
                className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:opacity-50"
              >
                {isSubmitting ? "Creating…" : "Create coupon"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function Field({ label, className = "", ...p }: any) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        {...p}
        className={`mt-1 w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary ${className}`}
      />
    </label>
  );
}
