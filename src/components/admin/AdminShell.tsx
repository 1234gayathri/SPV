import { Link, useRouterState } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Package,
  Tag,
  Image as ImageIcon,
  Search,
  Menu,
  X,
  Lock,
} from "lucide-react";
import { Logo } from "@/components/Logo";

const nav = [
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/offers", label: "Coupons", icon: Tag },
  { to: "/admin/content", label: "Testimonials", icon: ImageIcon },
];

export const getAdminHeaderDataFn = createServerFn({ method: "GET" }).handler(
  async () => {
    return { supportEmail: "exim@spvexports.com" };
  },
);

export function AdminShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState(false);
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [mounted, setMounted] = useState(false);

  const [headerData, setHeaderData] = useState({
    supportEmail: "Loading...",
  });

  const fetchHeaderData = useCallback(() => {
    if (auth) {
      getAdminHeaderDataFn()
        .then(setHeaderData)
        .catch((err) => console.error("Error fetching header data:", err));
    }
  }, [auth]);

  // Keep a stable ref so the event listener always calls the latest version
  const fetchHeaderDataRef = useRef(fetchHeaderData);
  useEffect(() => {
    fetchHeaderDataRef.current = fetchHeaderData;
  }, [fetchHeaderData]);

  useEffect(() => {
    setMounted(true);
    if (sessionStorage.getItem("admin_auth") === "true") {
      setAuth(true);
    }
  }, []);

  useEffect(() => {
    fetchHeaderData();

    const handleUpdate = () => {
      fetchHeaderDataRef.current();
    };

    window.addEventListener("admin-data-update", handleUpdate);
    const interval = setInterval(() => fetchHeaderDataRef.current(), 4000);

    return () => {
      window.removeEventListener("admin-data-update", handleUpdate);
      clearInterval(interval);
    };
  }, [auth, path]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd === "admin@project6878") {
      sessionStorage.setItem("admin_auth", "true");
      setAuth(true);
      setErr("");
    } else {
      setErr("Incorrect password");
    }
  };

  if (!mounted) return null;

  if (!auth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-3 sm:p-6">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-3xl border bg-card p-6 sm:p-8 shadow-elegant text-center"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 mb-6">
            <Lock className="h-6 w-6 text-accent" />
          </div>
          <h1 className="font-display text-2xl font-semibold">Admin Access</h1>
          <p className="mt-2 text-sm text-muted-foreground mb-6">
            Enter password to manage your store.
          </p>
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:border-primary mb-3"
            autoFocus
          />
          {err && (
            <p className="text-xs text-destructive text-left mb-3">{err}</p>
          )}
          <button
            type="submit"
            className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background hover:opacity-90 transition"
          >
            Unlock
          </button>
          <div className="mt-6">
            <Link
              to="/"
              className="text-xs text-muted-foreground hover:underline"
            >
              ← Back to store
            </Link>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-16 items-center justify-between px-5 border-b">
          <Logo to="/admin" />
          <button onClick={() => setOpen(false)} className="lg:hidden p-1 hover:bg-sidebar-accent rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-3 space-y-0.5 max-h-[calc(100vh-80px)] overflow-y-auto">
          {nav.map((n) => {
            const active = n.exact ? path === n.to : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition touch-target ${
                  active
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "hover:bg-sidebar-accent"
                }`}
              >
                <n.icon className="h-4 w-4 flex-shrink-0" /> <span className="truncate">{n.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
          <div className="flex h-16 items-center gap-2 sm:gap-3 px-3 sm:px-6">
            <button onClick={() => setOpen(true)} className="lg:hidden p-1 hover:bg-accent/10 rounded">
              <Menu className="h-5 w-5" />
            </button>
            <div className="relative hidden md:block flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search products, orders, customers…"
                className="w-full rounded-full border bg-muted/40 pl-9 pr-4 py-2 text-sm outline-none focus:border-primary focus:bg-background"
              />
            </div>
            <div className="ml-auto flex items-center gap-1 sm:gap-2 pl-2 sm:pl-3 border-l min-w-0">
              <div className="h-8 w-8 rounded-full bg-gradient-warm flex-shrink-0" />
              <div className="hidden sm:block min-w-0">
                <div className="text-xs font-semibold">Support</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {headerData.supportEmail}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          <div className="mb-6">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold truncate">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
