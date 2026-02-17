from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .config import API_TITLE, API_VERSION, API_DESCRIPTION
from .database import init_db
from .ml_service import predictor
from .schemas import HealthResponse

from .routers import customers, predictions, dashboard, segments, trends, model, metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    print("Starting Customer Churn Prediction API...")

    # Initialize database
    init_db()
    print("Database initialized")

    # Load ML models
    model_loaded = predictor.load_models()
    if model_loaded:
        print("ML model loaded successfully")
        # Initialize SHAP explainer
        shap_ready = predictor.initialize_shap()
        if shap_ready:
            print("SHAP explainer initialized")
        else:
            print("SHAP explainer not available - predictions will work without explanations")
    else:
        print("WARNING: ML model not loaded - prediction endpoints will return 503")

    yield

    # Shutdown
    print("Shutting down Customer Churn Prediction API...")


# Create FastAPI app
app = FastAPI(
    title=API_TITLE,
    version=API_VERSION,
    description=API_DESCRIPTION,
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(customers.router, prefix="/api")
app.include_router(predictions.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(segments.router, prefix="/api")
app.include_router(trends.router, prefix="/api")
app.include_router(model.router, prefix="/api")
app.include_router(metadata.router)  # Already has /api/metadata prefix


@app.get("/", tags=["Root"])
async def root():
    """API root endpoint"""
    return {
        "name": API_TITLE,
        "version": API_VERSION,
        "status": "running",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        model_loaded=predictor.model_loaded,
        shap_explainer_ready=predictor.shap_ready,
        database_connected=True,
        version=API_VERSION
    )


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def api_health_check():
    """API health check endpoint"""
    return HealthResponse(
        status="healthy",
        model_loaded=predictor.model_loaded,
        shap_explainer_ready=predictor.shap_ready,
        database_connected=True,
        version=API_VERSION
    )
