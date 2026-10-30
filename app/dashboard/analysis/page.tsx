"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { defaultInput, fetchModel, saveApplications, type ApplicationRecord, type Prediction } from "@/lib/model";

const featureLabels: Record<string, string> = {
  Age: "Age",
  "Person Income": "Annual income ($)",
  "Employee Experience": "Employment experience (years)",
  "Loan Amount": "Requested loan amount ($)",
  "Loan interest Rate": "Interest rate (%)",
  "Loan percentage": "Loan-to-income ratio",
  "Credit History": "Credit history (years)",
  "Credit Score": "Credit score",
  "Previous Loan": "Previous loan (0 = no, 1 = yes)",
};

function toModelInput(row: Record<string, unknown>) {
  const result: Record<string, number> = {};
  for (const [key, fallback] of Object.entries(defaultInput)) {
    const value = row[key];
    if (typeof value === "boolean") result[key] = value ? 1 : 0;
    else if (value !== undefined && value !== null && value !== "") {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new Error(`Column "${key}" contains a non-numeric value.`);
      result[key] = parsed;
    } else result[key] = fallback;
  }
  return result;
}

function parseCsv(text: string): Record<string, unknown>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new Error("The CSV needs a header row and at least one applicant.");
  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, ""));
  return rows.slice(1).map((cells, rowIndex) => {
    const data: Record<string, unknown> = {};
    for (const [index, header] of headers.entries()) {
      const raw = cells[index] ?? "";
      data[header] = raw.toLowerCase() === "true" ? 1 : raw.toLowerCase() === "false" ? 0 : raw;
    }
    if (!headers.length || headers.some((header) => !header)) throw new Error("Every CSV column must have a header.");
    if (cells.length > headers.length) throw new Error(`CSV row ${rowIndex + 2} has more values than the header.`);
    return data;
  });
}

export default function AnalysisPage() {
  const [inputs, setInputs] = useState(defaultInput);
  const [name, setName] = useState("");
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [bulkResults, setBulkResults] = useState<ApplicationRecord[]>([]);
  const [bulkProgress, setBulkProgress] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const setField = (key: string, value: string) => setInputs((previous) => ({ ...previous, [key]: Number(value) }));
  const explanation = prediction?.ai_explanation_and_suggestions;
  const structuredExplanation = explanation && typeof explanation === "object" ? explanation : null;

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setPrediction(null); setBusy(true);
    try {
      const result = await fetchModel<Prediction>("predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inputs) });
      setPrediction(result);
      const education = inputs.Education_Bachelor ? "Bachelor"
        : inputs.Education_Doctorate ? "Doctorate"
          : inputs["Education_High School"] ? "High School"
            : "Master";
      const profile = {
        Gender: `Group ${inputs.Gender}`,
        Education: education,
      };
      saveApplications([{
        id: crypto.randomUUID(), createdAt: new Date().toISOString(), name: name.trim() || "Applicant",
        approval: result.approval_chances_percentage, prediction: result.prediction_class, inputs, profile,
      }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to analyze this application.");
    } finally { setBusy(false); }
  }

  async function submitCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(""); setBulkResults([]); setBusy(true);
    try {
      const applicants = parseCsv(await file.text());
      if (applicants.length > 200) throw new Error("Please upload no more than 200 applicants at a time.");
      const rows: ApplicationRecord[] = [];
      for (const [index, applicant] of applicants.entries()) {
        setBulkProgress(`Analyzing applicant ${index + 1} of ${applicants.length}…`);
        const modelInput = toModelInput(applicant);
        const result = await fetchModel<Prediction>("predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(modelInput) });
        rows.push({
          id: crypto.randomUUID(), createdAt: new Date().toISOString(),
          name: String(applicant.Name || applicant.name || `Applicant ${index + 1}`),
          approval: result.approval_chances_percentage, prediction: result.prediction_class,
          inputs: modelInput,
          profile: {
            Gender: applicant.Gender === undefined ? "Unknown" : `Group ${String(applicant.Gender)}`,
            Education: String(applicant.Education
              || (modelInput.Education_Bachelor ? "Bachelor"
                : modelInput.Education_Doctorate ? "Doctorate"
                  : modelInput["Education_High School"] ? "High School"
                    : modelInput.Education_Master ? "Master"
                      : "Unknown")),
          },
        });
      }
      saveApplications(rows);
      setBulkResults(rows);
      setBulkProgress("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "CSV analysis could not be completed.");
      setBulkProgress("");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <>
      <div className="page-heading"><div className="eyebrow">APPLICANT INTELLIGENCE <span className="eyebrow-line" /></div><h1>Loan analysis</h1><p className="subtitle">Explore an individual application or assess a batch with your model.</p></div>
      {error && <div className="notice notice-error"><span>!</span><div><strong>Analysis could not be completed</strong><p>{error}</p></div><button className="notice-close" onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
      <section className="panel analysis-panel">
        <div className="panel-heading"><div><div className="section-kicker">01 / SINGLE APPLICATION</div><h2>Applicant details</h2><p>Enter the applicant&apos;s profile to generate a model-backed estimate.</p></div><span className="secure-label">⌑ &nbsp;Private to this browser</span></div>
        <form onSubmit={submitApplication}>
          <div className="form-section-label">PERSONAL & FINANCIAL PROFILE</div>
          <div className="form-grid">
            <label className="field"><span>Applicant name <small>Optional</small></span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Alex Morgan" /></label>
            {Object.entries(featureLabels).map(([key, label]) => <label className="field" key={key}><span>{label}</span><input type="number" step={key === "Loan percentage" || key === "Loan interest Rate" ? "0.01" : "1"} value={inputs[key]} onChange={(event) => setField(key, event.target.value)} required /></label>)}
            <label className="field"><span>Gender model code <small>Dataset encoding</small></span><select value={inputs.Gender} onChange={(event) => setField("Gender", event.target.value)}><option value="0">0</option><option value="1">1</option></select></label>
          </div>
          <div className="form-section-label form-section-spaced">PROFILE CATEGORIES</div>
          <div className="category-grid">
            <label className="field"><span>Education</span><select value={inputs.Education_Bachelor ? "Bachelor" : inputs.Education_Doctorate ? "Doctorate" : inputs["Education_High School"] ? "High School" : "Master"} onChange={(event) => {
              const next: Record<string, number> = { ...inputs, Education_Bachelor: 0, Education_Doctorate: 0, "Education_High School": 0, Education_Master: 0 };
              const key = event.target.value === "High School" ? "Education_High School" : `Education_${event.target.value}`;
              next[key] = 1; setInputs(next);
            }}><option>Bachelor</option><option>Doctorate</option><option>High School</option><option>Master</option></select></label>
            <label className="field"><span>Home ownership</span><select value={inputs["Home Onwership_OWN"] ? "OWN" : inputs["Home Onwership_OTHER"] ? "OTHER" : "RENT"} onChange={(event) => setInputs((previous) => ({ ...previous, "Home Onwership_OWN": Number(event.target.value === "OWN"), "Home Onwership_OTHER": Number(event.target.value === "OTHER"), "Home Onwership_RENT": Number(event.target.value === "RENT") }))}><option value="RENT">Rent</option><option value="OWN">Own</option><option value="OTHER">Other</option></select></label>
            <label className="field"><span>Loan intent</span><select value={inputs["Loan Intent_EDUCATION"] ? "EDUCATION" : inputs["Loan Intent_HOMEIMPROVEMENT"] ? "HOMEIMPROVEMENT" : inputs["Loan Intent_MEDICAL"] ? "MEDICAL" : inputs["Loan Intent_VENTURE"] ? "VENTURE" : "PERSONAL"} onChange={(event) => {
              const keys = ["Loan Intent_EDUCATION", "Loan Intent_HOMEIMPROVEMENT", "Loan Intent_MEDICAL", "Loan Intent_PERSONAL", "Loan Intent_VENTURE"];
              const next = { ...inputs }; keys.forEach((key) => { next[key] = Number(key === `Loan Intent_${event.target.value}`); }); setInputs(next);
            }}><option value="EDUCATION">Education</option><option value="HOMEIMPROVEMENT">Home improvement</option><option value="MEDICAL">Medical</option><option value="PERSONAL">Personal</option><option value="VENTURE">Business venture</option></select></label>
          </div>
          <div className="form-actions"><span className="form-hint">Results are estimates and should not be used as the sole basis for a lending decision.</span><button className="button button-primary" disabled={busy}>{busy ? <><span className="spinner" /> Analyzing…</> : <>Analyze application <span>→</span></>}</button></div>
        </form>
      </section>

      {prediction && <section className="panel result-panel">
        <div className="result-topline">
          <div><div className="section-kicker">YOUR APPLICATION RESULT</div><h2>Loan approval estimate</h2></div>
          <span className={`status-pill result-status ${prediction.prediction_class === "Approved" ? "approved" : "rejected"}`}><i />Predicted {prediction.prediction_class}</span>
        </div>
        <div className="result-summary">
          <div className="result-score-card">
            <div className="result-score-label"><span className="result-score-icon">↗</span><span>Estimated approval chance</span></div>
            <div className="result-score-value">{prediction.approval_chances_percentage.toFixed(1)}<small>%</small></div>
            <div className="result-track" role="progressbar" aria-label="Estimated approval chance" aria-valuenow={Math.round(prediction.approval_chances_percentage)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${prediction.approval_chances_percentage}%` }} /></div>
            <div className="result-scale"><span>0%</span><span>100%</span></div>
          </div>
          <div className={`result-outcome result-outcome-${prediction.prediction_class === "Approved" ? "approved" : "rejected"}`}>
            <span className="outcome-symbol">{prediction.prediction_class === "Approved" ? "✓" : "!"}</span>
            <div><strong>Model estimate</strong><p>This is an estimate from the model, not a lending decision.</p></div>
          </div>
        </div>
        <div className="result-detail-grid">
          {prediction.ai_explanation_and_suggestions && <article className="explanation-box">
            <div className="detail-heading"><span className="detail-icon explanation-icon">✳</span><div><strong>Plain-English explanation</strong><span>Generated by AI from the model estimate and top factors</span></div></div>
            {structuredExplanation ? <>
              <p>{structuredExplanation.summary}</p>
              {(structuredExplanation.positive_factors?.length || structuredExplanation.negative_factors?.length) ? <div className="ai-factor-groups">
                {structuredExplanation.positive_factors && structuredExplanation.positive_factors.length > 0 && <div className="ai-factor-group"><strong>Factors that raised the estimate</strong><ul>{structuredExplanation.positive_factors.map((item, index) => <li key={`positive-${index}`}>{item}</li>)}</ul></div>}
                {structuredExplanation.negative_factors && structuredExplanation.negative_factors.length > 0 && <div className="ai-factor-group"><strong>Factors that lowered the estimate</strong><ul>{structuredExplanation.negative_factors.map((item, index) => <li key={`negative-${index}`}>{item}</li>)}</ul></div>}
              </div> : null}
              {structuredExplanation.suggestions && structuredExplanation.suggestions.length > 0 && <div className="ai-suggestions"><strong>Possible next steps</strong><ol>{structuredExplanation.suggestions.map((item, index) => <li key={`suggestion-${index}`}>{item}</li>)}</ol></div>}
              {structuredExplanation.loan_recommendations && structuredExplanation.loan_recommendations.length > 0 && <div className="loan-recommendations">
                <div className="loan-recommendations-heading"><span className="detail-icon loan-icon">⌂</span><div><strong>Loan types to explore</strong><span>General categories selected for this application</span></div></div>
                <div className="loan-recommendations-list">{structuredExplanation.loan_recommendations.slice(0, 3).map((loan, index) => <article className="loan-recommendation" key={`${loan.name}-${index}`}><div className="loan-recommendation-title"><span>{index + 1}</span><strong>{loan.name}</strong></div><p>{loan.why_it_may_fit}</p><div className="loan-check"><strong>Compare:</strong> {loan.what_to_check}</div></article>)}</div>
                <p className="loan-recommendations-note">These are AI-generated loan categories, not specific lender offers. Check actual rates, fees, terms, and eligibility with providers.</p>
              </div>}
            </> : typeof explanation === "string" ? <p>{explanation}</p> : null}
            <p className="ai-disclaimer">AI-generated guidance can be inaccurate. This estimate is not a lending decision or financial advice.</p>
          </article>}
          {prediction.local_shap_details && <article className="factor-list">
            <div className="detail-heading"><span className="detail-icon factor-icon">⌁</span><div><strong>Top contributing factors</strong><span>How features influenced the model score</span></div></div>
            <div className="factor-items">{Object.entries(prediction.local_shap_details).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4).map(([factor, value]) => <div className="factor-item" key={factor}><span className={`factor-direction ${value >= 0 ? "factor-positive" : "factor-negative"}`}>{value >= 0 ? "↑" : "↓"}</span><span className="factor-name">{factor.replaceAll("_", " ")}</span><span className={`factor-value ${value >= 0 ? "factor-positive" : "factor-negative"}`}>{value >= 0 ? "+" : ""}{value.toFixed(3)}</span></div>)}</div>
            <p className="factor-note">Positive and negative values show direction of contribution to the model score.</p>
          </article>}
        </div>
      </section>}

      <section className="panel bulk-panel">
        <div className="panel-heading"><div><div className="section-kicker">02 / BULK APPLICATIONS</div><h2>Analyze a portfolio</h2><p>Upload applicant data as a CSV and evaluate each row with the deployed model.</p></div><span className="upload-icon">⇧</span></div>
        <div className="upload-box" onClick={() => !busy && fileInput.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") fileInput.current?.click(); }} role="button" tabIndex={0}>
          <input ref={fileInput} type="file" accept=".csv,text/csv" onChange={submitCsv} hidden />
          <span className="upload-cloud">⇧</span><strong>{busy && bulkProgress ? bulkProgress : "Drop your CSV here, or browse"}</strong><span>CSV file · Up to 200 applicants · Maximum 10 MB recommended</span>
          <span className="button button-secondary button-small">Choose CSV file</span>
        </div>
        <div className="csv-note"><span>ⓘ</span><p>Use the exact feature headers expected by the model (for example <code>Age</code>, <code>Person Income</code>, <code>Credit Score</code>). Missing columns use model defaults; extra columns are ignored.</p></div>
        {bulkResults.length > 0 && <div className="bulk-summary"><strong>{bulkResults.length} applications analyzed</strong><span>{bulkResults.filter((item) => item.prediction === "Approved").length} predicted approved</span><span>{bulkResults.filter((item) => item.prediction !== "Approved").length} predicted declined</span></div>}
      </section>
    </>
  );
}
