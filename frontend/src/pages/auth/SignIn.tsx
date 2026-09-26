import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, UserRound, ShieldCheck } from "lucide-react";
import { useAuth } from "@/services/auth";
import { ErrorNote, Spinner } from "@/components/ui";

export default function SignIn() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const demo = params.get("demo") === "citizen";
  const [email, setEmail] = useState(demo ? "ramesh@demo.in" : "");
  const [password, setPassword] = useState(demo ? "Demo@123" : "");
  const [show, setShow] = useState(false);
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
      <p className="mt-1 text-ink-600">Continue to your account.</p>
      {params.get("expired") && <div className="mt-4"><ErrorNote>Your session expired. Please sign in again.</ErrorNote></div>}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="label" >Email</label>
          <div className="relative">
            <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input id="email" type="email" className="input pl-10" autoComplete="email" placeholder="Email" required aria-invalid={!!err || undefined} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-semibold text-ink-700">Password</label>
            <Link to="/forgot-password" className="rounded text-sm font-semibold text-forest-700 hover:text-forest-900 hover:underline">Forgot?</Link>
          </div>
          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input id="password" type={show ? "text" : "password"} placeholder="Password" className="input pl-10 pr-11" autoComplete="current-password" required aria-invalid={!!err || undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <ErrorNote>{err}</ErrorNote>
        <button className="btn-primary w-full py-3" disabled={busy}>{busy && <Spinner />} Sign in</button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-400">
        <span className="h-px flex-1 bg-paper-300" />New here?<span className="h-px flex-1 bg-paper-300" />
      </div>
      <Link to="/signup" className="btn-secondary w-full">Create an account</Link>

      <div className="mt-7 rounded-md border border-forest-100 bg-forest-50/60 p-3.5">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-forest-700">Quick sign-in</div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => fill("ramesh@demo.in", "Demo@123")} className="flex items-center justify-center gap-1.5 rounded-md border border-forest-100 bg-white px-3 py-2 text-sm font-semibold text-ink-800 transition-colors hover:border-forest-300 hover:bg-forest-50">
            <UserRound size={15} className="text-forest-600" /> Citizen
          </button>
          <button type="button" onClick={() => fill("admin@demo.gov.in", "Admin@123")} className="flex items-center justify-center gap-1.5 rounded-md border border-forest-100 bg-white px-3 py-2 text-sm font-semibold text-ink-800 transition-colors hover:border-forest-300 hover:bg-forest-50">
            <ShieldCheck size={15} className="text-forest-600" /> Admin
          </button>
        </div>
      </div>
    </div>
  );
}
