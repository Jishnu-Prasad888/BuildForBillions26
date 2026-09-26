import { useEffect, useState } from "react";
import { CircleHelp, FileText, FileUp, FolderOpen, Home, LogOut, Menu, MessageCircle, NotebookPen, Search, ShieldCheck, UserRound, X } from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth } from "@/services/auth";
import { useI18n } from "@/i18n";

export function DemoStrip() {
  return (
    <div className="border-b border-saffron-100 bg-saffron-50 px-4 py-1.5 text-center text-xs font-semibold text-saffron-700">
      <span className="sm:hidden">DEMO MODE · Practice only — nothing is sent to the government.</span>
      <span className="hidden sm:inline">DEMO MODE · Hackathon prototype. Seed documents are summaries marked “demo”; forms and submissions are mock — nothing is sent to any government portal.</span>
    </div>
  );
}

export default function UserLayout() {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const loc = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => setMoreOpen(false), [loc.pathname]);

  const items = [
    { to: "/", icon: Home, label: t("home"), end: true },
    { to: "/assistant", icon: MessageCircle, label: t("assistant") },
    { to: "/schemes", icon: Search, label: t("schemes") },
    { to: "/applications", icon: FileText, label: t("applications") },
    { to: "/forms", icon: FileUp, label: "AI Form Assistant" },
    { to: "/documents", icon: FolderOpen, label: t("documents") },
    { to: "/notes", icon: NotebookPen, label: t("notes") },
    { to: "/profile", icon: UserRound, label: t("profile") },
  ];
  // The phone tab bar holds the four most-used places; the rest live under "More".
  const tabs = items.slice(0, 4);
  const extra = items.slice(4);
  const logout = () => { signOut(); nav("/"); };

  return (
    <div className="flex min-h-screen">
      {/* Full-height column so the sidebar background never ends before the page does. */}
      <div className="hidden w-64 flex-none border-r border-paper-300 bg-white lg:block">
        <aside className="sticky top-0 flex h-screen flex-col px-4 pb-5">
          <div className="tricolor-rule -mx-4 mb-5 h-1" />
          <Link to="/" aria-label="Sahayak home"><Logo /></Link>
          <nav className="mt-8 flex flex-col gap-1" aria-label="Main">
            {items.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[0.97rem] font-semibold transition-colors ${
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
                <ShieldCheck size={16} /> {t("admin_console")}
              </button>
            )}
            <div className="rounded-xl bg-paper-100 p-3">
              <div className="truncate text-sm font-semibold text-ink-900">{user?.full_name}</div>
              <div className="truncate text-xs text-ink-500">{user?.email}</div>
              <button className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-brick" onClick={logout}>
                <LogOut size={15} /> {t("sign_out")}
              </button>
            </div>
          </div>
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="tricolor-rule h-1 lg:hidden" />
        <DemoStrip />
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-paper-300 bg-white/85 px-4 py-2.5 backdrop-blur sm:px-6 lg:justify-end">
          <Link to="/" className="lg:hidden" aria-label="Sahayak home"><Logo sub={false} /></Link>
          <div className="flex items-center gap-2">
            <Link to="/guide" className="btn-ghost btn-sm" title={t("how_to_use")}>
              <CircleHelp size={18} /> <span className="hidden sm:inline">{t("how_to_use")}</span>
            </Link>
            <LanguageSwitcher />
          </div>
        </header>
        <main className="pb-safe mx-auto w-full max-w-6xl flex-1 px-4 pt-6 sm:px-6 sm:pt-8">
          <Outlet />
        </main>
      </div>

      {/* Phone navigation: big icon + word targets at the bottom, where thumbs reach. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-paper-300 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Main mobile">
        <div className="grid grid-cols-5">
          {tabs.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-[60px] flex-col items-center justify-center gap-1 px-0.5 text-center text-[0.68rem] font-semibold leading-tight ${isActive ? "text-saffron-700" : "text-ink-600"}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-8 w-12 items-center justify-center rounded-full ${isActive ? "bg-saffron-50" : ""}`}><Icon size={21} /></span>
                  <span className="max-w-full break-words">{label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button
            className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold leading-tight ${moreOpen ? "text-saffron-700" : "text-ink-600"}`}
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
          >
            <span className="flex h-8 w-12 items-center justify-center rounded-full">{moreOpen ? <X size={21} /> : <Menu size={21} />}</span>
            {t("more")}
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-30 bg-ink-900/30 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] rounded-t-3xl bg-white p-4 shadow-lift" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 px-2">
              <div className="truncate font-semibold text-ink-900">{user?.full_name}</div>
              <div className="truncate text-xs text-ink-500">{user?.email}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {extra.map(({ to, icon: Icon, label }) => (
                <Link key={to} to={to} className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-paper-100 px-4 font-semibold text-ink-800">
                  <Icon size={20} className="text-saffron-600" /> {label}
                </Link>
              ))}
              <Link to="/guide" className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-paper-100 px-4 font-semibold text-ink-800">
                <CircleHelp size={20} className="text-saffron-600" /> {t("how_to_use")}
              </Link>
              {user?.role === "ADMIN" && (
                <Link to="/admin" className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-paper-100 px-4 font-semibold text-ink-800">
                  <ShieldCheck size={20} className="text-saffron-600" /> {t("admin_console")}
                </Link>
              )}
              <button onClick={logout} className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-brick-50 px-4 font-semibold text-brick">
                <LogOut size={20} /> {t("sign_out")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
