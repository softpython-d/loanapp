"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDate, readHistory, type ApplicationRecord } from "@/lib/model";

export default function HistoryPage() {
  const [history, setHistory] = useState<ApplicationRecord[]>([]);
  useEffect(() => setHistory(readHistory()), []);
  return (
    <>
      <div className="page-heading heading-row"><div><div className="eyebrow">YOUR WORKSPACE <span className="eyebrow-line" /></div><h1>Application history</h1><p className="subtitle">Review predictions saved from analyses in this browser.</p></div><Link className="button button-primary" href="/dashboard/analysis"><span className="button-plus">＋</span> New analysis</Link></div>
      <div className="notice notice-info"><span>i</span><div><strong>History is stored locally</strong><p>Applications are saved in this browser only. They are not synced to an account or sent to a database.</p></div></div>
      <section className="panel history-panel">
        <div className="panel-heading"><div><h2>Analyzed applications</h2><p>{history.length} saved record{history.length === 1 ? "" : "s"}</p></div></div>
        {history.length ? <div className="table-scroll"><table><thead><tr><th>APPLICANT</th><th>DATE ANALYZED</th><th>LOAN AMOUNT</th><th>APPROVAL CHANCE</th><th>STATUS</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td><div className="applicant-cell"><span className="applicant-avatar">{item.name.slice(0, 1).toUpperCase()}</span><strong>{item.name}</strong></div></td><td>{formatDate(item.createdAt)}</td><td>${Number(item.inputs["Loan Amount"] || 0).toLocaleString()}</td><td><span className="chance">{item.approval.toFixed(1)}%</span></td><td><span className={`status-pill ${item.prediction === "Approved" ? "approved" : "rejected"}`}><i />{item.prediction}</span></td></tr>)}</tbody></table></div> : <div className="table-empty"><div className="empty-list-icon">◷</div><div><strong>Your history is waiting</strong><p>Predicted applications will be listed here once you run an analysis.</p></div><Link className="text-link" href="/dashboard/analysis">Analyze an application <span>→</span></Link></div>}
      </section>
      <p className="report-footnote">Predictions are estimates from the machine-learning model and are not credit decisions.</p>
    </>
  );
}
