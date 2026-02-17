# Customer Churn Prediction & Risk Analysis System

A full-stack application for predicting customer churn using machine learning with SHAP explainability.

## 🎉 Latest Update: Model Integration Complete!

**Status**: ✅ **FULLY OPERATIONAL** (Updated: 2026-01-18)

The system has been successfully integrated with the retrained Random Forest model achieving **83.74% ROC-AUC**. All 32 features are correctly engineered, and the backend/frontend are fully synchronized.

📖 **Quick Links**:
- [Quick Start Guide](QUICKSTART.md) - Get up and running in 5 minutes
- [Integration Summary](INTEGRATION_SUMMARY.md) - Detailed integration documentation
- [Architecture](ARCHITECTURE.md) - System architecture and data flow
- [Final Status](FINAL_STATUS.md) - Complete integration status

**Test the Model**: Run `python test_model.py` to verify predictions!

## Features

### Phase 1 (MVP)
- **Dashboard**: Overview of customer metrics, risk distribution, and top at-risk customers
- **Customer Management**: List, search, filter, and view customer details
- **Individual Predictions**: Predict churn probability for any customer profile
- **Batch Predictions**: Run predictions for all customers at once
- **Risk Classification**: Automatic categorization into High/Medium/Low risk

### Phase 2
- **SHAP Explainability**: Per-customer explanations of prediction factors
- **Customer Segments**: Pre-defined segments with insights and recommendations
- **Churn Trends**: Historical analysis of churn patterns over time
- **Cohort Analysis**: Churn analysis by customer tenure cohorts
- **Model Metrics**: Performance metrics, confusion matrix, and feature importance
- **Prediction History**: Track prediction changes over time for each customer

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - SQL toolkit and ORM
- **SQLite** - Lightweight database
- **scikit-learn** - Machine learning
- **SHAP** - Model explainability
- **Pandas/NumPy** - Data processing

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization
- **Axios** - HTTP client
- **React Router** - Navigation
- **Lucide React** - Icons

## Project Structure

```
Customer Churn Prediction & Risk Analysis System/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI application
│   │   ├── config.py            # Configuration
│   │   ├── database.py          # Database setup
│   │   ├── models.py            # SQLAlchemy models
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── ml_service.py        # ML prediction service
│   │   └── routers/
│   │       ├── customers.py     # Customer endpoints
│   │       ├── predictions.py   # Prediction endpoints
│   │       ├── dashboard.py     # Dashboard endpoints
│   │       ├── segments.py      # Segment endpoints
│   │       ├── trends.py        # Trends endpoints
│   │       └── model.py         # Model metrics endpoints
│   ├── requirements.txt
│   └── seed_data.py             # Database seeding script
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
└── ml/
    ├── models/                   # Trained model files
    └── train_model.py           # Model training script
```

## Setup Instructions

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Train the model (creates model files in ml/models/)
cd ..
python ml/train_model.py

# Seed the database with sample data
cd backend
python seed_data.py

# Start the server
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### 3. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## API Endpoints

### Dashboard
- `GET /api/dashboard/metrics` - Get dashboard metrics
- `GET /api/dashboard/risk-distribution` - Get risk distribution
- `GET /api/dashboard/top-at-risk` - Get top at-risk customers

### Customers
- `GET /api/customers` - List customers (with pagination, search, filters)
- `GET /api/customers/{id}` - Get customer details
- `POST /api/customers` - Create customer
- `PUT /api/customers/{id}` - Update customer
- `DELETE /api/customers/{id}` - Delete customer

### Predictions
- `POST /api/predictions` - Make a prediction
- `POST /api/predictions/explain` - Prediction with SHAP explanation
- `POST /api/predictions/customer/{id}` - Predict for existing customer
- `POST /api/predictions/batch` - Batch predictions
- `GET /api/predictions/history/{id}` - Get prediction history

### Segments (Phase 2)
- `GET /api/segments` - List all segments
- `GET /api/segments/{id}` - Get segment details
- `GET /api/segments/{id}/customers` - Get segment customers
- `GET /api/segments/{id}/insights` - Get segment insights

### Trends (Phase 2)
- `GET /api/trends/churn` - Get churn trends
- `GET /api/trends/risk-evolution` - Get risk evolution
- `GET /api/trends/cohort-analysis` - Get cohort analysis

### Model (Phase 2)
- `GET /api/model/metrics` - Get model metrics
- `GET /api/model/feature-importance` - Get feature importance
- `GET /api/model/confusion-matrix` - Get confusion matrix
- `POST /api/model/reload` - Reload model from disk

## Model Information

The churn prediction model uses a Random Forest Classifier with **83.74% ROC-AUC** trained on 7,043 customers.

### Performance Metrics
- **ROC-AUC**: 0.8374 (83.74%) - Excellent discrimination
- **Accuracy**: 75.0%
- **Precision**: 52.1%
- **Recall**: 74.6%
- **Training Date**: 2026-01-18
- **Dataset Size**: 7,043 customers
- **Churn Rate**: 26.5%

### Features (32 Total)

#### Categorical Features (16)
- Contract, InternetService, PaymentMethod, tenure_group
- OnlineSecurity, TechSupport, OnlineBackup, DeviceProtection
- gender, Partner, Dependents, PhoneService
- MultipleLines, StreamingTV, StreamingMovies, PaperlessBilling

#### Numerical Features (16)
- tenure, MonthlyCharges, TotalCharges, SeniorCitizen
- avg_monthly_charge, price_per_tenure, num_services
- is_new_customer, is_expensive, is_month_to_month
- has_premium_services, has_paperless_billing, auto_payment
- has_phone, has_internet, has_fiber

### Top Predictive Features
1. **is_month_to_month** (47.3%) - Most important predictor
2. **Contract** (12.4%)
3. **has_fiber** (6.9%)
4. **is_new_customer** (4.1%)
5. **has_phone** (2.8%)

### Risk Thresholds
- **High Risk**: Churn probability >= 70%
- **Medium Risk**: Churn probability >= 40%
- **Low Risk**: Churn probability < 40%

### Model Files
All models saved with `joblib` protocol=4 for compatibility:
- `churn_model.pkl` - Random Forest classifier
- `scaler.pkl` - StandardScaler for numerical features
- `label_encoders.pkl` - LabelEncoders for categorical features
- `shap_explainer.pkl` - Pre-computed SHAP explainer
- `metadata.json` - Feature names, importance, metrics, training info

## Error Handling

If model files are missing, the API returns a 503 error for prediction endpoints.
Use the `/api/model/reload` endpoint to reload models after placing files in `ml/models/`.

## Development

### Adding New Features
1. Add backend endpoint in appropriate router
2. Add schema in `schemas.py`
3. Add API call in `frontend/src/services/api.js`
4. Create/update frontend component

### Model Retraining
1. Update `ml/train_model.py` as needed
2. Run the training script
3. Use `/api/model/reload` or restart the server
