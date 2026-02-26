from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional, List

from ..database import get_db
from ..models import Customer
from ..schemas import SegmentInfo, SegmentListResponse, SegmentCustomersResponse, CustomerResponse
from ..ml_service import predictor

router = APIRouter(prefix="/segments", tags=["Segments - Phase 2"])

def get_risk_segments():
    """Define segments dynamically based on risk levels"""
    return {
        "high_risk": {
            "name": "High Risk",
            "description": "Customers with > 70% churn probability. Immediate attention required.",
            "criteria": {"risk_level": "high"}
        },
        "medium_risk": {
            "name": "Medium Risk",
            "description": "Customers with 40-70% churn probability. Monitoring recommended.",
            "criteria": {"risk_level": "medium"}
        },
        "low_risk": {
            "name": "Low Risk",
            "description": "Customers with < 40% churn probability. Loyal customer base.",
            "criteria": {"risk_level": "low"}
        }
    }

@router.get("", response_model=SegmentListResponse)
def get_segments(db: Session = Depends(get_db)):
    """Get all customer segments (Risk Based)"""
    try:
        segments = []
        defined_segments = get_risk_segments()

        for seg_id, seg_def in defined_segments.items():
            # Count customers in this risk level
            risk_level = seg_def["criteria"]["risk_level"]
            
            stats = db.query(
                func.count(Customer.id).label("count"),
                func.avg(Customer.churn_probability).label("avg_prob")
            ).filter(
                Customer.churn_risk_level == risk_level,
                Customer.is_churned == False
            ).first()

            count = stats.count or 0
            if count == 0:
                continue

            segments.append(SegmentInfo(
                segment_id=seg_id,
                name=seg_def["name"],
                description=seg_def["description"],
                customer_count=count,
                avg_churn_probability=round(stats.avg_prob or 0, 4),
                total_revenue=0, # Not available for generic data
                avg_tenure=0     # Not available for generic data
            ))

        return SegmentListResponse(segments=segments)
    except Exception as e:
        print(f"Error in get_segments: {e}")
        return SegmentListResponse(segments=[])


@router.get("/{segment_id}")
def get_segment_details(segment_id: str, db: Session = Depends(get_db)):
    """Get detailed information about a specific segment"""
    try:
        defined_segments = get_risk_segments()
        
        if segment_id not in defined_segments:
            raise HTTPException(status_code=404, detail="Segment not found")
            
        seg_def = defined_segments[segment_id]
        risk_level = seg_def["criteria"]["risk_level"]

        # Get stats
        stats = db.query(
            func.count(Customer.id).label("count"),
            func.avg(Customer.churn_probability).label("avg_prob")
        ).filter(
            Customer.churn_risk_level == risk_level
        ).first()

        count = stats.count if stats else 0
        avg_prob = stats.avg_prob if stats else 0

        return {
            "segment_id": segment_id,
            "name": seg_def["name"],
            "description": seg_def["description"],
            "criteria": seg_def["criteria"],
            "statistics": {
                "customer_count": count or 0,
                "avg_churn_probability": round(avg_prob or 0, 4),
                "total_annual_revenue": 0,
                "avg_tenure_months": 0,
                "avg_monthly_charges": 0,
                "avg_support_tickets": 0
            },
            "risk_distribution": {risk_level: count or 0}, 
            "contract_distribution": {}
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_segment_details: {e}")
        # Return partial/empty response to prevent crash
        return {
            "segment_id": segment_id,
            "name": "Error loading segment",
            "description": "Could not load details",
            "criteria": {},
            "statistics": {
                "customer_count": 0,
                "avg_churn_probability": 0
            },
            "risk_distribution": {},
            "contract_distribution": {}
        }


@router.get("/{segment_id}/customers")
def get_segment_customers(
    segment_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("churn_probability", regex="^(name|churn_probability)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    db: Session = Depends(get_db)
):
    """Get customers in a specific segment with pagination"""
    try:
        defined_segments = get_risk_segments()
        if segment_id not in defined_segments:
            # Check if it's a generic "all" or unknown, default to empty
            return {
                "segment": {"segment_id": segment_id, "name": "Unknown", "description": "", "customer_count": 0},
                "customers": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 0
            }

        risk_level = defined_segments[segment_id]["criteria"]["risk_level"]
        
        query = db.query(Customer).filter(Customer.churn_risk_level == risk_level)
        total = query.count()

        # Apply sorting
        if hasattr(Customer, sort_by):
            sort_column = getattr(Customer, sort_by)
            if sort_order == "desc":
                query = query.order_by(sort_column.desc())
            else:
                query = query.order_by(sort_column.asc())
        
        # Pagination
        offset = (page - 1) * page_size
        customers = query.offset(offset).limit(page_size).all()
        
        # Segment info for response
        segment_info = SegmentInfo(
            segment_id=segment_id,
            name=defined_segments[segment_id]["name"],
            description=defined_segments[segment_id]["description"],
            customer_count=total,
            avg_churn_probability=0, 
            total_revenue=0,
            avg_tenure=0
        )

        return {
            "segment": segment_info,
            "customers": [CustomerResponse.model_validate(c) for c in customers],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 1
        }
    except Exception as e:
        print(f"Error in get_segment_customers: {e}")
        return {
            "segment": {"segment_id": segment_id, "name": "Error", "description": "", "customer_count": 0},
            "customers": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 0
        }

@router.get("/{segment_id}/insights")
def get_segment_insights(segment_id: str, db: Session = Depends(get_db)):
    """Get actionable insights for a segment"""
    try:
        defined_segments = get_risk_segments()
        if segment_id not in defined_segments:
            return {
                "segment_id": segment_id,
                "insights": [],
                "metrics_summary": {}
            }
            
        insights = []
        
        if segment_id == "high_risk":
            insights.append({
                "type": "critical",
                "title": "High Churn Risk Detected",
                "description": "These customers are very likely to leave. Immediate action needed.",
                "recommendation": "Contact personally or offer strong retention incentives."
            })
        elif segment_id == "medium_risk":
            insights.append({
                "type": "warning",
                "title": "Monitor Closely",
                "description": "customers show signs of potential churn.",
                "recommendation": "Send engagement emails or satisfaction surveys."
            })
        elif segment_id == "low_risk":
            insights.append({
                "type": "success",
                "title": "Healthy Segment",
                "description": "These customers are stable.",
                "recommendation": "Upsell opportunities or referral requests."
            })
        return {
            "segment_id": segment_id,
            "insights": insights,
            "metrics_summary": {}
        }
    except Exception as e:
        print(f"Error in get_segment_insights: {e}")
        return {
            "segment_id": segment_id,
            "insights": [],
            "metrics_summary": {}
        }


import json as _json

@router.get("/churn-by-feature/{feature}")
def churn_by_feature(feature: str, db: Session = Depends(get_db)):
    """
    Group all customers by a feature value and return avg churn rate per group.
    Used to power the dynamic bar chart on the Segments page.
    """
    try:
        rows = db.query(
            Customer.features_json,
            Customer.churn_probability,
            Customer.churn_risk_level
        ).filter(
            Customer.features_json.isnot(None),
            Customer.churn_probability.isnot(None)
        ).all()

        if not rows:
            return {"feature": feature, "data": []}

        groups = {}
        for row in rows:
            try:
                feat_dict = _json.loads(row.features_json)
            except Exception:
                continue
            if feature not in feat_dict:
                continue
            val = str(feat_dict[feature])
            if val not in groups:
                groups[val] = {"sum_prob": 0.0, "count": 0, "high": 0, "medium": 0, "low": 0}
            groups[val]["sum_prob"] += float(row.churn_probability)
            groups[val]["count"] += 1
            risk = (row.churn_risk_level or "low").lower()
            if risk in groups[val]:
                groups[val][risk] += 1

        if not groups:
            return {"feature": feature, "data": [], "message": f"Feature '{feature}' not found in customer data."}

        data = []
        for val, g in groups.items():
            avg_prob = g["sum_prob"] / g["count"] if g["count"] else 0
            data.append({
                "value": val,
                "churn_rate": round(avg_prob * 100, 1),
                "count": g["count"],
                "high": g["high"],
                "medium": g["medium"],
                "low": g["low"],
            })

        try:
            data.sort(key=lambda d: float(d["value"]))
        except ValueError:
            data.sort(key=lambda d: d["value"])

        return {"feature": feature, "data": data}

    except Exception as e:
        print(f"[churn-by-feature] Error: {e}")
        raise HTTPException(500, f"Could not compute churn by feature: {e}")
