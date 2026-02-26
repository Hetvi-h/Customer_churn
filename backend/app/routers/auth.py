"""
Auth router — Google OAuth + Email OTP + JWT
"""
import os, random, string, smtplib, threading
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from ..database import get_db
from ..models import User, OTPCode

# ─── Config ──────────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
JWT_SECRET           = os.getenv("JWT_SECRET_KEY", "fallback_secret_change_me")
JWT_ALGORITHM        = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES   = int(os.getenv("JWT_EXPIRE_MINUTES", "10080"))  # 7 days
SMTP_HOST            = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT            = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER            = os.getenv("SMTP_USER")
SMTP_PASSWORD        = os.getenv("SMTP_PASSWORD")
SMTP_FROM            = os.getenv("SMTP_FROM")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter(prefix="/api/auth", tags=["Auth"])


# ─── Schemas ─────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class GoogleTokenRequest(BaseModel):
    credential: str  # Google ID token from frontend

class OTPVerifyRequest(BaseModel):
    email: str
    code: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ─── Helpers ─────────────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_jwt(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))

def send_otp_email(to_email: str, otp_code: str, user_name: str = ""):
    """Send OTP email via Gmail SMTP — called in background thread"""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "🔐 Your Attrinex Login Code"
        msg["From"]    = SMTP_FROM
        msg["To"]      = to_email

        html = f"""
        <html><body style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:40px">
          <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:16px;padding:40px;border:1px solid #334155">
            <h1 style="color:#818cf8;margin:0 0 8px">Attrinex</h1>
            <p style="color:#94a3b8;margin:0 0 32px;font-size:14px">Customer Intelligence Platform</p>
            <h2 style="color:#f1f5f9;margin:0 0 8px">Your verification code</h2>
            <p style="color:#94a3b8;margin:0 0 24px">Hi {user_name or to_email}, enter this code to sign in:</p>
            <div style="background:#0f172a;border-radius:12px;padding:24px;text-align:center;letter-spacing:12px;font-size:36px;font-weight:bold;color:#818cf8;margin:0 0 24px">
              {otp_code}
            </div>
            <p style="color:#64748b;font-size:13px;margin:0">This code expires in <strong style="color:#94a3b8">10 minutes</strong>. Do not share it with anyone.</p>
          </div>
        </body></html>
        """
        msg.attach(MIMEText(html, "html"))

        # 10-second timeout prevents hanging forever
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, to_email, msg.as_string())
        print(f"[EMAIL] OTP sent to {to_email}")
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")
        return False

def send_otp_in_background(to_email: str, otp_code: str, user_name: str = ""):
    """Fire-and-forget: send OTP in a daemon thread so HTTP response is not blocked"""
    t = threading.Thread(
        target=send_otp_email,
        args=(to_email, otp_code, user_name),
        daemon=True
    )
    t.start()

def save_otp(db: Session, user_id: int, code: str):
    """Invalidate old OTPs and save new one"""
    db.query(OTPCode).filter(
        OTPCode.user_id == user_id, OTPCode.used == False
    ).update({"used": True})
    db.add(OTPCode(
        user_id=user_id,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=10)
    ))
    db.commit()


# ─── Routes ──────────────────────────────────────────────────────────────────
@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """Register with email + password → sends OTP"""
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(400, "Email already registered. Please log in.")

    user = User(
        name=req.name,
        email=req.email,
        password_hash=hash_password(req.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    otp = generate_otp()
    save_otp(db, user.id, otp)
    print(f"[DEV] Register OTP for {user.email}: {otp}")  # always visible in terminal
    send_otp_in_background(user.email, otp, user.name)

    return {"message": "Account created! Check your email for the verification code.", "email": user.email}


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Login with email + password → sends OTP"""
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not user.password_hash:
        raise HTTPException(401, "Invalid email or password.")
    if not verify_password(req.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password.")

    otp = generate_otp()
    save_otp(db, user.id, otp)
    print(f"[DEV] Login OTP for {user.email}: {otp}")  # always visible in terminal
    send_otp_in_background(user.email, otp, user.name)

    return {"message": "Verification code sent to your email.", "email": user.email}


@router.post("/google")
async def google_auth(req: GoogleTokenRequest, db: Session = Depends(get_db)):
    """Verify Google ID token → create/find user → send OTP"""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={req.credential}"
            )
            if r.status_code != 200:
                raise HTTPException(401, "Invalid Google token.")
            info = r.json()

        if info.get("aud") != GOOGLE_CLIENT_ID:
            raise HTTPException(401, "Token audience mismatch.")

        email     = info.get("email")
        name      = info.get("name", email)
        google_id = info.get("sub")

        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(email=email, name=name, google_id=google_id)
            db.add(user)
            db.commit()
            db.refresh(user)
        elif not user.google_id:
            user.google_id = google_id
            db.commit()

        otp = generate_otp()
        save_otp(db, user.id, otp)
        print(f"[DEV] Google OTP for {user.email}: {otp}")  # always visible in terminal
        send_otp_in_background(user.email, otp, user.name)

        return {"message": "Verification code sent to your email.", "email": user.email}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Google auth failed: {str(e)}")


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(req: OTPVerifyRequest, db: Session = Depends(get_db)):
    """Verify 6-digit OTP → return JWT"""
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        raise HTTPException(404, "User not found.")

    otp_record = db.query(OTPCode).filter(
        OTPCode.user_id == user.id,
        OTPCode.code == req.code,
        OTPCode.used == False,
        OTPCode.expires_at > datetime.utcnow()
    ).first()

    if not otp_record:
        raise HTTPException(400, "Invalid or expired code. Please request a new one.")

    otp_record.used = True
    db.commit()

    token = create_jwt({"sub": str(user.id), "email": user.email})
    return TokenResponse(
        access_token=token,
        user={"id": user.id, "email": user.email, "name": user.name, "google_id": user.google_id}
    )


class ResendRequest(BaseModel):
    email: str

@router.post("/resend-otp")
def resend_otp(req: ResendRequest, db: Session = Depends(get_db)):
    """Resend a fresh OTP to the user's email"""
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        # Return 200 anyway to avoid email enumeration
        return {"message": "If that email exists, a code was sent."}
    otp = generate_otp()
    save_otp(db, user.id, otp)
    print(f"[DEV] Resend OTP for {user.email}: {otp}")  # always visible in terminal
    send_otp_in_background(user.email, otp, user.name)
    return {"message": "Verification code resent."}


@router.get("/me")
def get_me(db: Session = Depends(get_db)):
    """Placeholder — use Authorization: Bearer header for protected routes"""
    raise HTTPException(401, "Provide Authorization: Bearer <token> header")
