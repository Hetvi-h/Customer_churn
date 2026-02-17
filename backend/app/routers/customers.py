from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime

from ..database import get_db
from ..models import Customer
from ..schemas import (
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
    CustomerListResponse
)

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("", response_model=CustomerListResponse)
def get_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    risk_level: Optional[str] = None,
    sort_by: str = Query("created_at", regex="^(name|churn_probability|tenure|created_at)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    db: Session = Depends(get_db)
):
    """Get paginated list of customers with optional filtering"""
    query = db.query(Customer)

    # Apply search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Customer.name.ilike(search_term)) |
            (Customer.customer_id.ilike(search_term)) |
            (Customer.email.ilike(search_term))
        )

    # Apply risk level filter
    if risk_level:
        query = query.filter(Customer.churn_risk_level == risk_level)

    # Get total count
    total = query.count()

    # Apply sorting
    sort_column = getattr(Customer, sort_by)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # Apply pagination
    offset = (page - 1) * page_size
    customers = query.offset(offset).limit(page_size).all()

    total_pages = (total + page_size - 1) // page_size

    return CustomerListResponse(
        customers=[CustomerResponse.model_validate(c) for c in customers],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: str, db: Session = Depends(get_db)):
    """Get single customer by ID"""
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return CustomerResponse.model_validate(customer)


@router.post("", response_model=CustomerResponse, status_code=201)
def create_customer(customer_data: CustomerCreate, db: Session = Depends(get_db)):
    """Create a new customer"""
    # Check for existing customer
    existing = db.query(Customer).filter(
        Customer.customer_id == customer_data.customer_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Customer ID already exists")

    customer = Customer(**customer_data.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return CustomerResponse.model_validate(customer)


@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: str,
    customer_data: CustomerUpdate,
    db: Session = Depends(get_db)
):
    """Update customer information"""
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = customer_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(customer, field, value)

    # Handle churn marking
    if customer_data.is_churned and not customer.churned_at:
        customer.churned_at = datetime.utcnow()

    customer.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(customer)
    return CustomerResponse.model_validate(customer)


@router.delete("/{customer_id}", status_code=204)
def delete_customer(customer_id: str, db: Session = Depends(get_db)):
    """Delete a customer"""
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    db.delete(customer)
    db.commit()
    return None


@router.post("/{customer_id}/mark-churned", response_model=CustomerResponse)
def mark_customer_churned(customer_id: str, db: Session = Depends(get_db)):
    """Mark a customer as churned"""
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer.is_churned = True
    customer.churned_at = datetime.utcnow()
    customer.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(customer)
    return CustomerResponse.model_validate(customer)


@router.get("/stats/summary")
def get_customer_stats(db: Session = Depends(get_db)):
    """Get customer statistics summary"""
    total = db.query(Customer).count()
    churned = db.query(Customer).filter(Customer.is_churned == True).count()

    risk_distribution = db.query(
        Customer.churn_risk_level,
        func.count(Customer.id)
    ).group_by(Customer.churn_risk_level).all()

    risk_dict = {level: count for level, count in risk_distribution if level}

    avg_tenure = db.query(func.avg(Customer.tenure)).scalar() or 0
    avg_monthly = db.query(func.avg(Customer.monthly_charges)).scalar() or 0

    return {
        "total_customers": total,
        "churned_customers": churned,
        "active_customers": total - churned,
        "churn_rate": round(churned / total * 100, 2) if total > 0 else 0,
        "risk_distribution": risk_dict,
        "avg_tenure_months": round(avg_tenure, 1),
        "avg_monthly_charges": round(avg_monthly, 2)
    }
