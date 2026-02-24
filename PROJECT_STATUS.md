# ChurnGuard - Project Status

## Current State
- **Backend**: FastAPI server running correctly with correct database integration.
- **Frontend**: Vite + React frontend operational, pending integration verification.
- **ML**: Training pipeline consolidated into `ml/train_model.py`. Model artifacts are correctly generated (Label Encoding + XGBoost).
- **Core Feature**: CSV upload works but needs a fix for categorical handling ("No" string error).

## Architecture
- **Backend API**: FastAPI on port 8000 (`backend/app/routers/predictions.py` handles core logic).
- **Frontend**: React SPA on port 3000 (`frontend/src/pages` contains main views).
- **Database**: SQLite with SQLAlchemy ORM (`backend/app/models.py`).
- **ML Pipeline**: 
  - `ml/train_model.py` -> Trains model, saves to `ml/models/`.
  - `backend/app/ml_service.py` -> Loads model for inference.

## File Structure
- `backend/app/main.py`: Entry point for API.
- `backend/app/routers/predictions.py`: Upload & prediction logic.
- `backend/app/ml_service.py`: Model inference service.
- `frontend/src/App.jsx`: Main frontend router.
- `ml/train_model.py`: **Single source of truth** for model training.

## Known Issues
- **None**: SHAP integration is fully functional. Dynamic customer reports now support both Telco and Banking datasets with automated profile filtering.
- **None**: CSV and Excel upload is fully functional across training and prediction pipelines.

## How To Run
1. **Backend**:
   ```bash
   cd backend
   python -m uvicorn app.main:app --reload --port 8000
   ```
2. **Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

## Change Log
- **2026-02-24**:
  - Implemented Dual Format Support (CSV & Excel) for model training pipeline, resolving `ParserError`.
  - Personalized Customer Intelligence: Report Modal now dynamically adapts to dataset features (Telco/Banking).
  - Added idempotent SQLite migration to `database.py` for seamless schema updates without data loss.
  - Improved `CustomerReportModal` with intelligent field filtering to hide irrelevant Telco defaults from non-Telco datasets.
- **2026-02-19**: 
  - Comprehensive project cleanup (deleted debug files, consolidated scripts).
  - Implemented smart deduplication: Uploads are now hashed (MD5) and checked against history. Duplicate uploads skip retraining and reuse existing models, saving time and resources.
  - Enhanced upload history logging to track duplicates and file hashes.
- **2026-02-18**: Implemented robust metadata sheet detection in `ml/train_model.py`. The system now gracefully rejects Excel documentation sheets and guides users to upload clean data. Confirmed fix with verification script.
- **2026-02-17**: Consolidated training scripts into `ml/train_model.py`. Switched to Label Encoding to fix backend mismatch. Cleaned up outdated documentation.
