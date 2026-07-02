# JobBridge

Intelligent Chatbot and OCR-Assisted Job Matching and Employment Monitoring System for the Public Employment Service Office (PESO) — Municipality of Pila, Laguna.

Built for LSPU Sta. Cruz Campus, BSIT — Group EW12.

## Stack

- **Frontend**: React 18 + Vite, Tailwind CSS, shadcn-style components (Radix primitives), Framer Motion, TanStack Query/Table, Zustand, Socket.io-client
- **Backend**: Flask, SQLAlchemy (Supabase Postgres via session pooler), Flask-JWT-Extended, Flask-SocketIO, Flask-Mail
- **Database & Storage**: Supabase (Postgres + Storage)
- **AI**: scikit-learn (TF-IDF + Cosine Similarity job matching, fully live), spaCy (resume NLP parsing, fully live), Google Vision API (OCR — stubbed with mock output until `GOOGLE_APPLICATION_CREDENTIALS` is configured), Dialogflow ES (chatbot — stubbed with canned replies until `DIALOGFLOW_PROJECT_ID` is configured)
- **Deployment**: Vercel (frontend), Render (backend)

## Local Development

### Backend

```bash
cd backend
python -m venv venv
./venv/Scripts/activate          # Windows
pip install -r requirements.txt
python -m spacy download en_core_web_sm
cp .env.example .env             # then fill in real values — never commit .env
flask db upgrade                 # applies the schema to your Supabase Postgres instance
python seed.py                   # seeds the Admin account from ADMIN_SEED_EMAIL/PASSWORD
python app.py                    # runs on http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env             # then fill in real values
npm run dev                      # runs on http://localhost:5173
```

## Environment Variables

See `backend/.env.example` and `frontend/.env.example` for the full list. Secrets are never committed — `.env` is git-ignored everywhere.

Notably:
- `GOOGLE_APPLICATION_CREDENTIALS` / `DIALOGFLOW_PROJECT_ID` are optional. When absent, OCR resume parsing and the chatbot run in a clearly-labeled mock mode so the rest of the system remains fully testable without a Google Cloud account. A service-account key is configured for `GOOGLE_APPLICATION_CREDENTIALS` (place it at `backend/credentials/`, git-ignored) — Vision API also requires **billing enabled** on the GCP project, or calls fail with a billing error and the code falls back to mock output automatically.
- Supabase Row Level Security should be enabled per-table in the dashboard as defense-in-depth. The backend authenticates via `DATABASE_URL` (a Postgres role, not a Supabase client session), so the primary authorization boundary is the JWT + `@role_required` decorator, not RLS.

## Deployment

- **Frontend → Vercel**: `frontend/vercel.json` configures the SPA rewrite + security headers. Set `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in the Vercel dashboard.
- **Backend → Render**: `backend/render.yaml` configures the build/start commands (gunicorn + eventlet worker for Socket.io) and lists required env vars (set manually in the Render dashboard — never committed).
- **CI/CD**: `.github/workflows/frontend.yml` and `backend.yml` build/check on every push and deploy on push to `main`. Add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `RENDER_SERVICE_ID`, `RENDER_DEPLOY_KEY` as GitHub repo secrets to enable auto-deploy.

## Repository Layout

```
/
├── frontend/    React + Vite SPA — all 4 role dashboards (Jobseeker/Employer/PESO Staff/Admin)
├── backend/     Flask API — auth, RBAC, all business logic, AI services
└── .github/workflows/   CI/CD
```

## Roles

| Role | Base Route | Account Creation |
|---|---|---|
| Jobseeker | `/jobseeker/*` | Self-register + Email OTP |
| Employer | `/employer/*` | Self-register + Email OTP |
| PESO Staff | `/staff/*` | Admin-created only (`/admin/staff/create`) |
| Admin | `/admin/*` | Pre-seeded via `seed.py` — no registration page |
