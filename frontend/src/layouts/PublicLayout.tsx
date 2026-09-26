import { Link, NavLink, Outlet } from "react-router-dom";
import Logo from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PageBackdrop from "@/components/PageBackdrop";
import { useAuth } from "@/services/auth";
import { useTr } from "@/i18n";

const navCls = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${isActive ? "border-forest-700 text-forest-800" : "border-transparent text-ink-600 hover:text-forest-800"}`;

/* Shell for pages anyone can open without signing in: the landing page (which carries the user guide) and docs. */
export default function PublicLayout() {
  const { user } = useAuth();
  const tr = useTr();
  const links = [
    { to: "/welcome", end: true, label: tr({ en: "Home", hi: "मुख्य पृष्ठ", kn: "ಮುಖಪುಟ" }) },
    { to: "/welcome#guide", label: tr({ en: "How to use", hi: "कैसे इस्तेमाल करें", kn: "ಹೇಗೆ ಬಳಸುವುದು" }), hash: true },
    { to: "/docs", label: tr({ en: "Docs", hi: "जानकारी", kn: "ಮಾಹಿತಿ" }) },
  ];
  const home = user ? (user.role === "ADMIN" ? "/admin" : "/") : "/signin";
  const homeLabel = user ? tr({ en: "Open my account", hi: "मेरा खाता खोलें", kn: "ನನ್ನ ಖಾತೆ ತೆರೆಯಿರಿ" }) : tr({ en: "Sign in", hi: "साइन इन", kn: "ಸೈನ್ ಇನ್" });

  const renderLink = (l: (typeof links)[number]) =>
    l.hash ? (
      <Link key={l.to} to={l.to} className={navCls({ isActive: false })}>{l.label}</Link>
    ) : (
      <NavLink key={l.to} to={l.to} end={l.end} className={navCls}>{l.label}</NavLink>
    );

  return (
    <div className="flex min-h-screen flex-col">
      <PageBackdrop />
      <div className="tricolor-rule h-[3px]" />

      <header className="sticky top-0 z-30 border-b border-paper-300 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-1 px-3 sm:gap-2 sm:px-6">
          <Link to="/" aria-label="Sahayak home" className="mr-auto shrink-0 rounded-md"><Logo sub={false} /></Link>
          <nav className="hidden items-center sm:flex" aria-label="Site">{links.map(renderLink)}</nav>
          <div className="mx-1 hidden h-5 w-px bg-paper-300 sm:block" />
          <LanguageSwitcher />
          <Link to={home} className="btn-primary btn-sm hidden sm:inline-flex">{homeLabel}</Link>
        </div>
        <nav className="flex items-center gap-1 border-t border-paper-300 px-3 sm:hidden" aria-label="Site mobile">
          {links.map(renderLink)}
          <Link to={home} className="btn-primary btn-sm ml-auto whitespace-nowrap">{homeLabel}</Link>
        </nav>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-paper-300 bg-white">
        <div className="tricolor-rule h-[3px]" />
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-[1.6fr_1fr_1fr] sm:px-6">
          <div>
            <Logo />
            <p className="mt-4 max-w-sm leading-relaxed text-ink-600">
              {tr({
                en: "A hackathon prototype. Forms and submissions are practice only — nothing is sent to any government portal.",
                hi: "यह एक हैकाथॉन प्रोटोटाइप है। फ़ॉर्म और आवेदन केवल अभ्यास के लिए हैं — सरकार को कुछ नहीं भेजा जाता।",
                kn: "ಇದು ಹ್ಯಾಕಥಾನ್ ಮಾದರಿ. ಫಾರ್ಮ್‌ಗಳು ಮತ್ತು ಅರ್ಜಿಗಳು ಅಭ್ಯಾಸಕ್ಕೆ ಮಾತ್ರ — ಸರ್ಕಾರಕ್ಕೆ ಏನನ್ನೂ ಕಳುಹಿಸುವುದಿಲ್ಲ.",
              })}
            </p>
          </div>
          <div className="space-y-2.5">
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-forest-700">{tr({ en: "Help", hi: "मदद", kn: "ಸಹಾಯ" })}</div>
            <Link to="/welcome#guide" className="block text-ink-600 transition-colors hover:text-forest-800">{links[1].label}</Link>
            <Link to="/docs" className="block text-ink-600 transition-colors hover:text-forest-800">{links[2].label}</Link>
          </div>
          <div className="space-y-2.5">
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-forest-700">{tr({ en: "Account", hi: "खाता", kn: "ಖಾತೆ" })}</div>
            <Link to="/signin" className="block text-ink-600 transition-colors hover:text-forest-800">{tr({ en: "Sign in", hi: "साइन इन", kn: "ಸೈನ್ ಇನ್" })}</Link>
            <Link to="/signup" className="block text-ink-600 transition-colors hover:text-forest-800">{tr({ en: "Create an account", hi: "खाता बनाएँ", kn: "ಖಾತೆ ರಚಿಸಿ" })}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
