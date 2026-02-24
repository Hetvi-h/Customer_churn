from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime
import json
import pandas as pd
import numpy as np
import io


from ..database import get_db
from ..models import Customer, Prediction, ChurnTrend
from ..schemas import (
    PredictionInput,
    PredictionResponse,
    PredictionWithExplanation,
    CustomerPredictionResponse,
    BatchPredictionInput,
    BatchPredictionResponse,
    CSVUploadResponse
)
from ..config import (
    API_VERSION,
    ML_DATA_DIR,
    BASE_DIR
)
from ..ml_service import predictor, ModelNotLoadedError
import subprocess
import sys
import shutil
import os

router = APIRouter(prefix="/predictions", tags=["Predictions"])


def safe_convert(value, converter, default):
    """Safely convert a value, handling None, NaN, and empty strings"""
    if pd.isna(value) or value == '' or value is None:
        return default
    try:
        return converter(value)
    except (ValueError, TypeError):
        return default


def check_model_loaded():
    """Dependency to check if model is loaded"""
    if not predictor.model_loaded:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Please ensure model files exist in ml/models/ directory."
        )


@router.post("", response_model=PredictionResponse)
def predict_churn(
    input_data: Dict[str, Any],
    _: None = Depends(check_model_loaded)
):
    """Make a single churn prediction (DYNAMIC - works with ANY features)"""
    try:
        result = predictor.predict(input_data)
        return PredictionResponse(**result)
    except ModelNotLoadedError:
        raise HTTPException(status_code=503, detail="Model not loaded")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@router.post("/explain", response_model=PredictionWithExplanation)
def predict_with_explanation(
    input_data: Dict[str, Any],
    _: None = Depends(check_model_loaded)
):
    """Make prediction with SHAP explanation (DYNAMIC - adapts to ANY features)"""
    try:
        result = predictor.predict_with_explanation(input_data)
        return PredictionWithExplanation(**result)
    except ModelNotLoadedError:
        raise HTTPException(status_code=503, detail="Model not loaded")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@router.post("/customer/{customer_id}", response_model=CustomerPredictionResponse)
def predict_for_customer(
    customer_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(check_model_loaded)
):
    """Make prediction for existing customer and store result"""
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Prepare input from customer data
    input_data = {
        "tenure": customer.tenure,
        "MonthlyCharges": customer.monthly_charges,
        "TotalCharges": customer.total_charges,
        "Contract": customer.contract_type or "Month-to-month",
        "PaymentMethod": customer.payment_method or "Electronic check",
        "InternetService": customer.internet_service or "Fiber optic",
        "gender": customer.gender or "Male",
        "SeniorCitizen": 1 if customer.senior_citizen else 0,
        "Partner": "Yes" if customer.partner else "No",
        "Dependents": "Yes" if customer.dependents else "No",
        "PhoneService": "Yes",
        "MultipleLines": "No",
        "OnlineSecurity": "No",
        "OnlineBackup": "No",
        "DeviceProtection": "No",
        "TechSupport": "No",
        "StreamingTV": "No",
        "StreamingMovies": "No",
        "PaperlessBilling": "Yes"
    }

    try:
        result = predictor.predict_with_explanation(input_data)

        # Update customer record
        customer.churn_probability = result["churn_probability"]
        customer.churn_risk_level = result["risk_level"]
        customer.last_prediction_date = datetime.utcnow()

        # Store prediction history
        prediction = Prediction(
            customer_id=customer.id,
            churn_probability=result["churn_probability"],
            risk_level=result["risk_level"],
            confidence_lower=result["confidence_interval"]["lower"],
            confidence_upper=result["confidence_interval"]["upper"],
            shap_values=json.dumps(result.get("shap_values", {})),
            top_factors=json.dumps(result.get("top_factors", [])),
            model_version="2.0.0"
        )
        db.add(prediction)
        db.commit()
        db.refresh(customer)

        return CustomerPredictionResponse(
            customer_id=customer.customer_id,
            customer_name=customer.name,
            prediction=PredictionWithExplanation(**result)
        )

    except ModelNotLoadedError:
        raise HTTPException(status_code=503, detail="Model not loaded")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@router.post("/batch", response_model=BatchPredictionResponse)
def batch_predict(
    batch_input: BatchPredictionInput,
    db: Session = Depends(get_db),
    _: None = Depends(check_model_loaded)
):
    """Make predictions for multiple customers"""
    predictions = []
    high_risk = 0
    medium_risk = 0
    low_risk = 0
    total_revenue_at_risk = 0

    for cust_id in batch_input.customer_ids:
        customer = db.query(Customer).filter(Customer.customer_id == cust_id).first()
        if not customer:
            continue

        input_data = {
            "tenure": customer.tenure,
            "MonthlyCharges": customer.monthly_charges,
            "TotalCharges": customer.total_charges,
            "Contract": customer.contract_type or "Month-to-month",
            "PaymentMethod": customer.payment_method or "Electronic check",
            "InternetService": customer.internet_service or "Fiber optic",
            "gender": customer.gender or "Male",
            "SeniorCitizen": 1 if customer.senior_citizen else 0,
            "Partner": "Yes" if customer.partner else "No",
            "Dependents": "Yes" if customer.dependents else "No",
            "PhoneService": "Yes",
            "MultipleLines": "No",
            "OnlineSecurity": "No",
            "OnlineBackup": "No",
            "DeviceProtection": "No",
            "TechSupport": "No",
            "StreamingTV": "No",
            "StreamingMovies": "No",
            "PaperlessBilling": "Yes"
        }

        try:
            result = predictor.predict_with_explanation(input_data)

            customer.churn_probability = result["churn_probability"]
            customer.churn_risk_level = result["risk_level"]
            customer.last_prediction_date = datetime.utcnow()

            if result["risk_level"] == "high":
                high_risk += 1
                total_revenue_at_risk += customer.monthly_charges * 12
            elif result["risk_level"] == "medium":
                medium_risk += 1
                total_revenue_at_risk += customer.monthly_charges * 6
            else:
                low_risk += 1

            predictions.append(CustomerPredictionResponse(
                customer_id=customer.customer_id,
                customer_name=customer.name,
                prediction=PredictionWithExplanation(**result)
            ))

        except Exception as e:
            print(f"Error predicting for customer {cust_id}: {e}")
            continue

    db.commit()

    summary = {
        "total_processed": len(predictions),
        "high_risk_count": high_risk,
        "medium_risk_count": medium_risk,
        "low_risk_count": low_risk,
        "revenue_at_risk": round(total_revenue_at_risk, 2)
    }

    return BatchPredictionResponse(predictions=predictions, summary=summary)


@router.post("/upload-csv", response_model=CSVUploadResponse)
async def upload_csv_for_predictions(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload CSV/Excel file -> RETRAIN MODEL -> Generate Predictions
    
    1. Saves uploaded file
    2. Retrains XGBoost on the new data
    3. Reloads model & metadata
    4. Generates predictions using the NEW model
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    filename = file.filename.lower()
    if not (filename.endswith('.csv') or filename.endswith('.xlsx') or filename.endswith('.xls')):
        raise HTTPException(status_code=400, detail="File must be CSV or Excel format")

    try:
        import time
        print(f"\n--- New Upload Request at {time.time()} ---")
        upload_start = time.time()
        
        # 1. Save File with correct extension
        ext = ".csv"
        if filename.endswith(".xlsx"):
            ext = ".xlsx"
        elif filename.endswith(".xls"):
            ext = ".xls"
            
        file_path = os.path.abspath(os.path.join(ML_DATA_DIR, f"current_upload{ext}")) # --- IMPLEMENT SMART DEDUPLICATION ---
        
        summary_stats = {}  # Initialize early
        
        # --- IMPLEMENT SMART DEDUPLICATION ---
        import hashlib
        import json
        
        # 1. Calculate File Hash
        contents = await file.read()
        file_hash = hashlib.md5(contents).hexdigest()
        
        # 2. Check History for Duplicate
        history_file = os.path.join(ML_DATA_DIR, "upload_history.json")
        is_duplicate = False
        duplicate_entry = None

        if os.path.exists(history_file):
            try:
                with open(history_file, 'r') as f:
                    history = json.load(f)
                
                # Check if this file hash exists
                for entry in history.get("uploads", []):
                    if entry.get("file_hash") == file_hash:
                        is_duplicate = True
                        duplicate_entry = entry
                        print(f"Duplicate upload detected: {file.filename} (Hash: {file_hash})")
                        break
            except Exception as e:
                print(f"Warning: Failed to read history for deduplication: {e}")

        # 3. Handle Duplicate vs New Upload
        # Save file (Always needed for the current prediction session)
        os.makedirs(ML_DATA_DIR, exist_ok=True)
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
        print(f"File saved to {file_path}")
        
        # Always retrain — dedup is tracked for history only, but we always
        # want to use the latest model hyperparameters.
        if is_duplicate:
            print(f"Note: Duplicate file detected (same as previous upload), but retraining anyway to apply latest model settings.")
        else:
            print("New dataset detected. Retraining model...")
        
        train_script = "ml/train_model.py"
        try:
            import copy
            env = copy.copy(os.environ)
            env["PYTHONIOENCODING"] = "utf-8"  # Fix Windows cp1252 charmap crash
            result = subprocess.run(
                [sys.executable, train_script, file_path],
                cwd=BASE_DIR,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=env,
                check=True
            )
            print("Model retraining complete.")
            print(result.stdout)
            
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] Model training failed with exit code {e.returncode}")
            print(f"STDOUT:\n{e.stdout}")
            print(f"STDERR:\n{e.stderr}")
            raise HTTPException(status_code=500, detail=f"Model training failed: {e.stderr}")
            
        # 3. Reload Model & Metadata
        print("Reloading model...")
        if not predictor.load_models():
             raise HTTPException(status_code=500, detail="Failed to load retrained model")
        
        # 3.1 Initialize SHAP explainer for the new model
        print("Initializing SHAP explainer...")
        predictor.initialize_shap()
             
        # 4. Process Predictions using NEW Model
        # Read the file again into DataFrame (multi-sheet Excel support)
        if filename.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            # Multi-sheet: skip metadata sheets, use first valid data sheet
            xls = pd.ExcelFile(file_path)
            metadata_keywords = {'Data', 'Variable', 'Description', 'Discerption',
                                 'Column_name', 'Column_type', 'Data_type', 'Type', 'Format'}
            df = None
            for sheet_name in xls.sheet_names:
                temp_df = pd.read_excel(xls, sheet_name=sheet_name)
                temp_df.columns = temp_df.columns.str.strip()
                if set(temp_df.columns).intersection(metadata_keywords):
                    continue
                if len(temp_df) < 10:
                    continue
                df = temp_df
                print(f"Re-reading sheet '{sheet_name}' for predictions ({len(df)} rows)")
                break
            if df is None:
                raise ValueError("No valid data sheet found in Excel file for predictions.")
            
        # Standardize column names
        df.columns = df.columns.str.strip()
        
        # Get NEW metadata
        feature_cols = predictor.metadata.get('feature_cols', [])
        categorical_cols = predictor.metadata.get('categorical_cols', [])
        numerical_cols = predictor.metadata.get('numerical_cols', [])
        customer_id_col = predictor.metadata.get('customer_id_col', 'customerID')
        target_col = predictor.metadata.get('target_col', 'Churn')
        
        print(f"New Schema: Target={target_col}, ID={customer_id_col}, Features={len(feature_cols)}")

        # Prepare features DataFrame
        df_features = pd.DataFrame()
        
        # Create case-insensitive column map
        col_map = {c.lower(): c for c in df.columns}
        
        missing_cols = []
        mapped_cols = []

        for col in feature_cols:
            # Try to find column (Exact or Case-Insensitive)
            source_col = col  # Default to exact
            if col in df.columns:
                source_col = col
            elif col.lower() in col_map:
                source_col = col_map[col.lower()]
                mapped_cols.append(f"{source_col} -> {col}")
            else:
                source_col = None
                missing_cols.append(col)

            if source_col:
                if col in numerical_cols:
                    df_features[col] = pd.to_numeric(df[source_col], errors='coerce').fillna(0)
                else:
                    df_features[col] = df[source_col].fillna("Unknown").astype(str)
            else:
                # Feature completely missing
                df_features[col] = 0 if col in numerical_cols else "Unknown"
        
        print(f"Column Mapping: {len(mapped_cols)} case-mismatched columns mapped.")
        if missing_cols:
            print(f"[WARN] MISSING FEATURES ({len(missing_cols)}): {missing_cols}")
        else:
            print("[OK] All features found in uploaded file.")

        # Extract IDs and Actual Churn
        customer_ids = df[customer_id_col].astype(str).tolist() if customer_id_col in df.columns else [f"ROW-{i+1}" for i in range(len(df))]
        
        if target_col in df.columns:
            actual_churn = df[target_col].apply(
                lambda x: 1 if str(x).lower() in ['yes', '1', 'true', 'churned', 'exited'] else 0
            ).tolist()
        else:
            actual_churn = [None] * len(df)

        # Batch Prediction
        print("Running batch prediction...")
        X_array = predictor.batch_prepare_features(df_features)
        probabilities = predictor.model.predict_proba(X_array)[:, 1]
        
        # Risk Levels
        risk_levels = [predictor._get_risk_level(p) for p in probabilities]
        
        high_risk = sum(1 for r in risk_levels if r == "high")
        medium_risk = sum(1 for r in risk_levels if r == "medium")
        low_risk = sum(1 for r in risk_levels if r == "low")

        # ── Compute per-customer SHAP values (single vectorised call) ──────────
        shap_per_row = [None] * len(customer_ids)  # fallback: no SHAP
        try:
            # Multi-check initialization
            if not predictor.shap_ready or predictor.shap_explainer is None:
                print("[INFO] SHAP explainer not ready — attempting one-time initialization...")
                predictor.initialize_shap()

            if predictor.shap_ready and predictor.shap_explainer is not None:
                print(f"Computing SHAP for {len(X_array)} rows...")
                raw_shap = predictor.shap_explainer.shap_values(X_array)
                
                # Robust class selection for different SHAP versions/models
                if isinstance(raw_shap, list):
                    # List of arrays (one per class)
                    shap_matrix = raw_shap[1] if len(raw_shap) > 1 else raw_shap[0]
                elif isinstance(raw_shap, np.ndarray) and len(raw_shap.shape) == 3:
                    # 3D array (samples, features, classes)
                    shap_matrix = raw_shap[:, :, 1] if raw_shap.shape[2] > 1 else raw_shap[:, :, 0]
                else:
                    # 2D array (samples, features)
                    shap_matrix = raw_shap

                feat_names = predictor.metadata.get('feature_cols', [])
                for i in range(len(customer_ids)):
                    if i < len(shap_matrix):
                        shap_per_row[i] = {
                            fn: float(sv)
                            for fn, sv in zip(feat_names, shap_matrix[i])
                        }
                print(f"[OK] SHAP values computed and mapped for {len(shap_matrix)} customers.")
            else:
                print("[WARN] SHAP explainer still NULL after init — SHAP will be missing.")
        except Exception as shap_err:
            print(f"[ERROR] SHAP calculation failed: {str(shap_err)}")
            import traceback
            traceback.print_exc()

        # ── Build insert records ─────────────────────────────────────────────
        print("Clearing old customers from DB...")
        db.query(Customer).delete()
        db.commit()
        print(f"Inserting {len(customer_ids)} new customers...")
        insert_records = []

        for idx, (cust_id, prob, risk, churn) in enumerate(zip(customer_ids, probabilities, risk_levels, actual_churn)):
            # Raw features for this row
            row_features = df_features.iloc[idx].to_dict()
            # Convert numpy types to native Python for JSON serialisation
            row_features = {
                k: (float(v) if isinstance(v, (np.floating, np.integer)) else str(v))
                for k, v in row_features.items()
            }

            shap_dict = shap_per_row[idx]
            top_factor = None
            if shap_dict:
                top_factor = max(shap_dict, key=lambda f: abs(shap_dict[f]))

            record = {
                "customer_id": cust_id,
                "name": f"Customer {cust_id}",
                "churn_probability": float(prob),
                "churn_risk_level": risk,
                "last_prediction_date": datetime.utcnow(),
                "features_json": json.dumps(row_features),
                "shap_values_json": json.dumps(shap_dict) if shap_dict else None,
                "top_risk_factor": top_factor,
            }

            if churn is not None:
                record["is_churned"] = bool(churn)
            else:
                record["is_churned"] = False
            insert_records.append(record)
        if insert_records:
            db.bulk_insert_mappings(Customer, insert_records)
            print(f"   Bulk inserted {len(insert_records)} customers")
        
        db.commit()
        
        # Create Trend Snapshot
        try:
            churn_count = sum(1 for c in actual_churn if c == 1) if any(x is not None for x in actual_churn) else 0
            snapshot = ChurnTrend(
                date=datetime.utcnow(),
                total_customers=len(customer_ids),
                at_risk_customers=high_risk + medium_risk,
                churned_customers=churn_count,
                avg_churn_probability=float(np.mean(probabilities)),
                high_value_at_risk=0,       
                new_customer_churn_risk=0   
            )
            db.add(snapshot)
            db.commit()
            print("Trend snapshot created.")
        except Exception as e:
            print(f"Warning: Failed to create trend snapshot: {e}")


        
        # Build Response
        predictions = [
            {
                "row_index": idx + 1,
                "customer_id": cust_id,
                "churn_probability": float(prob),
                "risk_level": risk
            }
            for idx, (cust_id, prob, risk) in enumerate(zip(customer_ids[:100], probabilities[:100], risk_levels[:100]))
        ]

        summary_stats = {
            "total_customers": len(customer_ids),
            "total_rows": len(df),
            "high_risk": high_risk,
            "medium_risk": medium_risk,
            "low_risk": low_risk,
            "churn_rate": round(float(np.mean([c for c in actual_churn if c is not None])) * 100, 2) if any(c is not None for c in actual_churn) else 0,
            "avg_churn_probability": round(float(np.mean(probabilities)), 4),
            "model_name": predictor.metadata.get("model_name", "XGBoost"),
            "roc_auc": predictor.metadata.get("roc_auc", 0),
            "accuracy": predictor.metadata.get("accuracy", 0),
            "customer_id_col": customer_id_col,
            "target_col": target_col,
            "feature_importance": predictor.metadata.get("feature_importance", {}),
            "feature_count": len(feature_cols),
            "feature_names": feature_cols
        }

        upload_record = {
            "timestamp": datetime.utcnow().isoformat(),
            "filename": file.filename,
            "file_hash": file_hash,
            "is_duplicate": is_duplicate,
            "original_upload": duplicate_entry["timestamp"] if is_duplicate and duplicate_entry else None,
            "total_customers": len(customer_ids),
            "total_columns": len(df.columns),
            "target_column": target_col,
            "features_detected": len(feature_cols),
            "high_risk": int(high_risk),
            "medium_risk": int(medium_risk),
            "low_risk": int(low_risk),
            "roc_auc": float(predictor.metadata.get("roc_auc", 0)),
            "accuracy": float(predictor.metadata.get("accuracy", 0)),
            "churn_rate": float(summary_stats.get("churn_rate", 0))
        }

        # Append to history
        if os.path.exists(history_file):
            try:
                with open(history_file, 'r') as f:
                    history = json.load(f)
            except json.JSONDecodeError:
                history = {"uploads": []}
        else:
            history = {"uploads": []}

        history["uploads"].append(upload_record)

        # Keep only last 50 uploads
        history["uploads"] = history["uploads"][-50:]

        with open(history_file, 'w') as f:
            json.dump(history, f, indent=2)

        print(f"Upload complete. Processed {len(customer_ids)} rows.")
        return {
            "success": True,
            "rows_processed": len(customer_ids),
            "predictions": predictions,
            "summary": summary_stats
        }

    except Exception as e:
        db.rollback()
        print(f"ERROR during upload: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


def _extract_feature_importance(metadata):
    """Extract feature importance as list from metadata"""
    if not metadata:
        return []
    
    feature_importance = metadata.get("feature_importance", {})
    
    if isinstance(feature_importance, dict):
        # Convert dict to list
        return [
            {"feature": k, "importance": v}
            for k, v in sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:10]
        ]
    elif isinstance(feature_importance, list):
        return feature_importance[:10]
    else:
        return []





@router.post("/batch/all")
def predict_all_customers(
    db: Session = Depends(get_db),
    _: None = Depends(check_model_loaded)
):
    """Run predictions for all customers in database"""
    customers = db.query(Customer).filter(Customer.is_churned == False).all()
    customer_ids = [c.customer_id for c in customers]

    return batch_predict(
        BatchPredictionInput(customer_ids=customer_ids),
        db
    )


@router.get("/history/{customer_id}")
def get_prediction_history(
    customer_id: str,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Get prediction history for a customer"""
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    predictions = db.query(Prediction).filter(
        Prediction.customer_id == customer.id
    ).order_by(Prediction.created_at.desc()).limit(limit).all()

    return {
        "customer_id": customer_id,
        "customer_name": customer.name,
        "predictions": [
            {
                "id": p.id,
                "churn_probability": p.churn_probability,
                "risk_level": p.risk_level,
                "confidence_lower": p.confidence_lower,
                "confidence_upper": p.confidence_upper,
                "top_factors": json.loads(p.top_factors) if p.top_factors else [],
                "created_at": p.created_at.isoformat()
            }
            for p in predictions
        ]
    }
