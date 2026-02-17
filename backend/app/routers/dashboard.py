from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from ..database import get_db
from ..models import Customer, Prediction, ChurnTrend
from ..schemas import DashboardMetrics, RiskDistribution
from ..ml_service import predictor

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/metrics", response_model=DashboardMetrics)
def get_dashboard_metrics(db: Session = Depends(get_db)):
    """Get main dashboard metrics (Phase 1)"""
    total_customers = db.query(Customer).count()
    churned_customers = db.query(Customer).filter(Customer.is_churned == True).count()

    # Risk distribution
    high_risk = db.query(Customer).filter(
        Customer.churn_risk_level == "high",
        Customer.is_churned == False
    ).count()

    medium_risk = db.query(Customer).filter(
        Customer.churn_risk_level == "medium",
        Customer.is_churned == False
    ).count()

    low_risk = db.query(Customer).filter(
        Customer.churn_risk_level == "low",
        Customer.is_churned == False
    ).count()

    at_risk = high_risk + medium_risk

    # Calculate average churn probability
    avg_prob = db.query(func.avg(Customer.churn_probability)).filter(
        Customer.churn_probability.isnot(None),
        Customer.is_churned == False
    ).scalar() or 0

    # Calculate revenue at risk (high risk customers' annual revenue)
    revenue_at_risk = db.query(func.sum(Customer.monthly_charges * 12)).filter(
        Customer.churn_risk_level == "high",
        Customer.is_churned == False
    ).scalar() or 0

    churn_rate = (churned_customers / total_customers * 100) if total_customers > 0 else 0

    return DashboardMetrics(
        total_customers=total_customers,
        at_risk_customers=at_risk,
        high_risk_customers=high_risk,
        medium_risk_customers=medium_risk,
        low_risk_customers=low_risk,
        churned_customers=churned_customers,
        churn_rate=round(churn_rate, 2),
        avg_churn_probability=round(avg_prob, 4),
        revenue_at_risk=round(revenue_at_risk, 2)
    )


@router.get("/risk-distribution")
def get_risk_distribution(db: Session = Depends(get_db)):
    """Get customer risk distribution for charts"""
    distribution = db.query(
        Customer.churn_risk_level,
        func.count(Customer.id)
    ).filter(
        Customer.is_churned == False,
        Customer.churn_risk_level.isnot(None)
    ).group_by(Customer.churn_risk_level).all()

    result = {"high": 0, "medium": 0, "low": 0}
    for level, count in distribution:
        if level in result:
            result[level] = count

    return result


@router.get("/top-at-risk")
def get_top_at_risk_customers(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Get top customers at risk of churning"""
    customers = db.query(Customer).filter(
        Customer.is_churned == False,
        Customer.churn_probability.isnot(None)
    ).order_by(Customer.churn_probability.desc()).limit(limit).all()

    return [
        {
            "customer_id": c.customer_id,
            "name": c.name,
            "churn_probability": c.churn_probability,
            "risk_level": c.churn_risk_level,
            "monthly_charges": c.monthly_charges,
            "tenure": c.tenure,
            "contract_type": c.contract_type
        }
        for c in customers
    ]


@router.get("/revenue-at-risk")
def get_revenue_at_risk_breakdown(db: Session = Depends(get_db)):
    """Get revenue at risk breakdown by risk level"""
    high_revenue = db.query(func.sum(Customer.monthly_charges * 12)).filter(
        Customer.churn_risk_level == "high",
        Customer.is_churned == False
    ).scalar() or 0

    medium_revenue = db.query(func.sum(Customer.monthly_charges * 12)).filter(
        Customer.churn_risk_level == "medium",
        Customer.is_churned == False
    ).scalar() or 0

    # Weighted risk (high = 70%, medium = 40%)
    weighted_risk = (high_revenue * 0.7) + (medium_revenue * 0.4)

    return {
        "high_risk_revenue": round(high_revenue, 2),
        "medium_risk_revenue": round(medium_revenue, 2),
        "total_at_risk": round(high_revenue + medium_revenue, 2),
        "weighted_risk": round(weighted_risk, 2)
    }


@router.get("/contract-distribution")
def get_contract_distribution(db: Session = Depends(get_db)):
    """Get customer distribution by contract type"""
    distribution = db.query(
        Customer.contract_type,
        func.count(Customer.id).label("count"),
        func.avg(Customer.churn_probability).label("avg_churn_prob")
    ).filter(
        Customer.is_churned == False,
        Customer.contract_type.isnot(None)
    ).group_by(Customer.contract_type).all()

    return [
        {
            "contract_type": row.contract_type,
            "count": row.count,
            "avg_churn_probability": round(row.avg_churn_prob or 0, 4)
        }
        for row in distribution
    ]


@router.get("/recent-predictions")
def get_recent_predictions(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Get most recent predictions"""
    predictions = db.query(Prediction).order_by(
        Prediction.created_at.desc()
    ).limit(limit).all()

    results = []
    for p in predictions:
        customer = db.query(Customer).filter(Customer.id == p.customer_id).first()
        if customer:
            results.append({
                "prediction_id": p.id,
                "customer_id": customer.customer_id,
                "customer_name": customer.name,
                "churn_probability": p.churn_probability,
                "risk_level": p.risk_level,
                "created_at": p.created_at.isoformat()
            })

    return results


@router.get("/summary-stats")
def get_summary_stats(db: Session = Depends(get_db)):
    """Get summary statistics for dashboard"""
    total = db.query(Customer).filter(Customer.is_churned == False).count()

    stats = db.query(
        func.avg(Customer.tenure).label("avg_tenure"),
        func.avg(Customer.monthly_charges).label("avg_monthly"),
        func.avg(Customer.total_charges).label("avg_total"),
        func.avg(Customer.num_support_tickets).label("avg_tickets"),
        func.avg(Customer.churn_probability).label("avg_churn_prob")
    ).filter(Customer.is_churned == False).first()

    return {
        "total_active_customers": total,
        "avg_tenure_months": round(stats.avg_tenure or 0, 1),
        "avg_monthly_charges": round(stats.avg_monthly or 0, 2),
        "avg_total_charges": round(stats.avg_total or 0, 2),
        "avg_support_tickets": round(stats.avg_tickets or 0, 1),
        "avg_churn_probability": round(stats.avg_churn_prob or 0, 4),
        "model_loaded": predictor.model_loaded,
        "shap_ready": predictor.shap_ready
    }


@router.get("/training-data-stats")
def get_training_data_stats():
    """Get stats from training data when database is empty"""
    if predictor.metadata:
        return {
            "source": "training_data",
            "dataset_size": predictor.metadata.get("dataset_size", 7043),
            "churn_rate": round(predictor.metadata.get("churn_rate", 0.2654) * 100, 2),
            "model_performance": predictor.metadata.get("model_performance", {}),
            "training_date": predictor.metadata.get("training_date"),
            "feature_count": len(predictor.feature_cols) if predictor.feature_cols else 32,
            "model_loaded": predictor.model_loaded,
            "shap_ready": predictor.shap_ready
        }
    return {
        "source": "default",
        "dataset_size": 7043,
        "churn_rate": 26.54,
        "model_performance": {
            "roc_auc": 0.837,
            "accuracy": 0.75,
            "precision": 0.52,
            "recall": 0.75
        },
        "training_date": None,
        "feature_count": 32,
        "model_loaded": predictor.model_loaded,
        "shap_ready": predictor.shap_ready
    }
