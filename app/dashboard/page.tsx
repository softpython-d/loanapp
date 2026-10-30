"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchModel, formatDate, metricPercent, readHistory, type ApplicationRecord, type FairnessReport, type PerformanceReport } from "@/lib/model";

function Donut({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="donut-wrap">
      <svg className="donut" viewBox="0 0 120 120" aria-label={`${clamped.toFixed(1)} percent predicted approvals`}>
        <circle className="donut-track" cx="60" cy="60" r="48" />
        <circle className="donut-value" cx="60" cy="60" r="48" strokeDasharray={`${clamped * 3.016} 301.6`} />
      </svg>
      <div className="donut-center"><strong>{clamped.toFixed(0)}%</strong><span>approval-ready</span></div>
    </div>
  );
}

export default function OverviewPage() {
  const [history, setHistory] = useState<ApplicationRecord[]>([]);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [fairness, setFairness] = useState<FairnessReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setHistory(readHistory());
    Promise.all([
      fetchModel<PerformanceReport>("model-performance"),
      fetchModel<FairnessReport>("fairness-report"),
    ]).then(([performance, fairnessReport]) => {
      setReport(performance);
      setFairness(fairnessReport);
    }).catch((requestError: Error) => setError(requestError.message));
  }, []);

  const approvedRate = useMemo(() => history.length ? history.filter((item) => item.prediction === "Approved").length / history.length * 100 : 0, [history]);
  const accuracy = report ? metricPercent(report.accuracy) : "—";
  const disparity = fairness?.demographic_parity_difference;
  const recent = history.slice(0, 5);

  return (
    <>
      <div className="page-heading heading-row">
        <div><div className="eyebrow">PORTFOLIO OVERVIEW <span className="eyebrow-line" /></div><h1>Good morning, analyst <span className="wave">✦</span></h1><p className="subtitle">Here&apos;s what&apos;s happening across your loan portfolio.</p></div>
        <Link className="button button-primary" href="/dashboard/analysis"><span className="button-plus">＋</span> New analysis</Link>
      </div>
      {error && <div className="notice notice-warn"><span>!</span><div><strong>Model metrics are unavailable</strong><p>{error} Check that the Render service is awake and its API is reachable.</p></div></div>}

      <section className="stat-grid" aria-label="Portfolio metrics">
        <article className="stat-card"><div className="stat-top"><span>Total applications analyzed</span><span className="stat-icon mint">▤</span></div><div className="stat-value">{history.length}<span className="stat-unit"> this browser</span></div><div className="stat-foot"><span className="positive-dot" /> From your saved application history</div></article>
        <article className="stat-card"><div className="stat-top"><span>Predicted approval rate</span><span className="stat-icon lavender">↗</span></div><div className="stat-value">{history.length ? `${approvedRate.toFixed(1)}%` : "—"}</div><div className="stat-foot">Based on {history.length} analyzed application{history.length === 1 ? "" : "s"}</div></article>
        <article className="stat-card"><div className="stat-top"><span>Model accuracy</span><span className="stat-icon blue">◎</span></div><div className="stat-value">{accuracy}</div><div className="stat-foot">Evaluation score <Link href="/dashboard/performance">View report <span>↗</span></Link></div></article>
        <article className="stat-card"><div className="stat-top"><span>Fairness disparity</span><span className="stat-icon peach">⌁</span></div><div className="stat-value">{typeof disparity === "number" ? `${(disparity * 100).toFixed(1)}%` : "—"}</div><div className="stat-foot">Demographic parity difference <Link href="/dashboard/fairness">Details <span>↗</span></Link></div></article>
      </section>

      <section className="overview-grid">
        <article className="panel approval-panel">
          <div className="panel-heading"><div><h2>Approval outlook</h2><p>Share of your analyzed applications predicted approved</p></div><span className="period-pill">Your history <span>⌄</span></span></div>
          {history.length ? <div className="approval-content"><Donut value={approvedRate} /><div className="approval-legend"><div><span className="legend-dot teal" /><span>Predicted approved</span><strong>{history.filter((item) => item.prediction === "Approved").length}</strong></div><div><span className="legend-dot gray" /><span>Predicted declined</span><strong>{history.filter((item) => item.prediction !== "Approved").length}</strong></div><p>Predictions are model estimates, not lending decisions.</p></div></div> : <div className="empty-chart"><div className="empty-circle"><span>↗</span></div><strong>Start with your first application</strong><p>Your approval outlook will appear here after an analysis.</p><Link className="text-link" href="/dashboard/analysis">Analyze an application <span>→</span></Link></div>}
        </article>
        <article className="panel insight-panel">
          <div className="panel-heading"><div><h2>Model snapshot</h2><p>Latest evaluation from your deployed model</p></div><Link className="icon-link" href="/dashboard/performance">↗</Link></div>
          <div className="snapshot-score"><div><span className="snapshot-label">ROC-AUC</span><strong>{report ? metricPercent(report.roc_auc) : "—"}</strong></div><span className="score-gauge">◔</span></div>
          <div className="snapshot-divider" />
          <div className="snapshot-row"><span>Precision</span><strong>{report ? metricPercent(report.precision) : "—"}</strong><span className="tiny-bar"><i style={{ width: `${(report?.precision ?? 0) * 100}%` }} /></span></div>
          <div className="snapshot-row"><span>Recall</span><strong>{report ? metricPercent(report.recall) : "—"}</strong><span className="tiny-bar"><i style={{ width: `${(report?.recall ?? 0) * 100}%` }} /></span></div>
          <div className="snapshot-row"><span>F1 score</span><strong>{report ? metricPercent(report.f1_score) : "—"}</strong><span className="tiny-bar"><i style={{ width: `${(report?.f1_score ?? 0) * 100}%` }} /></span></div>
          <Link className="report-link" href="/dashboard/performance">Explore full model report <span>→</span></Link>
        </article>
      </section>

      <section className="panel recent-panel">
        <div className="panel-heading"><div><h2>Recent applications</h2><p>Your latest applicant analyses</p></div><Link className="button button-secondary button-small" href="/dashboard/history">View all <span>→</span></Link></div>
        {recent.length ? <div className="table-scroll"><table><thead><tr><th>APPLICANT</th><th>DATE ANALYZED</th><th>LOAN AMOUNT</th><th>APPROVAL CHANCE</th><th>STATUS</th><th /></tr></thead><tbody>{recent.map((item) => <tr key={item.id}><td><div className="applicant-cell"><span className="applicant-avatar">{item.name.slice(0, 1).toUpperCase()}</span><strong>{item.name}</strong></div></td><td>{formatDate(item.createdAt)}</td><td>${Number(item.inputs["Loan Amount"] || 0).toLocaleString()}</td><td><span className="chance">{item.approval.toFixed(1)}%</span></td><td><span className={`status-pill ${item.prediction === "Approved" ? "approved" : "rejected"}`}><i />{item.prediction}</span></td><td><span className="row-arrow">↗</span></td></tr>)}</tbody></table></div> : <div className="table-empty"><div className="empty-list-icon">▤</div><div><strong>No applications yet</strong><p>Run a single application or upload a CSV to see your recent activity here.</p></div><Link className="text-link" href="/dashboard/analysis">Get started <span>→</span></Link></div>}
      </section>
      <footer className="page-footer"><span>© 2026 Justifi</span><span>Built for thoughtful lending <span className="footer-heart">♥</span></span><Link href="/dashboard/fairness">Responsible AI principles</Link></footer>
    </>
  );
}
