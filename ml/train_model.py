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
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(SCRIPT_DIR, "data", "telco_churn.csv")
MODELS_DIR = os.path.join(SCRIPT_DIR, "models")
DEBUG_LOG_PATH = os.path.join(MODELS_DIR, "training_debug.log")

# Redirect stdout to log file for debugging
class Tee(object):
    def __init__(self, *files):
        self.files = files
    def write(self, obj):
        for f in self.files:
            f.write(obj)
            f.flush()
    def flush(self):
        for f in self.files:
            f.flush()

os.makedirs(MODELS_DIR, exist_ok=True)
f = open(DEBUG_LOG_PATH, 'w')
sys.stdout = Tee(sys.stdout, f)
sys.stderr = Tee(sys.stderr, f)

print("Starting training script...")

def train(data_path=None):
    if data_path is None:
        data_path = DATA_PATH
        
    print(f"Loading data from {data_path}...")
    try:
        if data_path.endswith('.xlsx') or data_path.endswith('.xls'):
            # Iterative header detection for Excel
            for header_row in range(5):
                try:
                    df = pd.read_excel(data_path, header=header_row)
                    # Check if columns look reasonable (not mostly Unnamed)
                    unnamed_count = sum(1 for c in df.columns if str(c).startswith('Unnamed:'))
                    if unnamed_count < len(df.columns) / 2:
                        print(f"Detected header at row {header_row}")
                        break
                except Exception:
                    continue
            else:
                 # Fallback to default
                 df = pd.read_excel(data_path)

        else:
            # CSV with fallback engines and delimiters
            try:
                # Try default
                print(f"Reading CSV from {data_path}")
                df = pd.read_csv(data_path)
            except UnicodeDecodeError:
                print("Utf-8 decode error, trying latin1...")
                try:
                    df = pd.read_csv(data_path, encoding='latin1')
                except:
                    # Try with different delimiters
                    df = pd.read_csv(data_path, sep=';', encoding='latin1')
            except pd.errors.ParserError:
                 print("Parser error, trying different delimiter...")
                 df = pd.read_csv(data_path, sep=';', encoding='utf-8')
                 
        print(f"Raw dataframe shape: {df.shape}")
        print(f"Raw columns: {list(df.columns)}")
                 
    except Exception as e:
        print(f"Failed to read file: {e}")
        raise

    # 1. Detect Schema (Auto-detect Target and ID)
    df.columns = df.columns.str.strip()
    
    # --- METADATA/DOCUMENTATION SHEET CHECK ---
    # Detect common metadata sheet patterns
    metadata_patterns = [
        {'Data', 'Variable', 'Discerption'},
        {'Variable', 'Description', 'Type'},
        {'Column', 'Description', 'Type'},
        {'Field', 'Description'},
        {'Column_name', 'Column_type', 'Data_type', 'Description'},  # ADD THIS
        {'Column_name', 'Description'},  # ADD THIS
    ]
    
    current_cols = set(df.columns)
    if current_cols in metadata_patterns:
        raise ValueError(
            "This appears to be a metadata/documentation sheet. "
            "Please upload the actual data sheet or export as CSV "
            "with only the customer data (no metadata sheets)."
        )

    # Also check if columns are suspiciously generic
    # Check if we have very few columns AND they look like metadata headers
    metadata_headers = {'Data', 'Variable', 'Value', 'Description', 'Type', 'Format', 'Example'}
    if len(df.columns) < 3 and all(col in metadata_headers for col in df.columns):
         raise ValueError(
            "This file appears to contain documentation rather than customer data (generic headers found). "
            "Please upload a CSV/Excel file with actual customer records."
        )
    # ------------------------------------------
    
    # Clean up any remaining Unnamed columns (drop empty columns)
    df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
    
    print(f"Columns found: {list(df.columns)}")
    
    # Expanded candidate lists
    target_candidates = ['Churn', 'Exited', 'churn', 'Target', 'Status', 'churned', 'class', 'Outcome', 'label']
    id_candidates = ['customerID', 'CustomerId', 'customer_id', 'id', 'RowNumber', 'ID', 'Client_ID']
    
    # Find Target
    target_col = next((col for col in target_candidates if col in df.columns), None)
    
    # Fallback: Check last column if it looks like a binary target (0/1 or Yes/No) and unique values < 5
    if not target_col:
        last_col = df.columns[-1]
        unique_vals = df[last_col].nunique()
        if unique_vals <= 5:
            print(f"Target column not found by name. Using last column '{last_col}' as target (unique values: {unique_vals})")
            target_col = last_col
        else:
            raise ValueError(f"Could not auto-detect target column. Available columns: {list(df.columns)}")
            
    # Find ID
    customer_id_col = next((col for col in id_candidates if col in df.columns), None)
    if not customer_id_col:
        print("No ID column found. Using index as ID.")
        customer_id_col = "ROW_ID" 
        df["ROW_ID"] = df.index.astype(str)

    print(f"Auto-detected Target: '{target_col}', ID: '{customer_id_col}'")
    
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
    print(f"Numerical cols: {numerical_cols}")
    print(f"Categorical cols: {categorical_cols}")
    print(f"Feature count: {len(numerical_cols) + len(categorical_cols)}")
    
    # 2. Preprocessing
    X = pd.DataFrame(index=df.index) # Initialize with index to avoid length mismatch issues
    encoders = {}
    
    # Label Encode Categorical
    for col in categorical_cols:
        try:
            le = LabelEncoder()
            # Handle NaN as "Unknown" purely for encoding
            # Use Series.astype(str) to ensure uniform type
            vals = df[col].fillna("Unknown").astype(str)
            X[col] = le.fit_transform(vals)
            encoders[col] = le
        except Exception as e:
            print(f"Error encoding column {col}: {e}")
            
    # Scale Numerical
    for col in numerical_cols:
        try:
            # Force numeric conversion
            X[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        except Exception as e:
            print(f"Error processing numerical column {col}: {e}")
            
    print(f"X shape before encoding/scaling: {X.shape}")
    print(f"X columns: {list(X.columns)}")
    
    if X.empty or X.shape[1] == 0:
        print("ERROR: X is empty after feature processing!")
        print(f"Numerical cols detected: {numerical_cols}")
        print(f"Categorical cols detected: {categorical_cols}")
        for col in numerical_cols:
            print(f"Checking numerical {col}: {col in df.columns}")
        for col in categorical_cols:
            print(f"Checking categorical {col}: {col in df.columns}")
        raise ValueError("No features were added to X!")

    # Handle Target
    # Check if target is already numeric 0/1
    y_raw = df[target_col]
    if pd.api.types.is_numeric_dtype(y_raw) and set(y_raw.unique()).issubset({0, 1}):
        y = y_raw
    else:
        # Try mapped conversion
        y = y_raw.apply(lambda x: 1 if str(x).lower() in ['yes', '1', 'true', 'churned', 'exited'] else 0)
    
    # Scale numericals
    scaler = StandardScaler()
    if numerical_cols:
        X[numerical_cols] = scaler.fit_transform(X[numerical_cols])

    # 3. Train XGBoost (Optimized for speed)
    print("Training XGBoost...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = XGBClassifier(
        n_estimators=50,       # Reduced from 100 for speed
        learning_rate=0.1,
        max_depth=4,           # Reduced depth for speed
        n_jobs=-1,             # Use all cores
        random_state=42,
        use_label_encoder=False,
        eval_metric='logloss'
    )
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    
    # Handle case with only 1 class in test set
    try:
        auc = roc_auc_score(y_test, y_prob)
    except ValueError:
        auc = 0.5
        
    acc = accuracy_score(y_test, y_pred)
    
    print(f"Training complete. ROC-AUC: {auc:.4f}, Accuracy: {acc:.4f}")
    
    # 4. Generate SHAP Explainer (TreeExplainer)
    # Use approximate method if dataset is large, or exact if small. TreeExplainer is usually fast.
    print("Generating SHAP explainer...")
    try:
        explainer = shap.TreeExplainer(model)
        shap_ready = True
    except Exception as e:
        print(f"SHAP init failed: {e}")
        explainer = None
        shap_ready = False
    
    # 5. Save Artifacts
    print("Saving artifacts...")
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    joblib.dump(model, os.path.join(MODELS_DIR, "model.pkl"))
    joblib.dump(scaler, os.path.join(MODELS_DIR, "scaler.pkl"))
    joblib.dump(encoders, os.path.join(MODELS_DIR, "encoders.pkl"))
    
    if shap_ready:
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
        "training_date": "2026-02-18" # Updated date
    }
    
    
    with open(os.path.join(MODELS_DIR, "metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)
        
    print("All files saved successfully.")

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
