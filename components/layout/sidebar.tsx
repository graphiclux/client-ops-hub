import Link from "next/link";
import { Home, Search, Settings, SquareKanban, Users, Shield, KeyRound } from "lucide-react";

const baseNav = [
  { href: "/clients", label: "Clients", icon: Home },
  { href: "/engagements", label: "Engagements", icon: SquareKanban },
  { href: "/search", label: "Search", icon: Search },
  { href: "/settings/integrations", label: "Integrations", icon: Settings },
  { href: "/settings/password", label: "Password", icon: KeyRound }
];

const adminNav = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: Shield }
];

export function Sidebar({ canAdmin }: { canAdmin: boolean }) {
  const nav = canAdmin ? [...baseNav, ...adminNav] : baseNav;

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card p-4 lg:block">
      <div className="mb-8 px-3">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Graphiclux</p>
        <h1 className="text-xl font-semibold">Client Ops Hub</h1>
      </div>
      <nav className="space-y-1">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm hover:bg-muted">
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
