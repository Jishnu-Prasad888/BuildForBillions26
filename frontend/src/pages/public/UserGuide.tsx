import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, Info, Lightbulb, ShieldAlert, X } from "lucide-react";
import { useAuth } from "@/services/auth";
import { QUICK_START, SECTIONS, type Block, type Img } from "./guideContent";

/* **bold** and *italic* inside the guide's text fields. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith("**")) return <strong key={i} className="font-semibold text-ink-900">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

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

function Lightbox({ img, onClose }: { img: Img; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/80 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={img.alt} onClick={onClose}>
      <button ref={close} onClick={onClose} aria-label="Close" className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink-800 shadow-lift sm:right-6 sm:top-6">
        <X size={20} />
      </button>
      <img src={img.src} alt={img.alt} className="max-h-full max-w-full rounded-md bg-white object-contain shadow-lift" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

function Figure({ img, onOpen, narrow = false }: { img: Img; onOpen: (i: Img) => void; narrow?: boolean }) {
  return (
    <figure className={narrow ? "w-full" : "mt-4"}>
      <button type="button" onClick={() => onOpen(img)} title="Click to enlarge"
        className="block w-full overflow-hidden rounded-lg border border-paper-300 bg-paper-100 shadow-card transition-shadow hover:shadow-lift focus-visible:outline-2 focus-visible:outline-forest-600">
        <img src={img.src} alt={img.alt} width={img.w} height={img.h} loading="lazy" decoding="async" className="h-auto w-full" />
      </button>
      {img.caption && <figcaption className="mt-1.5 text-sm text-ink-500">{img.caption}</figcaption>}
    </figure>
  );
}

const NOTE = {
  tip: { icon: Lightbulb, cls: "border-forest-100 border-l-forest-600 bg-forest-50", ic: "text-forest-700" },
  warn: { icon: ShieldAlert, cls: "border-amber-100 border-l-amber bg-amber-50", ic: "text-amber-600" },
  info: { icon: Info, cls: "border-paper-300 border-l-ink-400 bg-paper-100", ic: "text-ink-500" },
} as const;

function BlockView({ b, onOpen }: { b: Block; onOpen: (i: Img) => void }) {
  switch (b.t) {
    case "p":
      return <p className="mt-3 leading-relaxed text-ink-700">{inline(b.text)}</p>;
    case "h3":
      return <h3 className="mt-8 font-display text-lg font-bold text-ink-900">{b.text}</h3>;
    case "steps":
      return (
        <ol className="mt-4 space-y-3">
          {b.items.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-forest-800 text-sm font-bold text-white" aria-hidden>{i + 1}</span>
              <span className="min-w-0 leading-relaxed text-ink-700"><span className="sr-only">Step {i + 1}: </span>{inline(s)}</span>
            </li>
          ))}
        </ol>
      );
    case "list":
      return (
        <ul className="mt-4 space-y-2">
          {b.items.map((s, i) => (
            <li key={i} className="flex gap-3 leading-relaxed text-ink-700">
              <span className="mt-2.5 h-1.5 w-1.5 flex-none rounded-full bg-forest-600" aria-hidden />
              <span className="min-w-0">{inline(s)}</span>
            </li>
          ))}
        </ul>
      );
    case "img":
      return <Figure img={b.img} onOpen={onOpen} />;
    case "phones":
      return (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {b.imgs.map((i) => <Figure key={i.src} img={i} onOpen={onOpen} narrow />)}
        </div>
      );
    case "note": {
      const { icon: Icon, cls, ic } = NOTE[b.tone];
      return (
        <div className={`mt-4 flex gap-3 rounded-lg border border-l-4 px-4 py-3 text-sm text-ink-800 ${cls}`}>
          <Icon size={18} className={`mt-0.5 flex-none ${ic}`} aria-hidden />
          <p className="leading-relaxed">{inline(b.text)}</p>
        </div>
      );
    }
    case "defs":
      return (
        <dl className="mt-4 divide-y divide-paper-300 overflow-hidden rounded-lg border border-paper-300">
          {b.items.map(([term, def]) => (
            <div key={term} className="grid gap-1 px-4 py-3 sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-4">
              <dt className="font-semibold text-ink-900">{term}</dt>
              <dd className="text-ink-700">{inline(def)}</dd>
            </div>
          ))}
        </dl>
      );
    case "faq":
      return (
        <div className="mt-4 divide-y divide-paper-300 overflow-hidden rounded-lg border border-paper-300">
          {b.items.map(([q, a]) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-ink-900 hover:bg-forest-50">
                {q}
                <ChevronDown size={18} className="flex-none text-ink-400 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="px-4 pb-4 leading-relaxed text-ink-700">{inline(a)}</p>
            </details>
          ))}
        </div>
      );
  }
}

/* The full citizen user guide: every page of the app, step by step, with screenshots. */
export default function UserGuide() {
  const { user } = useAuth();
  const active = useActiveSection();
  const { hash } = useLocation();
  const [open, setOpen] = useState<Img | null>(null);

  // Deep links such as /guide#assistant: the sections render with the page, so scroll once they exist.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <div className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-10">
      <div className="rounded-lg bg-white px-4 py-8 shadow-lift sm:px-8 sm:py-10">
        <header className="mb-8 border-b border-paper-300 pb-6">
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-forest-700">User guide</div>
          <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">How to use Sahayak</h1>
          <p className="mt-2 max-w-2xl text-lg text-ink-600">
            Everything a citizen can do, step by step, with screenshots. Press any picture to see it larger.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={user ? "/" : "/signin"} className="btn-primary btn-sm">{user ? "Open my account" : "Sign in"}</Link>
            {user && <Link to="/assistant" className="btn-secondary btn-sm">Talk to the assistant</Link>}
          </div>
        </header>

        <section aria-labelledby="quick" className="mb-10 rounded-lg border border-forest-100 bg-forest-50/60 p-4 sm:p-5">
          <h2 id="quick" className="font-display text-lg font-bold text-ink-900">The short version</h2>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_START.map((q, i) => (
              <li key={q.title}>
                <a href={`#${q.to}`} className="flex items-center gap-3 rounded-md border border-forest-100 bg-white px-3 py-2.5 text-sm font-semibold text-ink-800 transition-colors hover:border-forest-300 hover:bg-forest-50">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-forest-800 text-xs font-bold text-white">{i + 1}</span>
                  {q.title}
                </a>
              </li>
            ))}
          </ol>
        </section>

        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
          <nav className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto" aria-label="On this page">
            <div className="mb-2 hidden text-xs font-bold uppercase tracking-[0.08em] text-ink-500 lg:block">On this page</div>
            <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:border-l lg:border-paper-300 lg:pb-0">
              {SECTIONS.map((s, i) => (
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
                    <span className="mr-1.5 text-ink-400">{i + 1}.</span>{s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <article className="min-w-0 max-w-3xl space-y-14">
            {SECTIONS.map((s, i) => (
              <section key={s.id} aria-labelledby={s.id} className="scroll-mt-24">
                <h2 id={s.id} className="flex items-center gap-3 font-display text-2xl font-bold text-ink-900">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-forest-800 text-sm text-white" aria-hidden>{i + 1}</span>
                  {s.title}
                </h2>
                {s.blocks.map((b, j) => <BlockView key={j} b={b} onOpen={setOpen} />)}
              </section>
            ))}
          </article>
        </div>
      </div>
      {open && <Lightbox img={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
