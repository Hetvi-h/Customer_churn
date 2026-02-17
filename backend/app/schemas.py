from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# Customer Schemas
class CustomerBase(BaseModel):
    customer_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = "Male"
    SeniorCitizen: int = 0
    Partner: Optional[str] = "No"
    Dependents: Optional[str] = "No"
    tenure: int = 0
    Contract: Optional[str] = "Month-to-month"
    PaymentMethod: Optional[str] = "Electronic check"
    InternetService: Optional[str] = "Fiber optic"
    PhoneService: Optional[str] = "Yes"
    MultipleLines: Optional[str] = "No"
    OnlineSecurity: Optional[str] = "No"
    OnlineBackup: Optional[str] = "No"
    DeviceProtection: Optional[str] = "No"
    TechSupport: Optional[str] = "No"
    StreamingTV: Optional[str] = "No"
    StreamingMovies: Optional[str] = "No"
    PaperlessBilling: Optional[str] = "Yes"
    MonthlyCharges: float = 0.0
    TotalCharges: float = 0.0


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = None
    SeniorCitizen: Optional[int] = None
    Partner: Optional[str] = None
    Dependents: Optional[str] = None
    tenure: Optional[int] = None
    Contract: Optional[str] = None
    PaymentMethod: Optional[str] = None
    InternetService: Optional[str] = None
    PhoneService: Optional[str] = None
    MultipleLines: Optional[str] = None
    OnlineSecurity: Optional[str] = None
    OnlineBackup: Optional[str] = None
    DeviceProtection: Optional[str] = None
    TechSupport: Optional[str] = None
    StreamingTV: Optional[str] = None
    StreamingMovies: Optional[str] = None
    PaperlessBilling: Optional[str] = None
    MonthlyCharges: Optional[float] = None
    TotalCharges: Optional[float] = None
    is_churned: Optional[bool] = None


class CustomerResponse(CustomerBase):
    id: int
    churn_probability: Optional[float] = None
    churn_risk_level: Optional[str] = None
    last_prediction_date: Optional[datetime] = None
    is_churned: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CustomerListResponse(BaseModel):
    customers: List[CustomerResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# Prediction Schemas - Updated for 32-feature model
class PredictionInput(BaseModel):
    # Core features
    tenure: int = Field(..., ge=0, description="Months of tenure")
    MonthlyCharges: float = Field(..., ge=0)
    TotalCharges: float = Field(..., ge=0)
    SeniorCitizen: int = Field(default=0, ge=0, le=1)

    # Contract and billing
    Contract: str = Field(default="Month-to-month")
    PaymentMethod: str = Field(default="Electronic check")
    PaperlessBilling: str = Field(default="Yes")

    # Internet and phone
    InternetService: str = Field(default="Fiber optic")
    PhoneService: str = Field(default="Yes")
    MultipleLines: str = Field(default="No")

    # Additional services
    OnlineSecurity: str = Field(default="No")
    OnlineBackup: str = Field(default="No")
    DeviceProtection: str = Field(default="No")
    TechSupport: str = Field(default="No")
    StreamingTV: str = Field(default="No")
    StreamingMovies: str = Field(default="No")

    # Demographics
    gender: str = Field(default="Male")
    Partner: str = Field(default="No")
    Dependents: str = Field(default="No")


class ShapFactor(BaseModel):
    feature: str
    value: Any
    shap_value: float
    impact: str


class PredictionResponse(BaseModel):
    churn_probability: float
    risk_level: str
    confidence_interval: Dict[str, float]
    recommendation: str


class PredictionWithExplanation(PredictionResponse):
    shap_values: Dict[str, float]
    top_factors: List[ShapFactor]
    feature_importance_chart: List[Dict[str, Any]]


class CustomerPredictionResponse(BaseModel):
    customer_id: str
    customer_name: str
    prediction: PredictionWithExplanation


class BatchPredictionInput(BaseModel):
    customer_ids: List[str]


class BatchPredictionResponse(BaseModel):
    predictions: List[CustomerPredictionResponse]
    summary: Dict[str, Any]


# CSV Upload Schemas
class CSVUploadResponse(BaseModel):
    success: bool
    rows_processed: int
    predictions: List[Dict[str, Any]]
    summary: Dict[str, Any]


# Dashboard Schemas
class DashboardMetrics(BaseModel):
    total_customers: int
    at_risk_customers: int
    high_risk_customers: int
    medium_risk_customers: int
    low_risk_customers: int
    churned_customers: int
    churn_rate: float
    avg_churn_probability: float
    revenue_at_risk: float


class RiskDistribution(BaseModel):
    high: int
    medium: int
    low: int


# Segment Schemas
class SegmentInfo(BaseModel):
    segment_id: str
    name: str
    description: str
    customer_count: int
    avg_churn_probability: float
    total_revenue: float
    avg_tenure: float


class SegmentListResponse(BaseModel):
    segments: List[SegmentInfo]


class SegmentCustomersResponse(BaseModel):
    segment: SegmentInfo
    customers: List[CustomerResponse]
    total: int
    page: int
    page_size: int


# Trend Schemas
class TrendDataPoint(BaseModel):
    date: str
    total_customers: int
    at_risk_customers: int
    churned_customers: int
    churn_rate: float
    avg_churn_probability: float


class ChurnTrendResponse(BaseModel):
    trend_data: List[TrendDataPoint]
    period: str
    summary: Dict[str, Any]


# Model Metrics Schemas - Updated for metadata.json
class ModelPerformance(BaseModel):
    roc_auc: float
    accuracy: float
    precision: float
    recall: float


class ConfusionMatrixData(BaseModel):
    true_positive: int
    true_negative: int
    false_positive: int
    false_negative: int


class ModelMetricsResponse(BaseModel):
    model_performance: ModelPerformance
    training_date: Optional[str] = None
    dataset_size: Optional[int] = None
    churn_rate: Optional[float] = None
    feature_count: Optional[int] = None


# Feature Importance Schema
class FeatureImportance(BaseModel):
    feature: str
    importance: float


class FeatureImportanceResponse(BaseModel):
    features: List[FeatureImportance]


# Health Check Schema
class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    shap_explainer_ready: bool
    database_connected: bool
    version: str
    feature_count: Optional[int] = None
