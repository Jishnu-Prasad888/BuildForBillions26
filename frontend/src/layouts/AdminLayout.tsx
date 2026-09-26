import { BookOpen, Database, Globe, LayoutDashboard, LogOut, Network, Users, Workflow, ArrowLeft } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
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
    <div className="flex min-h-screen flex-col">
      <div className="tricolor-rule h-1" />
      <DemoStrip />
      <div className="flex flex-1">
        <aside className="sticky top-0 flex h-screen w-60 flex-none flex-col bg-ink-900 px-4 py-5 text-ink-200">
          <Logo light />
          <div className="mt-2 text-[0.7rem] font-bold uppercase tracking-wider text-saffron">Admin console</div>
          <nav className="mt-6 flex flex-col gap-1" aria-label="Admin">
            {items.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.95rem] font-semibold transition-colors ${isActive ? "bg-white text-ink-900" : "text-ink-200 hover:bg-ink-700"}`
                }
              >
                <Icon size={18} /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto space-y-3">
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-ink-200 hover:bg-ink-700" onClick={() => nav("/")}>
              <ArrowLeft size={16} /> Citizen view
            </button>
            <div className="rounded-lg bg-ink-800 p-3">
              <div className="truncate text-sm font-semibold text-white">{user?.full_name}</div>
              <div className="truncate text-xs text-ink-300">{user?.email}</div>
              <button className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-200 hover:text-white" onClick={() => { signOut(); nav("/signin"); }}>
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-8 py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
