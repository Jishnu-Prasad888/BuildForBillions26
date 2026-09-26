import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.security import create_access_token, hash_password, verify_password
from app.config import settings
from app.database import get_db
from app.models import User
from app.models.common import utcnow
from app.schemas.common import ForgotIn, ProfileIn, ResetIn, SignInIn, SignUpIn, TokenOut, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])
users_router = APIRouter(prefix="/api/users", tags=["users"])


def _token(user: User) -> TokenOut:
    return TokenOut(access_token=create_access_token(user.id, user.role), user=UserOut.model_validate(user))


@router.post("/signup", response_model=TokenOut, status_code=201)
def signup(body: SignUpIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalars(select(User).where(User.email == email)).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(email=email, full_name=body.full_name.strip(), password_hash=hash_password(body.password), role="USER",
                preferred_language=body.preferred_language, profile={}, last_login_at=utcnow())
    db.add(user)
    db.commit()
    return _token(user)


@router.post("/signin", response_model=TokenOut)
def signin(body: SignInIn, db: Session = Depends(get_db)):
    user = db.scalars(select(User).where(User.email == body.email.lower())).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been disabled. Contact the administrator.")
    user.last_login_at = utcnow()
    db.commit()
    return _token(user)


@router.post("/logout")
def logout():
    # JWTs are stateless; the client discards the token.
    return {"ok": True}


@router.post("/forgot-password")
def forgot_password(body: ForgotIn, db: Session = Depends(get_db)):
    user = db.scalars(select(User).where(User.email == body.email.lower())).first()
    msg = "If an account exists for this email, a reset link has been sent."
    if not user:
        return {"message": msg}
    user.reset_token = secrets.token_urlsafe(24)
    user.reset_token_expires = utcnow() + timedelta(minutes=30)
    db.commit()
    out = {"message": msg}
    if settings.DEMO_MODE:
        # No email service in the prototype: surface the token so the flow can be demonstrated.
        out["demo_reset_token"] = user.reset_token
    return out


@router.post("/reset-password")
def reset_password(body: ResetIn, db: Session = Depends(get_db)):
    user = db.scalars(select(User).where(User.reset_token == body.token)).first()
    if not user or not user.reset_token_expires or user.reset_token_expires < utcnow():
        raise HTTPException(400, "Reset link is invalid or has expired")
    user.password_hash = hash_password(body.password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    return {"message": "Password updated. You can sign in now."}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@users_router.patch("/me", response_model=UserOut)
def update_me(body: ProfileIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.full_name:
        user.full_name = body.full_name.strip()
    if body.preferred_language:
        user.preferred_language = body.preferred_language
    if body.profile is not None:
        allowed = {"phone", "state", "district", "taluk", "village", "occupation", "land_acres",
                   "father_name", "dob", "nationality", "address", "pincode", "country", "email"}  # never PAN/Aadhaar: those are typed on the form
        user.profile = {**(user.profile or {}), **{k: v for k, v in body.profile.items() if k in allowed}}
    db.commit()
    return user
