import { Link, useRouterState } from "@tanstack/react-router";
import { Home, BookOpen, LayoutDashboard, ShieldCheck, Settings } from "lucide-react";
import { useAuth } from "@/lib/auth";

/** Thumb-reachable navigation for small screens. Hidden from sm: upward. */
export function MobileBottomNav() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!user) return null;

  const items = [
    { to: "/", label: "Home", Icon: Home },
    { to: "/courses", label: "Courses", Icon: BookOpen },
    { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { to: "/verify", label: "Verify", Icon: ShieldCheck },
    { to: "/settings", label: "Settings", Icon: Settings },
  ] as const;

  return (
    <>
      {/* Spacer so fixed bar never covers page content */}
      <div aria-hidden="true" className="h-20 sm:hidden" />
      <nav
        aria-label="Quick navigation"
        className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 flex sm:hidden border-t border-blue-100 bg-white/95 backdrop-blur-xl pt-1 pb-2"
      >
        {items.map(({ to, label, Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                active ? "text-blue-700" : "text-blue-500"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}