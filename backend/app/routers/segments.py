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
