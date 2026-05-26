import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.jpg";

export function Logo({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 group">
      <img
        src={logo}
        alt="SPV Export Spices"
        className="h-9 w-9 rounded-full object-cover shadow-soft"
      />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-semibold tracking-tight">
          spvexport.com
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Spices Co.
        </span>
      </span>
    </Link>
  );
}
