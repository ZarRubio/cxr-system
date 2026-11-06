# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Academic chest X-ray (CXR) decision-support system: a FastAPI backend runs a two-model CNN-ViT ensemble (DenseNet121 backbone + ViT, trained on NIH ChestX-ray14, 14 classes, "No Finding" when no class passes its threshold) and a Next.js 16 frontend handles auth, history, PDF reports and email alerts. UI text, docs, error messages and most code comments are in **Spanish (es-PE)**; keep new user-facing text in Spanish.

`frontend-next/CLAUDE.md` (via `AGENTS.md`) applies inside the frontend: this Next.js version has breaking changes vs. training data — read the relevant guide in `frontend-next/node_modules/next/dist/docs/` before writing Next.js code. Example: middleware lives in `frontend-next/proxy.ts`, not `middleware.ts`.

## Commands

Backend (run from `backend/`; a local venv exists at `../venv`):

```bash
pip install -r requirements.txt -r requirements-dev.txt
uvicorn main:app --reload --port 8000
CXR_SKIP_MODEL_LOAD=1 python -m pytest tests/ ../tools/gradcam_diagnostics -q   # what CI runs
CXR_SKIP_MODEL_LOAD=1 python -m pytest tests/test_predict.py::TestCXRScreening -q   # single test/class
python -m ruff check .
```

Frontend (run from `frontend-next/`; copy `.env.local.example` to `.env.local` first; dev login `admin` / `hnal2026`):

```bash
npm run dev                         # http://localhost:3000
npm test                            # vitest run (jsdom)
npx vitest run lib/pdf.test.ts      # single file; add -t "name" for a single test
npm run lint && npx tsc --noEmit && npm run build
```

Research tools (run from repo root; need backend deps plus `tools/requirements.txt`):

```bash
python -m pytest tools -q                    # CI job "Tools" runs tools/test_*.py; gradcam_diagnostics runs in the backend job
python -m pytest tools/test_create_nih_splits.py -q
python -m ruff check tools                   # uses tools/pyproject.toml; local scripts are listed as known-first-party
```

When adding a new importable script under `tools/`, add its module name to `known-first-party` in `tools/pyproject.toml`, or ruff's import sorting will fail in CI.

Full stack: `docker compose up --build` (backend :8000, frontend :3000).

Model checkpoints (`sprint4ml_v1.pt`, `sprint4ml_v2.pt`) are not in git; place them in `backend/artifacts/`. Without them, set `CXR_SKIP_MODEL_LOAD=1` (tests always do this, setting the env var before importing `main`).

## Architecture

**Request flow:** browser → Next.js route handlers under `frontend-next/app/api/*` → FastAPI. The browser never calls the backend. Route handlers check the NextAuth session (`lib/active-session.ts`), then forward via `lib/backend.ts` with the `X-API-Key` header (`BACKEND_API_KEY` must equal backend `CXR_API_KEY`). The backend returns 401 without the key when one is configured; `/health` stays open.

**Auth/session revalidation:** `proxy.ts` re-reads the user from the data store on every protected request, so deactivating a user or changing a password (tracked via `lib/session-version.ts`) invalidates existing JWTs. `/api/predict*` is excluded from the proxy matcher so large uploads aren't buffered twice; those handlers validate the session themselves. `/admin` and `/api/admin` require role `admin`.

**Persistence (frontend only):** `lib/data/store.ts` defines the `DataStore` interface with two implementations selected by `DATA_BACKEND`: `sqlite-store.ts` (default, `data/cxr.db`) and `firestore-store.ts` (Firestore via raw REST in `firestore-rest.ts`, used on Cloud Run because its filesystem is ephemeral). Any new data operation must be added to the interface and both stores. The backend is stateless apart from an in-memory LRU prediction cache and the audit log.

**Prediction persistence:** `app/api/predict/route.ts` proxies to `/predict`, builds an `AnalysisRecord` (`lib/data/analysis.ts`) and saves it before responding. Images and Grad-CAM maps are never stored, only metadata and scores. It then calls `notifyCriticalAnalysis` (`lib/critical-email.ts`), which emails when a positive finding is `critical` in `SEVERITY_MAP` (`lib/constants.ts`). Email sending uses a persistent claim/lock in the store to avoid duplicates across instances, with no automatic retries. Re-requesting a Grad-CAM for an existing study (`explain_analysis_id`) must match the stored `imageHash` and `modelVersion`.

**Backend pipeline:** `routers/predict.py` is thin and serializes inference with a global lock, because CAM hooks share model state. `services/prediction_service.py` handles size validation, decoding (PNG/JPG/DICOM via `dicom_service.py`), the CXR screening heuristic (`cxr_screening_service.py`, which rejects CT/MR/US and color photos and warns on doubtful cases), inference, Grad-CAM, caching and auditing. `services/model_service.py` combines the two sigmoids by weighted average (weights in `ensemble_config.json`) and applies per-class thresholds from `thresholds_14.json`. It also computes `decision_support` (stable/borderline/discordant from threshold margin and inter-model disagreement), which is explicitly *not* a calibrated probability.

**Artifacts integrity:** at startup `main.py` verifies a SHA-256 model manifest (`model_manifest.py`; required when `CXR_REQUIRE_MODEL_MANIFEST` is set; deploy generates it). It also checks that `labels_14.json` order matches `CLASSES_14` in code. `evaluation_evidence.py` pins expected artifact hashes for published metrics, so changing artifacts or thresholds affects `/model-info` evidence and tests.

**Grad-CAM:** `services/gradcam_service.py` targets `model.cnn_features.denseblock4` of the v2 model. It returns empty strings for invalid maps (non-finite, constant, wrong shape or out of range). The frontend and PDF must handle a missing map rather than show a fabricated one. `tools/gradcam_diagnostics/` holds exploratory CAM validation; its README sets the methodological rules (keep all cases in denominators, no sign flipping or abs() to create positive regions, no cherry-picking samples).

## Conventions and constraints

- Clinical caution is a design requirement. Scores are uncalibrated sigmoid outputs and must not be presented as clinical probabilities. Keep disclaimers (`backend/constants/clinical_text.py`) and "requires radiologist review" messaging intact.
- Privacy (Peru Law 29733): from DICOM, only age, sex, ViewPosition and a hash of StudyInstanceUID are read. Never read or log names, patient IDs or dates. Audit logs store an image hash, not the image.
- Backend settings use the `CXR_` env prefix (`backend/settings.py`). Ruff line length is 110 with E501 ignored.
- Model/validation claims in docs must match evidence in `docs/` (audits, reproduction, validation plan). Don't overstate metrics.
- Deploy: CI (`.github/workflows/ci.yml`) runs on PRs. `deploy.yml` runs on push to `master`: it reruns CI, downloads checkpoints from GCS, generates and verifies the manifest, and deploys both services to Cloud Run. Standalone/Cloud Run needs `AUTH_URL` and `AUTH_TRUST_HOST=true`, or auth redirects break.
- Firestore backups run through `.github/workflows/firestore-backup.yml` (daily schedule, 7-day retention). The GitHub Actions service account needs the backup roles listed in `docs/BACKUP_RESTORE.md`.
