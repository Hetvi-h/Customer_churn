"""
Seed script to populate database with sample customer data
Run: python seed_data.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import random
from datetime import datetime, timedelta
from app.database import SessionLocal, init_db
from app.models import Customer

# Sample data generators
FIRST_NAMES = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
               "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
               "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Lisa", "Daniel", "Nancy"]

LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
              "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
              "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White"]

CONTRACT_TYPES = ["month-to-month", "one_year", "two_year"]
PAYMENT_METHODS = ["credit_card", "bank_transfer", "electronic_check", "mailed_check"]
INTERNET_SERVICES = ["dsl", "fiber_optic", "no"]
GENDERS = ["male", "female"]


def generate_customer(index: int) -> Customer:
    """Generate a random customer"""
    first_name = random.choice(FIRST_NAMES)
    last_name = random.choice(LAST_NAMES)

    tenure = random.randint(1, 72)
    contract_type = random.choice(CONTRACT_TYPES)

    # Base monthly charge with variation
    base_charge = random.uniform(20, 120)
    monthly_charges = round(base_charge, 2)
    total_charges = round(monthly_charges * tenure * random.uniform(0.9, 1.1), 2)

    # Contract value based on contract type
    if contract_type == "two_year":
        contract_value = monthly_charges * 24
    elif contract_type == "one_year":
        contract_value = monthly_charges * 12
    else:
        contract_value = monthly_charges

    # Support tickets (more for shorter tenure, inversely related to satisfaction)
    num_support_tickets = max(0, random.randint(0, 10) - tenure // 12)

    # Days since last interaction
    days_since_last_interaction = random.randint(0, 90)

    # Payment delay
    payment_delay_days = random.choices(
        [0, random.randint(1, 5), random.randint(6, 15), random.randint(16, 30)],
        weights=[0.6, 0.2, 0.15, 0.05]
    )[0]

    # Churn probability influenced by various factors
    base_prob = 0.2

    # Short tenure increases churn risk
    if tenure < 6:
        base_prob += 0.2
    elif tenure < 12:
        base_prob += 0.1
    elif tenure > 36:
        base_prob -= 0.1

    # Month-to-month contracts have higher churn
    if contract_type == "month-to-month":
        base_prob += 0.15
    elif contract_type == "two_year":
        base_prob -= 0.15

    # High support tickets increase churn
    base_prob += num_support_tickets * 0.03

    # Payment delays increase churn
    base_prob += payment_delay_days * 0.01

    # Clamp probability
    churn_probability = max(0.05, min(0.95, base_prob + random.uniform(-0.1, 0.1)))

    # Risk level
    if churn_probability >= 0.7:
        risk_level = "high"
    elif churn_probability >= 0.4:
        risk_level = "medium"
    else:
        risk_level = "low"

    # Some customers have already churned
    is_churned = random.random() < 0.1
    churned_at = datetime.utcnow() - timedelta(days=random.randint(1, 30)) if is_churned else None

    return Customer(
        customer_id=f"CUST-{index:05d}",
        name=f"{first_name} {last_name}",
        email=f"{first_name.lower()}.{last_name.lower()}{index}@email.com",
        phone=f"+1-555-{random.randint(100, 999)}-{random.randint(1000, 9999)}",
        gender=random.choice(GENDERS),
        senior_citizen=random.random() < 0.15,
        partner=random.random() < 0.5,
        dependents=random.random() < 0.3,
        tenure=tenure,
        contract_type=contract_type,
        payment_method=random.choice(PAYMENT_METHODS),
        internet_service=random.choice(INTERNET_SERVICES),
        num_products=random.randint(1, 5),
        monthly_charges=monthly_charges,
        total_charges=total_charges,
        contract_value=round(contract_value, 2),
        payment_delay_days=payment_delay_days,
        num_support_tickets=num_support_tickets,
        days_since_last_interaction=days_since_last_interaction,
        churn_probability=round(churn_probability, 4),
        churn_risk_level=risk_level,
        last_prediction_date=datetime.utcnow() - timedelta(days=random.randint(0, 7)),
        is_churned=is_churned,
        churned_at=churned_at,
        created_at=datetime.utcnow() - timedelta(days=tenure * 30 + random.randint(0, 30)),
        updated_at=datetime.utcnow() - timedelta(days=random.randint(0, 7))
    )


def seed_database(num_customers: int = 500):
    """Seed database with sample customers"""
    print(f"Initializing database...")
    init_db()

    db = SessionLocal()

    try:
        # Check if data already exists
        existing = db.query(Customer).count()
        if existing > 0:
            print(f"Database already contains {existing} customers. Skipping seed.")
            return

        print(f"Generating {num_customers} sample customers...")
        customers = [generate_customer(i) for i in range(1, num_customers + 1)]

        print("Inserting customers into database...")
        db.bulk_save_objects(customers)
        db.commit()

        print(f"Successfully seeded {num_customers} customers!")

        # Print summary
        high_risk = sum(1 for c in customers if c.churn_risk_level == "high")
        medium_risk = sum(1 for c in customers if c.churn_risk_level == "medium")
        low_risk = sum(1 for c in customers if c.churn_risk_level == "low")
        churned = sum(1 for c in customers if c.is_churned)

        print(f"\nSummary:")
        print(f"  High Risk: {high_risk}")
        print(f"  Medium Risk: {medium_risk}")
        print(f"  Low Risk: {low_risk}")
        print(f"  Already Churned: {churned}")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    num = int(sys.argv[1]) if len(sys.argv) > 1 else 500
    seed_database(num)
