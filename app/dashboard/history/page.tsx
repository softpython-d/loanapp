"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchManualReviews, formatDate, readHistory, type ApplicationRecord } from "@/lib/model";
import { useAuth } from "@/components/AuthProvider";

export default function HistoryPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState<ApplicationRecord[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const localHistory = readHistory();
    setHistory(localHistory);
    if (user) {
      fetchManualReviews(user.id).then((reviews) => {
        if (!active) return;
        const byId = new Map(localHistory.map((item) => [item.id, item]));
        for (const review of reviews) {
          const existing = byId.get(review.application_id);
          if (existing) {
            byId.set(review.application_id, {
              ...existing,
              manualReviewStatus: review.status,
              manualReviewResult: review.review_result,
              manualReviewNotes: review.review_notes,
            });
          } else {
            byId.set(review.application_id, {
              id: review.application_id,
              createdAt: review.created_at,
              name: review.applicant_name,
              approval: review.model_approval,
              prediction: review.model_prediction,
              inputs: review.applicant_inputs,
              profile: {},
              manualReviewStatus: review.status,
              manualReviewResult: review.review_result,
              manualReviewNotes: review.review_notes,
            });
          }
        }
        setHistory([...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      }).catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load manual review results.");
      });
    }
    return () => { active = false; };
  }, [user]);
  const reviewResultLabel = (result: ApplicationRecord["manualReviewResult"]) =>
    result === "approved" ? "Approved by reviewer" : result === "declined" ? "Declined by reviewer" : result === "more_info" ? "More information needed" : "Pending";
  const reviewResultClass = (result: ApplicationRecord["manualReviewResult"]) =>
    result === "approved" ? "approved" : result === "declined" ? "rejected" : "review-pending";
  return (
    <>
      <div className="page-heading heading-row"><div><div className="eyebrow">YOUR WORKSPACE <span className="eyebrow-line" /></div><h1>Application history</h1><p className="subtitle">Review model estimates and any human review results.</p></div><Link className="button button-primary" href="/dashboard/analysis"><span className="button-plus">＋</span> New analysis</Link></div>
      {!user && <div className="notice notice-info"><span>i</span><div><strong>Sign in to sync review results</strong><p>Analyses stay in this browser. Sign in before requesting a manual review to receive its decision in your account history.</p></div></div>}
      {error && <div className="notice notice-error" role="alert"><span>!</span><div><strong>Manual review results could not be loaded</strong><p>{error}</p></div></div>}
      <section className="panel history-panel">
        <div className="panel-heading"><div><h2>Analyzed applications</h2><p>{history.length} saved record{history.length === 1 ? "" : "s"}</p></div></div>
        {history.length ? <div className="table-scroll"><table><thead><tr><th>APPLICANT</th><th>DATE ANALYZED</th><th>LOAN AMOUNT</th><th>APPROVAL CHANCE</th><th>MODEL ESTIMATE</th><th>MANUAL REVIEW</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td><div className="applicant-cell"><span className="applicant-avatar">{item.name.slice(0, 1).toUpperCase()}</span><strong>{item.name}</strong></div></td><td>{formatDate(item.createdAt)}</td><td>${Number(item.inputs["Loan Amount"] || 0).toLocaleString()}</td><td><span className="chance">{item.approval.toFixed(1)}%</span></td><td><span className={`status-pill ${item.prediction === "Approved" ? "approved" : "rejected"}`}><i />{item.prediction}</span></td><td>{item.manualReviewStatus ? <div className="review-result-cell"><span className={`status-pill ${item.manualReviewStatus === "completed" ? reviewResultClass(item.manualReviewResult) : "review-pending"}`}><i />{item.manualReviewStatus === "completed" ? reviewResultLabel(item.manualReviewResult) : "Pending"}</span>{item.manualReviewNotes && <small>{item.manualReviewNotes}</small>}</div> : <span className="history-not-requested">Not requested</span>}</td></tr>)}</tbody></table></div> : <div className="table-empty"><div className="empty-list-icon">◷</div><div><strong>Your history is waiting</strong><p>Predicted applications will be listed here once you run an analysis.</p></div><Link className="text-link" href="/dashboard/analysis">Analyze an application <span>→</span></Link></div>}
      </section>
      <p className="report-footnote">Model predictions are estimates. Manual review results are human decisions and are shown separately.</p>
    </>
  );
}
