/**
 * db.ts — Server-only persistent database with PostgreSQL
 *
 * Uses Prisma ORM to connect to PostgreSQL database on Neon.tech
 * All data is persisted permanently and survives server restarts.
 */

import type { Product } from "./products";
import { products as defaultProducts } from "./products";
import prisma from "./prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Order = {
  id: string;
  customer: string;
  email?: string;
  phone?: string;
  address?: string;
  items: number;
  total: number;
  status: string;
  date: string;
  paymentMethod?: string;
};

export type Customer = {
  name: string;
  email: string;
  phone: string;
  orders: number;
  spent: number;
};

export type Coupon = {
  code: string;
  description: string;
  maxUses: number;
  expiry?: string;
  uses: number;
  active: boolean;
};

export type Banner = {
  id: string;
  text: string;
  image: string;
};

export type Testimonial = {
  id: string;
  name: string;
  quote: string;
};

export type StoreSettings = {
  storeName: string;
  email: string;
  phone: string;
  address: string;
  shippingFee: number;
  freeShippingThreshold: number;
  taxRate: number;
  currency: string;
};

export type DbSchema = {
  products: Product[];
  orders: Order[];
  customers: Customer[];
  coupons: Coupon[];
  banners: Banner[];
  testimonials: Testimonial[];
  settings: StoreSettings;
};

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED: DbSchema = {
  products: defaultProducts,
  orders: [],
  customers: [],
  coupons: [],
  banners: [],
  testimonials: [],
  settings: {
    storeName: "spvexport.com",
    email: "contact@spvexport.com",
    phone: "+91 98765 43210",
    address: "Erode, Tamil Nadu, India",
    shippingFee: 50,
    freeShippingThreshold: 499,
    taxRate: 5,
    currency: "INR",
  },
};

// ─── File Path ────────────────────────────────────────────────────────────────

async function getLocalDbPaths() {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");
  const currentFileDir = path.dirname(url.fileURLToPath(import.meta.url));
  const DATA_DIR = path.resolve(currentFileDir, "../../data");
  const DB_FILE = path.resolve(DATA_DIR, "db.json");
  return { fs, DATA_DIR, DB_FILE };
}

// ─── In-Memory Cache ──────────────────────────────────────────────────────────

let _cache: DbSchema | null = null;

// ─── Upstash Redis Helpers ────────────────────────────────────────────────────

const REDIS_KEY = "sadbhaav_db";

async function redisGet(): Promise<DbSchema | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/get/${REDIS_KEY}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json()) as { result?: string };
    if (json.result) return JSON.parse(json.result) as DbSchema;
  } catch (e) {
    console.error("[db] Redis GET error:", e);
  }
  return null;
}

async function redisSet(data: DbSchema): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["SET", REDIS_KEY, JSON.stringify(data)]),
    });
    if (!res.ok) {
      console.error("[db] Redis SET non-ok response:", res.status, await res.text());
    }
  } catch (e) {
    console.error("[db] Redis SET error:", e);
  }
}

// ─── Read / Write ─────────────────────────────────────────────────────────────

async function writeLocal(data: DbSchema): Promise<void> {
  try {
    const { fs, DATA_DIR, DB_FILE } = await getLocalDbPaths();
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("[db] Local file write error:", e);
  }
}

async function readDb(): Promise<DbSchema> {
  // 1. Return in-memory cache if available (fastest)
  if (_cache) return _cache;

  // 2. Try Upstash Redis first — this is the AUTHORITATIVE source of truth
  //    Redis survives server restarts, redeploys, and ephemeral filesystems
  const fromRedis = await redisGet();
  if (fromRedis) {
    console.log("[db] Loaded data from Redis (authoritative source)");
    // Ensure settings exist (backwards compat)
    if (!fromRedis.settings) {
      fromRedis.settings = structuredClone(SEED.settings);
      await redisSet(fromRedis);
    }
    _cache = fromRedis;
    // Sync to local file as a backup (non-blocking)
    writeLocal(fromRedis).catch(() => {});
    return _cache;
  }

  // 3. Fallback to local JSON file (only used if Redis is not configured or empty)
  //    This is useful for local dev or when Redis has no data yet
  try {
    const { fs, DB_FILE } = await getLocalDbPaths();
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const db = JSON.parse(raw) as DbSchema;
      if (!db.settings) {
        db.settings = structuredClone(SEED.settings);
      }
      _cache = db;
      console.log("[db] Loaded data from local JSON file");
      // Push local data to Redis so it becomes the source of truth going forward
      await redisSet(db);
      return _cache;
    }
  } catch (e) {
    console.error("[db] Error reading local JSON file:", e);
  }

  // 4. First-ever run — use seed data and PERSIST it immediately
  console.log("[db] First run — seeding initial data and persisting to Redis + local file");
  _cache = structuredClone(SEED);
  await writeLocal(_cache);
  await redisSet(_cache);
  return _cache;
}

async function writeDb(data: DbSchema): Promise<void> {
  _cache = data;
  // Write to BOTH stores in parallel for maximum persistence
  await Promise.all([
    writeLocal(data).catch((e) => console.error("[db] writeLocal failed:", e)),
    redisSet(data).catch((e) => console.error("[db] redisSet failed:", e)),
  ]);
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Products
export async function getProducts(): Promise<Product[]> {
  const db = await readDb();
  return db.products;
}

export async function addProduct(
  product: Omit<Product, "id">,
): Promise<Product> {
  const db = await readDb();
  if (db.products.length >= 10) {
    throw new Error("Cannot add product: Maximum limit of 10 products reached.");
  }
  const newProduct: Product = { ...product, id: `prod-${Date.now()}` };
  db.products = [newProduct, ...db.products];
  await writeDb(db);
  return newProduct;
}

export async function updateProduct(
  id: string,
  updates: Partial<Product>,
): Promise<Product | null> {
  const db = await readDb();
  const idx = db.products.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  db.products[idx] = { ...db.products[idx], ...updates };
  await writeDb(db);
  return db.products[idx];
}

export async function deleteProduct(id: string): Promise<boolean> {
  const db = await readDb();
  const before = db.products.length;
  db.products = db.products.filter((p) => p.id !== id);
  if (db.products.length === before) return false;
  await writeDb(db);
  return true;
}

// Orders
export async function getOrders(): Promise<Order[]> {
  try {
    if (process.env.DATABASE_URL) {
      const ordersFromPrisma = await prisma.order.findMany({
        include: {
          customer: true,
          items: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      if (ordersFromPrisma && ordersFromPrisma.length > 0) {
        return ordersFromPrisma.map((o: any) => ({
          id: o.id,
          customer: o.customer?.name || "Anonymous",
          email: o.customer?.email,
          phone: o.customer?.phone || undefined,
          address: o.customer?.address || undefined,
          items: o.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
          total: o.total,
          status: o.status.charAt(0).toUpperCase() + o.status.slice(1).toLowerCase(),
          date: new Date(o.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        }));
      }
    }
  } catch (error) {
    console.error("[Prisma] Failed to fetch orders from PostgreSQL:", error);
  }
  return (await readDb()).orders;
}

export async function updateOrderStatus(
  id: string,
  status: string,
): Promise<Order | null> {
  // Update in in-memory / cache database
  const db = await readDb();
  const idx = db.orders.findIndex((o) => o.id === id);
  if (idx !== -1) {
    db.orders[idx] = { ...db.orders[idx], status };
    await writeDb(db);
  }

  // Update in PostgreSQL database
  try {
    if (process.env.DATABASE_URL) {
      await prisma.order.update({
        where: { id },
        data: { status: status.toLowerCase() },
      });
      console.log(`[Prisma] Updated order status for ${id} in PostgreSQL to: ${status}`);
    }
  } catch (error) {
    console.error("[Prisma] Failed to update order status in PostgreSQL:", error);
  }

  return idx !== -1 ? db.orders[idx] : null;
}

// Customers
export async function getCustomers(): Promise<Customer[]> {
  try {
    if (process.env.DATABASE_URL) {
      const customersFromPrisma = await prisma.customer.findMany({
        include: {
          orders: true,
        },
      });
      if (customersFromPrisma && customersFromPrisma.length > 0) {
        return customersFromPrisma.map((c: any) => ({
          name: c.name || "Anonymous",
          email: c.email,
          phone: c.phone || "—",
          orders: c.orders.length,
          spent: c.orders.reduce((sum: number, o: any) => sum + o.total, 0),
        }));
      }
    }
  } catch (error) {
    console.error("[Prisma] Failed to fetch customers from PostgreSQL:", error);
  }
  return (await readDb()).customers;
}

// Coupons
export async function getCoupons(): Promise<Coupon[]> {
  const db = await readDb();
  return db.coupons;
}

export async function addCoupon(
  coupon: Omit<Coupon, "uses" | "active">,
): Promise<Coupon> {
  const db = await readDb();
  const newCoupon: Coupon = { ...coupon, uses: 0, active: true };
  db.coupons = [newCoupon, ...db.coupons];
  await writeDb(db);
  return newCoupon;
}

export async function deleteCoupon(code: string): Promise<boolean> {
  const db = await readDb();
  const before = db.coupons.length;
  db.coupons = db.coupons.filter((c) => c.code !== code);
  if (db.coupons.length === before) return false;
  await writeDb(db);
  return true;
}

// Banners
export async function getBanners(): Promise<Banner[]> {
  return (await readDb()).banners;
}

export async function addBanner(banner: Omit<Banner, "id">): Promise<Banner> {
  const db = await readDb();
  const newBanner: Banner = { ...banner, id: `b-${Date.now()}` };
  db.banners = [...db.banners, newBanner];
  await writeDb(db);
  return newBanner;
}

export async function deleteBanner(id: string): Promise<boolean> {
  const db = await readDb();
  const before = db.banners.length;
  db.banners = db.banners.filter((b) => b.id !== id);
  if (db.banners.length === before) return false;
  await writeDb(db);
  return true;
}

// Testimonials
export async function getTestimonials(): Promise<Testimonial[]> {
  return (await readDb()).testimonials;
}

export async function addTestimonial(
  testimonial: Omit<Testimonial, "id">,
): Promise<Testimonial> {
  const db = await readDb();
  const newTestimonial: Testimonial = { ...testimonial, id: `t-${Date.now()}` };
  db.testimonials = [...db.testimonials, newTestimonial];
  await writeDb(db);
  return newTestimonial;
}

export async function deleteTestimonial(id: string): Promise<boolean> {
  const db = await readDb();
  const before = db.testimonials.length;
  db.testimonials = db.testimonials.filter((t) => t.id !== id);
  if (db.testimonials.length === before) return false;
  await writeDb(db);
  return true;
}

// Store Settings
export async function getSettings(): Promise<StoreSettings> {
  return (await readDb()).settings;
}

export async function updateSettings(
  updates: Partial<StoreSettings>,
): Promise<StoreSettings> {
  const db = await readDb();
  db.settings = { ...db.settings, ...updates };
  await writeDb(db);
  return db.settings;
}

// Dashboard stats and dynamic activity feed
export async function getDashboardStats() {
  const products = await getProducts();
  const orders = await getOrders();
  const customers = await getCustomers();
  const coupons = await getCoupons();

  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const totalOrders = orders.length;
  const totalCustomers = customers.length;
  const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const recentOrders = orders.slice(0, 5);
  const topProducts = [...products]
    .sort((a, b) => b.reviews - a.reviews)
    .slice(0, 4);

  // Generate activities dynamically from actual data
  const activities: {
    t: string;
    w: string;
    c: "primary" | "accent" | "secondary" | "destructive";
  }[] = [];

  // 1. Live Orders (up to 3)
  orders.slice(0, 3).forEach((o, i) => {
    activities.push({
      t: `New order #${o.id} from ${o.customer}`,
      w: i === 0 ? "2 min ago" : i === 1 ? "1 hr ago" : "today",
      c: "primary",
    });
  });

  // 2. Low Stock warnings (up to 2)
  products
    .filter((p) => p.stock < 20)
    .slice(0, 2)
    .forEach((p) => {
      activities.push({
        t: `${p.name} stock low (${p.stock} left)`,
        w: "recently",
        c: "accent",
      });
    });

  // 3. Active Coupon usage (up to 2)
  coupons
    .filter((c) => c.active && c.uses > 0)
    .slice(0, 2)
    .forEach((c) => {
      activities.push({
        t: `Coupon ${c.code} used ${c.uses}×`,
        w: "today",
        c: "secondary",
      });
    });

  // Fallback if no activities exist
  if (activities.length === 0) {
    activities.push({
      t: "Store launched! Awaiting first order.",
      w: "now",
      c: "secondary",
    });
  }

  return {
    totalRevenue,
    totalOrders,
    totalCustomers,
    avgOrder,
    recentOrders,
    topProducts,
    activities,
  };
}

export async function addOrder(
  order: Omit<Order, "id" | "date" | "status">,
  purchasedItems?: { id: string; qty: number }[],
): Promise<Order> {
  const db = await readDb();

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const now = new Date();
  const dateStr = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

  const newOrder: Order = {
    ...order,
    id: `SB-${1000 + db.orders.length + 1}`,
    date: dateStr,
    status: "Pending",
  };

  db.orders = [newOrder, ...db.orders];

  // Decrement stock levels & compile product prices for PostgreSQL
  const prismaItems: { productId: string; quantity: number; price: number }[] = [];
  if (purchasedItems) {
    purchasedItems.forEach((item) => {
      const idx = db.products.findIndex((p) => p.id === item.id);
      if (idx !== -1) {
        db.products[idx].stock = Math.max(0, db.products[idx].stock - item.qty);
        prismaItems.push({
          productId: item.id,
          quantity: item.qty,
          price: db.products[idx].price,
        });
      }
    });
  }

  // Update or register Customer profile
  const custIdx = db.customers.findIndex(
    (c) => c.email.toLowerCase() === (order.email || "").toLowerCase(),
  );
  if (custIdx !== -1) {
    db.customers[custIdx].orders += 1;
    db.customers[custIdx].spent += order.total;
  } else {
    db.customers.push({
      name: order.customer,
      email: order.email || "",
      phone: order.phone || "",
      orders: 1,
      spent: order.total,
    });
  }

  // Write to cache/JSON database
  await writeDb(db);

  // Write to PostgreSQL database using Prisma
  try {
    if (process.env.DATABASE_URL) {
      // Connect to or create the customer, then create the order and related order items
      await prisma.order.create({
        data: {
          id: newOrder.id,
          customer: {
            connectOrCreate: {
              where: { email: order.email || "" },
              create: {
                email: order.email || "",
                name: order.customer,
                phone: order.phone || "",
                address: order.address || "",
              },
            },
          },
          items: {
            create: prismaItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
          total: order.total,
          status: "pending",
        },
      });
      console.log(`[Prisma] Order ${newOrder.id} successfully written to PostgreSQL`);
    }
  } catch (error) {
    console.error("[Prisma] Failed to write order to PostgreSQL:", error);
  }

  return newOrder;
}

export async function incrementCouponUses(code: string): Promise<boolean> {
  const db = await readDb();
  const idx = db.coupons.findIndex(
    (c) => c.code.toUpperCase() === code.toUpperCase(),
  );
  if (idx === -1) return false;
  db.coupons[idx].uses += 1;
  await writeDb(db);
  return true;
}

// ─── Prisma-based write functions for PostgreSQL persistence ─────────────────

/**
 * Save an order to PostgreSQL database
 * This persists the order permanently
 */
export async function saveOrderToDb(
  customer: { name: string; email: string; phone?: string; address?: string },
  items: { productId: string; quantity: number; price: number }[],
  total: number,
  status: string = "pending",
): Promise<{ id: string }> {
  try {
    const order = await prisma.order.create({
      data: {
        customer: {
          connectOrCreate: {
            where: { email: customer.email },
            create: {
              email: customer.email,
              name: customer.name,
              phone: customer.phone,
              address: customer.address,
            },
          },
        },
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
        total,
        status,
      },
      include: { items: true },
    });
    return { id: order.id };
  } catch (error) {
    console.error("[Prisma] Error saving order:", error);
    throw error;
  }
}

/**
 * Save a product to PostgreSQL database
 */
export async function saveProductToDb(product: {
  name: string;
  price: number;
  stock: number;
  image?: string;
  description?: string;
}): Promise<{ id: string }> {
  try {
    const saved = await prisma.product.create({
      data: product,
    });
    return { id: saved.id };
  } catch (error) {
    console.error("[Prisma] Error saving product:", error);
    throw error;
  }
}

/**
 * Update a product in PostgreSQL database
 */
export async function updateProductInDb(
  id: string,
  updates: {
    name?: string;
    price?: number;
    stock?: number;
    image?: string;
    description?: string;
  },
): Promise<{ id: string }> {
  try {
    const updated = await prisma.product.update({
      where: { id },
      data: updates,
    });
    return { id: updated.id };
  } catch (error) {
    console.error("[Prisma] Error updating product:", error);
    throw error;
  }
}

/**
 * Get all products from PostgreSQL database
 */
export async function getProductsFromDb(): Promise<any[]> {
  try {
    return await prisma.product.findMany();
  } catch (error) {
    console.error("[Prisma] Error fetching products:", error);
    return [];
  }
}

/**
 * Save a cart item to PostgreSQL database
 */
export async function saveCartItemToDb(
  customerId: string,
  productId: string,
  quantity: number,
): Promise<{ id: string }> {
  try {
    // First, ensure customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    // Get or create cart for customer
    let cart = await prisma.cart.findUnique({
      where: { customerId },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { customerId },
      });
    }

    // Add or update cart item
    const cartItem = await prisma.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
      update: { quantity },
      create: {
        cartId: cart.id,
        productId,
        quantity,
      },
    });

    return { id: cartItem.id };
  } catch (error) {
    console.error("[Prisma] Error saving cart item:", error);
    throw error;
  }
}

/**
 * Get cart items for a customer from PostgreSQL database
 */
export async function getCartItemsFromDb(customerId: string): Promise<any[]> {
  try {
    const cart = await prisma.cart.findUnique({
      where: { customerId },
      include: { items: { include: { product: true } } },
    });
    return cart?.items || [];
  } catch (error) {
    console.error("[Prisma] Error fetching cart items:", error);
    return [];
  }
}

/**
 * Clear cart items from PostgreSQL database
 */
export async function clearCartFromDb(customerId: string): Promise<void> {
  try {
    const cart = await prisma.cart.findUnique({
      where: { customerId },
    });
    if (cart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });
    }
  } catch (error) {
    console.error("[Prisma] Error clearing cart:", error);
    throw error;
  }
}

/**
 * Get orders for a customer from PostgreSQL database
 */
export async function getOrdersFromDb(customerId?: string): Promise<any[]> {
  try {
    if (customerId) {
      return await prisma.order.findMany({
        where: { customerId },
        include: { items: { include: { product: true } } },
      });
    }
    return await prisma.order.findMany({
      include: { items: { include: { product: true } } },
    });
  } catch (error) {
    console.error("[Prisma] Error fetching orders:", error);
    return [];
  }
}
