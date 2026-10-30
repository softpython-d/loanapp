"use client";

import { useEffect, useState } from "react";
import { fetchModel, metricPercent, type FairnessReport, type GlobalFeatureImportance, type PerformanceReport } from "@/lib/model";

const metrics = [
  { key: "accuracy", label: "Accuracy", hint: "Overall correct predictions", icon: "◎" },
  { key: "precision", label: "Precision", hint: "Approved predictions that were correct", icon: "⌖" },
  { key: "recall", label: "Recall", hint: "Actual approvals identified", icon: "↗" },
  { key: "f1_score", label: "F1 score", hint: "Balance of precision and recall", icon: "✳" },
  { key: "roc_auc", label: "ROC-AUC", hint: "Ability to distinguish both classes", icon: "⌁" },
] as const;

export default function PerformancePage() {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [fairness, setFairness] = useState<FairnessReport | null>(null);
  const [featureImportance, setFeatureImportance] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.allSettled([
      fetchModel<PerformanceReport>("model-performance"),
      fetchModel<FairnessReport>("fairness-report"),
      fetchModel<GlobalFeatureImportance>("shap-details/global"),
    ]).then(([performanceResult, fairnessResult, importanceResult]) => {
      const failures: string[] = [];
      if (performanceResult.status === "fulfilled") setReport(performanceResult.value);
      else failures.push(`Performance report: ${performanceResult.reason instanceof Error ? performanceResult.reason.message : "request failed"}`);
      if (fairnessResult.status === "fulfilled") setFairness(fairnessResult.value);
      else failures.push(`Fairness report: ${fairnessResult.reason instanceof Error ? fairnessResult.reason.message : "request failed"}`);
      if (importanceResult.status === "fulfilled") setFeatureImportance(importanceResult.value.feature_importance ?? {});
      else failures.push(`SHAP details: ${importanceResult.reason instanceof Error ? importanceResult.reason.message : "request failed"}`);
      if (failures.length) setError(failures.join(" "));
    });
  }, []);
  const confusion = report?.confusion_matrix;
  const topFeatures = Object.entries(featureImportance ?? {})
    .filter(([, value]) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const maxFeatureImportance = Math.max(0, ...topFeatures.map(([, value]) => value));
  return (
    <>
      <div className="page-heading heading-row"><div><div className="eyebrow">MODEL CARD <span className="eyebrow-line" /></div><h1>Model performance</h1><p className="subtitle">Evaluation metrics and methodology for the deployed loan approval model.</p></div><span className={`live-tag${error ? " live-tag-error" : ""}`}><i /> {report ? "Live report" : error ? "Unavailable" : "Loading report"}</span></div>
      {error && <div className="notice notice-error"><span>!</span><div><strong>Could not load the model report</strong><p>{error}</p></div></div>}
      <div className="report-banner"><div className="report-emblem">✳</div><div><span className="report-overline">CREDIT APPROVAL MODEL</span><strong>Loan approval classifier</strong><span>Evaluation report served by your deployed model</span></div>      <div className="report-model-id"><span>MODEL STATUS</span><strong className={error ? "report-model-error" : ""}><i /> {report ? "Connected" : error ? "Unavailable" : "Checking…"}</strong></div></div>
      <section className="metric-grid">
        {metrics.map((metric, index) => {
          const value = report?.[metric.key];
          return <article className="metric-card" key={metric.key}><div className="metric-card-top"><span className={`metric-icon metric-${index}`}>{metric.icon}</span><span className="metric-card-label">{metric.label}</span></div><strong className="metric-card-value">{metricPercent(value)}</strong><span className="metric-card-hint">{metric.hint}</span><div className="metric-progress"><i style={{ width: `${typeof value === "number" ? Math.max(0, Math.min(100, value * 100)) : 0}%` }} /></div></article>;
        })}
      </section>
      <section className="performance-grid">
        <article className="panel evaluation-panel"><div className="panel-heading"><div><h2>Evaluation summary</h2><p>Training and test configuration</p></div><span className="subtle-icon">▥</span></div>
          <div className="evaluation-row"><div><span>Dataset size</span><small>Training dataset used by model</small></div><strong>Not reported</strong></div>
          <div className="evaluation-row"><div><span>Train / test split</span><small>Model training configuration</small></div><strong>80% / 20%</strong></div>
          <div className="evaluation-row"><div><span>Positive class</span><small>Target label in training data</small></div><strong className="positive-class"><i /> Approved (1)</strong></div>
          <div className="evaluation-row"><div><span>Model family</span><small>Estimator reported by backend</small></div><strong>XGBoost classifier</strong></div>
          <p className="summary-note">The API does not expose the dataset row count or evaluation split metadata. The 80/20 split shown here reflects the current model source configuration.</p>
        </article>
        <article className="panel confusion-panel"><div className="panel-heading"><div><h2>Confusion matrix</h2><p>Predicted vs. actual test outcomes</p></div><span className="subtle-icon">▦</span></div>
          {confusion ? <div className="matrix-layout"><div className="matrix-y-label">ACTUAL</div><div className="matrix-content"><div className="matrix-x-label">PREDICTED</div><div className="matrix-col-labels"><span>Declined</span><span>Approved</span></div><div className="matrix-row"><span className="matrix-row-label">Declined</span><div className="matrix-cell true-cell"><small>TRUE NEGATIVE</small><strong>{confusion.True_Negative ?? 0}</strong></div><div className="matrix-cell false-cell"><small>FALSE POSITIVE</small><strong>{confusion.False_Positive ?? 0}</strong></div></div><div className="matrix-row"><span className="matrix-row-label">Approved</span><div className="matrix-cell false-cell"><small>FALSE NEGATIVE</small><strong>{confusion.False_Negative ?? 0}</strong></div><div className="matrix-cell true-cell"><small>TRUE POSITIVE</small><strong>{confusion.True_Positive ?? 0}</strong></div></div></div></div> : <div className="empty-small">Confusion matrix is not available yet.</div>}
        </article>
      </section>
      <section className="panel shap-panel">
        <div className="panel-heading"><div><h2>What influences the model?</h2><p>Global SHAP feature importance across the model&apos;s evaluation data</p></div><span className="subtle-icon">✳</span></div>
        {topFeatures.length ? <div className="shap-list">{topFeatures.map(([feature, importance]) => <div className="shap-row" key={feature}><div className="shap-feature-name">{feature.replaceAll("_", " ")}</div><div className="shap-track" role="progressbar" aria-label={`${feature} relative importance`} aria-valuenow={maxFeatureImportance ? Math.round(importance / maxFeatureImportance * 100) : 0} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${maxFeatureImportance ? importance / maxFeatureImportance * 100 : 0}%` }} /></div><strong>{importance.toFixed(3)}</strong></div>)}</div> : <div className="empty-small">Global feature importance is not available yet.</div>}
        <p className="shap-note">A higher value means the feature had more influence on the model&apos;s predictions overall. This summary does not show whether a feature raises or lowers an individual applicant&apos;s score, and it does not imply cause and effect.</p>
      </section>
      <section className="panel evaluation-fairness"><div className="panel-heading"><div><h2>Fairness indicators</h2><p>Aggregate disparity measures returned by the model API</p></div><span className="info-badge">i</span></div><div className="fairness-indicator-grid"><div><span>Demographic parity difference</span><strong>{typeof fairness?.demographic_parity_difference === "number" ? fairness.demographic_parity_difference.toFixed(4) : "—"}</strong><small>Closer to zero indicates smaller disparity</small></div><div><span>Equalized odds difference</span><strong>{typeof fairness?.equalized_odds_difference === "number" ? fairness.equalized_odds_difference.toFixed(4) : "—"}</strong><small>Closer to zero indicates smaller disparity</small></div><div className="fairness-navigation"><span>Explore by group</span><p>Compare saved outcomes and review fairness definitions.</p><a href="/dashboard/fairness">Open fairness analysis →</a></div></div></section>
      <p className="report-footnote">Performance values are produced by the model API and reflect its configured evaluation dataset. They are not a guarantee of future performance.</p>
    </>
  );
}
