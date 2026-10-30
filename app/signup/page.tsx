"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

export default function SignupPage() {
  const router = useRouter();
  const { configured } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const supabase = getSupabaseClient();
    if (!supabase) { setMessage("Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to frontend/.env.local to enable account creation."); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (error) {
        setMessage(error.message);
        return;
      }
      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        setMessage("Account created. Confirm your email, then sign in to continue.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account creation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return <main className="auth-page"><Link href="/dashboard" className="brand auth-brand"><span className="brand-mark">l</span><span>lendwise<span className="brand-dot">.</span></span></Link><section className="auth-card"><div className="auth-symbol">l<span>.</span></div><div className="eyebrow">GET STARTED</div><h1>Create your account</h1><p>Set up your workspace for clearer loan insights.</p><form onSubmit={submit}><label className="field"><span>Your name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex Morgan" autoComplete="name" required /></label><label className="field"><span>Email address</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required /></label><label className="field"><span>Password</span><input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required /></label><button className="button button-primary auth-submit" disabled={busy || !configured}>{busy ? "Creating account…" : "Create account"} <span>→</span></button></form>{!configured && <div className="auth-message">Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to frontend/.env.local, then restart the app.</div>}{message && <div className="auth-message">{message}</div>}<div className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></div></section><div className="auth-footer"><Link href="/dashboard">← Back to workspace</Link><span>Responsible lending insights</span></div></main>;
}
