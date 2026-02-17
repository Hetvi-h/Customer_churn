from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from ..ml_service import predictor, ModelNotLoadedError

router = APIRouter(prefix="/api/metadata", tags=["Metadata"])


@router.get("")
async def get_metadata() -> Dict[str, Any]:
    """
    Get complete metadata.json for dynamic frontend configuration
    
    CRITICAL: Frontend uses this to build dynamic forms, charts, and tables
    """
    try:
        metadata = predictor.get_metadata()
        return metadata
    except ModelNotLoadedError:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Please ensure model files exist in ml/models/ directory."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving metadata: {str(e)}"
        )


@router.get("/features")
async def get_features() -> Dict[str, Any]:
    """
    Get feature configuration (categorical, numerical, all features)
    """
    try:
        metadata = predictor.get_metadata()
        return {
            "feature_cols": metadata.get("feature_cols", []),
            "categorical_cols": metadata.get("categorical_cols", []),
            "numerical_cols": metadata.get("numerical_cols", []),
            "excluded_cols": metadata.get("excluded_cols", [])
        }
    except ModelNotLoadedError:
        raise HTTPException(status_code=503, detail="Model not loaded")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/importance")
async def get_feature_importance() -> Dict[str, Any]:
    """
    Get feature importance (sorted by importance)
    """
    try:
        importance = predictor.get_feature_importance()
        return {"features": importance}
    except ModelNotLoadedError:
        raise HTTPException(status_code=503, detail="Model not loaded")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/model-info")
async def get_model_info() -> Dict[str, Any]:
    """
    Get model performance metrics and info
    """
    try:
        metrics = predictor.get_model_metrics()
        return metrics
    except ModelNotLoadedError:
        raise HTTPException(status_code=503, detail="Model not loaded")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
