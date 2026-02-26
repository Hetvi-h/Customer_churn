# Customer Churn Prediction & Risk Analysis System

A modern, full-stack AI platform that empowers businesses to predict, analyze, and prevent customer churn using dynamic machine learning models and SHAP-based explainability.

![System Overview](https://img.shields.io/badge/Status-Fully_Operational-success) ![Version](https://img.shields.io/badge/Version-2.1.0-blue)

## ✨ Key Features

### 1. Dynamic Dataset Upload & On-the-Fly Training
- **Custom Datasets:** Upload historical CSV datasets from any industry (Telecom, Banking, SaaS, Retail, etc.).
- **Auto-ML Pipeline:** Automatically detects schemas, handles preprocessing, and trains an optimized machine learning model (e.g., XGBoost) on your specific data.
- **Zero-Config Deployment:** Once trained, the model is immediately deployed and ready to serve predictions for the frontend UI.

### 2. Customer Intelligence
- **Smart Directory:** Search and filter your customer base using real-time SWR caching.
- **Risk Tiers:** Automatically categorizes customers into High (🔴), Medium (🟡), and Low (🟢) risk tiers based on churn probability.
- **Actionable Reports:** Click on any customer to view a comprehensive personalized report, including churn probability and SHAP (SHapley Additive exPlanations) values that isolate the exact features driving their specific risk.

### 3. Advanced Analytics & Insights
- **Segments:** Analyze customer distribution across risk tiers mapped against your dataset's top predictive features.
- **Trends:** Track historical churn patterns, cohort retention, and aggregate risk evolution.
- **Feature Drivers:** Global SHAP visualizations that reveal the holistic, macro-level impact of your business metrics on customer retention.

### 4. Interactive Churn Predictor
- Input hypothetical or new customer profiles into an auto-generated form built dynamically from your active dataset's schema.
- Receive instant predictions alongside AI-generated retention strategy recommendations.

---

## 🛠️ Tech Stack

### Backend
- **FastAPI** - High-performance Python async web framework
- **XGBoost / scikit-learn** - Machine learning pipeline and model training
- **SHAP** - Local and global model interpretability
- **Pandas & NumPy** - Data processing and computation
- **SQLAlchemy & SQLite** - Relational data management

### Frontend
- **React 18** - Interactive user interface component library
- **Vite** - Next-generation frontend tooling and bundling
- **Tailwind CSS** - Utility-first CSS framework for rapid styling
- **SWR** - React hooks for data fetching, caching, and mutation
- **Recharts** - Composable charting library
- **Axios** - Promise-based HTTP client

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.9+**
- **Node.js 18+**

### 1. Automatic Startup (Windows)
If you are on Windows, you can simply run the provided startup script which will activate background servers for both the frontend and backend:
```cmd
.\start.bat
```

### 2. Manual Setup

**Backend (API)**
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows: venv\Scripts\activate
# On Mac/Linux: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```

**Frontend (UI)**
```bash
cd frontend

# Install Node dependencies
npm install

# Start the Vite development server
npm run dev
```

### 3. Access the Application
- **Frontend UI:** [http://localhost:5173](http://localhost:5173)
- **Backend API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 💡 How to Use

1. **Upload Data:** Navigate to the "Upload Data" panel and drop a historical dataset. (Ensure it has a column indicating churn status like `Churn`, `Exited`, or `Left`).
2. **Explore Insights:** Once the AI finishes training on your dataset, navigate to the Dashboard, Segments, and Trends tabs to view high-level analytics.
3. **Analyze Customers:** Open the "Customer Intelligence" tab to search for specific accounts and view their individual Risk Reports.
4. **Predict New Users:** Use the "Churn Predictor" tab to fill out a form for a brand new customer and see what the model predicts for their future behavior.

---

## 🔒 Security & Scope
This system uses local browser storage integration (`localStorage`), Context APIs (`AuthContext`, `UploadContext`), and SWR to maintain multi-tenant upload states. Uploading a new dataset isolates the experience to the current user's session.
