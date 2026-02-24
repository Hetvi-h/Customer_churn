from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    from . import models
    Base.metadata.create_all(bind=engine)
    _migrate_db()


def _migrate_db():
    """Add any new columns to existing SQLite tables (idempotent)."""
    new_columns = [
        ("features_json",    "TEXT"),
        ("shap_values_json", "TEXT"),
        ("top_risk_factor",  "VARCHAR(100)"),
    ]
    with engine.connect() as conn:
        # Get existing column names via PRAGMA
        result = conn.execute(__import__('sqlalchemy').text("PRAGMA table_info(customers)"))
        existing = {row[1] for row in result}
        for col_name, col_type in new_columns:
            if col_name not in existing:
                conn.execute(
                    __import__('sqlalchemy').text(
                        f"ALTER TABLE customers ADD COLUMN {col_name} {col_type}"
                    )
                )
                print(f"[Migration] Added column customers.{col_name}")
        conn.commit()

