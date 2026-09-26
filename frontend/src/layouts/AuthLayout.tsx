import { Link, Outlet } from "react-router-dom";
import Logo from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Wheel from "@/components/Wheel";
// import { DemoStrip } from "./UserLayout";

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-paper-100">
      <div className="tricolor-rule h-[3px]" />
      {/* <DemoStrip /> */}
      <div className="grid flex-1 grid-rows-[auto_1fr] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-1">
        {/* Brand panel: full on desktop, compact banner on mobile */}
        <section className="relative flex flex-col justify-between overflow-hidden bg-forest-950 px-6 py-5 text-white sm:px-10 lg:p-12">
          <Wheel className="pointer-events-none absolute -bottom-32 -right-32 hidden h-[520px] w-[520px] text-white opacity-[0.08] lg:block" />
          <Wheel className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 text-white opacity-[0.08] lg:hidden" />
          <Link to="/" aria-label="Sahayak home" className="relative w-fit"><Logo light /></Link>
          <div className="relative mt-6 max-w-md lg:mt-0">
            <h2 className="font-display text-2xl font-bold leading-tight text-white lg:text-4xl">Government help, in your language.</h2>
            <p className="mt-2 text-forest-200 lg:mt-3 lg:text-lg">Speak your problem. Find the right scheme.</p>
            <div className="mt-4 hidden flex-wrap gap-2 lg:flex">
              {["English", "हिन्दी", "ಕನ್ನಡ"].map((l) => (
                <span key={l} className="rounded-md border border-forest-700 bg-forest-900 px-3 py-1 text-sm font-semibold text-forest-100">{l}</span>
              ))}
            </div>
          </div>
          <div className="relative hidden h-1 w-24 overflow-hidden rounded-full lg:flex">
            <span className="flex-1 bg-saffron" /><span className="flex-1 bg-white" /><span className="flex-1 bg-leaf" />
          </div>
        </section>

        <section className="flex flex-col px-6 py-6 sm:px-12">
          <div className="flex justify-end"><LanguageSwitcher /></div>
          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8 lg:py-10">
            <Outlet />
          </div>
        </section>
      </div>
    </div>
  );
}
