import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { ErrorNote, Spinner } from "@/components/ui";

export default function ForgotPassword() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [demoToken, setDemoToken] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const request = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await api.post<{ message: string; demo_reset_token?: string }>("/api/auth/forgot-password", { email });
      setMsg(r.message);
      setSent(true);
      if (r.demo_reset_token) {
        setDemoToken(r.demo_reset_token);
        setToken(r.demo_reset_token);
      }
    } catch (ex: any) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api.post("/api/auth/reset-password", { token, password });
      nav("/signin");
    } catch (ex: any) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-medium tracking-tight text-ink-900">Reset password</h1>
      {!sent ? (
        <form onSubmit={request} className="mt-6 space-y-4">
          <p className="text-sm text-ink-600">Enter your registered email. We will send a reset link.</p>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" autoComplete="email" required aria-invalid={!!err || undefined} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <ErrorNote>{err}</ErrorNote>
          <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner />} Send reset link</button>
        </form>
      ) : (
        <form onSubmit={reset} className="mt-6 space-y-4">
          <p className="rounded-xl border border-forest-100 bg-forest-50 px-3.5 py-2.5 text-sm text-forest-800">{msg}</p>
          {demoToken && (
            <p className="rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-700">
              Demo mode: there is no email service in this prototype, so the reset token has been filled in for you.
            </p>
          )}
          <div>
            <label className="label" htmlFor="token">Reset token</label>
            <input id="token" className="input font-mono text-sm" required aria-invalid={!!err || undefined} value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="pw">New password</label>
            <input id="pw" type="password" className="input" autoComplete="new-password" minLength={8} required aria-invalid={!!err || undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="mt-1 text-xs text-ink-500">At least 8 characters.</p>
          </div>
          <ErrorNote>{err}</ErrorNote>
          <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner />} Set new password</button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/signin" className="link">Back to sign in</Link></p>
    </div>
  );
}
