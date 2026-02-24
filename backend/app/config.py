import os
from pathlib import Path

# Base paths using Windows-compatible path joining
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ML_MODELS_DIR = os.path.join(BASE_DIR, "ml", "models")
ML_DATA_DIR = os.path.join(BASE_DIR, "ml", "data")

# Model file paths - Updated for new .pkl format
CHURN_MODEL_PATH = os.path.join(ML_MODELS_DIR, "model.pkl")
SCALER_PATH = os.path.join(ML_MODELS_DIR, "scaler.pkl")
LABEL_ENCODERS_PATH = os.path.join(ML_MODELS_DIR, "encoders.pkl")
METADATA_PATH = os.path.join(ML_MODELS_DIR, "metadata.json")
SHAP_EXPLAINER_PATH = os.path.join(ML_MODELS_DIR, "shap_explainer.pkl")

# Training data path
TRAINING_DATA_PATH = os.path.join(ML_DATA_DIR, "telco_churn.csv")

# Database
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'backend', 'churn.db')}"

# API Settings
API_TITLE = "Customer Churn Prediction API"
API_VERSION = "2.0.0"
API_DESCRIPTION = """
Customer Churn Prediction & Risk Analysis System API.

## Phase 1 Features (MVP)
- Individual customer churn prediction
- Batch prediction processing
- Customer management
- Basic dashboard metrics

## Phase 2 Features
- SHAP-based explainability
- Customer segmentation
- Churn trend analysis
- Risk scoring with confidence intervals
- CSV/Excel file upload for batch predictions
"""

# Feature configuration for the churn model - 32 features
CATEGORICAL_FEATURES = [
    "Contract",
    "InternetService",
    "PaymentMethod",
    "tenure_group",
    "OnlineSecurity",
    "TechSupport",
    "OnlineBackup",
    "DeviceProtection",
    "gender",
    "Partner",
    "Dependents",
    "PhoneService",
    "MultipleLines",
    "StreamingTV",
    "StreamingMovies",
    "PaperlessBilling"
]

NUMERICAL_FEATURES = [
    "tenure",
    "MonthlyCharges",
    "TotalCharges",
    "SeniorCitizen",
    "avg_monthly_charge",
    "price_per_tenure",
    "num_services",
    "is_new_customer",
    "is_expensive",
    "is_month_to_month",
    "has_premium_services",
    "has_paperless_billing",
    "auto_payment",
    "has_phone",
    "has_internet",
    "has_fiber"
]

# Risk thresholds
RISK_THRESHOLDS = {
    "high": 0.7,    # >= 70% = High
    "medium": 0.3,  # >= 30% = Medium, < 30% = Low
    "low": 0.0
}

# Updated segment definitions
SEGMENTS = {
    "champions": {
        "name": "Champions",
        "description": "Low churn risk, high value, loyal customers",
        "criteria": {"max_churn_prob": 0.3, "min_monthly_charges": 70.35, "min_tenure": 24}
    },
    "at_risk_high_value": {
        "name": "At-Risk High Value",
        "description": "High churn risk customers with above-average charges - PRIORITY",
        "criteria": {"min_churn_prob": 0.7, "min_monthly_charges": 70.35}
    },
    "new_customers": {
        "name": "New Customers",
        "description": "Customers with tenure less than 6 months",
        "criteria": {"max_tenure": 6}
    },
    "about_to_churn": {
        "name": "About to Churn",
        "description": "High churn risk with month-to-month contracts",
        "criteria": {"min_churn_prob": 0.7, "contract_type": "Month-to-month"}
    },
    "loyal_customers": {
        "name": "Loyal Customers",
        "description": "Long-term customers with low churn risk",
        "criteria": {"max_churn_prob": 0.4, "min_tenure": 36}
    }
}

# Median monthly charges (from training data)
MEDIAN_MONTHLY_CHARGES = 70.35
