import { CheckCircle2, Languages, MapPin, Sprout, UserRound, type LucideIcon } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/services/api";
import { useAuth } from "@/services/auth";
import { LANGUAGES, useI18n } from "@/i18n";
import type { Lang, User } from "@/types";
import { PageHeader, ProgressBar, Spinner } from "@/components/ui";

const FIELDS: [string, string][] = [["phone", "Mobile number"], ["state", "State"], ["district", "District"], ["taluk", "Taluk"], ["village", "Village"], ["occupation", "Occupation"], ["land_acres", "Land (acres)"]];
const LABEL = Object.fromEntries(FIELDS);
const PLACE = ["state", "district", "taluk", "village"];
const WORK = ["occupation", "land_acres"];

function Section({ icon: Icon, title, hint, children, delay }: { icon: LucideIcon; title: string; hint: string; children: ReactNode; delay: number }) {
  return (
    <section className="card animate-riseIn p-5 sm:p-6" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-forest-50 text-forest-700"><Icon size={18} /></span>
        <div>
          <h2 className="font-bold text-ink-900">{title}</h2>
          <p className="text-sm text-ink-500">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function Profile() {
  const { user, setUser } = useAuth();
  const { setLang } = useI18n();
  const [params] = useSearchParams();
  const [name, setName] = useState(user?.full_name ?? "");
  const [lang, setL] = useState<Lang>(user?.preferred_language ?? "en");
  const [profile, setProfile] = useState<Record<string, any>>(user?.profile ?? {});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const u = await api.patch<User>("/api/users/me", { full_name: name, preferred_language: lang, profile });
    setUser(u);
    setLang(lang);
    setBusy(false);
    setMsg("Saved.");
    setTimeout(() => setMsg(""), 2500);
  };

  const filled = FIELDS.filter(([k]) => String(profile[k] ?? "").trim()).length + (name.trim() ? 1 : 0);
  const pct = Math.round((filled / (FIELDS.length + 1)) * 100);
  const initials = (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const field = (k: string) => (
    <div key={k}><label className="label" htmlFor={`p-${k}`}>{LABEL[k]}</label><input id={`p-${k}`} className="input" value={profile[k] ?? ""} onChange={(e) => setProfile({ ...profile, [k]: e.target.value })} /></div>
  );

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Your details" title="Profile" subtitle="The assistant uses these details to suggest answers on forms — it always asks before filling them in." />
      {params.get("welcome") && <p className="mb-4 animate-popIn rounded-lg bg-leaf-50 px-4 py-3 text-leaf-700">Welcome! Add a few details so the assistant can help you faster.</p>}

      <div className="greet-surface mb-5 flex animate-riseIn flex-col gap-4 rounded-xl border border-paper-300 p-5 shadow-card sm:flex-row sm:items-center">
        <span className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-forest-800 font-display text-2xl font-bold text-white shadow-lift">{initials}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-xl font-bold text-ink-900">{name || "Your name"}</div>
          <div className="truncate text-sm text-ink-500">{user?.email}</div>
          <div className="mt-3 flex max-w-sm items-center gap-3">
            <ProgressBar value={pct} />
            <span className="whitespace-nowrap text-sm font-semibold text-ink-600">{pct}% complete</span>
          </div>
        </div>
      </div>

      <form onSubmit={save} className="space-y-5">
        <Section icon={UserRound} title="About you" hint="Used on every form you fill." delay={80}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="p-name">Full name</label><input id="p-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
            {field("phone")}
            <div className="sm:col-span-2"><label className="label" htmlFor="p-email">Email</label><input id="p-email" className="input bg-paper-100" value={user?.email} disabled /></div>
          </div>
        </Section>

        <Section icon={Languages} title="Preferred language" hint="The app and the assistant will use this language." delay={160}>
          <div className="grid grid-cols-3 gap-2">
            {LANGUAGES.map((l) => (
              <button type="button" key={l.code} onClick={() => setL(l.code)} aria-pressed={lang === l.code}
                className={`rounded-lg border px-3 py-2.5 font-semibold transition-all ${lang === l.code ? "border-forest-800 bg-forest-800 text-white shadow-sm" : "border-ink-200 bg-white hover:border-forest-200 hover:bg-forest-50"}`}>{l.native}</button>
            ))}
          </div>
        </Section>

        <Section icon={MapPin} title="Where you live" hint="Helps find schemes for your state and district." delay={240}>
          <div className="grid gap-4 sm:grid-cols-2">{PLACE.map(field)}</div>
        </Section>

        <Section icon={Sprout} title="Work & land" hint="Many farming schemes depend on these." delay={320}>
          <div className="grid gap-4 sm:grid-cols-2">{WORK.map(field)}</div>
        </Section>

        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex items-center gap-3 rounded-xl border border-paper-300 bg-white/95 p-3 shadow-lift backdrop-blur lg:bottom-4">
          <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Save profile</button>
          {msg && <span className="flex animate-popIn items-center gap-1.5 text-sm font-semibold text-leaf-700"><CheckCircle2 size={17} /> {msg}</span>}
        </div>
      </form>
    </div>
  );
}
