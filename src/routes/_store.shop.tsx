import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { ProductCard } from "@/components/client/ProductCard";
import turmericImg from "@/assets/turmeric.jpg";
import chilliImg from "@/assets/chilli.jpg";
import cardamomImg from "@/assets/cardamom.jpg";

const CATEGORY_IMAGES: Record<string, string> = {
  Turmeric: turmericImg,
  Chilli: chilliImg,
  Cardamom: cardamomImg,
};

export const getShopProductsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getProducts } = await import("@/lib/db");
    return await getProducts();
  },
);

export const Route = createFileRoute("/_store/shop")({
  component: Shop,
  loader: () => getShopProductsFn(),
  staleTime: 0,
  validateSearch: (
    s: Record<string, unknown>,
  ): { cat?: string; q?: string; sort?: string } => ({
    cat: s.cat as string | undefined,
    q: s.q as string | undefined,
    sort: s.sort as string | undefined,
  }),
  head: () => ({ meta: [{ title: "Shop — spvexport.com" }] }),
});

function Shop() {
  const products = Route.useLoaderData();
  const {
    cat = "All",
    q: searchQ = "",
    sort: searchSort = "popular",
  } = Route.useSearch();
  const [q, setQ] = useState(searchQ);
  const [sort, setSort] = useState(searchSort);
  const [activeCat, setActiveCat] = useState(cat);

  useEffect(() => {
    setQ(searchQ);
  }, [searchQ]);

  useEffect(() => {
    setSort(searchSort);
  }, [searchSort]);

  useEffect(() => {
    setActiveCat(cat);
  }, [cat]);

  const list = useMemo(() => {
    let l = products.filter(
      (p) =>
        (activeCat === "All" || p.category === activeCat) &&
        (q === "" || p.name.toLowerCase().includes(q.toLowerCase())),
    );
    if (sort === "price-asc") l = [...l].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") l = [...l].sort((a, b) => b.price - a.price);
    if (sort === "rating") l = [...l].sort((a, b) => b.rating - a.rating);
    return l;
  }, [activeCat, q, sort]);

  const cats = ["All", "Turmeric", "Chilli", "Cardamom"];

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Collection
        </p>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">
          The Spice Library
        </h1>
        <p className="text-muted-foreground">
          {list.length} premium products, freshly milled.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                activeCat === c
                  ? "bg-foreground text-background border-foreground"
                  : "hover:border-primary"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search spices"
              className="rounded-full border bg-background pl-9 pr-4 py-2 text-sm outline-none focus:border-primary w-56"
            />
          </div>
          <div className="relative">
            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-full border bg-background pl-9 pr-4 py-2 text-sm outline-none focus:border-primary appearance-none"
            >
              <option value="popular">Popular</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Top rated</option>
            </select>
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="mt-20 text-center py-16 border rounded-3xl bg-card/30 border-dashed max-w-lg mx-auto flex flex-col items-center">
          <p className="font-display text-2xl font-semibold">
            No spices in the library
          </p>
          <p className="mt-2 text-muted-foreground text-sm px-6 max-w-md">
            {products.length === 0
              ? "We are currently stocking up our fresh organic spices. Please check back shortly."
              : "No products match your current filters or search criteria."}
          </p>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <ProductCard
              key={p.id}
              p={{ ...p, image: p.image || CATEGORY_IMAGES[p.category] }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
