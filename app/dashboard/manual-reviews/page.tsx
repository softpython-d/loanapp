"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { completeManualReview, fetchAllManualReviews, formatDate, type ManualReviewRecord } from "@/lib/model";

type ReviewDraft = {
  result: NonNullable<ManualReviewRecord["review_result"]> | "";
  notes: string;
};

const resultLabels: Record<NonNullable<ManualReviewRecord["review_result"]>, string> = {
  approved: "Approved",
  declined: "Declined",
  more_info: "More information needed",
};

export default function ManualReviewsPage() {
  const { user, loading } = useAuth();
  const isAdmin = user?.app_metadata.role === "admin";
  const [reviews, setReviews] = useState<ManualReviewRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [busyId, setBusyId] = useState("");
  const [queueLoading, setQueueLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadReviews = useCallback(async () => {
    const records = await fetchAllManualReviews();
    setReviews(records);
    setDrafts(Object.fromEntries(records.map((record) => [record.id, {
      result: record.review_result || "",
      notes: record.review_notes || "",
    }])));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadReviews().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load the review queue.");
    }).finally(() => setQueueLoading(false));
  }, [isAdmin, loadReviews]);

  async function saveReview(review: ManualReviewRecord) {
    const draft = drafts[review.id];
    if (!draft?.result) return;
    setBusyId(review.id); setError(""); setMessage("");
    try {
      await completeManualReview(review.id, draft.result, draft.notes);
      setMessage(`Saved the decision for ${review.applicant_name}.`);
      await loadReviews();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this decision.");
    } finally {
      setBusyId("");
    }
  }

  if (loading) return <div className="panel"><p>Checking administrator access…</p></div>;
  if (!isAdmin) return (
    <>
      <div className="page-heading"><div className="eyebrow">REVIEW WORKSPACE <span className="eyebrow-line" /></div><h1>Manual reviews</h1></div>
      <div className="notice notice-error"><span>!</span><div><strong>Administrator access required</strong><p>This page is only available to accounts assigned the admin role in Supabase.</p></div></div>
    </>
  );

  return (
    <>
      <div className="page-heading"><div className="eyebrow">REVIEW WORKSPACE <span className="eyebrow-line" /></div><h1>Manual reviews</h1><p className="subtitle">Review submitted applications and record a decision for the applicant.</p></div>
      {error && <div className="notice notice-error" role="alert"><span>!</span><div><strong>Review action failed</strong><p>{error}</p></div></div>}
      {message && <div className="notice notice-info" role="status"><span>i</span><div><strong>Decision saved</strong><p>{message}</p></div></div>}
      <section className="panel history-panel">
        <div className="panel-heading"><div><h2>Submitted applications</h2><p>{reviews.filter((review) => review.status === "pending").length} awaiting review · {reviews.length} total</p></div></div>
        {queueLoading ? <p className="manual-review-loading">Loading review queue…</p> : reviews.length ? <div className="manual-review-list">{reviews.map((review) => {
          const draft = drafts[review.id];
          return <article className="manual-review-card" key={review.id}>
            <div className="manual-review-card-heading">
              <div><h3>{review.applicant_name}</h3><p>Submitted {formatDate(review.created_at)} · Loan amount ${Number(review.applicant_inputs["Loan Amount"] || 0).toLocaleString()}</p></div>
              <span className={`status-pill ${review.status === "completed" ? review.review_result === "approved" ? "approved" : review.review_result === "declined" ? "rejected" : "review-pending" : "review-pending"}`}><i />{review.status === "completed" && review.review_result ? resultLabels[review.review_result] : "Pending"}</span>
            </div>
            <div className="manual-review-model-summary"><span>Model estimate: <strong>{review.model_approval.toFixed(1)}%</strong></span><span>Model prediction: <strong>{review.model_prediction}</strong></span></div>
            <details className="manual-review-details"><summary>View application details</summary><pre>{JSON.stringify(review.applicant_inputs, null, 2)}</pre></details>
            {draft && <div className="manual-review-form">
              <label className="field"><span>Reviewer decision</span><select required value={draft.result} onChange={(event) => {
                const result = event.target.value;
                if (result === "" || result === "approved" || result === "declined" || result === "more_info") {
                  setDrafts((previous) => ({ ...previous, [review.id]: { ...draft, result } }));
                }
              }}>
                <option value="">Select a decision</option>
                <option value="approved">Approved</option><option value="declined">Declined</option><option value="more_info">More information needed</option>
              </select></label>
              <label className="field"><span>Notes for applicant <small>Optional</small></span><textarea rows={3} value={draft.notes} onChange={(event) => setDrafts((previous) => ({ ...previous, [review.id]: { ...draft, notes: event.target.value } }))} /></label>
              <button className="button button-primary" type="button" onClick={() => saveReview(review)} disabled={busyId === review.id || !draft.result}>{busyId === review.id ? "Saving…" : "Save decision"}</button>
            </div>}
          </article>;
        })}</div> : <div className="table-empty"><div className="empty-list-icon">◷</div><div><strong>No applications to review</strong><p>Applications submitted for manual review will appear here.</p></div></div>}
      </section>
      <p className="report-footnote">The review result is stored separately from the model estimate and appears in the applicant&apos;s history.</p>
    </>
  );
}
