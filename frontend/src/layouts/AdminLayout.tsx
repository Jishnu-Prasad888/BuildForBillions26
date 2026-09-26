import { BookOpen, Database, Globe, LayoutDashboard, LogOut, Network, Users, Workflow, ArrowLeft } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { useAuth } from "@/services/auth";
import { DemoStrip } from "./UserLayout";

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const items = [
    { to: "/admin", icon: LayoutDashboard, label: "Overview", end: true },
    { to: "/admin/knowledge", icon: BookOpen, label: "Knowledge Base" },
    { to: "/admin/documents", icon: Database, label: "Documents" },
    { to: "/admin/sources", icon: Globe, label: "Sources" },
    { to: "/admin/users", icon: Users, label: "Users" },
    { to: "/admin/schemes", icon: Network, label: "Schemes" },
    { to: "/admin/ingestion", icon: Workflow, label: "Ingestion" },
  ];
  return (
    <div className="flex min-h-screen">
      {/* Full-height column so the dark sidebar runs the whole length of the page. */}
      <div className="hidden w-60 flex-none bg-ink-900 lg:block">
        <aside className="sticky top-0 flex h-screen flex-col px-4 pb-5 text-ink-200">
          <div className="tricolor-rule -mx-4 mb-5 h-1" />
          <Logo light />
          <div className="mt-2 text-[0.7rem] font-bold uppercase tracking-wider text-saffron">Admin console</div>
          <nav className="mt-6 flex flex-col gap-1" aria-label="Admin">
            {items.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[0.95rem] font-semibold transition-colors ${isActive ? "bg-white text-ink-900" : "text-ink-200 hover:bg-ink-700"}`
                }
              >
                <Icon size={18} /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto space-y-3">
            <button className="flex min-h-[40px] w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink-200 hover:bg-ink-700" onClick={() => nav("/")}>
              <ArrowLeft size={16} /> Citizen view
            </button>
            <div className="rounded-xl bg-ink-800 p-3">
              <div className="truncate text-sm font-semibold text-white">{user?.full_name}</div>
              <div className="truncate text-xs text-ink-300">{user?.email}</div>
              <button className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-200 hover:text-white" onClick={() => { signOut(); nav("/"); }}>
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </div>
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="tricolor-rule h-1 lg:hidden" />
        <DemoStrip />
        <header className="flex items-center justify-between gap-3 bg-ink-900 px-4 py-3 lg:hidden">
          <Link to="/admin"><Logo light sub={false} /></Link>
          <button className="text-sm font-semibold text-ink-200" onClick={() => { signOut(); nav("/"); }}>Sign out</button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-paper-300 bg-white px-3 py-2 lg:hidden" aria-label="Admin mobile">
          {items.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? "bg-ink-800 text-white" : "text-ink-700"}`}>
              {label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
