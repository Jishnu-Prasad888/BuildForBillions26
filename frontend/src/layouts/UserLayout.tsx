import { FileText, FileUp, FolderOpen, Home, LogOut, MessageCircle, NotebookPen, Search, ShieldCheck, UserRound } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth } from "@/services/auth";
import { useI18n } from "@/i18n";

export function DemoStrip() {
  return (
    <div className="border-b border-saffron-100 bg-saffron-50 px-4 py-1.5 text-center text-xs font-semibold text-saffron-700">
      DEMO MODE · Hackathon prototype. Seed documents are summaries marked “demo”; forms and submissions are mock — nothing is sent to any government portal.
    </div>
  );
}

export default function UserLayout() {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const items = [
    { to: "/", icon: Home, label: t("dashboard"), end: true },
    { to: "/assistant", icon: MessageCircle, label: t("assistant") },
    { to: "/schemes", icon: Search, label: t("schemes") },
    { to: "/forms", icon: FileUp, label: "AI Form Assistant" },
    { to: "/applications", icon: FileText, label: t("applications") },
    { to: "/documents", icon: FolderOpen, label: t("documents") },
    { to: "/notes", icon: NotebookPen, label: t("notes") },
    { to: "/profile", icon: UserRound, label: t("profile") },
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <div className="tricolor-rule h-1" />
      <DemoStrip />
      <div className="flex flex-1">
        <aside className="sticky top-0 hidden h-screen w-64 flex-none flex-col border-r border-paper-300 bg-white px-4 py-5 lg:flex">
          <Logo />
          <nav className="mt-8 flex flex-col gap-1" aria-label="Main">
            {items.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.97rem] font-semibold transition-colors ${
                    isActive ? "bg-ink-800 text-white" : "text-ink-700 hover:bg-ink-50"
                  }`
                }
              >
                <Icon size={19} /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto space-y-3">
            {user?.role === "ADMIN" && (
              <button className="btn-secondary btn-sm w-full" onClick={() => nav("/admin")}>
                <ShieldCheck size={16} /> Admin console
              </button>
            )}
            <div className="rounded-lg bg-paper-100 p-3">
              <div className="truncate text-sm font-semibold text-ink-900">{user?.full_name}</div>
              <div className="truncate text-xs text-ink-500">{user?.email}</div>
              <button className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-brick" onClick={() => { signOut(); nav("/signin"); }}>
                <LogOut size={15} /> {t("sign_out")}
              </button>
            </div>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-paper-300 bg-white/70 px-5 py-3 backdrop-blur lg:justify-end">
            <div className="lg:hidden"><Logo sub={false} /></div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
            </div>
          </header>
          <nav className="flex gap-1 overflow-x-auto border-b border-paper-300 bg-white px-3 py-2 lg:hidden" aria-label="Main mobile">
            {items.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold ${isActive ? "bg-ink-800 text-white" : "text-ink-700"}`}>
                {label}
              </NavLink>
            ))}
          </nav>
          <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
