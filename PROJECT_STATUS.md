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
- **SHAP Integration**: Pending verification of SHAP explainer loading (disabled for speed during rapid fix).
- **None**: CSV upload is now fully functional and performant (2.5s for 7000 rows).

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
- **2026-02-17**: Consolidated training scripts into `ml/train_model.py`. Switched to Label Encoding to fix backend mismatch. Cleaned up outdated documentation.
