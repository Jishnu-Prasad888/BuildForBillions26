import { Link, NavLink, Outlet } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth } from "@/services/auth";
import { useTr } from "@/i18n";

/* Shell for pages anyone can open without signing in: landing, user guide, docs. */
export default function PublicLayout() {
  const { user } = useAuth();
  const tr = useTr();
  const links = [
    { to: "/guide", label: tr({ en: "How to use", hi: "कैसे इस्तेमाल करें", kn: "ಹೇಗೆ ಬಳಸುವುದು" }) },
    { to: "/docs", label: tr({ en: "Docs", hi: "जानकारी", kn: "ಮಾಹಿತಿ" }) },
  ];
  const home = user ? (user.role === "ADMIN" ? "/admin" : "/") : "/signin";

  return (
    <div className="flex min-h-screen flex-col">
      <div className="tricolor-rule h-1" />
      <header className="sticky top-0 z-30 border-b border-paper-300 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" aria-label="Sahayak home" className="mr-auto"><Logo sub={false} /></Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Site">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => `rounded-lg px-3 py-2 text-[0.95rem] font-semibold ${isActive ? "text-ink-900 underline decoration-saffron decoration-2 underline-offset-8" : "text-ink-600 hover:text-ink-900"}`}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <LanguageSwitcher />
          <Link to={home} className="btn-primary btn-sm hidden sm:inline-flex">
            {user ? tr({ en: "Open my account", hi: "मेरा खाता खोलें", kn: "ನನ್ನ ಖಾತೆ ತೆರೆಯಿರಿ" }) : tr({ en: "Sign in", hi: "साइन इन", kn: "ಸೈನ್ ಇನ್" })}
            <ArrowRight size={15} />
          </Link>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-3 pb-2 md:hidden" aria-label="Site mobile">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm font-semibold ${isActive ? "bg-ink-800 text-white" : "text-ink-700"}`}>
              {l.label}
            </NavLink>
          ))}
          <Link to={home} className="ml-auto rounded-lg px-3 py-1.5 text-sm font-semibold text-saffron-700 sm:hidden">
            {user ? tr({ en: "My account", hi: "मेरा खाता", kn: "ನನ್ನ ಖಾತೆ" }) : tr({ en: "Sign in", hi: "साइन इन", kn: "ಸೈನ್ ಇನ್" })} →
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-paper-300 bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-ink-600 sm:grid-cols-[1.5fr_1fr_1fr] sm:px-6">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm">
              {tr({
                en: "A hackathon prototype. Forms and submissions are practice only — nothing is sent to any government portal.",
                hi: "यह एक हैकाथॉन प्रोटोटाइप है। फ़ॉर्म और आवेदन केवल अभ्यास के लिए हैं — सरकार को कुछ नहीं भेजा जाता।",
                kn: "ಇದು ಹ್ಯಾಕಥಾನ್ ಮಾದರಿ. ಫಾರ್ಮ್‌ಗಳು ಮತ್ತು ಅರ್ಜಿಗಳು ಅಭ್ಯಾಸಕ್ಕೆ ಮಾತ್ರ — ಸರ್ಕಾರಕ್ಕೆ ಏನನ್ನೂ ಕಳುಹಿಸುವುದಿಲ್ಲ.",
              })}
            </p>
          </div>
          <div className="space-y-2">
            <div className="eyebrow">{tr({ en: "Help", hi: "मदद", kn: "ಸಹಾಯ" })}</div>
            <Link to="/guide" className="block hover:text-ink-900">{links[0].label}</Link>
            <Link to="/docs" className="block hover:text-ink-900">{links[1].label}</Link>
          </div>
          <div className="space-y-2">
            <div className="eyebrow">{tr({ en: "Account", hi: "खाता", kn: "ಖಾತೆ" })}</div>
            <Link to="/signin" className="block hover:text-ink-900">{tr({ en: "Sign in", hi: "साइन इन", kn: "ಸೈನ್ ಇನ್" })}</Link>
            <Link to="/signup" className="block hover:text-ink-900">{tr({ en: "Create an account", hi: "खाता बनाएँ", kn: "ಖಾತೆ ರಚಿಸಿ" })}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
