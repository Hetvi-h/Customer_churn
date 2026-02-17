"""
Retrain model with Label Encoding to match backend expectations.
"""
import pandas as pd
import numpy as np
import joblib
import json
import shap
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import roc_auc_score, accuracy_score
from xgboost import XGBClassifier

# Paths
import os
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(SCRIPT_DIR, "data", "telco_churn.csv")
MODELS_DIR = os.path.join(SCRIPT_DIR, "models")

def train(data_path=None):
    if data_path is None:
        data_path = DATA_PATH
        
    print(f"Loading data from {data_path}...")
    if data_path.endswith('.xlsx') or data_path.endswith('.xls'):
        df = pd.read_excel(data_path)
    else:
        df = pd.read_csv(data_path)
    
    # 1. Detect Schema (Auto-detect Target and ID)
    df.columns = df.columns.str.strip()
    target_candidates = ['Churn', 'Exited', 'churn', 'Target', 'Status', 'churned']
    id_candidates = ['customerID', 'CustomerId', 'customer_id', 'id', 'RowNumber']
    
    target_col = next((col for col in target_candidates if col in df.columns), 'Churn')
    customer_id_col = next((col for col in id_candidates if col in df.columns), 'customerID')
    
    print(f"Auto-detected Target: {target_col}, ID: {customer_id_col}")
    
    numerical_cols = []
    categorical_cols = []
    
    for col in df.columns:
        if col in [target_col, customer_id_col]:
            continue
        # Convert to numeric, errors='coerce' turns non-numeric to NaN
        converted = pd.to_numeric(df[col], errors='coerce')
        ratio = converted.notna().sum() / len(df)
        if ratio > 0.8:
            numerical_cols.append(col)
        else:
            categorical_cols.append(col)
            
    print(f"Detected {len(numerical_cols)} numerical and {len(categorical_cols)} categorical columns")
    
    # 2. Preprocessing
    X = pd.DataFrame()
    encoders = {}
    
    # Label Encode Categorical
    for col in categorical_cols:
        le = LabelEncoder()
        # Handle NaN as "Unknown" purely for encoding
        X[col] = le.fit_transform(df[col].fillna("Unknown").astype(str))
        encoders[col] = le
        
    # Scale Numerical
    for col in numerical_cols:
        X[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        
    y = df[target_col].apply(lambda x: 1 if str(x).lower() in ['yes', '1', 'true', 'churned', 'exited'] else 0)
    
    # Scale numericals
    scaler = StandardScaler()
    if numerical_cols:
        X[numerical_cols] = scaler.fit_transform(X[numerical_cols])
        
    # 3. Train XGBoost
    print("Training XGBoost...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = XGBClassifier(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=5,
        random_state=42,
        use_label_encoder=False,
        eval_metric='logloss'
    )
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, y_prob)
    acc = accuracy_score(y_test, y_pred)
    
    print(f"Training complete. ROC-AUC: {auc:.4f}, Accuracy: {acc:.4f}")
    
    # 4. Generate SHAP Explainer (TreeExplainer)
    print("Generating SHAP explainer...")
    explainer = shap.TreeExplainer(model)
    
    # 5. Save Artifacts
    print("Saving artifacts...")
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    joblib.dump(model, os.path.join(MODELS_DIR, "model.pkl"))
    joblib.dump(scaler, os.path.join(MODELS_DIR, "scaler.pkl"))
    joblib.dump(encoders, os.path.join(MODELS_DIR, "encoders.pkl"))
    joblib.dump(explainer, os.path.join(MODELS_DIR, "shap_explainer.pkl"))
    print("SHAP explainer saved!")
    
    # Feature Importance
    importances = model.feature_importances_
    features = list(X.columns)
    feat_imp = {feat: float(imp) for feat, imp in zip(features, importances)}
    feat_imp = dict(sorted(feat_imp.items(), key=lambda x: x[1], reverse=True))
    
    # Metadata
    metadata = {
        "model_name": "XGBoost",
        "accuracy": float(acc),
        "roc_auc": float(auc),
        "churn_rate": float(y.mean()),
        "customer_id_col": customer_id_col,
        "target_col": target_col,
        "numerical_cols": numerical_cols,
        "categorical_cols": categorical_cols,
        "feature_cols": features,
        "feature_importance": feat_imp,
        "training_date": "2026-02-17"
    }
    
    
    with open(os.path.join(MODELS_DIR, "metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)
        
    print("✅ All files saved successfully.")

if __name__ == "__main__":
    import sys
    import traceback
    
    # Setup error logging
    error_log_path = os.path.join(MODELS_DIR, "error.log")
    
    try:
        data_path = sys.argv[1] if len(sys.argv) > 1 else None
        train(data_path)
    except Exception as e:
        with open(error_log_path, "w") as f:
            f.write(f"Error: {str(e)}\n\n")
            f.write(traceback.format_exc())
        print(f"CRITICAL ERROR: {e}", file=sys.stderr)
        sys.exit(1)
