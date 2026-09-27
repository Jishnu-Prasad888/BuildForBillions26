import { useEffect, useState } from "react";
import { CircleHelp, FileText, FileUp, FolderOpen, Home, LogOut, Menu, MessageCircle, NotebookPen, Search, ShieldCheck, UserRound, X } from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import UserMenu from "@/components/UserMenu";
import { useAuth } from "@/services/auth";
import { useI18n } from "@/i18n";

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
    { to: "/forms", icon: FileUp, label: t("form_assistant") },
    { to: "/documents", icon: FolderOpen, label: t("documents") },
    { to: "/notes", icon: NotebookPen, label: t("notes") },
    { to: "/profile", icon: UserRound, label: t("profile") },
  ];
  // Sidebar groups: getting help, the work in flight, and the user's own records.
  const groups = [
    { label: null, items: items.slice(0, 2) },
    { label: t("nav_apply"), items: items.slice(2, 5) },
    { label: t("nav_records"), items: items.slice(5, 8) },
  ];
  const initials = (user?.full_name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  // The phone tab bar holds the four most-used places; the rest live under "More".
  const tabs = items.slice(0, 4);
  const extra = items.slice(4);
  const logout = () => { signOut(); nav("/"); };

  return (
    <div className="flex min-h-screen">
      {/* Full-height column so the sidebar background never ends before the page does. */}
      <div className="hidden w-64 flex-none bg-paper-100 lg:block">
        <aside className="sticky top-0 flex h-screen flex-col px-3 pb-5 pt-5">
          <Link to="/" className="px-2" aria-label="Sahayak home"><Logo /></Link>
          <nav className="mt-8 flex flex-col gap-5" aria-label="Main">
            {groups.map((g, gi) => (
              <div key={gi}>
                {g.label && <div className="eyebrow mb-1.5 px-4 text-[0.68rem]">{g.label}</div>}
                <div className="flex flex-col gap-0.5">
                  {g.items.map(({ to, icon: Icon, label, end }) => (
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
                </div>
              </div>
            ))}
          </nav>
          <div className="mt-auto space-y-3 px-1">
            {user?.role === "ADMIN" && (
              <button className="btn-secondary btn-sm w-full" onClick={() => nav("/admin")}>
                <ShieldCheck size={16} /> {t("admin_console")}
              </button>
            )}
            <Link to="/profile" className="flex items-center gap-3 rounded-full border border-paper-300 bg-white p-2 pr-3 transition-colors hover:border-forest-200 hover:bg-forest-50">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-forest-600 text-sm font-medium text-white">{initials}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink-900">{user?.full_name}</span>
                <span className="block truncate text-xs text-ink-500">{user?.email}</span>
              </span>
            </Link>
          </div>
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-paper-300 bg-white/90 px-4 py-2.5 backdrop-blur sm:px-6 lg:justify-end">
          <Link to="/" className="lg:hidden" aria-label="Sahayak home"><Logo sub={false} /></Link>
          <div className="flex items-center gap-2">
            <Link to="/welcome#guide" className="btn-ghost btn-sm" title={t("how_to_use")}>
              <CircleHelp size={18} /> <span className="hidden sm:inline">{t("how_to_use")}</span>
            </Link>
            <LanguageSwitcher />
            <UserMenu />
          </div>
        </header>
        <main className="pb-safe mx-auto w-full max-w-6xl flex-1 px-4 pt-6 sm:px-6 sm:pt-8">
          {/* Keyed on the path so each tab eases in when you switch to it. */}
          <div key={loc.pathname} className="animate-pageIn">
            <Outlet />
          </div>
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
                `flex min-h-[60px] flex-col items-center justify-center gap-1 px-0.5 text-center text-[0.68rem] font-medium leading-tight ${isActive ? "text-forest-700" : "text-ink-600"}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200 ${isActive ? "bg-forest-100" : ""}`}><Icon size={21} /></span>
                  <span className="max-w-full break-words">{label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button
            className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-[0.68rem] font-medium leading-tight ${moreOpen ? "text-forest-700" : "text-ink-600"}`}
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
          >
            <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200 ${moreOpen ? "bg-forest-100" : ""}`}>{moreOpen ? <X size={21} /> : <Menu size={21} />}</span>
            {t("more")}
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-30 animate-fadeIn bg-ink-900/30 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] animate-sheetUp rounded-t-3xl bg-white p-4 shadow-lift" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-8 rounded-full bg-ink-200" />
            <div className="mb-3 flex items-center gap-3 px-2">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-forest-600 text-sm font-medium text-white">{initials}</span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink-900">{user?.full_name}</span>
                <span className="block truncate text-xs text-ink-500">{user?.email}</span>
              </span>
            </div>
            <div className="stagger grid grid-cols-2 gap-2">
              {extra.map(({ to, icon: Icon, label }) => (
                <Link key={to} to={to} className="flex min-h-[56px] items-center gap-3 rounded-xl bg-paper-100 px-4 font-medium text-ink-800">
                  <Icon size={20} className="text-forest-600" /> {label}
                </Link>
              ))}
              <Link to="/welcome#guide" className="flex min-h-[56px] items-center gap-3 rounded-xl bg-paper-100 px-4 font-medium text-ink-800">
                <CircleHelp size={20} className="text-forest-600" /> {t("how_to_use")}
              </Link>
              {user?.role === "ADMIN" && (
                <Link to="/admin" className="flex min-h-[56px] items-center gap-3 rounded-xl bg-paper-100 px-4 font-medium text-ink-800">
                  <ShieldCheck size={20} className="text-forest-600" /> {t("admin_console")}
                </Link>
              )}
              <button onClick={logout} className="flex min-h-[56px] items-center gap-3 rounded-xl bg-brick-50 px-4 font-medium text-brick">
                <LogOut size={20} /> {t("sign_out")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
