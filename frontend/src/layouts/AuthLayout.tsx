import { Link, Outlet } from "react-router-dom";
import Logo from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Charkha } from "@/components/Charkha";

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="grid flex-1 grid-rows-[auto_1fr] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-1">
        {/* Brand panel: full on desktop, compact banner on mobile. Deep Google blue with a faint charkha mark. */}
        <section className="relative flex flex-col justify-between overflow-hidden bg-forest-800 px-6 py-5 text-white sm:px-10 lg:p-12">
          <Charkha className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 text-white opacity-[0.07] lg:-right-16 lg:-top-16 lg:h-64 lg:w-64" />
          <Link to="/" aria-label="Sahayak home" className="relative w-fit"><Logo light /></Link>
          <div className="relative mt-6 max-w-md lg:mt-0">
            <h2 className="text-2xl font-medium leading-tight tracking-tight text-white lg:text-4xl">Government help, in your language.</h2>
            <p className="mt-2 text-forest-100 lg:mt-3 lg:text-lg">Describe your problem and find the scheme that fits.</p>
            <div className="mt-4 hidden flex-wrap gap-2 lg:flex">
              {["English", "हिन्दी", "ಕನ್ನಡ"].map((l) => (
                <span key={l} className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1 text-sm font-medium text-white">{l}</span>
              ))}
            </div>
          </div>
          <div className="relative hidden text-sm text-forest-100 lg:block">A hackathon prototype — nothing is sent to any government portal.</div>
        </section>

        <section className="flex flex-col px-6 py-6 sm:px-12">
          <div className="flex justify-end"><LanguageSwitcher /></div>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-6 lg:py-10">
            <div className="rounded-3xl border border-paper-300 bg-white p-6 shadow-card sm:p-8">
              <Outlet />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
