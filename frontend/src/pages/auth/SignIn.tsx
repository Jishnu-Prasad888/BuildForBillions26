import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/services/auth";
import { ErrorNote, Spinner } from "@/components/ui";

export default function SignIn() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const u = await signIn(email, password);
      nav(u.role === "ADMIN" ? "/admin" : params.get("next") || "/");
    } catch (ex: any) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const fill = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Sign in</h1>
      <p className="mt-1 text-ink-600">Welcome. Sign in to continue your applications.</p>
      {params.get("expired") && <div className="mt-4"><ErrorNote>Your session expired. Please sign in again.</ErrorNote></div>}
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="password">Password</label>
            <Link to="/forgot-password" className="mb-1.5 text-sm font-semibold text-ink-600 underline decoration-saffron underline-offset-2">Forgot password?</Link>
          </div>
          <input id="password" type="password" className="input" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <ErrorNote>{err}</ErrorNote>
        <button className="btn-primary w-full py-3" disabled={busy}>{busy && <Spinner />} Sign in</button>
      </form>
      <p className="mt-5 text-center text-ink-600">
        New here? <Link to="/signup" className="font-semibold text-ink-900 underline decoration-saffron underline-offset-2">Create an account</Link>
      </p>
      <div className="mt-8 rounded-xl border border-dashed border-paper-300 bg-paper-100 p-4 text-sm">
        <div className="eyebrow mb-2">Demo accounts</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={() => fill("ramesh@demo.in", "Demo@123")}>Citizen · Ramesh (farmer)</button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => fill("admin@demo.gov.in", "Admin@123")}>Admin · Anita</button>
        </div>
      </div>
    </div>
  );
}
