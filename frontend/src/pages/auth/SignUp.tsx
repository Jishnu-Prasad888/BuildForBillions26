import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/services/auth";
import { ErrorNote, Spinner } from "@/components/ui";
import { LANGUAGES, useI18n } from "@/i18n";

export default function SignUp() {
  const { signUp } = useAuth();
  const { lang, setLang } = useI18n();
  const nav = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", preferred_language: lang });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) return setErr("Password must be at least 8 characters.");
    setBusy(true);
    setErr("");
    try {
      await signUp(form);
      setLang(form.preferred_language);
      nav("/profile?welcome=1");
    } catch (ex: any) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Create account</h1>
      <p className="mt-1 text-ink-600">Takes a minute. You can add more details later.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" className="input" required minLength={2} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="pw">Password</label>
          <input id="pw" type="password" className="input" autoComplete="new-password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <p className="mt-1 text-xs text-ink-500">At least 8 characters.</p>
        </div>
        <div>
          <span className="label">Preferred language</span>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-ink-200 bg-white p-1" role="radiogroup" aria-label="Preferred language">
            {LANGUAGES.map((l) => (
              <button
                type="button"
                role="radio"
                aria-checked={form.preferred_language === l.code}
                key={l.code}
                onClick={() => setForm({ ...form, preferred_language: l.code })}
                className={`rounded-md px-3 py-2 font-semibold transition-colors ${form.preferred_language === l.code ? "bg-forest-800 text-white shadow-sm" : "text-ink-700 hover:bg-ink-100"}`}
              >
                {l.native}
              </button>
            ))}
          </div>
        </div>
        <ErrorNote>{err}</ErrorNote>
        <button className="btn-primary w-full py-3" disabled={busy}>{busy && <Spinner />} Create account</button>
      </form>
      <p className="mt-5 text-center text-ink-600">
        Already have an account? <Link to="/signin" className="font-semibold text-forest-700 hover:text-forest-900 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
