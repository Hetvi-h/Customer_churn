"""
Complete Churn Prediction Training & Testing Script for Google Colab
[OK] Includes SHAP explainer generation
[OK] Auto-downloads model files as ZIP
[OK] Tests predictions to verify no clustering

Upload your CSV to Colab, then run:
python train_and_test_colab.py your_data.csv
"""

import pandas as pd
import numpy as np
import joblib
import json
import shap
import zipfile
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import roc_auc_score, accuracy_score, precision_score, recall_score
from xgboost import XGBClassifier
import warnings
warnings.filterwarnings('ignore')

print("="*60)
print("CHURN PREDICTION MODEL - TRAINING & TESTING")
print("="*60)

# ============================================================================
# STEP 1: LOAD AND PREPARE DATA
# ============================================================================

def load_data(file_path):
    """Load CSV or Excel with robust encoding and error handling"""
    print(f"\n[1/7] Loading data from: {file_path}")
    
    # 1. Handle Excel
    if file_path.lower().endswith(('.xlsx', '.xls')):
        try:
            xls = pd.ExcelFile(file_path)
            metadata_keywords = {'Data', 'Variable', 'Description', 'Discerption', 
                                 'Column_name', 'Column_type', 'Data_type', 'Type', 'Format'}
            df = None
            for sheet_name in xls.sheet_names:
                temp_df = pd.read_excel(xls, sheet_name=sheet_name)
                temp_df.columns = temp_df.columns.str.strip()
                # If sheet contains metadata keywords in columns, skip it
                if set(temp_df.columns).intersection(metadata_keywords):
                    continue
                # If sheet is very small, likely not the data
                if len(temp_df) < 10:
                    continue
                df = temp_df
                print(f"[OK] Loaded Excel sheet: '{sheet_name}' ({len(df)} rows)")
                break
            
            if df is None:
                # Fallback to first sheet if nothing matched
                df = pd.read_excel(file_path)
                print(f"[WARN] No matched data sheet, using first sheet: {len(df)} rows")
            
            df.columns = df.columns.str.strip()
            return df
        except Exception as e:
            print(f"[ERROR] Failed to load Excel: {e}")
            raise

    # 2. Handle CSV (existing robust logic)
    df = None
    for enc in ('utf-8-sig', 'utf-8', 'cp1252', 'latin1'):
        try:
            df = pd.read_csv(file_path, encoding=enc, on_bad_lines='warn')
            print(f"[OK] Loaded with encoding={enc}: {len(df)} rows, {len(df.columns)} columns")
            break
        except (UnicodeDecodeError, Exception):
            continue
    
    if df is None:
        df = pd.read_csv(file_path, encoding='latin1', on_bad_lines='skip')
        print(f"[OK] Loaded (bad lines skipped): {len(df)} rows, {len(df.columns)} columns")
    
    df.columns = df.columns.str.strip()
    return df


def detect_schema(df):
    """Auto-detect target and ID columns"""
    print("\n[2/7] Detecting schema...")
    
    # Find target column
    target_candidates = ['Churn', 'Exited', 'churn', 'Target', 'Status', 'churned']
    target_col = next((col for col in target_candidates if col in df.columns), None)
    
    if not target_col:
        # Check last column
        last_col = df.columns[-1]
        if df[last_col].nunique() <= 5:
            target_col = last_col
            print(f"[WARN] Using last column '{last_col}' as target")
        else:
            raise ValueError(f"Cannot find target column. Columns: {list(df.columns)}")
    
    # Find ID column
    id_candidates = ['customerID', 'CustomerId', 'customer_id', 'id', 'RowNumber']
    customer_id_col = next((col for col in id_candidates if col in df.columns), None)
    
    if not customer_id_col:
        customer_id_col = "ROW_ID"
        df["ROW_ID"] = df.index.astype(str)
        print(f"[WARN] No ID column found, using index")
    
    print(f"[OK] Target: '{target_col}' | ID: '{customer_id_col}'")
    return df, target_col, customer_id_col

def prepare_features(df, target_col, customer_id_col):
    """Detect and prepare numerical/categorical features"""
    print("\n[3/7] Preparing features...")
    
    numerical_cols = []
    categorical_cols = []
    known_binary_fields = []   # 0/1 or Yes/No fields (still encoded as numeric)
    categorical_values = {}    # string-valued categoricals: {col: [options]}
    
    for col in df.columns:
        if col in [target_col, customer_id_col]:
            continue
        
        # Try numeric conversion
        converted = pd.to_numeric(df[col], errors='coerce')
        ratio = converted.notna().sum() / len(df)
        
        if ratio > 0.8:
            numerical_cols.append(col)
            # Check if this is actually a binary 0/1 field
            unique_vals = set(df[col].dropna().unique())
            if unique_vals.issubset({0, 1, '0', '1'}):
                known_binary_fields.append(col)
            elif unique_vals.issubset({'Yes', 'No', 'yes', 'no', 'YES', 'NO'}):
                known_binary_fields.append(col)
        else:
            categorical_cols.append(col)
            # Capture unique string options (up to 20) for dropdown
            options = sorted(df[col].dropna().astype(str).unique().tolist())[:20]
            categorical_values[col] = options
    
    print(f"[OK] Numerical: {len(numerical_cols)} | Categorical: {len(categorical_cols)} | Binary fields: {len(known_binary_fields)}")
    
    # Build feature matrix
    X = pd.DataFrame(index=df.index)
    encoders = {}
    
    # Encode categorical
    for col in categorical_cols:
        le = LabelEncoder()
        vals = df[col].fillna("Unknown").astype(str)
        X[col] = le.fit_transform(vals)
        encoders[col] = le
    
    # Add numerical (CRITICAL: use pd.to_numeric with coerce!)
    for col in numerical_cols:
        X[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    
    print(f"[OK] Feature matrix shape: {X.shape}")
    
    # Prepare target
    y_raw = df[target_col]
    if pd.api.types.is_numeric_dtype(y_raw) and set(y_raw.unique()).issubset({0, 1}):
        y = y_raw
    else:
        y = y_raw.apply(lambda x: 1 if str(x).lower() in ['yes', '1', 'true', 'churned', 'exited'] else 0)
    
    print(f"[OK] Churn rate: {y.mean()*100:.2f}%")
    
    # Scale numerical features
    scaler = StandardScaler()
    if numerical_cols:
        X[numerical_cols] = scaler.fit_transform(X[numerical_cols])
        print("[OK] Numerical features scaled")
    
    return X, y, encoders, scaler, numerical_cols, categorical_cols, known_binary_fields, categorical_values

# ============================================================================
# STEP 2: TRAIN MODEL
# ============================================================================

def train_model(X, y):
    """Train XGBoost with optimized hyperparameters"""
    print("\n[4/7] Training XGBoost model...")
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"  Train: {len(X_train)} samples | Test: {len(X_test)} samples")
    
    model = XGBClassifier(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=6,
        min_child_weight=1,
        subsample=0.8,
        colsample_bytree=0.8,
        n_jobs=-1,
        random_state=42,
        use_label_encoder=False,
        eval_metric='logloss'
    )
    
    model.fit(X_train, y_train)
    
    y_prob = model.predict_proba(X_test)[:, 1]
    y_pred = model.predict(X_test)
    auc = roc_auc_score(y_test, y_prob)
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec  = recall_score(y_test, y_pred, zero_division=0)
    
    print(f"[OK] ROC-AUC: {auc:.4f} | Accuracy: {acc:.4f} | Precision: {prec:.4f} | Recall: {rec:.4f}")
    
    return model, X_train, X_test, y_test, y_prob, auc, acc, prec, rec

# ============================================================================
# STEP 3: GENERATE SHAP EXPLAINER
# ============================================================================

def generate_shap(model, X_train):
    """Generate SHAP explainer"""
    print("\n[5/7] Generating SHAP explainer...")
    
    try:
        explainer = shap.TreeExplainer(model)
        print("[OK] SHAP TreeExplainer created successfully")
        return explainer
    except Exception as e:
        print(f"[WARN] SHAP failed: {e}")
        return None

# ============================================================================
# STEP 4: TEST PREDICTIONS
# ============================================================================

def test_predictions(y_prob):
    """Test prediction distribution"""
    print("\n[6/7] Testing predictions...")
    
    high = np.sum(y_prob >= 0.7)
    medium = np.sum((y_prob >= 0.5) & (y_prob < 0.7))
    low = np.sum(y_prob < 0.5)
    total = len(y_prob)
    
    print(f"\n  Risk Distribution:")
    print(f"  |-- High (>=70%):    {high:4d} ({high/total*100:5.1f}%)")
    print(f"  |-- Medium (50-70%): {medium:4d} ({medium/total*100:5.1f}%)")
    print(f"  +-- Low (<50%):     {low:4d} ({low/total*100:5.1f}%)")
    
    print(f"\n  Stats: Min={y_prob.min()*100:.1f}% | Max={y_prob.max()*100:.1f}% | Std={y_prob.std()*100:.1f}%")
    
    # Test 10 random samples
    np.random.seed(42)
    indices = np.random.choice(len(y_prob), 10)
    print(f"\n  10 Random Samples:")
    for i, idx in enumerate(indices, 1):
        prob = y_prob[idx]
        risk = "HIGH" if prob >= 0.7 else "MEDIUM" if prob >= 0.5 else "LOW"
        print(f"    {i:2d}. {prob*100:5.1f}%  [{risk}]")
    
    healthy = y_prob.std() > 0.05 and high/total < 0.8 and low/total < 0.9
    
    if healthy:
        print(f"\n  [OK] Predictions look healthy!")
    else:
        print(f"\n  [WARN] WARNING: Predictions may be clustered!")
    
    return healthy

# ============================================================================
# STEP 5: SAVE AND ZIP
# ============================================================================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def save_and_zip(model, scaler, encoders, explainer, metadata):
    """Save model files and create ZIP"""
    print("\n[7/7] Saving files...")
    
    # Save directly to ml/models/ so backend picks them up immediately
    output_dir = os.path.join(SCRIPT_DIR, 'models')
    os.makedirs(output_dir, exist_ok=True)
    
    # Save files
    joblib.dump(model, f'{output_dir}/model.pkl')
    joblib.dump(scaler, f'{output_dir}/scaler.pkl')
    joblib.dump(encoders, f'{output_dir}/encoders.pkl')
    
    if explainer:
        joblib.dump(explainer, f'{output_dir}/shap_explainer.pkl')
        print("[OK] Saved: model.pkl, scaler.pkl, encoders.pkl, shap_explainer.pkl")
    else:
        print("[OK] Saved: model.pkl, scaler.pkl, encoders.pkl (no SHAP)")
    
    with open(f'{output_dir}/metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)
    print("[OK] Saved: metadata.json")
    
    # Create ZIP
    zip_name = 'churn_model_files.zip'
    with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file in os.listdir(output_dir):
            zipf.write(os.path.join(output_dir, file), file)
    
    size_mb = os.path.getsize(zip_name) / (1024 * 1024)
    print(f"[OK] Created: {zip_name} ({size_mb:.2f} MB)")
    
    # Try Colab download
    try:
        from google.colab import files
        print(f"\n Downloading {zip_name}...")
        files.download(zip_name)
        print("[OK] Download started!")
    except:
        print(f"\n ZIP ready: {zip_name} (download manually)")

# ============================================================================
# MAIN
# ============================================================================

def main(file_path):
    df = load_data(file_path)
    df, target_col, id_col = detect_schema(df)
    X, y, encoders, scaler, num_cols, cat_cols, binary_fields, cat_values = prepare_features(df, target_col, id_col)
    model, X_train, X_test, y_test, y_prob, auc, acc, prec, rec = train_model(X, y)
    explainer = generate_shap(model, X_train)
    healthy = test_predictions(y_prob)
    
    # Metadata
    from datetime import date
    feat_imp = {f: float(i) for f, i in zip(X.columns, model.feature_importances_)}
    metadata = {
        "model_name": "XGBoost",
        "accuracy": float(acc),
        "roc_auc": float(auc),
        "precision": float(prec),
        "recall": float(rec),
        "churn_rate": float(y.mean()),
        "customer_id_col": id_col,
        "target_col": target_col,
        "numerical_cols": num_cols,
        "categorical_cols": cat_cols,
        "feature_cols": list(X.columns),
        "known_binary_fields": binary_fields,
        "categorical_values": cat_values,
        "feature_importance": dict(sorted(feat_imp.items(), key=lambda x: x[1], reverse=True)),
        "training_date": str(date.today())
    }
    
    save_and_zip(model, scaler, encoders, explainer, metadata)
    
    print("\n" + "="*60)
    if healthy:
        print("[OK] SUCCESS! Extract ZIP and replace files in ml/models/")
    else:
        print("[ERROR] FAILED! Do NOT use these files!")
    print("="*60 + "\n")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python train_and_test_colab.py data.csv")
        sys.exit(1)
    main(sys.argv[1])