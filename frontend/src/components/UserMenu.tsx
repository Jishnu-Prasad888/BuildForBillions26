import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/services/auth";
import { useI18n } from "@/i18n";

/* Account menu for the top-right of the header: name, profile link and sign out. */
export default function UserMenu({ showProfile = true }: { showProfile?: boolean }) {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!user) return null;
  const initials = user.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex h-9 items-center gap-2 rounded-md border border-ink-200 bg-white pl-1.5 pr-2 text-sm font-semibold text-ink-800 transition-colors hover:border-forest-300 hover:bg-forest-50"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest-800 text-[0.65rem] font-bold text-white" aria-hidden>{initials}</span>
        <span className="hidden max-w-[10rem] truncate sm:inline">{user.full_name}</span>
        <ChevronDown size={15} className={`text-ink-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-lg border border-paper-300 bg-white shadow-lift">
          <div className="border-b border-paper-300 bg-paper-100 px-4 py-3">
            <div className="truncate text-sm font-semibold text-ink-900">{user.full_name}</div>
            <div className="truncate text-xs text-ink-500">{user.email}</div>
          </div>
          <div className="p-1.5">
            {showProfile && (
              <Link to="/profile" role="menuitem" onClick={() => setOpen(false)} className="flex min-h-[40px] items-center gap-2.5 rounded-md px-3 text-sm font-semibold text-ink-700 hover:bg-forest-50">
                <UserRound size={16} /> {t("profile")}
              </Link>
            )}
            <button role="menuitem" onClick={() => { setOpen(false); signOut(); nav("/"); }} className="flex min-h-[40px] w-full items-center gap-2.5 rounded-md px-3 text-sm font-semibold text-ink-700 hover:bg-brick-50 hover:text-brick">
              <LogOut size={16} /> {t("sign_out")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
