import { Link, Outlet } from "react-router-dom";
import Logo from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { DemoStrip } from "./UserLayout";

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="tricolor-rule h-1" />
      <DemoStrip />
      <div className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-ink-900 p-12 text-white lg:flex">
          <Link to="/" aria-label="Sahayak home"><Logo light /></Link>
          <div className="max-w-lg">
            <h1 className="font-display text-4xl font-bold leading-tight text-white">Government help, explained in your language — and filled in with you.</h1>
            <p className="mt-4 text-lg text-ink-200">
              Tell Sahayak what happened. It finds schemes from official sources, shows you exactly where every answer comes from, and sits beside you while you fill the form.
            </p>
            <ul className="mt-8 space-y-3 text-ink-100">
              <li className="flex gap-3"><span className="mt-1 h-2 w-2 flex-none rounded-full bg-saffron" /> English · हिन्दी · ಕನ್ನಡ — by voice or text</li>
              <li className="flex gap-3"><span className="mt-1 h-2 w-2 flex-none rounded-full bg-saffron" /> Every answer cites official evidence</li>
              <li className="flex gap-3"><span className="mt-1 h-2 w-2 flex-none rounded-full bg-saffron" /> Screen-aware, field-by-field form help</li>
            </ul>
          </div>
          <p className="text-xs text-ink-400">Build for Billions · Track 3 · Reinventing Digital Public Infrastructure</p>
          <svg className="pointer-events-none absolute -right-24 -top-24 opacity-10" width="420" height="420" viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="46" stroke="#fff" strokeWidth="1.2" fill="none" />
            {Array.from({ length: 24 }).map((_, i) => (
              <line key={i} x1="50" y1="50" x2={50 + 46 * Math.cos((i * Math.PI) / 12)} y2={50 + 46 * Math.sin((i * Math.PI) / 12)} stroke="#fff" strokeWidth="0.6" />
            ))}
          </svg>
        </section>
        <section className="flex flex-col px-6 py-8 sm:px-12">
          <div className="flex justify-between">
            <Link to="/" className="lg:hidden" aria-label="Sahayak home"><Logo /></Link>
            <div className="ml-auto"><LanguageSwitcher /></div>
          </div>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
            <Outlet />
          </div>
        </section>
      </div>
    </div>
  );
}
