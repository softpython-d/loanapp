"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { fetchModel, type PerformanceReport } from "@/lib/model";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: "◫" },
  { href: "/dashboard/analysis", label: "Loan analysis", icon: "⌕" },
  { href: "/dashboard/fairness", label: "Fairness analysis", icon: "◉" },
  { href: "/dashboard/performance", label: "Model performance", icon: "▥" },
  { href: "/dashboard/history", label: "Application history", icon: "◷" },
];

export default function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, configured } = useAuth();
  const isAdmin = user?.app_metadata.role === "admin";
  const [serviceStatus, setServiceStatus] = useState<"checking" | "connected" | "unavailable">("checking");
  const [signingOut, setSigningOut] = useState(false);
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    fetchModel<PerformanceReport>("model-performance")
      .then(() => setServiceStatus("connected"))
      .catch(() => setServiceStatus("unavailable"));
  }, []);

  async function signOut() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setSigningOut(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthError(error.message);
        return;
      }
      router.replace("/login");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  const fullName = user?.user_metadata?.full_name;
  const userName = typeof fullName === "string" ? fullName : user?.email || "Analyst workspace";
  const initials = (typeof fullName === "string" ? fullName : "")
    .split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
    || user?.email?.slice(0, 1).toUpperCase()
    || "A";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">J</span>
          <span>Justifi<span className="brand-dot">.</span></span>
        </Link>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {[...navigation, ...(isAdmin ? [{ href: "/dashboard/manual-reviews", label: "Manual reviews", icon: "✓" }] : [])].map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            return (
              <Link className={`nav-link${active ? " active" : ""}`} href={item.href} key={item.href}>
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.label === "Application history" && <span className="nav-count">Mine</span>}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">?</span>
            <strong>Need a hand?</strong>
            <p>Explore model insights and responsible lending tools.</p>
            <Link href="/dashboard/performance">View model report <span>→</span></Link>
          </div>
          <div className="user-mini">
            <div className="avatar">{user ? initials : "LW"}</div>
            <div><strong>{userName}</strong><span>{user ? "Signed in" : "Personal account"}</span></div>
            <span className="more-icon">···</span>
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{navigation.find((item) => item.href === pathname)?.label || "Loan intelligence"}</strong></div>
          <div className="top-actions">
            <span className={`service-status service-${serviceStatus}`}><span className="status-dot" /> {serviceStatus === "checking" ? "Checking model" : serviceStatus === "connected" ? "Model connected" : "Model unavailable"}</span>
            {user ? <>
              <span className="top-user-email">{user.email}</span>
              <button type="button" className="top-signin top-signout" onClick={signOut} disabled={signingOut}>{signingOut ? "Signing out…" : "Sign out"}</button>
              <div className="top-avatar" title={user.email || "Signed in"}>{initials}</div>
            </> : <>
              <Link href="/login" className="top-signin">{configured ? "Sign in" : "Set up sign in"} <span>↗</span></Link>
              <div className="top-avatar">A</div>
            </>}
          </div>
        </header>
        {authError && <div className="auth-inline-error" role="alert">Sign out failed: {authError}</div>}
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
