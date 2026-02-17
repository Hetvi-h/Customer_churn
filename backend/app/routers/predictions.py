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
            
        file_path = os.path.abspath(os.path.join(ML_DATA_DIR, f"current_upload{ext}"))
        os.makedirs(ML_DATA_DIR, exist_ok=True)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        print(f"File saved to {file_path}")
        
        # 2. Retrain Model
        print("Retraining model on uploaded data...")
        train_script = "ml/train_model.py"
        
        # Run training script in separate process
        try:
            subprocess.check_call(
                [sys.executable, train_script, file_path],
                cwd=BASE_DIR
            )
            print("✅ Model retraining complete.")
        except subprocess.CalledProcessError as e:
            raise HTTPException(status_code=500, detail=f"Model training failed: {str(e)}")
            
        # 3. Reload Model & Metadata
        print("Reloading model...")
        if not predictor.load_models():
             raise HTTPException(status_code=500, detail="Failed to load retrained model")
             
        # 4. Process Predictions using NEW Model
        # Read the file again into DataFrame
        if filename.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
            
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
        for col in feature_cols:
            if col in df.columns:
                if col in numerical_cols:
                    df_features[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
                else:
                    df_features[col] = df[col].fillna("Unknown").astype(str)
            else:
                df_features[col] = 0 if col in numerical_cols else "Unknown"

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

        # Database Update
        print("Updating database...")
        existing_customers_query = db.query(Customer).filter(
            Customer.customer_id.in_(customer_ids)
        ).all()
        existing_customers = {c.customer_id: c for c in existing_customers_query}
        existing_ids = set(existing_customers.keys())
        
        update_records = []
        insert_records = []
        
        for idx, (cust_id, prob, risk, churn) in enumerate(zip(customer_ids, probabilities, risk_levels, actual_churn)):
            record = {
                "customer_id": cust_id,
                "name": f"Customer {cust_id}", 
                "churn_probability": float(prob),
                "churn_risk_level": risk,
                "last_prediction_date": datetime.utcnow(),
            }
            
            if churn is not None:
                record["is_churned"] = bool(churn)
                
            if cust_id in existing_ids:
                record["id"] = existing_customers[cust_id].id
                update_records.append(record)
            else:
                if churn is None:
                    record["is_churned"] = False
                insert_records.append(record)
        if insert_records:
            db.bulk_insert_mappings(Customer, insert_records)
        if update_records:
            db.bulk_update_mappings(Customer, update_records)
            print(f"   Bulk updated {len(update_records)} existing customers")
        
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
            "columns_in_file": list(df.columns),
            "features_detected": len(feature_cols),
            "feature_importance": _extract_feature_importance(predictor.metadata)
        }

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
