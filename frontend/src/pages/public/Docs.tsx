import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const SECTIONS = [
  { id: "overview", title: "Overview" },
  { id: "features", title: "Features" },
  { id: "citizens", title: "For citizens" },
];

const FEATURES = [
  { title: "Three languages", text: "English, Hindi, Kannada with voice input" },
  { title: "Scheme discovery", text: "Describe your problem, find applicable schemes" },
  { title: "Sourced answers", text: "Every answer links to its source document" },
  { title: "Form assistance", text: "Guided field-by-field help with voice support" },
  { title: "Application tracker", text: "Monitor progress for each application" },
];

const AREAS = ["Home", "Assistant", "Schemes", "Applications", "More"];

/* Tracks which section heading is on screen so the sidebar can highlight it. */
function useActiveSection() {
  const [active, setActive] = useState(SECTIONS[0].id);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-90px 0px -65% 0px" },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);
  return active;
}

export default function Docs() {
  const active = useActiveSection();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <header className="mb-8 border-b border-paper-300 pb-6">
        <div className="text-xs font-bold uppercase tracking-[0.08em] text-forest-700">Documentation</div>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Sahayak</h1>
        <p className="mt-2 max-w-xl text-lg text-ink-600">
          An AI assistant for government schemes. <Link to="/welcome#guide" className="link">See the guide</Link> for step-by-step help.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
        <nav className="lg:sticky lg:top-24 lg:self-start" aria-label="On this page">
          <div className="mb-2 hidden text-xs font-bold uppercase tracking-[0.08em] text-ink-500 lg:block">On this page</div>
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:border-l lg:border-paper-300 lg:pb-0">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={active === s.id ? "true" : undefined}
                  className={`block whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition-colors lg:-ml-px lg:rounded-none lg:rounded-r-md lg:border-l-2 ${
                    active === s.id
                      ? "bg-forest-50 text-forest-800 lg:border-forest-600"
                      : "text-ink-600 hover:bg-ink-100 hover:text-ink-900 lg:border-transparent"
                  }`}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="min-w-0 max-w-3xl space-y-10">
          <section aria-labelledby="overview" className="scroll-mt-24">
            <h2 id="overview" className="font-display text-2xl font-bold">Overview</h2>
            <p className="mt-3 leading-relaxed text-ink-700">
              Sahayak is an AI assistant that helps citizens find government schemes and fill application forms by speaking their own language.
            </p>
            <div className="mt-4 rounded-lg border border-amber-100 border-l-4 border-l-amber bg-amber-50 px-4 py-3 text-sm text-ink-800">
              <strong>This is a prototype.</strong> Documents and forms are practice versions. Nothing is sent to government portals.
            </div>
          </section>

          <section aria-labelledby="features" className="scroll-mt-24">
            <h2 id="features" className="font-display text-2xl font-bold">Features</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {FEATURES.map(({ title, text }) => (
                <li key={title} className="card flex gap-3 p-4 transition-colors hover:border-forest-200">
                  <span className="mt-1 h-8 w-1 flex-none rounded-full bg-forest-600" aria-hidden />
                  <div>
                    <div className="font-bold text-ink-900">{title}</div>
                    <div className="text-sm leading-snug text-ink-600">{text}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="citizens" className="scroll-mt-24">
            <h2 id="citizens" className="font-display text-2xl font-bold">For citizens</h2>
            <p className="mt-3 leading-relaxed text-ink-700">
              Five main areas: <strong>Home</strong>, <strong>Assistant</strong>, <strong>Schemes</strong>, <strong>Applications</strong>, and <strong>More</strong> (Documents, Notes, Profile).
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {AREAS.map((a, i) => (
                <span key={a} className="inline-flex items-center gap-2 rounded-md border border-paper-300 bg-white px-3 py-1.5 text-sm font-semibold text-ink-800">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-forest-800 text-[0.7rem] font-bold text-white">{i + 1}</span>
                  {a}
                </span>
              ))}
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
