# Justifi frontend

Next.js dashboard for the loan model in `../backend`, with a server-side proxy to the deployed Render API.

## Run locally

```powershell
cd frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. Set `MODEL_API_URL` in `.env.local` to change the model endpoint; it defaults to `https://mlmodel-tul7.onrender.com`.

The model proxy keeps browser requests on the Next.js origin, so the model service does not need browser CORS configuration.

## Plain-English AI explanations

The backend uses Groq to explain each model prediction and suggest general loan categories to explore. Configure `GROQ_API_KEY` as a server-side environment variable in the Render backend service; never put it in `frontend/.env.local` or a `NEXT_PUBLIC_*` variable. These are general AI-generated categories, not lender offers or guaranteed approvals. After changing backend explanation code, redeploy the backend on Render.

## Supabase authentication

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` using the public project URL and anon/publishable key from Supabase. Sign-up and password sign-in use Supabase Auth. Do not put a Supabase service-role key in the frontend.

Application history is stored in the user's browser. Applications explicitly sent for manual review are also stored in Supabase; the reviewer decision and notes are synced back into the signed-in user's history.

### Manual application reviews

Run `../supabase/migrations/20261031000000_manual_reviews.sql` in the Supabase SQL Editor to create the review table and row-level security policies. Applicants must be signed in to send an analysis for review. Reviewers use `/dashboard/manual-reviews`; access is enforced by Supabase RLS and requires the signed-in user's `app_metadata` to contain `"role": "admin"`. Set this claim for trusted reviewer accounts in Supabase Auth (do not use editable `user_metadata`), then have the reviewer sign out and back in to refresh the JWT. Never expose a service-role key in the frontend.

Applicants can read only their own review records; only admins can list all submissions and update review outcomes. Model estimates remain separate from reviewer outcomes in the applicant's history.

## CSV bulk analysis

Upload a CSV with a header row and model feature names, such as `Age`, `Gender`, `Person Income`, `Loan Amount`, and `Credit Score`. Category one-hot headers must also match the model dataset exactly (for example `Home Onwership_RENT` and `Loan Intent_PERSONAL`). Missing model features use the same defaults as the single-applicant form; each row is sent to the model API individually. Files are limited to 200 applicants per run.

## Model API endpoints

The frontend uses `GET /model-performance`, `GET /fairness-report`, `GET /shap-details/global`, and `POST /predict` through its `/api/model/*` proxy. Fairness group approval rates are descriptive summaries of the predictions saved in this browser; the current model API only provides aggregate fairness differences.
