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
    <div className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-10">
    <div className="rounded-xl border border-paper-300 bg-white px-4 py-8 shadow-card sm:px-8 sm:py-10">
      <header className="mb-8 border-b border-paper-300 pb-6">
        <div className="eyebrow">Documentation</div>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-ink-900 sm:text-4xl">Sahayak</h1>
        <p className="mt-2 max-w-xl text-lg text-ink-600">
          An AI assistant for government schemes. <Link to="/welcome#guide" className="link">See the guide</Link> for step-by-step help.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
        <nav className="lg:sticky lg:top-24 lg:self-start" aria-label="On this page">
          <div className="eyebrow mb-2 hidden lg:block">On this page</div>
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:border-l lg:border-paper-300 lg:pb-0">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={active === s.id ? "true" : undefined}
                  className={`block whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors lg:-ml-px lg:rounded-none lg:rounded-r-full lg:border-l-2 ${
                    active === s.id
                      ? "bg-forest-100 text-forest-800 lg:border-forest-600"
                      : "text-ink-600 hover:bg-ink-50 hover:text-ink-900 lg:border-transparent"
                  }`}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="prose-doc min-w-0 max-w-3xl">
          <section aria-labelledby="overview" className="scroll-mt-24">
            <h2 id="overview">Overview</h2>
            <p>
              Sahayak is an AI assistant that helps citizens find government schemes and fill application forms by speaking their own language.
            </p>
            <div className="my-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-ink-800">
              <strong>This is a prototype.</strong> Documents and forms are practice versions. Nothing is sent to government portals.
            </div>
          </section>

          <section aria-labelledby="features" className="scroll-mt-24">
            <h2 id="features">Features</h2>
            <ul className="mt-4 grid list-none gap-3 pl-0 sm:grid-cols-2">
              {FEATURES.map(({ title, text }) => (
                <li key={title} className="card p-4 transition-colors hover:border-forest-200">
                  <div className="font-medium text-ink-900">{title}</div>
                  <div className="mt-0.5 text-sm leading-snug text-ink-600">{text}</div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="citizens" className="scroll-mt-24">
            <h2 id="citizens">For citizens</h2>
            <p>
              Five main areas: <strong>Home</strong>, <strong>Assistant</strong>, <strong>Schemes</strong>, <strong>Applications</strong>, and <strong>More</strong> (Documents, Notes, Profile).
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {AREAS.map((a, i) => (
                <span key={a} className="inline-flex items-center gap-2 rounded-full border border-paper-300 bg-white px-3.5 py-1.5 text-sm font-medium text-ink-800">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-forest-100 text-[0.7rem] font-medium text-forest-800">{i + 1}</span>
                  {a}
                </span>
              ))}
            </div>
          </section>
        </article>
      </div>
    </div>
    </div>
  );
}
