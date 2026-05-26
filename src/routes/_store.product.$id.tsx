import {
  createFileRoute,
  Link,
  notFound,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Minus,
  Plus,
  Star,
  Truck,
  ShieldCheck,
  Leaf,
  X,
} from "lucide-react";
import { createWhatsAppUrl } from "@/lib/constants";
import { toast } from "sonner";
import { ProductCard } from "@/components/client/ProductCard";
import type { Product } from "@/lib/products";

export const getClientProductFn = createServerFn({ method: "GET" })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { getProducts } = await import("@/lib/db");
    const all = (await getProducts()) as Product[];
    const p = all.find((x: Product) => x.id === id);
    return { product: p || null, all };
  });

export const submitRatingFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { productId: string; rating: number; review: string }) => data,
  )
  .handler(async ({ data }) => {
    const { getProducts, updateProduct } = await import("@/lib/db");
    const products = (await getProducts()) as Product[];
    const product = products.find((p: Product) => p.id === data.productId);

    if (!product) throw new Error("Product not found");

    // Calculate new average rating
    const totalRating = product.rating * product.reviews + data.rating;
    const newReviews = product.reviews + 1;
    const newRating = parseFloat((totalRating / newReviews).toFixed(1));

    // Update product
    await updateProduct(data.productId, {
      rating: newRating,
      reviews: newReviews,
    });

    return { success: true, newRating, newReviews };
  });

export const Route = createFileRoute("/_store/product/$id")({
  component: ProductDetail,
  loader: async ({ params }) => {
    const res = await getClientProductFn({ data: params.id });
    if (!res.product) throw notFound();
    return { product: res.product, all: res.all };
  },
  staleTime: 0,
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-32 text-center">
      <h1 className="font-display text-3xl">Product not found</h1>
      <Link to="/shop" className="mt-4 inline-block text-primary underline">
        Back to shop
      </Link>
    </div>
  ),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.product.name} — spvexport.com` }],
  }),
});

function ProductDetail() {
  const { product: p, all } = Route.useLoaderData();
  const [qty, setQty] = useState(1);
  const whatsappUrl = createWhatsAppUrl(
    `Hello, I would like to order ${qty} unit${qty > 1 ? "s" : ""} of ${p.name} from your spice catalog. Please share availability and pricing.`,
  );
  const related = (all as Product[])
    .filter((x: Product) => x.id !== p.id)
    .slice(0, 3);

  // Rating form state
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const handleSubmitRating = async () => {
    if (!reviewText.trim()) {
      toast.error("Please write a review");
      return;
    }

    setIsSubmittingRating(true);
    try {
      await submitRatingFn({
        data: {
          productId: p.id,
          rating: ratingValue,
          review: reviewText,
        },
      });
      toast.success("Thank you! Your rating has been submitted");
      setShowRatingModal(false);
      setReviewText("");
      setRatingValue(5);
      // Refresh the page to see updated rating
      window.location.reload();
    } catch (err) {
      toast.error("Failed to submit rating");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-6 sm:py-10">
      <nav className="text-xs text-muted-foreground overflow-x-auto">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>{" "}
        /{" "}
        <Link to="/shop" className="hover:text-foreground">
          Shop
        </Link>{" "}
        / <span className="text-foreground line-clamp-1">{p.name}</span>
      </nav>

      <div className="mt-6 grid gap-6 sm:gap-10 lg:grid-cols-2">
        <div className="grid gap-2 sm:gap-3">
          <div className="overflow-hidden rounded-2xl sm:rounded-3xl bg-card shadow-soft aspect-square">
            <img
              key={p.image}
              src={p.image}
              alt={p.name}
              width={1024}
              height={1024}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-square overflow-hidden rounded-lg sm:rounded-xl border bg-card"
              >
                <img
                  key={p.image}
                  src={p.image}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover opacity-80 hover:opacity-100 transition"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          {p.badge && (
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
              {p.badge}
            </span>
          )}
          <div>
            <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-semibold">
              {p.name}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground">{p.tagline}</p>
          </div>
          {p.rating > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 fill-primary text-primary" />
                <span className="font-semibold">{p.rating}</span>
                <span className="text-muted-foreground">
                  ({p.reviews} reviews)
                </span>
              </div>
              <button
                onClick={() => setShowRatingModal(true)}
                className="text-xs text-primary underline hover:no-underline text-left sm:text-right"
              >
                Share your experience
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
            <span className="font-display text-3xl sm:text-4xl font-semibold">
              ₹{p.price}
            </span>
            {p.oldPrice && (
              <span className="text-base sm:text-lg text-muted-foreground line-through">
                ₹{p.oldPrice}
              </span>
            )}
            {p.oldPrice && (
              <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-xs font-bold text-secondary">
                {Math.round((1 - p.price / p.oldPrice) * 100)}% off
              </span>
            )}
          </div>

          <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
            {p.description}
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="inline-flex items-center rounded-full border bg-card w-fit">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="p-2 sm:p-3 hover:bg-accent/10 rounded-l-full"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="px-3 sm:px-4 font-semibold tabular-nums">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="p-2 sm:p-3 hover:bg-accent/10 rounded-r-full"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              <div className="font-semibold">{p.stock} in stock</div>
              <div className="text-muted-foreground">
                Available: {p.quantity}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 sm:px-7 py-3 sm:py-3.5 text-sm font-semibold text-background hover:opacity-90 transition"
            >
              Order on WhatsApp
            </a>
          </div>

          <div className="mt-6 sm:mt-8 grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-3 text-xs">
            <Feature icon={Truck} t="Free delivery" d="Over ₹499" />
            <Feature icon={ShieldCheck} t="Lab tested" d="FSSAI certified" />
            <Feature icon={Leaf} t="100% organic" d="Farm direct" />
          </div>

          <div className="mt-6 sm:mt-8 rounded-2xl border bg-card p-4 sm:p-5">
            <div className="text-sm font-semibold">Ingredients</div>
            <ul className="mt-2 text-xs sm:text-sm text-muted-foreground space-y-1">
              {p.ingredients.map((i: string) => (
                <li key={i}>· {i}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <section className="mt-12 sm:mt-20">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold">
          You might also love
        </h2>
        <div className="mt-6 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((r) => (
            <ProductCard key={r.id} p={r} />
          ))}
        </div>
      </section>

      {/* Rating Modal */}
      {showRatingModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 backdrop-blur-sm p-4"
          onClick={() => setShowRatingModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-card p-5 sm:p-6 shadow-elegant max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl sm:text-2xl font-semibold truncate">
                Rate {p.name}
              </h3>
              <button
                onClick={() => setShowRatingModal(false)}
                className="p-1 rounded-lg hover:bg-muted/40 flex-shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="text-xs text-muted-foreground">
                Your Rating
              </label>
              <div className="mt-2 flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRatingValue(star)}
                    className="text-2xl sm:text-3xl transition hover:scale-110"
                  >
                    <Star
                      className={`h-6 sm:h-8 w-6 sm:w-8 ${star <= ratingValue ? "fill-primary text-primary" : "text-muted-foreground"}`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-muted-foreground">
                Your Review (optional but helpful!)
              </label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your experience with this product..."
                rows={4}
                className="mt-2 w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRatingModal(false)}
                className="rounded-full border px-5 py-2 text-sm font-semibold hover:bg-muted/20"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRating}
                disabled={isSubmittingRating}
                className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
              >
                {isSubmittingRating ? "Submitting..." : "Submit Rating"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Feature({ icon: Icon, t, d }: any) {
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-card p-3">
      <Icon className="h-4 w-4 text-primary" />
      <div>
        <div className="font-semibold">{t}</div>
        <div className="text-muted-foreground">{d}</div>
      </div>
    </div>
  );
}
