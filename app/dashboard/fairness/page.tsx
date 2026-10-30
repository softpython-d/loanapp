"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchModel, readHistory, type ApplicationRecord, type FairnessReport } from "@/lib/model";

export default function FairnessPage() {
  const [report, setReport] = useState<FairnessReport | null>(null);
  const [history, setHistory] = useState<ApplicationRecord[]>([]);
  const [groupBy, setGroupBy] = useState("Gender");
  const [error, setError] = useState("");
  useEffect(() => {
    setHistory(readHistory());
    fetchModel<FairnessReport>("fairness-report").then(setReport).catch((requestError: Error) => setError(requestError.message));
  }, []);
  const groupData = useMemo(() => {
    const counts = new Map<string, { approved: number; total: number }>();
    for (const item of history) {
      let group = item.profile[groupBy];
      if (!group || group === "Unknown") {
        if (groupBy === "Gender" && item.inputs.Gender !== undefined) group = `Group ${item.inputs.Gender}`;
        else continue;
      }
      const current = counts.get(group) || { approved: 0, total: 0 };
      current.total += 1;
      if (item.prediction === "Approved") current.approved += 1;
      counts.set(group, current);
    }
    return [...counts.entries()].map(([group, values]) => ({
      group: groupBy === "Gender" && /^\d+$/.test(group) ? `Group ${group}` : group,
      rate: values.approved / values.total * 100,
      approved: values.approved,
      total: values.total,
    })).sort((a, b) => b.rate - a.rate);
  }, [history, groupBy]);
  const disparity = report?.demographic_parity_difference;
  return (
    <>
      <div className="page-heading"><div className="eyebrow">RESPONSIBLE AI <span className="eyebrow-line" /></div><h1>Fairness analysis</h1><p className="subtitle">Understand how model outcomes vary across groups and inspect the fairness metrics.</p></div>
      {error && <div className="notice notice-warn"><span>!</span><div><strong>Fairness report unavailable</strong><p>{error}</p></div></div>}
      <section className="stat-grid fairness-stats">
        <article className="stat-card"><div className="stat-top"><span>Demographic parity difference</span><span className="stat-icon mint">◉</span></div><div className="stat-value">{typeof disparity === "number" ? disparity.toFixed(3) : "—"}</div><div className="stat-foot">0 is the ideal parity reference</div></article>
        <article className="stat-card"><div className="stat-top"><span>Equalized odds difference</span><span className="stat-icon lavender">⇄</span></div><div className="stat-value">{typeof report?.equalized_odds_difference === "number" ? report.equalized_odds_difference.toFixed(3) : "—"}</div><div className="stat-foot">Lower values indicate smaller disparities</div></article>
        <article className="stat-card"><div className="stat-top"><span>Applications in your history</span><span className="stat-icon blue">▤</span></div><div className="stat-value">{history.length}</div><div className="stat-foot">Grouped outcomes from this browser</div></article>
        <article className="stat-card"><div className="stat-top"><span>Model sensitive attribute</span><span className="stat-icon peach">⌘</span></div><div className="stat-value stat-text-value">Gender</div><div className="stat-foot">Reported by model evaluation endpoint</div></article>
      </section>
      <section className="panel fairness-chart-panel">
        <div className="panel-heading"><div><h2>Predicted approval by group</h2><p>Of the applications in each group, how many were predicted approved?</p></div><label className="select-inline"><span>Compare</span><select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}><option>Gender</option><option>Education</option></select></label></div>
        {groupData.length ? <div className="simple-group-list">{groupData.map((item) => <article className="simple-group-card" key={item.group}><div className="simple-group-heading"><strong>{item.group}</strong><span>{item.approved} of {item.total} predicted approved</span></div><div className="simple-rate-track" role="progressbar" aria-label={`${item.group} predicted approval rate`} aria-valuenow={Math.round(item.rate)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${item.rate}%` }} /></div><div className="simple-rate-caption"><span>Predicted approval rate</span><strong>{item.rate.toFixed(0)}%</strong></div></article>)}</div> : <div className="empty-chart fairness-empty"><div className="empty-circle"><span>◉</span></div><strong>No saved applications to compare yet</strong><p>Analyze or upload applications first. This comparison uses your browser&apos;s saved predictions.</p></div>}
        <p className="simple-chart-note">These are model predictions, not actual loan decisions. Group numbers are dataset codes and do not identify a person or demographic label.</p>
      </section>
      <section className="panel fairness-info">
        <div className="panel-heading"><div><h2>Reading the fairness report</h2><p>Metrics provided by the deployed model&apos;s evaluation endpoint.</p></div><span className="info-badge">i</span></div>
        <div className="fairness-metric-grid"><article><div className="metric-name">Demographic parity difference <span>?</span></div><p>Measures the largest difference in positive prediction rates between sensitive groups. A value closer to zero indicates more similar selection rates.</p><div className="metric-reference"><span>Parity reference</span><strong>0.000</strong></div></article><article><div className="metric-name">Equalized odds difference <span>?</span></div><p>Measures the largest group difference in true-positive and false-positive rates, accounting for the actual outcome.</p><div className="metric-reference"><span>Parity reference</span><strong>0.000</strong></div></article></div>
        <p className="disclaimer">Group rates above use only locally saved predictions and are descriptive, not a statistical fairness audit. The deployed API currently returns aggregate fairness differences rather than per-group approval counts.</p>
      </section>
    </>
  );
}
