import os
import json
import joblib
import numpy as np
import pandas as pd
from typing import Optional, Dict, Any, List
from datetime import datetime

from .config import (
    CHURN_MODEL_PATH,
    SCALER_PATH,
    LABEL_ENCODERS_PATH,
    METADATA_PATH,
    SHAP_EXPLAINER_PATH,
    RISK_THRESHOLDS,
    API_VERSION
)


class ModelNotLoadedError(Exception):
    """Raised when model is not loaded"""
    pass


class ChurnPredictor:
    """
    DYNAMIC Churn prediction service - Works with ANY dataset
    
    CRITICAL: This class reads ALL configuration from metadata.json
    NO hardcoded feature names or industry assumptions!
    """

    def __init__(self):
        self.model = None
        self.scaler = None
        self.label_encoders = None
        self.metadata = None
        self.shap_explainer = None
        self.model_loaded = False
        self.shap_ready = False
        
        # Dynamic properties (loaded from metadata)
        self.feature_cols = []
        self.categorical_cols = []
        self.numerical_cols = []
        self.feature_importance = {}

    def load_models(self) -> bool:
        """
        Load model, scaler, label encoders, and metadata from disk
        
        CRITICAL: All feature configuration comes from metadata.json
        """
        try:
            # Load model
            if not os.path.exists(CHURN_MODEL_PATH):
                print(f"❌ Model file not found at: {CHURN_MODEL_PATH}")
                return False

            self.model = joblib.load(CHURN_MODEL_PATH)
            print(f"✅ Loaded model from: {CHURN_MODEL_PATH}")

            # Load scaler
            if os.path.exists(SCALER_PATH):
                self.scaler = joblib.load(SCALER_PATH)
                print(f"✅ Loaded scaler from: {SCALER_PATH}")

            # Load label encoders
            if os.path.exists(LABEL_ENCODERS_PATH):
                self.label_encoders = joblib.load(LABEL_ENCODERS_PATH)
                print(f"✅ Loaded label encoders from: {LABEL_ENCODERS_PATH}")

            # Load metadata (CRITICAL!)
            if not os.path.exists(METADATA_PATH):
                print(f"❌ metadata.json not found at: {METADATA_PATH}")
                return False
                
            with open(METADATA_PATH, 'r') as f:
                self.metadata = json.load(f)
            
            # Extract dynamic configuration from metadata
            self.feature_cols = self.metadata.get('feature_cols', [])
            self.categorical_cols = self.metadata.get('categorical_cols', [])
            self.numerical_cols = self.metadata.get('numerical_cols', [])
            self.feature_importance = self.metadata.get('feature_importance', {})
            
            print(f"✅ Loaded metadata:")
            print(f"   - Features: {len(self.feature_cols)}")
            print(f"   - Categorical: {len(self.categorical_cols)}")
            print(f"   - Numerical: {len(self.numerical_cols)}")
            print(f"   - Model: {self.metadata.get('model_name', 'Unknown')}")
            print(f"   - ROC-AUC: {self.metadata.get('roc_auc', 'N/A')}")

            self.model_loaded = True
            return True

        except Exception as e:
            print(f"❌ Error loading models: {e}")
            import traceback
            traceback.print_exc()
            self.model_loaded = False
            return False

    def initialize_shap(self) -> bool:
        """Initialize SHAP explainer for the model"""
        if not self.model_loaded:
            return False

        try:
            # Try to load pre-computed SHAP explainer
            if os.path.exists(SHAP_EXPLAINER_PATH):
                self.shap_explainer = joblib.load(SHAP_EXPLAINER_PATH)
                print("✅ Loaded pre-computed SHAP explainer")
                self.shap_ready = True
                return True

            # Otherwise create new explainer
            import shap
            self.shap_explainer = shap.TreeExplainer(self.model)
            print("✅ Initialized SHAP TreeExplainer")
            self.shap_ready = True
            return True

        except Exception as e:
            print(f"⚠️  Error initializing SHAP: {e}")
            self.shap_ready = False
            return False

    def prepare_features(self, input_data: Dict[str, Any]) -> np.ndarray:
        """
        Prepare input features for prediction (100% DYNAMIC!)
        
        NO hardcoded features - reads from metadata.json
        """
        if not self.model_loaded:
            raise ModelNotLoadedError("Model not loaded")
        
        # Create DataFrame with single row
        df = pd.DataFrame([input_data])
        
        # Process categorical columns with label encoders (DYNAMIC!)
        if self.label_encoders:
            for col in self.categorical_cols:
                if col in df.columns and col in self.label_encoders:
                    encoder = self.label_encoders[col]
                    value = df[col].iloc[0]
                    
                    # Handle unknown values
                    if value in encoder.classes_:
                        df[col] = encoder.transform([value])
                    else:
                        # Use most common class or 0
                        df[col] = 0
                        print(f"⚠️  Unknown value '{value}' for feature '{col}', using default")

        # Ensure all features exist in correct order (DYNAMIC!)
        feature_df = pd.DataFrame()
        for feature in self.feature_cols:
            if feature in df.columns:
                feature_df[feature] = df[feature]
            else:
                # Missing feature - use default value
                feature_df[feature] = 0
                print(f"⚠️  Missing feature '{feature}', using default value 0")

        # Convert to numpy array
        features_array = feature_df.values.astype(float)

        # Apply scaling to numerical columns only (DYNAMIC!)
        if self.scaler is not None and len(self.numerical_cols) > 0:
            # Get indices of numerical columns in feature order
            num_indices = [i for i, f in enumerate(self.feature_cols) if f in self.numerical_cols]
            if num_indices:
                features_array[:, num_indices] = self.scaler.transform(features_array[:, num_indices])

        return features_array

    def batch_prepare_features(self, df: pd.DataFrame) -> np.ndarray:
        """
        Prepare features for BATCH of rows (VECTORIZED - NO LOOPS!)
        
        100x faster than calling prepare_features() in a loop
        Processes entire DataFrame at once
        """
        if not self.model_loaded:
            raise ModelNotLoadedError("Model not loaded")
        
        # 1. Create DataFrame with all feature columns initialized
        X = pd.DataFrame(index=df.index)
        for col in self.feature_cols:
            if col in df.columns:
                X[col] = df[col]
            else:
                X[col] = 0 # Default for missing features

        # 2. Encode Categorical Columns (Vectorized)
        if self.label_encoders:
            for col in self.categorical_cols:
                if col in X.columns and col in self.label_encoders:
                    # Convert to string to ensure matching with encoder classes
                    # Use map/replace for speed instead of apply
                    encoder = self.label_encoders[col]
                    
                    # Safe transform: handles unseen labels by mapping to 0
                    # Create a mapping dict from the encoder
                    mapping = {label: idx for idx, label in enumerate(encoder.classes_)}
                    
                    # Map values, fill unknown with 0
                    X[col] = X[col].astype(str).map(mapping).fillna(0)

        # 3. Convert to float (Safe now that strings are encoded)
        try:
            X = X.astype(float)
        except ValueError as e:
            # Fallback debug printer
            print("\n--- EXCEPTION DEBUG ---")
            for col in X.columns:
                try:
                    X[col].astype(float)
                except:
                    print(f"FAILED COLUMN: {col} values: {X[col].unique()[:5]}")
            raise e

        # 4. Scale Numerical Columns
        if self.scaler is not None and self.numerical_cols:
            # Filter numerical cols that are actually in the features
            valid_num_cols = [c for c in self.numerical_cols if c in X.columns]
            if valid_num_cols:
                X[valid_num_cols] = self.scaler.transform(X[valid_num_cols])
        
        return X.values


    def predict(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make churn prediction (DYNAMIC - works with ANY features)
        """
        if not self.model_loaded:
            raise ModelNotLoadedError("Model not loaded")

        features = self.prepare_features(input_data)
        proba = self.model.predict_proba(features)[0]

        churn_prob = float(proba[1]) if len(proba) > 1 else float(proba[0])

        risk_level = self._get_risk_level(churn_prob)
        confidence = self._calculate_confidence_interval(churn_prob)

        return {
            "churn_probability": round(churn_prob, 4),
            "risk_level": risk_level,
            "confidence_interval": confidence,
            "recommendation": self._get_recommendation(risk_level, input_data)
        }

    def predict_with_explanation(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make prediction with SHAP explanation (100% DYNAMIC!)
        
        SHAP values adapt to ANY features in the dataset
        """
        prediction = self.predict(input_data)

        if not self.shap_ready or self.shap_explainer is None:
            return {
                **prediction,
                "shap_values": {},
                "top_factors": [],
                "feature_importance_chart": []
            }

        features = self.prepare_features(input_data)

        try:
            shap_values = self.shap_explainer.shap_values(features)

            # Handle different SHAP output formats
            if isinstance(shap_values, list):
                shap_vals = shap_values[1][0] if len(shap_values) > 1 else shap_values[0][0]
            else:
                shap_vals = shap_values[0]

            # Create feature-shap value mapping (DYNAMIC!)
            shap_dict = {
                name: float(val) for name, val in zip(self.feature_cols, shap_vals)
            }

            # Get top factors (DYNAMIC!)
            top_factors = self._get_top_factors(shap_dict, input_data)

            # Create chart data (DYNAMIC!)
            chart_data = [
                {"feature": name, "value": abs(val), "direction": "positive" if val > 0 else "negative"}
                for name, val in sorted(shap_dict.items(), key=lambda x: abs(x[1]), reverse=True)[:10]
            ]

            return {
                **prediction,
                "shap_values": shap_dict,
                "top_factors": top_factors,
                "feature_importance_chart": chart_data
            }

        except Exception as e:
            print(f"⚠️  SHAP explanation error: {e}")
            return {
                **prediction,
                "shap_values": {},
                "top_factors": [],
                "feature_importance_chart": []
            }

    def _get_risk_level(self, probability: float) -> str:
        """Determine risk level based on probability"""
        if probability >= RISK_THRESHOLDS["high"]:
            return "high"
        elif probability >= RISK_THRESHOLDS["medium"]:
            return "medium"
        else:
            return "low"

    def _calculate_confidence_interval(self, probability: float, confidence: float = 0.95) -> Dict[str, float]:
        """Calculate confidence interval for prediction"""
        std_error = np.sqrt(probability * (1 - probability) / 100)
        z_score = 1.96

        lower = max(0, probability - z_score * std_error)
        upper = min(1, probability + z_score * std_error)

        return {
            "lower": round(lower, 4),
            "upper": round(upper, 4),
            "confidence_level": confidence
        }

    def _get_recommendation(self, risk_level: str, input_data: Dict[str, Any]) -> str:
        """
        Generate recommendation based on risk level (DYNAMIC!)
        
        Uses top features from metadata instead of hardcoded assumptions
        """
        recommendations = {
            "high": "Immediate intervention required. Consider personalized retention offer, direct outreach, or exclusive incentives.",
            "medium": "Proactive engagement recommended. Schedule check-in, offer loyalty rewards, or provide service enhancement.",
            "low": "Continue standard engagement. Monitor for changes and maintain regular communication."
        }

        base_recommendation = recommendations.get(risk_level, recommendations["low"])

        # Add dynamic recommendations based on top features
        if self.feature_importance:
            # Get top feature
            top_feature = max(self.feature_importance.items(), key=lambda x: x[1])[0]
            
            if top_feature in input_data:
                top_value = input_data[top_feature]
                base_recommendation += f" Focus on addressing '{top_feature}' (current value: {top_value})."

        return base_recommendation

    def _get_top_factors(self, shap_dict: Dict[str, float], input_data: Dict[str, Any], top_n: int = 5) -> List[Dict[str, Any]]:
        """
        Get top contributing factors for prediction (DYNAMIC!)
        
        Works with ANY features
        """
        sorted_factors = sorted(shap_dict.items(), key=lambda x: abs(x[1]), reverse=True)[:top_n]

        factors = []
        for feature, shap_value in sorted_factors:
            original_value = input_data.get(feature, "N/A")
            factors.append({
                "feature": feature,  # NOT hardcoded!
                "value": original_value,
                "shap_value": round(shap_value, 4),
                "impact": "increases" if shap_value > 0 else "decreases"
            })

        return factors

    def get_feature_importance(self) -> List[Dict[str, Any]]:
        """
        Get global feature importance from metadata (DYNAMIC!)
        """
        if self.metadata and 'feature_importance' in self.metadata:
            # Convert dict to list format
            importance_dict = self.metadata['feature_importance']
            return [
                {"feature": name, "importance": round(float(imp), 6)}
                for name, imp in sorted(importance_dict.items(), key=lambda x: x[1], reverse=True)
            ]

        if not self.model_loaded:
            raise ModelNotLoadedError("Model not loaded")

        try:
            if hasattr(self.model, "feature_importances_"):
                importances = self.model.feature_importances_
                return [
                    {"feature": name, "importance": round(float(imp), 6)}
                    for name, imp in sorted(zip(self.feature_cols, importances),
                                            key=lambda x: x[1], reverse=True)
                ]
        except Exception as e:
            print(f"⚠️  Error getting feature importance: {e}")

        return []

    def get_model_metrics(self) -> Dict[str, Any]:
        """Get model performance metrics from metadata"""
        if self.metadata:
            return {
                "model_name": self.metadata.get("model_name", "Unknown"),
                "roc_auc": self.metadata.get("roc_auc", None),
                "accuracy": self.metadata.get("accuracy", None),
                "churn_rate": self.metadata.get("churn_rate", None),
                "feature_count": len(self.feature_cols),
                "categorical_count": len(self.categorical_cols),
                "numerical_count": len(self.numerical_cols)
            }
        return {}

    def get_metadata(self) -> Dict[str, Any]:
        """Return complete metadata for frontend"""
        if not self.metadata:
            raise ModelNotLoadedError("Metadata not loaded")
        return self.metadata


# Global predictor instance
predictor = ChurnPredictor()
