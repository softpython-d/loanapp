import { getSupabaseClient } from "@/lib/supabase";

export type Prediction = {
  approval_chances_percentage: number;
  prediction_class: string;
  local_shap_details?: Record<string, number>;
  ai_explanation_and_suggestions?: string | {
    summary: string;
    positive_factors?: string[];
    negative_factors?: string[];
    suggestions?: string[];
    loan_recommendations?: {
      name: string;
      why_it_may_fit: string;
      what_to_check: string;
    }[];
  } | null;
};

export type PerformanceReport = {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  roc_auc?: number;
  confusion_matrix?: {
    True_Negative?: number;
    False_Positive?: number;
    False_Negative?: number;
    True_Positive?: number;
  };
};

export type FairnessReport = {
  demographic_parity_difference?: number;
  equalized_odds_difference?: number;
  error?: string;
};

export type GlobalFeatureImportance = {
  feature_importance?: Record<string, number>;
};

export type ApplicationRecord = {
  id: string;
  createdAt: string;
  name: string;
  approval: number;
  prediction: string;
  inputs: Record<string, number>;
  profile: Record<string, string>;
  manualReviewStatus?: "pending" | "completed";
  manualReviewResult?: "approved" | "declined" | "more_info" | null;
  manualReviewNotes?: string | null;
};

export type ManualReviewRecord = {
  id: string;
  application_id: string;
  user_id: string;
  applicant_name: string;
  applicant_inputs: Record<string, number>;
  model_approval: number;
  model_prediction: string;
  status: "pending" | "completed";
  review_result: "approved" | "declined" | "more_info" | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
};

export const HISTORY_KEY = "lendwise-applications";

export const defaultInput: Record<string, number> = {
  Age: 30,
  Gender: 0,
  "Person Income": 60000,
  "Employee Experience": 5,
  "Loan Amount": 12000,
  "Loan interest Rate": 10,
  "Loan percentage": 0.2,
  "Credit History": 5,
  "Credit Score": 680,
  "Previous Loan": 0,
  Education_Bachelor: 0,
  Education_Doctorate: 0,
  "Education_High School": 0,
  Education_Master: 1,
  "Home Onwership_OTHER": 0,
  "Home Onwership_OWN": 0,
  "Home Onwership_RENT": 1,
  "Loan Intent_EDUCATION": 0,
  "Loan Intent_HOMEIMPROVEMENT": 0,
  "Loan Intent_MEDICAL": 0,
  "Loan Intent_PERSONAL": 1,
  "Loan Intent_VENTURE": 0,
};

export async function fetchModel<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/model/${endpoint}`, { ...init, cache: "no-store" });
  const body = await response.text();
  let payload: (T & { detail?: string }) | null = null;
  try {
    payload = JSON.parse(body) as T & { detail?: string };
  } catch {
    if (response.ok) throw new Error("Model service returned an unexpected response.");
  }
  if (!response.ok) {
    throw new Error(payload?.detail || `Model request failed (${response.status})${body ? `: ${body}` : "."}`);
  }
  if (!payload) throw new Error("Model service returned an empty response.");
  return payload;
}

export function readHistory(): ApplicationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = window.localStorage.getItem(HISTORY_KEY);
    return saved ? (JSON.parse(saved) as ApplicationRecord[]) : [];
  } catch (error) {
    console.error("Could not read application history.", error);
    return [];
  }
}

export function saveApplications(records: ApplicationRecord[]) {
  if (typeof window === "undefined") return;
  try {
    const previous = readHistory();
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([...records, ...previous].slice(0, 100)));
  } catch (error) {
    console.error("Could not save application history.", error);
    throw new Error("Predictions completed, but application history could not be saved in this browser.");
  }
}

export async function createManualReview(record: ApplicationRecord, userId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: existing, error: lookupError } = await supabase
    .from("manual_reviews")
    .select("id")
    .eq("application_id", record.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (lookupError) throw new Error(`Could not check the manual review status: ${lookupError.message}`);
  if (existing) return false;

  const { data, error } = await supabase.from("manual_reviews").insert({
    application_id: record.id,
    user_id: userId,
    applicant_name: record.name,
    applicant_inputs: record.inputs,
    model_approval: record.approval,
    model_prediction: record.prediction,
  }).select("id").single();

  if (error) throw new Error(`Could not submit this application for manual review: ${error.message}`);
  return Boolean(data);
}

export async function fetchManualReviews(userId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("manual_reviews")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load manual review results: ${error.message}`);
  return data as ManualReviewRecord[];
}

export async function fetchAllManualReviews() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("manual_reviews")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load the review queue: ${error.message}`);
  return data as ManualReviewRecord[];
}

export async function completeManualReview(id: string, result: NonNullable<ManualReviewRecord["review_result"]>, notes: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase.from("manual_reviews").update({
    status: "completed",
    review_result: result,
    review_notes: notes.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq("id", id).select("id").single();

  if (error) throw new Error(`Could not save the manual review: ${error.message}`);
}

export function metricPercent(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "—";
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}
