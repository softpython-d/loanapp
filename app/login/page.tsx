"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { configured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const supabase = getSupabaseClient();
    if (!supabase) { setMessage("Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to frontend/.env.local to enable account sign-in."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return <main className="auth-page"><Link href="/dashboard" className="brand auth-brand"><span className="brand-mark">l</span><span>lendwise<span className="brand-dot">.</span></span></Link><section className="auth-card"><div className="auth-symbol">l<span>.</span></div><div className="eyebrow">WELCOME BACK</div><h1>Sign in to Lendwise</h1><p>Access your loan intelligence workspace.</p><form onSubmit={submit}><label className="field"><span>Email address</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required /></label><label className="field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></label><button className="button button-primary auth-submit" disabled={busy || !configured}>{busy ? "Signing in…" : "Sign in"} <span>→</span></button></form>{!configured && <div className="auth-message">Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to frontend/.env.local, then restart the app.</div>}{message && <div className="auth-message">{message}</div>}<div className="auth-switch">New to Lendwise? <Link href="/signup">Create an account</Link></div></section><div className="auth-footer"><Link href="/dashboard">← Back to workspace</Link><span>Responsible lending insights</span></div></main>;
}
