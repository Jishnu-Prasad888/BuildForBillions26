import { Link, NavLink, Outlet } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth } from "@/services/auth";
import { useTr } from "@/i18n";
import { DemoStrip } from "./UserLayout";

const navCls = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-semibold transition-colors sm:px-3 ${isActive ? "bg-forest-50 text-forest-800 ring-1 ring-forest-100" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"}`;

/* Shell for pages anyone can open without signing in: landing, user guide, docs. */
export default function PublicLayout() {
  const { user } = useAuth();
  const tr = useTr();
  const links = [
    { to: "/guide", label: tr({ en: "How to use", hi: "कैसे इस्तेमाल करें", kn: "ಹೇಗೆ ಬಳಸುವುದು" }) },
    { to: "/docs", label: tr({ en: "Docs", hi: "जानकारी", kn: "ಮಾಹಿತಿ" }) },
  ];
  const home = user ? (user.role === "ADMIN" ? "/admin" : "/") : "/signin";
  const homeLabel = user ? tr({ en: "Open my account", hi: "मेरा खाता खोलें", kn: "ನನ್ನ ಖಾತೆ ತೆರೆಯಿರಿ" }) : tr({ en: "Sign in", hi: "साइन इन", kn: "ಸೈನ್ ಇನ್" });

  return (
    <div className="flex min-h-screen flex-col">
      <div className="tricolor-rule h-[3px]" />
      <DemoStrip />
      <header className="sticky top-0 z-30 border-b border-paper-300 bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-3 sm:gap-2 sm:px-6">
          <Link to="/" aria-label="Sahayak home" className="mr-auto shrink-0 rounded-md"><Logo sub={false} /></Link>
          <nav className="hidden items-center sm:flex" aria-label="Site">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={navCls}>{l.label}</NavLink>
            ))}
          </nav>
          <div className="mx-1 hidden h-5 w-px bg-paper-300 sm:block" />
          <LanguageSwitcher />
          <Link to={home} className="btn-primary btn-sm hidden sm:inline-flex">
            {homeLabel}
            <ArrowRight size={15} />
          </Link>
        </div>
        <nav className="flex items-center gap-1 border-t border-paper-300 px-3 py-1.5 sm:hidden" aria-label="Site mobile">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={navCls}>{l.label}</NavLink>
          ))}
          <Link to={home} className="btn-primary btn-sm ml-auto whitespace-nowrap">{homeLabel} <ArrowRight size={15} /></Link>
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-forest-950 text-forest-200">
        <div className="tricolor-rule h-[3px]" />
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-[1.6fr_1fr_1fr] sm:px-6">
          <div>
            <Logo light />
            <p className="mt-4 max-w-sm leading-relaxed text-forest-200/80">
              {tr({
                en: "A hackathon prototype. Forms and submissions are practice only — nothing is sent to any government portal.",
                hi: "यह एक हैकाथॉन प्रोटोटाइप है। फ़ॉर्म और आवेदन केवल अभ्यास के लिए हैं — सरकार को कुछ नहीं भेजा जाता।",
                kn: "ಇದು ಹ್ಯಾಕಥಾನ್ ಮಾದರಿ. ಫಾರ್ಮ್‌ಗಳು ಮತ್ತು ಅರ್ಜಿಗಳು ಅಭ್ಯಾಸಕ್ಕೆ ಮಾತ್ರ — ಸರ್ಕಾರಕ್ಕೆ ಏನನ್ನೂ ಕಳುಹಿಸುವುದಿಲ್ಲ.",
              })}
            </p>
          </div>
          <div className="space-y-2.5">
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-forest-300">{tr({ en: "Help", hi: "मदद", kn: "ಸಹಾಯ" })}</div>
            <Link to="/guide" className="block transition-colors hover:text-white">{links[0].label}</Link>
            <Link to="/docs" className="block transition-colors hover:text-white">{links[1].label}</Link>
          </div>
          <div className="space-y-2.5">
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-forest-300">{tr({ en: "Account", hi: "खाता", kn: "ಖಾತೆ" })}</div>
            <Link to="/signin" className="block transition-colors hover:text-white">{tr({ en: "Sign in", hi: "साइन इन", kn: "ಸೈನ್ ಇನ್" })}</Link>
            <Link to="/signup" className="block transition-colors hover:text-white">{tr({ en: "Create an account", hi: "खाता बनाएँ", kn: "ಖಾತೆ ರಚಿಸಿ" })}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
