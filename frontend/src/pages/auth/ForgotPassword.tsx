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
      <h1 className="font-display text-3xl font-bold">Reset password</h1>
      {!sent ? (
        <form onSubmit={request} className="mt-6 space-y-4">
          <p className="text-ink-600">Enter your registered email. We will send a reset link.</p>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <ErrorNote>{err}</ErrorNote>
          <button className="btn-primary w-full py-3" disabled={busy}>{busy && <Spinner />} Send reset link</button>
        </form>
      ) : (
        <form onSubmit={reset} className="mt-6 space-y-4">
          <p className="rounded-lg border border-forest-100 bg-forest-50 px-3 py-2 text-sm text-forest-800">{msg}</p>
          {demoToken && (
            <p className="rounded-lg border border-saffron-100 bg-saffron-50 px-3 py-2 text-sm text-saffron-700">
              Demo mode: there is no email service in this prototype, so the reset token has been filled in for you.
            </p>
          )}
          <div>
            <label className="label" htmlFor="token">Reset token</label>
            <input id="token" className="input font-mono text-sm" required value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="pw">New password</label>
            <input id="pw" type="password" className="input" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <ErrorNote>{err}</ErrorNote>
          <button className="btn-primary w-full py-3" disabled={busy}>{busy && <Spinner />} Set new password</button>
        </form>
      )}
      <p className="mt-5 text-center"><Link to="/signin" className="font-semibold text-forest-700 hover:text-forest-900 hover:underline">Back to sign in</Link></p>
    </div>
  );
}
