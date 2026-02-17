from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime, timedelta
from typing import List

from ..database import get_db
from ..models import Customer, Prediction, ChurnTrend
from ..schemas import TrendDataPoint, ChurnTrendResponse

router = APIRouter(prefix="/trends", tags=["Trends - Phase 2"])


@router.get("", response_model=ChurnTrendResponse)
@router.get("/churn", response_model=ChurnTrendResponse)
def get_churn_trends(
    period: str = Query("30d", regex="^(7d|30d|90d|1y)$"),
    db: Session = Depends(get_db)
):
    """Get churn trends over time (requires at least 2 uploads)"""
    # Calculate date range
    period_days = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "1y": 365
    }
    days = period_days.get(period, 30)
    start_date = datetime.utcnow() - timedelta(days=days)

    # Get stored trends
    trends = db.query(ChurnTrend).filter(
        ChurnTrend.date >= start_date
    ).order_by(ChurnTrend.date.asc()).all()

    if len(trends) < 2:
        return ChurnTrendResponse(
            trend_data=[],
            period=period,
            summary={
                "period": period,
                "message": "Upload data multiple times to see trends (need at least 2 uploads)"
            }
        )

    trend_data = [
        TrendDataPoint(
            date=t.date.strftime("%Y-%m-%d"),
            total_customers=t.total_customers,
            at_risk_customers=t.at_risk_customers,
            churned_customers=t.churned_customers,
            churn_rate=round(t.churned_customers / t.total_customers * 100, 2) if t.total_customers > 0 else 0,
            avg_churn_probability=round(t.avg_churn_probability, 4)
        )
        for t in trends
    ]

    # Calculate summary
    first_point = trend_data[0]
    last_point = trend_data[-1]

    churn_rate_change = last_point.churn_rate - first_point.churn_rate
    at_risk_change = last_point.at_risk_customers - first_point.at_risk_customers

    summary = {
        "period": period,
        "start_date": first_point.date,
        "end_date": last_point.date,
        "churn_rate_change": round(churn_rate_change, 2),
        "at_risk_change": at_risk_change,
        "trend_direction": "increasing" if churn_rate_change > 0 else "decreasing" if churn_rate_change < 0 else "stable",
        "avg_churn_rate": round(sum(t.churn_rate for t in trend_data) / len(trend_data), 2)
    }

    return ChurnTrendResponse(
        trend_data=trend_data,
        period=period,
        summary=summary
    )


def generate_synthetic_trends(db: Session, days: int) -> List[TrendDataPoint]:
    """Generate synthetic trend data based on current customer data"""
    import random

    current_total = db.query(Customer).count()
    current_churned = db.query(Customer).filter(Customer.is_churned == True).count()
    current_at_risk = db.query(Customer).filter(
        Customer.churn_risk_level.in_(["high", "medium"]),
        Customer.is_churned == False
    ).count()

    avg_prob = db.query(func.avg(Customer.churn_probability)).filter(
        Customer.churn_probability.isnot(None)
    ).scalar() or 0.3

    trend_data = []
    random.seed(42)

    # Generate data points (daily for 7d, weekly for 30d+)
    if days <= 7:
        num_points = days
        step = 1
    elif days <= 30:
        num_points = days
        step = 1
    elif days <= 90:
        num_points = days // 7
        step = 7
    else:
        num_points = 12
        step = days // 12

    for i in range(num_points):
        date = datetime.utcnow() - timedelta(days=days - (i * step))

        # Add some variation
        variation = random.uniform(-0.1, 0.1)
        total = max(1, int(current_total * (0.95 + i * 0.005 / num_points)))
        at_risk = max(0, int(current_at_risk * (1 + variation)))
        churned = max(0, int(current_churned * (0.9 + i * 0.01 / num_points)))
        prob = min(1, max(0, avg_prob * (1 + variation * 0.5)))

        trend_data.append(TrendDataPoint(
            date=date.strftime("%Y-%m-%d"),
            total_customers=total,
            at_risk_customers=at_risk,
            churned_customers=churned,
            churn_rate=round(churned / total * 100, 2) if total > 0 else 0,
            avg_churn_probability=round(prob, 4)
        ))

    return trend_data


@router.get("/predictions")
def get_prediction_trends(
    period: str = Query("30d", regex="^(7d|30d|90d|1y)$"),
    db: Session = Depends(get_db)
):
    """Get prediction activity trends"""
    period_days = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = period_days.get(period, 30)
    start_date = datetime.utcnow() - timedelta(days=days)

    # Group predictions by date
    predictions = db.query(
        func.date(Prediction.created_at).label("date"),
        func.count(Prediction.id).label("count"),
        func.avg(Prediction.churn_probability).label("avg_prob")
    ).filter(
        Prediction.created_at >= start_date
    ).group_by(
        func.date(Prediction.created_at)
    ).order_by(
        func.date(Prediction.created_at)
    ).all()

    return {
        "period": period,
        "data": [
            {
                "date": str(p.date),
                "predictions_count": p.count,
                "avg_churn_probability": round(p.avg_prob or 0, 4)
            }
            for p in predictions
        ],
        "total_predictions": sum(p.count for p in predictions)
    }


@router.get("/risk-evolution")
def get_risk_evolution(
    period: str = Query("30d", regex="^(7d|30d|90d|1y)$"),
    db: Session = Depends(get_db)
):
    """Get evolution of risk distribution over time"""
    period_days = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = period_days.get(period, 30)
    start_date = datetime.utcnow() - timedelta(days=days)

    # Get predictions grouped by date and risk level
    predictions = db.query(
        func.date(Prediction.created_at).label("date"),
        Prediction.risk_level,
        func.count(Prediction.id).label("count")
    ).filter(
        Prediction.created_at >= start_date
    ).group_by(
        func.date(Prediction.created_at),
        Prediction.risk_level
    ).order_by(
        func.date(Prediction.created_at)
    ).all()

    # Organize by date
    data_by_date = {}
    for p in predictions:
        date_str = str(p.date)
        if date_str not in data_by_date:
            data_by_date[date_str] = {"high": 0, "medium": 0, "low": 0}
        if p.risk_level:
            data_by_date[date_str][p.risk_level] = p.count

    return {
        "period": period,
        "data": [
            {"date": date, **counts}
            for date, counts in sorted(data_by_date.items())
        ]
    }


@router.get("/cohort-analysis")
def get_cohort_analysis(db: Session = Depends(get_db)):
    """Get churn analysis by customer cohort (based on tenure)"""
    cohorts = [
        {"name": "0-3 months", "min": 0, "max": 3},
        {"name": "3-6 months", "min": 3, "max": 6},
        {"name": "6-12 months", "min": 6, "max": 12},
        {"name": "1-2 years", "min": 12, "max": 24},
        {"name": "2+ years", "min": 24, "max": 999}
    ]

    results = []
    for cohort in cohorts:
        stats = db.query(
            func.count(Customer.id).label("count"),
            func.avg(Customer.churn_probability).label("avg_prob"),
            func.sum(Customer.monthly_charges * 12).label("revenue")
        ).filter(
            Customer.tenure >= cohort["min"],
            Customer.tenure < cohort["max"],
            Customer.is_churned == False
        ).first()

        churned = db.query(Customer).filter(
            Customer.tenure >= cohort["min"],
            Customer.tenure < cohort["max"],
            Customer.is_churned == True
        ).count()

        total = (stats.count or 0) + churned
        churn_rate = (churned / total * 100) if total > 0 else 0

        results.append({
            "cohort": cohort["name"],
            "active_customers": stats.count or 0,
            "churned_customers": churned,
            "total_customers": total,
            "churn_rate": round(churn_rate, 2),
            "avg_churn_probability": round(stats.avg_prob or 0, 4),
            "annual_revenue": round(stats.revenue or 0, 2)
        })

    return {"cohorts": results}


@router.post("/snapshot")
def create_trend_snapshot(db: Session = Depends(get_db)):
    """Create a daily snapshot of churn metrics (should be called by scheduler)"""
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # Check if snapshot already exists for today
    existing = db.query(ChurnTrend).filter(ChurnTrend.date == today).first()
    if existing:
        return {"message": "Snapshot already exists for today", "snapshot": existing.id}

    total = db.query(Customer).count()
    at_risk = db.query(Customer).filter(
        Customer.churn_risk_level.in_(["high", "medium"]),
        Customer.is_churned == False
    ).count()
    churned = db.query(Customer).filter(Customer.is_churned == True).count()
    avg_prob = db.query(func.avg(Customer.churn_probability)).filter(
        Customer.churn_probability.isnot(None)
    ).scalar() or 0

    high_value_at_risk = db.query(Customer).filter(
        Customer.contract_value >= 1000,
        Customer.churn_probability >= 0.5,
        Customer.is_churned == False
    ).count()

    new_customer_prob = db.query(func.avg(Customer.churn_probability)).filter(
        Customer.tenure <= 6,
        Customer.churn_probability.isnot(None)
    ).scalar() or 0

    snapshot = ChurnTrend(
        date=today,
        total_customers=total,
        at_risk_customers=at_risk,
        churned_customers=churned,
        avg_churn_probability=avg_prob,
        high_value_at_risk=high_value_at_risk,
        new_customer_churn_risk=new_customer_prob
    )

    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)

    return {"message": "Snapshot created", "snapshot_id": snapshot.id}
