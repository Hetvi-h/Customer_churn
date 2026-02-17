from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    email = Column(String(100))
    phone = Column(String(20))

    # Demographics
    gender = Column(String(10))
    senior_citizen = Column(Boolean, default=False)
    partner = Column(Boolean, default=False)
    dependents = Column(Boolean, default=False)

    # Account info
    tenure = Column(Integer, default=0)  # months
    contract_type = Column(String(20))  # month-to-month, one_year, two_year
    payment_method = Column(String(50))

    # Service info
    internet_service = Column(String(20))
    num_products = Column(Integer, default=1)

    # Financial
    monthly_charges = Column(Float, default=0.0)
    total_charges = Column(Float, default=0.0)
    contract_value = Column(Float, default=0.0)
    payment_delay_days = Column(Integer, default=0)

    # Engagement
    num_support_tickets = Column(Integer, default=0)
    days_since_last_interaction = Column(Integer, default=0)

    # Churn prediction results
    churn_probability = Column(Float)
    churn_risk_level = Column(String(20))
    last_prediction_date = Column(DateTime)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_churned = Column(Boolean, default=False)
    churned_at = Column(DateTime)

    # Relationships
    predictions = relationship("Prediction", back_populates="customer")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)

    # Prediction results
    churn_probability = Column(Float, nullable=False)
    risk_level = Column(String(20), nullable=False)
    confidence_lower = Column(Float)
    confidence_upper = Column(Float)

    # SHAP values (stored as JSON string)
    shap_values = Column(Text)
    top_factors = Column(Text)  # JSON string of top contributing factors

    # Metadata
    model_version = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="predictions")


class ChurnTrend(Base):
    __tablename__ = "churn_trends"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, nullable=False, index=True)

    # Aggregated metrics
    total_customers = Column(Integer, default=0)
    at_risk_customers = Column(Integer, default=0)
    churned_customers = Column(Integer, default=0)
    avg_churn_probability = Column(Float, default=0.0)

    # By segment
    high_value_at_risk = Column(Integer, default=0)
    new_customer_churn_risk = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow)


class ModelMetrics(Base):
    __tablename__ = "model_metrics"

    id = Column(Integer, primary_key=True, index=True)
    model_version = Column(String(50), nullable=False)

    # Performance metrics
    accuracy = Column(Float)
    precision = Column(Float)
    recall = Column(Float)
    f1_score = Column(Float)
    auc_roc = Column(Float)

    # Confusion matrix (stored as JSON)
    confusion_matrix = Column(Text)

    # Training info
    training_date = Column(DateTime, default=datetime.utcnow)
    training_samples = Column(Integer)

    created_at = Column(DateTime, default=datetime.utcnow)
