from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from database import get_db
import models
import os

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY env var is not set")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="auth/token", auto_error=False)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

    return user

async def get_current_user_and_session(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        token_version: int = payload.get("v", 1)
        session_id: str = payload.get("sid")
        
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # Check token version (global revoke)
    if user.token_version != token_version:
        raise credentials_exception

    # Check specific session (granular revoke)
    if session_id:
        session = db.query(models.UserSession).filter(models.UserSession.id == session_id).first()
        if not session or not session.is_active:
            raise credentials_exception
            
        if session.expires_at and session.expires_at < datetime.utcnow():
            raise credentials_exception
        
        # Update last_used_at
        session.last_used_at = datetime.utcnow()
        db.commit()
        return user, session
        
    return user, None

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user, _ = await get_current_user_and_session(token, db)
    return user

async def get_optional_current_user(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db)
) -> Optional[models.User]:
    if not token:
        # Check guest access setting
        setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "allow_guest_access").first()
        if setting and setting.value == "true":
            return None
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    
    return await get_current_user(token, db)

    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    return current_user

def has_permission(permission: str):
    def permission_checker(current_user: models.User = Depends(get_current_user)):
        # 1. Admin always has access
        if current_user.role == models.UserRole.admin:
            return current_user
        
        # 2. Check Role permissions
        if current_user.role_rel and current_user.role_rel.permissions:
            if permission in current_user.role_rel.permissions:
                return current_user
                
        raise HTTPException(status_code=403, detail=f"Missing permission: {permission}")
    return permission_checker

get_current_active_user = get_current_user

async def get_current_user_with_api_key(
    request: Request,
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme_optional)
):
    # 1. Try API Key from Header
    api_key = request.headers.get("X-API-Key")
    if api_key:
        user = db.query(models.User).filter(models.User.api_key == api_key).first()
        if user:
            if not user.is_active:
                raise HTTPException(status_code=400, detail="Inactive user")
            return user
        else:
             # If API key is provided but invalid, fail immediately? 
             # Or fall back to other methods? 
             # Requirement says: "Username, Password UND ein API Key notwendig" for the specific endpoint.
             # But this dependency might be used generally? 
             # For the specific endpoint, we will enforce both.
             # But for now, let's just return the user if API key matches.
             pass

    # 2. Try Bearer Token (Standard)
    if token:
        try:
            user = await get_current_user(token, db)
            return user
        except HTTPException:
            pass
            
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

from fastapi.security import HTTPBasic, HTTPBasicCredentials

security = HTTPBasic()

from fastapi import Header

def get_user_for_automation(
    credentials: HTTPBasicCredentials = Depends(security),
    api_key: str = Header(..., alias="X-API-Key"),
    db: Session = Depends(get_db)
):
    # 1. Verify Basic Auth
    user = db.query(models.User).filter(models.User.username == credentials.username).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    
    # 2. Verify API Key
    # We expect the DB to store the SHA256 hash of the key
    if not api_key:
         raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API Key",
        )
    
    # Hash the incoming key to compare with stored hash
    import hashlib
    incoming_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    
    # Constant time comparison to prevent timing attacks (though hash comparison is less sensitive than password)
    import secrets
    if not user.api_key or not secrets.compare_digest(user.api_key, incoming_key_hash):
         raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key",
        )
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    return user

def get_api_key_hash(api_key: str) -> str:
    import hashlib
    return hashlib.sha256(api_key.encode()).hexdigest()
