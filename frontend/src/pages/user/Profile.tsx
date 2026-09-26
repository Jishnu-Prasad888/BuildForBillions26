import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/services/api";
import { useAuth } from "@/services/auth";
import { LANGUAGES, useI18n } from "@/i18n";
import type { Lang, User } from "@/types";
import { PageHeader, Spinner } from "@/components/ui";

const FIELDS: [string, string][] = [["phone", "Mobile number"], ["state", "State"], ["district", "District"], ["taluk", "Taluk"], ["village", "Village"], ["occupation", "Occupation"], ["land_acres", "Land (acres)"]];

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
  };

  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Your details" title="Profile" subtitle="The assistant uses these details to suggest answers on forms — it always asks before filling them in." />
      {params.get("welcome") && <p className="mb-4 rounded-lg bg-leaf-50 px-4 py-3 text-leaf-700">Welcome! Add a few details so the assistant can help you faster.</p>}
      <form onSubmit={save} className="card space-y-4 p-6">
        <div><label className="label">Full name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Email</label><input className="input bg-paper-100" value={user?.email} disabled /></div>
        <div>
          <span className="label">Preferred language</span>
          <div className="grid grid-cols-3 gap-2">
            {LANGUAGES.map((l) => (
              <button type="button" key={l.code} onClick={() => setL(l.code)} className={`rounded-lg border px-3 py-2 font-semibold ${lang === l.code ? "border-ink-800 bg-ink-800 text-white" : "border-ink-200 bg-white"}`}>{l.native}</button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(([k, label]) => (
            <div key={k}><label className="label">{label}</label><input className="input" value={profile[k] ?? ""} onChange={(e) => setProfile({ ...profile, [k]: e.target.value })} /></div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Save profile</button>
          {msg && <span className="text-sm text-leaf-700">{msg}</span>}
        </div>
      </form>
    </div>
  );
}
