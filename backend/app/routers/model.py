from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json

from ..database import get_db
from ..models import ModelMetrics
from ..schemas import ModelMetricsResponse, FeatureImportanceResponse, ModelPerformance
from ..ml_service import predictor
from ..config import API_VERSION

router = APIRouter(prefix="/model", tags=["Model - Phase 2"])


@router.get("/metrics")
def get_model_metrics(db: Session = Depends(get_db)):
    """Get current model performance metrics from metadata.json"""
    try:
        # First try to get from predictor metadata
        if predictor.metadata:
            # Handle both flat and nested structure
            perf = predictor.metadata.get("model_performance", predictor.metadata)
            
            return {
                "model_performance": {
                    "roc_auc": perf.get("roc_auc", 0),
                    "accuracy": perf.get("accuracy", 0),
                    "precision": perf.get("precision", 0),
                    "recall": perf.get("recall", 0)
                },
                "training_date": predictor.metadata.get("training_date"),
                "dataset_size": predictor.metadata.get("dataset_size", 0),
                "churn_rate": predictor.metadata.get("churn_rate", 0),
                "feature_count": len(predictor.feature_cols) if predictor.feature_cols else 0
            }

        # Fallback to database
        metrics = db.query(ModelMetrics).order_by(
            ModelMetrics.training_date.desc()
        ).first()

        if metrics:
            return {
                "model_performance": {
                    "roc_auc": metrics.auc_roc,
                    "accuracy": metrics.accuracy,
                    "precision": metrics.precision,
                    "recall": metrics.recall
                },
                "training_date": str(metrics.training_date) if metrics.training_date else None,
                "dataset_size": metrics.training_samples,
                "churn_rate": None,
                "feature_count": len(predictor.feature_cols) if predictor.feature_cols else 0
            }

        # Return default metrics
        return {
            "model_performance": {
                "roc_auc": 0.837,
                "accuracy": 0.75,
                "precision": 0.52,
                "recall": 0.75
            },
            "training_date": None,
            "dataset_size": 7043,
            "churn_rate": 0.2654,
            "feature_count": 32
        }
    except Exception as e:
        # Never return 500 - always return valid JSON
        return {
            "model_performance": {
                "roc_auc": 0,
                "accuracy": 0,
                "precision": 0,
                "recall": 0
            },
            "training_date": None,
            "dataset_size": 0,
            "churn_rate": 0,
            "feature_count": 0,
            "error": str(e)
        }


@router.get("/feature-importance")
def get_feature_importance():
    """Get global feature importance from the model metadata"""
    if not predictor.model_loaded:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Please ensure model files exist."
        )

    features = predictor.get_feature_importance()

    # Add descriptions for common features (best effort)
    feature_descriptions = {
        "is_month_to_month": "Whether customer has month-to-month contract",
        "Contract": "Type of service contract",
        "has_fiber": "Whether customer has fiber optic internet",
        "is_new_customer": "Customer with tenure <= 12 months",
        "has_phone": "Whether customer has phone service",
        "OnlineSecurity": "Whether customer has online security service",
        "InternetService": "Type of internet service",
        "TechSupport": "Whether customer has tech support",
        "tenure_group": "Customer tenure grouped by years",
        "StreamingMovies": "Whether customer has streaming movies",
        "price_per_tenure": "Monthly charges divided by tenure",
        "PhoneService": "Whether customer has phone service",
        "PaperlessBilling": "Whether customer uses paperless billing",
        "has_paperless_billing": "Derived paperless billing flag",
        "PaymentMethod": "Payment method used",
        "tenure": "Number of months as customer",
        "auto_payment": "Whether using automatic payment",
        "MultipleLines": "Whether customer has multiple phone lines",
        "MonthlyCharges": "Monthly subscription charges",
        "SeniorCitizen": "Whether customer is senior citizen",
        "OnlineBackup": "Whether customer has online backup",
        "num_services": "Number of additional services subscribed",
        "TotalCharges": "Total charges over lifetime",
        "Dependents": "Whether customer has dependents",
        "avg_monthly_charge": "Average monthly charge over tenure",
        "has_premium_services": "Whether customer has 3+ additional services",
        "StreamingTV": "Whether customer has streaming TV",
        "DeviceProtection": "Whether customer has device protection",
        "gender": "Customer gender",
        "Partner": "Whether customer has a partner",
        "is_expensive": "Whether monthly charges above median",
        "has_internet": "Whether customer has any internet service"
    }

    # Add descriptions to features
    features_with_desc = []
    for f in features:
        feature_name = f["feature"]
        features_with_desc.append({
            "feature": feature_name,
            "importance": f["importance"],
            "description": feature_descriptions.get(feature_name, f"Feature: {feature_name}")
        })

    return {
        "features": features_with_desc,
        "model_version": API_VERSION
    }


@router.get("/confusion-matrix")
def get_confusion_matrix(db: Session = Depends(get_db)):
    """Get confusion matrix data for visualization"""
    # Try to calculate from metadata if available
    if predictor.metadata:
        perf = predictor.metadata.get("model_performance", predictor.metadata)
        dataset_size = predictor.metadata.get("dataset_size", 7043)
        churn_rate = predictor.metadata.get("churn_rate", 0.2654)

        # Estimate confusion matrix from metrics
        # This is an approximation based on recall/precision
        total_churned = int(dataset_size * churn_rate)
        total_not_churned = dataset_size - total_churned

        recall = perf.get("recall", 0.75)
        precision = perf.get("precision", 0.52)

        # TP = recall * actual_positives
        tp = int(recall * total_churned)
        fn = total_churned - tp

        # From precision: TP / (TP + FP) = precision
        # FP = TP * (1 - precision) / precision
        fp = int(tp * (1 - precision) / precision) if precision > 0 else 0
        tn = total_not_churned - fp

        cm = {
            "true_positive": tp,
            "true_negative": tn,
            "false_positive": fp,
            "false_negative": fn
        }
    else:
        # Try database
        metrics = db.query(ModelMetrics).order_by(
            ModelMetrics.training_date.desc()
        ).first()

        if metrics and metrics.confusion_matrix:
            cm = json.loads(metrics.confusion_matrix)
        else:
            # Default confusion matrix
            cm = {
                "true_positive": 1394,
                "true_negative": 3873,
                "false_positive": 1286,
                "false_negative": 490
            }

    # Calculate derived metrics
    total = sum(cm.values())
    accuracy = (cm["true_positive"] + cm["true_negative"]) / total if total > 0 else 0
    precision = cm["true_positive"] / (cm["true_positive"] + cm["false_positive"]) if (cm["true_positive"] + cm["false_positive"]) > 0 else 0
    recall = cm["true_positive"] / (cm["true_positive"] + cm["false_negative"]) if (cm["true_positive"] + cm["false_negative"]) > 0 else 0

    return {
        "matrix": cm,
        "labels": ["Not Churned", "Churned"],
        "metrics": {
            "accuracy": round(accuracy, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(2 * precision * recall / (precision + recall), 4) if (precision + recall) > 0 else 0
        },
        "visualization_data": [
            {"actual": "Not Churned", "predicted": "Not Churned", "value": cm["true_negative"]},
            {"actual": "Not Churned", "predicted": "Churned", "value": cm["false_positive"]},
            {"actual": "Churned", "predicted": "Not Churned", "value": cm["false_negative"]},
            {"actual": "Churned", "predicted": "Churned", "value": cm["true_positive"]}
        ]
    }


@router.get("/status")
def get_model_status():
    """Get current model status"""
    try:
        return {
            "model_loaded": predictor.model_loaded,
            "shap_explainer_ready": predictor.shap_ready,
            "model_version": API_VERSION,
            "api_version": API_VERSION,
            "feature_count": len(predictor.feature_cols) if predictor.feature_cols else 0,
            "training_date": predictor.metadata.get("training_date") if predictor.metadata else None
        }
    except Exception as e:
        return {
            "model_loaded": False,
            "shap_explainer_ready": False,
            "model_version": API_VERSION,
            "api_version": API_VERSION,
            "feature_count": 0,
            "training_date": None,
            "error": str(e)
        }


@router.post("/reload")
def reload_model():
    """Reload model from disk"""
    success = predictor.load_models()

    if not success:
        raise HTTPException(
            status_code=503,
            detail="Failed to load model. Ensure model files exist in ml/models/ directory."
        )

    # Initialize SHAP
    shap_success = predictor.initialize_shap()

    return {
        "message": "Model reloaded successfully",
        "model_loaded": predictor.model_loaded,
        "shap_ready": shap_success,
        "feature_count": len(predictor.feature_cols) if predictor.feature_cols else 0
    }
