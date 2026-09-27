import { BookOpen, Database, Globe, LayoutDashboard, Network, Users, Workflow, ArrowLeft } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import UserMenu from "@/components/UserMenu";

export default function AdminLayout() {
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
      {/* Full-height column so the sidebar runs the whole length of the page. */}
      <div className="hidden w-60 flex-none bg-paper-100 lg:block">
        <aside className="sticky top-0 flex h-screen flex-col px-3 pb-5 pt-5 text-ink-700">
          <div className="px-2"><Logo /></div>
          <div className="mt-1 px-4 text-[0.7rem] font-medium uppercase tracking-wider text-forest-600">Admin console</div>
          <nav className="mt-6 flex flex-col gap-0.5" aria-label="Admin">
            {items.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} className={isActive ? "text-forest-700" : "text-ink-500"} /> {label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto px-1">
            <button className="nav-item w-full !text-sm" onClick={() => nav("/")}>
              <ArrowLeft size={18} /> Citizen view
            </button>
          </div>
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-paper-300 bg-white/90 px-4 py-2.5 backdrop-blur sm:px-6 lg:justify-end">
          <Link to="/admin" className="lg:hidden"><Logo sub={false} /></Link>
          <UserMenu showProfile={false} />
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-paper-300 bg-white px-3 py-2 lg:hidden" aria-label="Admin mobile">
          {items.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium ${isActive ? "bg-forest-100 text-forest-800" : "text-ink-700"}`}>
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
