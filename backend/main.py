from fastapi import FastAPI, Depends, HTTPException, status, Request, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import text, func, desc, or_, cast, String
from typing import List, Optional, Dict, Any
import models
import schemas
from database import engine, get_db, SessionLocal
from ai_parser import parse_recipe_from_text
from scraper import scrape_url
from datetime import datetime, timedelta
from auth import get_password_hash, verify_password, create_access_token, get_current_user, get_current_active_user, has_permission, get_optional_current_user, get_user_for_automation
import auth
import auth
import os
import shutil
import uuid
import secrets
from email_utils import send_mail, send_verification_email
from email_templates import get_email_template
from logger import logger

def get_gemini_api_key(db: Session) -> Optional[str]:
    setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "gemini_api_key").first()
    if not setting or not setting.value:
        return None
    
    # Sanitize key
    key = setting.value.strip()
    # Remove quotes if accidentally added
    if (key.startswith('"') and key.endswith('"')) or (key.startswith("'") and key.endswith("'")):
        key = key[1:-1]
    return key

# Create tables
models.Base.metadata.create_all(bind=engine)

# Migration: Add language column if missing
try:
    with engine.connect() as conn:
        # Check if column exists (Postgres specific, but try/except works for simple add)
        # For SQLite/Postgres, attempting to add it will fail if it exists.
        # We wrap in try/except to ignore "duplicate column" error.
        conn.execute(text("ALTER TABLE users ADD COLUMN language VARCHAR DEFAULT 'en'"))
        conn.commit()
except Exception as e:
    # logger.info(f"Migration note: {e}")
    pass

# Seed Roles
def seed_roles():
    db = next(get_db())
    roles = [
        {"name": "Admin", "permissions": ["read:recipes", "write:recipes", "delete:recipes", "manage:users", "manage:roles", "manage:system", "manage:units", "manage:ingredients"]},
        {"name": "Editor", "permissions": ["read:recipes", "write:recipes", "delete:recipes"]},
        {"name": "User", "permissions": ["read:recipes", "write:recipes"]},
        {"name": "Viewer", "permissions": ["read:recipes"]}
    ]
    for r in roles:
        existing = db.query(models.Role).filter(models.Role.name == r["name"]).first()
        if not existing:
            new_role = models.Role(name=r["name"], permissions=r["permissions"])
            db.add(new_role)
        else:
            # Update existing admin role to include new permissions if missing
            if r["name"] == "Admin":
                current_perms = set(existing.permissions)
                new_perms = set(r["permissions"])
                if not new_perms.issubset(current_perms):
                    existing.permissions = list(current_perms.union(new_perms))
                    db.add(existing)
    db.commit()

    db.commit()

seed_roles()

from seed_data import seed_data
seed_data()



app = FastAPI(title="Bake Assist API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trust X-Forwarded-Proto headers from Nginx
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

# Security Headers Middleware
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Ensure static directory exists
os.makedirs("static/uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.on_event("startup")
def startup_event():
    # Load System Settings
    try:
        db = SessionLocal()
        # Debug Mode
        debug_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "debug_mode").first()
        if debug_setting and debug_setting.value.lower() == "true":
            from logger import set_log_level
            set_log_level(True)
            from logger import logger
            logger.info("Debug Mode enabled via System Settings")
        db.close()
    except Exception as e:
        print(f"Startup error: {e}")

@app.get("/")
def read_root():
    return {"message": "Backend is running!"}

@app.post("/upload")
async def upload_file(request: Request, file: UploadFile = File(...), current_user: models.User = Depends(get_current_user)):
    file_extension = os.path.splitext(file.filename)[1]
    file_name = f"{uuid.uuid4()}{file_extension}"
    file_path = f"static/uploads/{file_name}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Return full URL
    base_url = str(request.base_url).rstrip("/")
    return {"url": f"{base_url}/static/uploads/{file_name}"}

# --- System Initialization ---

@app.get("/system/init-status")
def get_init_status(db: Session = Depends(get_db)):
    user_count = db.query(models.User).count()
    return {"initialized": user_count > 0}

@app.post("/system/init")
def initialize_system(init_data: schemas.SystemInit, db: Session = Depends(get_db)):
    # Verify no users exist
    if db.query(models.User).count() > 0:
        raise HTTPException(status_code=400, detail="System already initialized")
    
    # 1. Create Admin User
    # Ensure Admin role exists
    admin_role = db.query(models.Role).filter(models.Role.name == "Admin").first()
    if not admin_role:
        # Should have been seeded, but just in case
        seed_roles()
        admin_role = db.query(models.Role).filter(models.Role.name == "Admin").first()
        
    hashed_password = get_password_hash(init_data.admin_password)
    new_admin = models.User(
        username=init_data.admin_username,
        email=init_data.admin_email,
        hashed_password=hashed_password,
        role=models.UserRole.admin,
        role_id=admin_role.id,
        is_active=True,
        is_verified=True # Admin is verified by default
    )
    db.add(new_admin)
    
    # Get app name and language
    app_name_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "app_name").first()
    app_name = app_name_setting.value if app_name_setting else "Bake'n'Cook"
    
    # Determine language (default to en, or use user's language if available)
    # Note: current_user is not available here in system init, so default to 'en'
    language = "en" 
    
    from email_templates import get_test_email_template
    html_content = get_test_email_template(app_name, language)
    
    # Extract subject from template (a bit hacky, but keeps it self-contained)
    # Or better, just define subject here based on language
    subjects = {
        "en": f"Test Email from {app_name}",
        "de": f"Test-E-Mail von {app_name}"
    }
    subject = subjects.get(language, subjects["en"])

    # This part of the code seems to be misplaced or intended for a different endpoint.
    # The `request` object is not available here, and `test_recipient` is not part of `init_data`.
    # Assuming this block was meant to be illustrative of how `get_test_email_template` would be used
    # in a *separate* endpoint for sending test emails, and not directly within system initialization.
    # For now, I will comment it out to maintain syntactical correctness and avoid errors.
    # If the intention was to send a test email *during* initialization, `init_data` would need
    # to include `test_recipient` and `smtp_config` details, and `email_utils.send_email` would need to be imported.

    # success = email_utils.send_email(
    #     to_email=request.test_recipient,
    #     subject=subject,
    #     body=html_content, # Send HTML content
    #     smtp_config={
    #         "smtp_server": request.smtp_server,
    #         "smtp_port": request.smtp_port,
    #         "smtp_user": request.smtp_user,
    #         "smtp_password": request.smtp_password,
    #         "sender_email": request.sender_email
    #     },
    #     is_html=True
    # )
    
    # 2. Save Settings
    settings_to_save = {
        "app_name": init_data.app_name,
        "gemini_api_key": init_data.gemini_api_key,
        "smtp_host": init_data.smtp_server,
        "smtp_port": str(init_data.smtp_port) if init_data.smtp_port else None,
        "smtp_user": init_data.smtp_user,
        "smtp_password": init_data.smtp_password,
        "smtp_from_email": init_data.sender_email,
        "favicon_url": init_data.favicon_base64,
        "enable_registration": str(init_data.enable_registration).lower(),
        "enable_email_verification": str(init_data.enable_email_verification).lower(),
        "allow_guest_access": str(init_data.allow_guest_access).lower(),
    }
    
    for key, value in settings_to_save.items():
        if value is not None:
            setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == key).first()
            if setting:
                setting.value = value
            else:
                db.add(models.SystemSetting(key=key, value=value))
                
    # Handle Favicon (if provided as base64 or we might handle it separately, 
    # but user asked to configure it. For now, let's assume it's handled via settings or separate upload if complex.
    # If it's base64, we could save it to a file. 
    # For simplicity, let's assume the frontend uploads it separately or we just save the URL if it was an upload.
    # But the prompt said "favicon einstellen". 
    # Let's check if we have a setting for favicon.
    # If init_data.favicon_base64 is present, we can save it to static/favicon.ico or similar.
    if init_data.favicon_base64:
        # Decode and save
        import base64
        try:
            # Remove header if present (data:image/png;base64,...)
            if "," in init_data.favicon_base64:
                header, encoded = init_data.favicon_base64.split(",", 1)
            else:
                encoded = init_data.favicon_base64
            
            data = base64.b64decode(encoded)
            with open("static/favicon.ico", "wb") as f:
                f.write(data)
            # Also update setting
            fav_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "favicon_url").first()
            val = "/static/favicon.ico"
            if fav_setting:
                fav_setting.value = val
            else:
                db.add(models.SystemSetting(key="favicon_url", value=val))
        except Exception as e:
            logger.error(f"Failed to save favicon: {e}")

    db.commit()
    
    # 3. Import Data
    if init_data.import_data:
        from seed_data_extended import seed_data_extended
        seed_data_extended()
        
    return {"message": "System initialized successfully"}

@app.get("/system/version", response_model=schemas.SystemVersion)
def get_system_version():
    from version import VERSION
    return {"version": VERSION}

@app.get("/system/changelog")
def get_system_changelog():
    root_dir = os.getenv("PROJECT_ROOT", os.path.dirname(os.path.dirname(__file__)))
    changelog_path = os.path.join(root_dir, 'CHANGELOG.md')
    if os.path.exists(changelog_path):
        with open(changelog_path, 'r') as f:
            content = f.read()
        return {"changelog": content}
    return {"changelog": "Changelog not found."}

@app.get("/system/check-update")
@app.get("/system/check-update")
def check_for_updates(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_permission("manage:system"))
):
    import subprocess
    import re
    from packaging import version
    
    try:
        # Get Update Channel
        channel_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "update_channel").first()
        channel = channel_setting.value if channel_setting else "stable"
        
        # Fetch tags
        root_dir = os.getenv("PROJECT_ROOT", os.path.dirname(os.path.dirname(__file__)))
        subprocess.run(["git", "fetch", "--tags", "--force"], check=True, cwd=root_dir)
        
        # Get all tags
        tags_output = subprocess.check_output(["git", "tag"], cwd=root_dir).strip().decode('utf-8')
        tags = [t for t in tags_output.split('\n') if t]
        
        # Filter and Sort tags
        valid_versions = []
        for t in tags:
            try:
                # Clean tag (remove 'v' prefix if present)
                clean_tag = t.lstrip('v')
                v = version.parse(clean_tag)
                
                # Filter based on channel
                if channel == "stable":
                    if not v.is_prerelease:
                        valid_versions.append((v, t))
                else:
                    # Beta/All includes prereleases
                    valid_versions.append((v, t))
            except:
                continue
                
        if not valid_versions:
             return {"update_available": False, "current_version": "Unknown", "message": "No versions found"}
             
        # Sort by version (descending)
        valid_versions.sort(key=lambda x: x[0], reverse=True)
        latest_version_obj, latest_tag = valid_versions[0]
        
        # Get current version
        from version import VERSION
        current_v = version.parse(VERSION)
        
        if latest_version_obj > current_v:
             return {
                 "update_available": True, 
                 "current_version": VERSION, 
                 "remote_version": latest_tag,
                 "channel": channel
             }
             
        return {
            "update_available": False, 
            "current_version": VERSION, 
            "remote_version": latest_tag,
            "channel": channel
        }

    except Exception as e:
        logger.error(f"Update check failed: {e}")
        return {"update_available": False, "error": str(e)}

# --- Update Execution ---

# Global state for update process
update_process_state = {
    "status": "idle", # idle, running, completed, failed
    "log": [],
    "pid": None
}

def run_update_script(target_version: str = None):
    global update_process_state
    update_process_state["status"] = "running"
    update_process_state["log"] = []
    
    import subprocess
    import sys
    
    root_dir = os.getenv("PROJECT_ROOT", os.path.dirname(os.path.dirname(__file__)))
    script_path = os.path.join(root_dir, 'scripts', 'update.sh')
    
    cmd = ["bash", script_path]
    if target_version:
        cmd.append(target_version)
        
    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=root_dir
        )
        update_process_state["pid"] = process.pid
        
        for line in process.stdout:
            update_process_state["log"].append(line.strip())
            
        process.wait()
        
        if process.returncode == 0:
            update_process_state["status"] = "completed"
            update_process_state["log"].append("Update finished successfully.")
        else:
            update_process_state["status"] = "failed"
            update_process_state["log"].append(f"Update failed with exit code {process.returncode}")
            
    except Exception as e:
        update_process_state["status"] = "failed"
        update_process_state["log"].append(f"Execution error: {str(e)}")

@app.post("/system/update")
def trigger_update(
    background_tasks: BackgroundTasks,
    update_request: schemas.SystemUpdate = None, # We need to define this schema
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_permission("manage:system"))
):
    global update_process_state
    
    if update_process_state["status"] == "running":
        raise HTTPException(status_code=400, detail="Update already in progress")
        
    target_version = update_request.version if update_request else None
    
    background_tasks.add_task(run_update_script, target_version)
    
    return {"message": "Update started", "status": "running"}

@app.get("/system/update-status")
def get_update_status(
    current_user: models.User = Depends(has_permission("manage:system"))
):
    global update_process_state
    # Return last 50 log lines to avoid huge payload
    return {
        "status": update_process_state["status"],
        "log": update_process_state["log"][-50:]
    }

@app.get("/system/settings")
def get_system_settings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_permission("manage:system"))
):
    # Fetch update channel
    channel_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "update_channel").first()
    channel = channel_setting.value if channel_setting else "stable"
    
    # Fetch debug mode
    debug_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "debug_mode").first()
    debug_mode = debug_setting.value.lower() == "true" if debug_setting else False
    
    return {
        "update_channel": channel,
        "debug_mode": debug_mode
    }


# --- Auth ---

@app.post("/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    if user.email:
        db_email = db.query(models.User).filter(models.User.email == user.email).first()
        if db_email:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    
    # Check if this is the first user
    # is_first_user = db.query(models.User).count() == 0
    role_enum = models.UserRole.user # Default to user
    role_name = "User"
    
    # Legacy: FIRST_USER_ADMIN logic removed as we use Onboarding Wizard now.
    
    # Fetch role_id from roles table
    role_obj = db.query(models.Role).filter(models.Role.name == role_name).first()
    role_id = role_obj.id if role_obj else None

    new_user = models.User(
        username=user.username, 
        hashed_password=hashed_password, 
        role=role_enum, 
        role_id=role_id,
        email=user.email,
        language=user.language or "en"
    )
    
    # Check registration setting
    reg_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "enable_registration").first()
    if reg_setting and reg_setting.value.lower() == "false":
         raise HTTPException(status_code=403, detail="Registration is currently disabled")

    db.add(new_user)
    db.flush() # Generate ID

    # Check email verification setting
    verify_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "enable_email_verification").first()
    require_verification = verify_setting and verify_setting.value.lower() == "true"
    
    if require_verification:
        new_user.is_verified = False
        # Generate 6-digit code
        import random
        token = "".join([str(random.randint(0, 9)) for _ in range(6)])
        # Save token
        ver_token = models.VerificationToken(
            token=token,
            user_id=new_user.id,
            expires_at=datetime.utcnow() + timedelta(hours=24)
        )
        db.add(ver_token)
        
        # Send email
        # Get app name
        app_name_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "app_name").first()
        app_name = app_name_setting.value if app_name_setting else "BakeAssist"
        app_name = app_name.strip()
        
        if user.email:
            tmpl = get_email_template('verification', new_user.language, {'code': token, 'app_name': app_name})
            send_mail(db, user.email, tmpl['subject'], tmpl['body'])
    else:
        new_user.is_verified = True

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/auth/verify-email")
def verify_email(request: schemas.VerifyEmailRequest, db: Session = Depends(get_db)):
    ver_token = db.query(models.VerificationToken).filter(models.VerificationToken.token == request.token).first()
    if not ver_token:
        raise HTTPException(status_code=400, detail="Invalid token")
        
    if ver_token.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token expired")
        
    user = db.query(models.User).filter(models.User.id == ver_token.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_verified = True
    db.delete(ver_token)
    db.commit()
    
    # Generate access token for auto-login
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "v": user.token_version}, expires_delta=access_token_expires
    )
    
    return {"message": "Email verified", "access_token": access_token, "token_type": "bearer"}

@app.post("/auth/resend-verification")
def resend_verification(email: Optional[str] = None, username: Optional[str] = None, db: Session = Depends(get_db)):
    if email:
        user = db.query(models.User).filter(models.User.email == email).first()
    elif username:
        user = db.query(models.User).filter(models.User.username == username).first()
    else:
        raise HTTPException(status_code=400, detail="Email or username required")
        
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.is_verified:
        return {"message": "Already verified"}
        
    # Generate new token
    import random
    token = "".join([str(random.randint(0, 9)) for _ in range(6)])
    ver_token = db.query(models.VerificationToken).filter(models.VerificationToken.user_id == user.id).first()
    if ver_token:
        ver_token.token = token
        ver_token.expires_at = datetime.utcnow() + timedelta(hours=24)
    else:
        ver_token = models.VerificationToken(
            token=token,
            user_id=user.id,
            expires_at=datetime.utcnow() + timedelta(hours=24)
        )
        db.add(ver_token)
    db.commit()
    
    tmpl = get_email_template('verification', user.language, {'code': token})
    send_mail(db, user.email, tmpl['subject'], tmpl['body'])
    return {"message": "Verification email sent"}

@app.post("/token", response_model=schemas.Token)
def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(
        or_(
            models.User.username == form_data.username,
            models.User.email == form_data.username
        )
    ).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="USER_INACTIVE",
        )

    # Check Maintenance Mode
    maint_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "maintenance_mode").first()
    if maint_setting and maint_setting.value.lower() == "true":
        if user.role != models.UserRole.admin:
            raise HTTPException(status_code=503, detail="System is in maintenance mode")

    # Check Verification
    verify_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "enable_email_verification").first()
    if verify_setting and verify_setting.value.lower() == "true":
        if not user.is_verified:
             raise HTTPException(status_code=403, detail="Email not verified")
    
    # Create User Session
    user_agent = request.headers.get('user-agent')
    client_ip = request.client.host if request.client else None
    
    # Calculate expiry based on user settings
    access_token_expires = timedelta(minutes=user.session_duration_minutes)
    expires_at = datetime.utcnow() + access_token_expires
    
    session = models.UserSession(
        user_id=user.id,
        user_agent=user_agent,
        ip_address=client_ip,
        expires_at=expires_at
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    access_token = create_access_token(
        data={
            "sub": user.username, 
            "v": user.token_version,
            "sid": session.id
        }, 
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/refresh", response_model=schemas.Token)
def refresh_token(
    db: Session = Depends(get_db),
    user_and_session: tuple = Depends(auth.get_current_user_and_session)
):
    user, session = user_and_session
    
    # Calculate expiry based on user settings
    access_token_expires = timedelta(minutes=user.session_duration_minutes)
    
    # Update session expiry
    if session:
        session.expires_at = datetime.utcnow() + access_token_expires
        session.last_used_at = datetime.utcnow()
        db.commit()
    
    access_token = create_access_token(
        data={
            "sub": user.username, 
            "v": user.token_version,
            "sid": session.id if session else None
        }, 
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.post("/auth/change-password")
def change_password(
    password_data: schemas.UserChangePassword,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not verify_password(password_data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect old password")
    
    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()
    return {"message": "Password updated successfully"}

@app.post("/auth/revoke-sessions")
def revoke_sessions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Increment token version to invalidate all existing tokens
    current_user.token_version += 1
    # Also mark all sessions as inactive
    db.query(models.UserSession).filter(models.UserSession.user_id == current_user.id).update({"is_active": False})
    db.commit()
    return {"message": "All sessions revoked"}

@app.get("/users/me/sessions", response_model=List[schemas.UserSession])
def read_my_sessions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.UserSession).filter(
        models.UserSession.user_id == current_user.id,
        models.UserSession.is_active == True
    ).order_by(models.UserSession.last_used_at.desc()).all()

@app.delete("/users/me/sessions/{session_id}")
def revoke_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    session = db.query(models.UserSession).filter(
        models.UserSession.id == session_id,
        models.UserSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session.is_active = False
    db.commit()
    return {"message": "Session revoked"}



@app.delete("/users/me")
def delete_my_account(
    request: schemas.DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not verify_password(request.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")

    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted"}

@app.post("/users/me/api-key")
def generate_api_key(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Generate new API Key
    import secrets
    import auth
    
    # Raw key (shown ONCE to user)
    raw_key = secrets.token_urlsafe(32)
    
    # Store Hash
    key_hash = auth.get_api_key_hash(raw_key)
    
    current_user.api_key = key_hash
    db.commit()
    
    # Return RAW key
    return {"api_key": raw_key}

@app.get("/users/me/api-key")
def get_api_key(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # NEVER return the API key (it's hashed anyway)
    # Just return status
    return {"has_api_key": bool(current_user.api_key)}

@app.get("/users/me/export")
def export_my_data(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Export user data, recipes, etc.
    recipes = db.query(models.Recipe).filter(models.Recipe.user_id == current_user.id).all()
    
    export_data = {
        "username": current_user.username,
        "role": current_user.role,
        "recipes": []
    }
    
    for r in recipes:
        recipe_dict = {
            "title": r.title,
            "ingredients": [
                {"name": i.name, "amount": i.amount, "unit": i.unit} for i in r.ingredients
            ],
            "steps": [
                {"description": s.description, "duration": s.duration_min} for s in r.steps
            ]
        }
        export_data["recipes"].append(recipe_dict)
        
    return export_data

# --- Admin Routes ---
from auth import has_permission

@app.get("/admin/users", response_model=List[schemas.User])
def read_all_users(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_permission("manage:users"))
):
    users = db.query(models.User).offset(skip).limit(limit).all()
    return users

@app.delete("/admin/users/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_permission("manage:users"))
):
    user_to_delete = db.query(models.User).filter(models.User.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting yourself
    if user_to_delete.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    db.delete(user_to_delete)
    db.commit()
    return {"message": "User deleted"}

@app.post("/admin/users", response_model=schemas.User)
def create_user_admin(
    user: schemas.UserAdminCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_permission("manage:users"))
):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    
    # Handle role assignment (enum + relation)
    # Default to 'user' enum, but if they selected 'admin' enum (legacy), set it.
    # Also try to find a Role with that name if it exists.
    
    role_enum = models.UserRole.user
    if user.role.lower() == "admin":
        role_enum = models.UserRole.admin
        
    # Find role by name if possible, default to 'User' role if not found or not specified
    role_name_to_find = "Admin" if user.role.lower() == "admin" else "User"
    role_obj = db.query(models.Role).filter(models.Role.name == role_name_to_find).first()
    
    new_user = models.User(
        username=user.username, 
        hashed_password=hashed_password, 
        role=role_enum,
        is_active=user.is_active,
        is_verified=user.is_verified,
        email=user.email,
        role_id=role_obj.id if role_obj else None
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.put("/admin/users/{user_id}", response_model=schemas.User)
def update_user_admin(
    user_id: str,
    user_update: schemas.UserAdminUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_permission("manage:users"))
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user_update.username:
        # Check uniqueness
        existing = db.query(models.User).filter(models.User.username == user_update.username).first()
        if existing and existing.id != user_id:
             raise HTTPException(status_code=400, detail="Username already taken")
        user.username = user_update.username
        
    if user_update.password:
        user.hashed_password = get_password_hash(user_update.password)
        
    if user_update.is_active is not None:
        # Prevent deactivating yourself
        if user.id == current_user.id and user_update.is_active is False:
             raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
        user.is_active = user_update.is_active
        
    if user_update.email is not None:
        user.email = user_update.email
        
    if user_update.is_verified is not None:
        user.is_verified = user_update.is_verified
        
    db.commit()
    db.refresh(user)
    return user

@app.get("/admin/roles", response_model=List[schemas.Role])
def read_roles(db: Session = Depends(get_db), current_user: models.User = Depends(has_permission("manage:roles"))):
    roles = db.query(models.Role).all()
    # Manually populate user_count since it's not a column but a computed property we want
    # Or we can use a join/group_by query for efficiency, but for now simple loop is fine for small number of roles
    result = []
    for role in roles:
        count = db.query(models.User).filter(models.User.role_id == role.id).count()
        # We need to convert the SQLAlchemy model to a dict or object that matches the schema
        # Pydantic's orm_mode will handle the model attributes, but user_count needs to be added
        role_dict = {
            "id": role.id,
            "name": role.name,
            "permissions": role.permissions,
            "user_count": count
        }
        result.append(role_dict)
    return result

@app.post("/admin/roles", response_model=schemas.Role)
def create_role(role: schemas.RoleCreate, db: Session = Depends(get_db), current_user: models.User = Depends(has_permission("manage:roles"))):
    db_role = db.query(models.Role).filter(models.Role.name == role.name).first()
    if db_role:
        raise HTTPException(status_code=400, detail="Role already exists")
    new_role = models.Role(name=role.name, permissions=role.permissions)
    db.add(new_role)
    db.commit()
    db.refresh(new_role)
    db.refresh(new_role)
    return new_role

@app.put("/admin/roles/{role_id}", response_model=schemas.Role)
def update_role(
    role_id: str, 
    role_update: schemas.RoleUpdate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(has_permission("manage:roles"))
):
    db_role = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not db_role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Update fields
    db_role.name = role_update.name
    db_role.permissions = role_update.permissions
    
    db.commit()
    db.refresh(db_role)
    # Return with user_count (likely 0 or unchanged)
    count = db.query(models.User).filter(models.User.role_id == db_role.id).count()
    return {
        "id": db_role.id,
        "name": db_role.name,
        "permissions": db_role.permissions,
        "user_count": count
    }

@app.delete("/admin/roles/{role_id}")
def delete_role(role_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(has_permission("manage:roles"))):
    role = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Check if users are assigned
    user_count = db.query(models.User).filter(models.User.role_id == role.id).count()
    if user_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete role with assigned users")
        
    db.delete(role)
    db.commit()
    return {"message": "Role deleted"}

@app.put("/admin/users/{user_id}/role")
def assign_role(user_id: str, role_name: str, db: Session = Depends(get_db), current_user: models.User = Depends(has_permission("manage:users"))):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    role = db.query(models.Role).filter(models.Role.name == role_name).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
        
    user.role_id = role.id
    # Sync the enum role for backward compatibility if it matches standard ones
    if role.name.lower() == "admin":
         user.role = models.UserRole.admin
    elif role.name.lower() == "user":
         user.role = models.UserRole.user
    
    db.commit()
    return {"message": "Role assigned"}

@app.put("/admin/users/{user_id}/status")
def toggle_user_status(
    user_id: str, 
    is_active: bool, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(has_permission("manage:users"))
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deactivating yourself
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
        
    user.is_active = is_active
    db.commit()
    return {"message": f"User status updated to {'active' if is_active else 'inactive'}"}

# --- Admin: Units ---

@app.get("/admin/units", response_model=List[schemas.Unit])
def read_units(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Unit).all()

@app.post("/admin/units", response_model=schemas.Unit)
def create_unit(unit: schemas.UnitCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Check for existing unit by name (JSON comparison is tricky in SQL)
    # Instead of exact JSON match, let's check if the English singular name exists
    # This is a heuristic but prevents most duplicates
    
    # Extract English singular name from input
    name_to_check = ""
    if isinstance(unit.name, dict):
         name_to_check = unit.name.get("en", {}).get("singular", "")
    elif isinstance(unit.name, str):
         # If it's a string (should be parsed by validator, but just in case)
         name_to_check = unit.name
         
    if name_to_check:
        # This is still a bit complex because DB stores JSON. 
        # We can use cast to text and ilike for a rough check, or just rely on client side validation?
        # Better: just try to insert and catch IntegrityError if there's a unique constraint?
        # But Unit.name is not unique in DB schema (only index=True, not unique=True in models.py?)
        # Let's check models.py... name = Column(JSON, nullable=False) ... no unique=True.
        # So we can have duplicates. But we want to avoid them.
        
        # Let's use a robust check: fetch all units and check in python (slow but safe for small table)
        all_units = db.query(models.Unit).all()
        for u in all_units:
            u_name = u.name
            u_en_sing = ""
            if isinstance(u_name, dict):
                u_en_sing = u_name.get("en", {}).get("singular", "")
            
            if u_en_sing and u_en_sing.lower() == name_to_check.lower():
                 raise HTTPException(status_code=400, detail="Unit already exists")

    # db_unit = db.query(models.Unit).filter(models.Unit.name == unit.name).first()
    # if db_unit:
    #    raise HTTPException(status_code=400, detail="Unit already exists")
    new_unit = models.Unit(name=unit.name, description=unit.description)
    db.add(new_unit)
    db.commit()
    db.refresh(new_unit)
    return new_unit

@app.put("/admin/units/{unit_id}", response_model=schemas.Unit)
def update_unit(
    unit_id: int, 
    unit_update: schemas.UnitCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(has_permission("manage:units"))
):
    unit = db.query(models.Unit).filter(models.Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    unit.name = unit_update.name
    unit.description = unit_update.description
    db.commit()
    db.refresh(unit)
    return unit

@app.delete("/admin/units/{unit_id}")
def delete_unit(unit_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(has_permission("manage:units"))):
    unit = db.query(models.Unit).filter(models.Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    db.delete(unit)
    db.commit()
    return {"message": "Unit deleted"}

# --- Automation / Import API ---

async def process_import_job(job_id: str, url: str, user_id: str, db: Session):
    job = db.query(models.ImportJob).filter(models.ImportJob.id == job_id).first()
    if not job:
        return

    try:
        job.status = models.ImportJobStatus.processing
        db.commit()

        # 1. Scrape
        scraped_text = await scrape_url(url)
        if not scraped_text:
            raise Exception("Failed to scrape URL")

        # 2. Parse with AI
        # Get API Key from settings
        gemini_key = get_gemini_api_key(db)
        if not gemini_key:
             raise Exception("Gemini API Key not configured")
             
        recipe_data = await parse_recipe_from_text(scraped_text, source_url=url, api_key=gemini_key, language="de")
        
        # 3. Create Recipe
        # Map schema to model
        new_recipe = models.Recipe(
            user_id=user_id,
            title=recipe_data["title"],
            source_url=recipe_data.get("source_url"),
            image_url=recipe_data.get("image_url"),
            created_type=models.RecipeType.ai_import,
            type=recipe_data.get("type", models.RecipeCategory.baking), # AI determines type
            yield_amount=recipe_data.get("yield_amount", 1),
            weight_per_piece=recipe_data.get("weight_per_piece"),
            reference_temperature=recipe_data.get("reference_temperature", 20.0),
            is_public=False
        )
        db.add(new_recipe)
        db.flush() # Get ID

        # Chapters, Ingredients, Steps
        for chapter_data in recipe_data.get("chapters", []):
            chapter = models.Chapter(
                recipe_id=new_recipe.id,
                name=chapter_data.get("name", "Main"),
                order_index=chapter_data.get("order_index", 0)
            )
            db.add(chapter)
            db.flush()

            for ing_data in chapter_data.get("ingredients", []):
                ing = models.Ingredient(
                    chapter_id=chapter.id,
                    name=ing_data["name"], # JSON
                    amount=ing_data["amount"],
                    unit=ing_data["unit"],
                    type=ing_data.get("type", models.IngredientType.other),
                    temperature=ing_data.get("temperature")
                )
                db.add(ing)

            for step_data in chapter_data.get("steps", []):
                step = models.Step(
                    chapter_id=chapter.id,
                    order_index=step_data["order_index"],
                    description=step_data["description"],
                    duration_min=step_data["duration_min"],
                    type=step_data.get("type", models.StepType.passive),
                    temperature=step_data.get("temperature")
                )
                db.add(step)
        
        job.status = models.ImportJobStatus.completed
        job.recipe_id = new_recipe.id
        db.commit()

    except Exception as e:
        print(f"Import Job Failed: {e}")
        job.status = models.ImportJobStatus.failed
        job.error_message = str(e)
        db.commit()

@app.post("/api/automation/import", response_model=schemas.ImportJob)
def create_import_job(
    request: schemas.RecipeImportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_user_for_automation)
):
    # Check if AI is enabled
    ai_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "enable_ai").first()
    if not ai_setting or ai_setting.value.lower() != "true":
        raise HTTPException(status_code=400, detail="AI automation is disabled")

    # Check if API Key is configured
    api_key_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "gemini_api_key").first()
    if not api_key_setting or not api_key_setting.value:
        raise HTTPException(status_code=400, detail="AI API Key not configured")

    # Create Job
    job = models.ImportJob(
        user_id=current_user.id,
        status=models.ImportJobStatus.pending
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Start Background Task
    background_tasks.add_task(process_import_job, job.id, request.url, current_user.id, db)

    return job

@app.get("/api/automation/status/{job_id}", response_model=schemas.ImportJob)
def get_import_job_status(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_user_for_automation)
):
    job = db.query(models.ImportJob).filter(models.ImportJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Ensure user owns the job
    if job.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    return job

@app.get("/admin/units/export", response_model=List[schemas.Unit])
def export_units(db: Session = Depends(get_db), current_user: models.User = Depends(has_permission("manage:units"))):
    return db.query(models.Unit).all()

@app.get("/admin/ingredients/export", response_model=List[schemas.IngredientItem])
def export_ingredients(db: Session = Depends(get_db), current_user: models.User = Depends(has_permission("manage:ingredients"))):
    return db.query(models.IngredientItem).all()



# --- Admin: Ingredients ---
from ai_parser import translate_ingredient

@app.get("/admin/ingredients", response_model=List[schemas.IngredientItem])
def read_ingredients(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.IngredientItem).all()

@app.post("/admin/ingredients", response_model=schemas.IngredientItem)
async def create_ingredient(
    ingredient: schemas.IngredientItemCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    # Check permissions to determine verification status
    # Admin/Editor -> Verified
    # User -> Unverified (Pending)
    
    is_admin_or_editor = False
    if current_user.role_rel:
        is_admin_or_editor = current_user.role_rel.name in ["Admin", "Editor"]
    
    # Also check specific permission if role name check fails (fallback)
    if not is_admin_or_editor and current_user.role_rel:
        is_admin_or_editor = "manage:ingredients" in current_user.role_rel.permissions

    is_verified = is_admin_or_editor

    # Check if name dict has both languages
    name_dict = ingredient.name
    if "en" not in name_dict or "de" not in name_dict:
        # Need translation
        # Use the first available value as source
        source_name = next(iter(name_dict.values()))
        
        # Fetch API Key
        api_key = get_gemini_api_key(db)
        
        translated = await translate_ingredient(source_name, api_key=api_key)
        name_dict = translated
    
    new_ing = models.IngredientItem(
        name=name_dict, 
        default_unit_id=ingredient.default_unit_id, 
        linked_recipe_id=ingredient.linked_recipe_id,
        is_verified=is_verified
    )
    db.add(new_ing)
    db.commit()
    db.refresh(new_ing)
    return new_ing

@app.put("/admin/ingredients/{ingredient_id}/approve", response_model=schemas.IngredientItem)
def approve_ingredient(
    ingredient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_permission("manage:ingredients"))
):
    ing = db.query(models.IngredientItem).filter(models.IngredientItem.id == ingredient_id).first()
    if not ing:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    
    ing.is_verified = True
    db.commit()
    db.refresh(ing)
    return ing

@app.put("/admin/ingredients/{ingredient_id}", response_model=schemas.IngredientItem)
async def update_ingredient(
    ingredient_id: int,
    ingredient_update: schemas.IngredientItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_permission("manage:ingredients"))
):
    ing = db.query(models.IngredientItem).filter(models.IngredientItem.id == ingredient_id).first()
    if not ing:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    
    ing.name = ingredient_update.name
    ing.default_unit_id = ingredient_update.default_unit_id
    ing.linked_recipe_id = ingredient_update.linked_recipe_id
    
    db.commit()
    db.refresh(ing)
    return ing

@app.delete("/admin/ingredients/{ingredient_id}")
def delete_ingredient(ingredient_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(has_permission("manage:ingredients"))):
    ing = db.query(models.IngredientItem).filter(models.IngredientItem.id == ingredient_id).first()
    if not ing:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    db.delete(ing)
    db.commit()
    return {"message": "Ingredient deleted"}

@app.post("/admin/units/bulk", response_model=List[schemas.Unit])
def bulk_create_units(units: List[schemas.UnitCreate], db: Session = Depends(get_db), current_user: models.User = Depends(has_permission("manage:units"))):
    created_units = []
    for unit in units:
        # Check if exists by name (simple check, assuming name is unique identifier for import)
        # We need to handle the dict/string nature of name. 
        # For simplicity, we check if a unit with the same English singular name exists.
        
        # Extract English singular name for check
        name_to_check = ""
        if isinstance(unit.name, dict):
             name_to_check = unit.name.get("en", {}).get("singular", "")
        
        # This is a bit complex due to JSON storage of names. 
        # A better approach for bulk import is to just try to insert and ignore errors or duplicates.
        # Or, we can check if a unit with the exact same JSON structure exists.
        
        # Given the requirements, let's just add them.
        new_unit = models.Unit(name=unit.name, description=unit.description)
        db.add(new_unit)
        created_units.append(new_unit)
    
    db.commit()
    for u in created_units:
        db.refresh(u)
    return created_units

@app.post("/admin/ingredients/bulk", response_model=List[schemas.IngredientItem])
def bulk_create_ingredients(ingredients: List[schemas.IngredientItemCreate], db: Session = Depends(get_db), current_user: models.User = Depends(has_permission("manage:ingredients"))):
    created_ingredients = []
    for ing in ingredients:
        new_ing = models.IngredientItem(name=ing.name, default_unit_id=ing.default_unit_id, linked_recipe_id=ing.linked_recipe_id)
        db.add(new_ing)
        created_ingredients.append(new_ing)
    
    db.commit()
    for i in created_ingredients:
        db.refresh(i)
    return created_ingredients
    




def send_verification_email(to_email: str, code: str, db: Session, language: str = "en"):
    # Get app name
    app_name_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "app_name").first()
    app_name = app_name_setting.value if app_name_setting else "BakeAssist"
    app_name = app_name.strip()
    
    tmpl = get_email_template('email_change', language, {'code': code, 'app_name': app_name})
    send_mail(db, to_email, tmpl['subject'], tmpl['body'])

@app.put("/users/me/settings", response_model=schemas.User)
def update_settings(
    settings: schemas.UserUpdateSettings,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if settings.session_duration_minutes < 1 or settings.session_duration_minutes > 43200:
        raise HTTPException(status_code=400, detail="Session duration must be between 1 minute and 30 days")
        
    # Handle Email Update
    if settings.email and settings.email != current_user.email:
        # Require password for email change
        if not settings.password:
             logger.warning("Email change requested without password")
             raise HTTPException(status_code=403, detail="Password required to change email")
             
        if not verify_password(settings.password, current_user.hashed_password):
             logger.warning(f"Email change failed: Incorrect password for user {current_user.username}")
             raise HTTPException(status_code=403, detail="Incorrect password")
             
        # Check if email is taken
        existing = db.query(models.User).filter(models.User.email == settings.email).first()
        if existing:
             raise HTTPException(status_code=400, detail="Email already registered")

        # Check if email verification is enabled
        verify_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "enable_email_verification").first()
        verification_enabled = verify_setting.value.lower() == "true" if verify_setting else False

        if verification_enabled:
            # Generate code
            import random
            code = str(random.randint(100000, 999999))
            
            # Store in VerificationToken (hack: store code:email in token field)
            # Remove old tokens for this user
            db.query(models.VerificationToken).filter(models.VerificationToken.user_id == current_user.id).delete()
            
            token_str = f"{code}:{settings.email}"
            new_token = models.VerificationToken(
                token=token_str,
                user_id=current_user.id,
                expires_at=datetime.utcnow() + timedelta(minutes=15)
            )
            db.add(new_token)
            db.commit()
            
            # Send Email
            try:
                send_verification_email(settings.email, code, db, current_user.language)
            except Exception as e:
                logger.error(f"Failed to send verification email: {e}")
                # If email fails, we should probably rollback or warn. 
                # For now, let's allow it but user won't get code (unless they check logs/admin)
                pass
                
            # Return user but with a flag indicating pending verification
            # Construct Pydantic model explicitly to ensure verification_pending is set
            user_response = schemas.User.model_validate(current_user)
            user_response.verification_pending = True
            return user_response
             
        current_user.email = settings.email

    if settings.language:
        current_user.language = settings.language

    current_user.session_duration_minutes = settings.session_duration_minutes
    db.commit()
    db.refresh(current_user)
    return current_user

@app.post("/users/me/email/confirm", response_model=schemas.User)
def confirm_email_change(
    confirm: schemas.EmailChangeConfirm,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Find token
    token_str = f"{confirm.code}:{confirm.email}"
    token = db.query(models.VerificationToken).filter(
        models.VerificationToken.user_id == current_user.id,
        models.VerificationToken.token == token_str
    ).first()
    
    if not token:
        raise HTTPException(status_code=400, detail="Invalid code or email")
        
    if token.expires_at < datetime.utcnow():
        db.delete(token)
        db.commit()
        raise HTTPException(status_code=400, detail="Code expired")
        
    # Update Email
    old_email = current_user.email
    current_user.email = confirm.email
    
    # Cleanup
    db.delete(token)
    db.commit()
    db.refresh(current_user)
    
    # Notify old email
    if old_email:
        try:
            app_name_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "app_name").first()
            app_name = app_name_setting.value if app_name_setting else "BakeAssist"
            app_name = app_name.strip()
            
            tmpl = get_email_template('security_alert_email_change', current_user.language, {'new_email': confirm.email, 'app_name': app_name})
            send_mail(db, old_email, tmpl['subject'], tmpl['body'])
        except Exception as e:
            print(f"Failed to send notification to old email: {e}")
    
    return current_user

def perform_session_cleanup(db: Session):
    cutoff = datetime.utcnow() - timedelta(days=30)
    deleted = db.query(models.UserSession).filter(
        or_(
            models.UserSession.is_active == False,
            models.UserSession.expires_at < datetime.utcnow()
        )
    ).delete(synchronize_session=False)
    db.commit()
    return deleted

@app.delete("/auth/sessions/cleanup")
def cleanup_sessions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_permission("manage:system"))
):
    deleted = perform_session_cleanup(db)
    return {"message": f"Cleaned up {deleted} sessions"}

import asyncio

async def periodic_cleanup():
    while True:
        try:
            # Run cleanup every hour
            await asyncio.sleep(3600)
            # Create a new session for the background task
            db = next(get_db())
            perform_session_cleanup(db)
        except Exception as e:
            print(f"Cleanup error: {e}")
            await asyncio.sleep(60)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(periodic_cleanup())

# --- System Settings ---

@app.get("/settings/public", response_model=Dict[str, str])
def read_public_settings(db: Session = Depends(get_db)):
    # Allow public access to specific settings needed for branding
    public_keys = ["app_name", "favicon_url", "allow_guest_access", "enable_registration"]
    settings = db.query(models.SystemSetting).filter(models.SystemSetting.key.in_(public_keys)).all()
    result = {s.key: s.value for s in settings}
    # Ensure defaults if missing
    if "app_name" not in result:
        result["app_name"] = "Bake'n'Cook"
    if "favicon_url" not in result:
        result["favicon_url"] = "/favicon.ico"
    if "allow_guest_access" not in result:
        result["allow_guest_access"] = "false"
    if "enable_registration" not in result:
        result["enable_registration"] = "true"
    return result

def mask_sensitive_value(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 3:
        return "****"
    return value[:3] + "****"

@app.get("/admin/settings", response_model=Dict[str, Any])
def read_system_settings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_permission("manage:system"))
):
    settings = db.query(models.SystemSetting).all()
    result = {}
    sensitive_keys = ["smtp_password", "gemini_api_key"]
    
    for s in settings:
        val = s.value
        if s.key == "debug_mode":
            val = s.value.lower() == "true"
        elif s.key in sensitive_keys and val:
            val = mask_sensitive_value(val)
            
        result[s.key] = val
    return result

@app.put("/admin/settings", response_model=Dict[str, Any])
def update_system_settings(
    settings_update: schemas.SystemSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_permission("manage:system"))
):
    sensitive_keys = ["smtp_password", "gemini_api_key"]
    
    for key, value in settings_update.settings.items():
        # Handle special cases or conversions
        str_value = str(value)
        if isinstance(value, bool):
            str_value = "true" if value else "false"
            
        # Special handling for debug_mode
        if key == "debug_mode":
            from logger import set_log_level
            set_log_level(str_value == "true")
            
        # Check if this is a sensitive key and if the value is the masked version
        if key in sensitive_keys:
            existing_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == key).first()
            if existing_setting and existing_setting.value:
                masked_existing = mask_sensitive_value(existing_setting.value)
                # If the incoming value matches the masked version of the existing value,
                # it means the user didn't change it (just sent back what they saw).
                # So we skip updating it.
                if str_value == masked_existing:
                    continue

        setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == key).first()
        if setting:
            setting.value = str_value
        else:
            new_setting = models.SystemSetting(key=key, value=str_value)
            db.add(new_setting)
            
    db.commit()
    
    # Return updated settings (masked)
    return read_system_settings(db, current_user)

@app.get("/admin/logs")
def get_system_logs(
    lines: int = 100,
    current_user: models.User = Depends(has_permission("manage:system"))
):
    log_file = "app.log"
    if not os.path.exists(log_file):
        return {"logs": []}
        
    try:
        with open(log_file, "r") as f:
            # Read all lines and return the last 'lines' count
            all_lines = f.readlines()
            return {"logs": all_lines[-lines:]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read logs: {e}")

@app.on_event("startup")
def startup_event():
    # Run session cleanup on startup
    try:
        db = next(get_db())
        
        # --- Simple Migration Check ---
        # Check for missing columns and add them if necessary
        # This is a workaround for lack of Alembic
        from sqlalchemy import text
        
        # 1. session_duration_minutes in users
        try:
            db.execute(text("SELECT session_duration_minutes FROM users LIMIT 1"))
        except Exception:
            print("Migrating: Adding session_duration_minutes to users table...")
            db.rollback()
            # Add column with default 60
            # Note: Syntax depends on DB. Assuming PostgreSQL based on DATABASE_URL default, 
            # but SQLite also supports ADD COLUMN.
            try:
                db.execute(text("ALTER TABLE users ADD COLUMN session_duration_minutes INTEGER DEFAULT 60"))
                db.commit()
            except Exception as e:
                print(f"Migration failed: {e}")
                db.rollback()

        # 2. weight_per_piece in recipes
        try:
            db.execute(text("SELECT weight_per_piece FROM recipes LIMIT 1"))
        except Exception:
            print("Migrating: Adding weight_per_piece to recipes table...")
            db.rollback()
            try:
                db.execute(text("ALTER TABLE recipes ADD COLUMN weight_per_piece INTEGER DEFAULT 0"))
                db.commit()
            except Exception as e:
                print(f"Migration failed: {e}")
                db.rollback()

        # 3. reference_temperature in recipes
        try:
            db.execute(text("SELECT reference_temperature FROM recipes LIMIT 1"))
        except Exception:
            print("Migrating: Adding reference_temperature to recipes table...")
            db.rollback()
            try:
                db.execute(text("ALTER TABLE recipes ADD COLUMN reference_temperature FLOAT DEFAULT 20.0"))
                db.commit()
            except Exception as e:
                print(f"Migration failed: {e}")
                db.rollback()

        # 4. real_temperature in schedules
        try:
            db.execute(text("SELECT real_temperature FROM schedules LIMIT 1"))
        except Exception:
            print("Migrating: Adding real_temperature to schedules table...")
            db.rollback()
            try:
                db.execute(text("ALTER TABLE schedules ADD COLUMN real_temperature FLOAT"))
                db.commit()
            except Exception as e:
                print(f"Migration failed: {e}")
                db.rollback()
            print("Migrating: Adding weight_per_piece to recipes table...")
            db.rollback()
            try:
                db.execute(text("ALTER TABLE recipes ADD COLUMN weight_per_piece INTEGER"))
                db.commit()
            except Exception as e:
                print(f"Migration failed: {e}")
                db.rollback()
                
        # 5. Fix amount type in ingredients (Integer -> Float)
        try:
            # This is primarily for Postgres. SQLite ignores this or fails safely.
            # SQLite uses dynamic typing, so changing the model might be enough if we don't enforce strict types.
            # But for Postgres we need to alter the column.
            db.execute(text("ALTER TABLE ingredients ALTER COLUMN amount TYPE FLOAT"))
            db.commit()
            print("Migrated: ingredients.amount to FLOAT")
        except Exception as e:
            # Expected to fail on SQLite or if already float
            print(f"Migration (amount -> float) skipped/failed (expected on SQLite): {e}")
            print(f"Migration (amount -> float) skipped/failed (expected on SQLite): {e}")
            db.rollback()

        # 6. Add email and is_verified to users
        try:
            db.execute(text("SELECT email FROM users LIMIT 1"))
        except Exception:
            print("Migrating: Adding email and is_verified to users table...")
            db.rollback()
            try:
                db.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR"))
                db.execute(text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE"))
                # Auto-verify existing users
                db.execute(text("UPDATE users SET is_verified = TRUE"))
                db.commit()
            except Exception as e:
                print(f"Migration failed: {e}")
                db.rollback()

        # 7. Create verification_tokens table (if not exists)
        # SQLAlchemy create_all should handle this if we run it, but main.py runs it at top.
        # However, if table didn't exist at start, it's created. If it's new model, we need to ensure it's created.
        # models.Base.metadata.create_all(bind=engine) is called at top of file.
        # So if we restart, it should be created.
        
        # --- End Migration Check ---

        deleted = perform_session_cleanup(db)
        print(f"Startup: Cleaned up {deleted} expired sessions")
    except Exception as e:
        print(f"Startup tasks failed: {e}")


# --- Recipes ---

@app.post("/recipes/", response_model=schemas.Recipe)
def create_recipe(
    recipe: schemas.RecipeCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Create Recipe
    db_recipe = models.Recipe(
        title=recipe.title,
        source_url=recipe.source_url,
        image_url=recipe.image_url,
        created_type=recipe.created_type,
        type=recipe.type,
        is_public=recipe.is_public,
        yield_amount=recipe.yield_amount,
        weight_per_piece=recipe.weight_per_piece,
        reference_temperature=recipe.reference_temperature,
        user_id=current_user.id
    )
    db.add(db_recipe)
    db.commit()
    db.refresh(db_recipe)

    # Create Chapters
    for chapter in recipe.chapters:
        db_chapter = models.Chapter(
            recipe_id=db_recipe.id,
            name=chapter.name,
            order_index=chapter.order_index
        )
        db.add(db_chapter)
        db.commit()
        db.refresh(db_chapter)

        # Create Ingredients for Chapter
        for ing in chapter.ingredients:
            db_ing = models.Ingredient(**ing.dict(), chapter_id=db_chapter.id)
            db.add(db_ing)
        
        # Create Steps for Chapter
        for step in chapter.steps:
            db_step = models.Step(**step.dict(), chapter_id=db_chapter.id)
            db.add(db_step)

    db.commit()
    db.refresh(db_recipe)
    
    # Populate ingredient_overview for response
    all_ingredients = []
    for chapter in db_recipe.chapters:
        all_ingredients.extend(chapter.ingredients)
    
    # Aggregate ingredients by name and unit
    aggregated = {}
    for ing in all_ingredients:
        # ing.name is a dict, so we need to make it hashable
        name_key = tuple(sorted(ing.name.items())) if isinstance(ing.name, dict) else ing.name
        key = (name_key, ing.unit)
        
        if key in aggregated:
            aggregated[key].amount += ing.amount
        else:
            # Create a copy to avoid modifying the DB object
            import copy
            new_ing = copy.copy(ing)
            aggregated[key] = new_ing
            
    db_recipe.ingredient_overview = list(aggregated.values())
    
    return db_recipe

@app.get("/recipes", response_model=schemas.RecipePage)
def read_recipes(
    skip: int = 0, 
    limit: int = 12, 
    tab: Optional[str] = "discover", # discover, my_recipes, search
    search: Optional[str] = None,
    sort_by: Optional[str] = "newest", # newest, oldest, rating, favorites
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_current_user)
):
    query = db.query(models.Recipe).options(
        joinedload(models.Recipe.ratings),
        joinedload(models.Recipe.favorites),
        joinedload(models.Recipe.owner)
    )

    # Filter by tab
    if tab == "my_recipes":
        if not current_user:
            return {"items": [], "total": 0, "page": 1, "size": limit, "pages": 0}
        query = query.filter(models.Recipe.user_id == current_user.id)
    elif tab == "favorites":
        if not current_user:
             return {"items": [], "total": 0, "page": 1, "size": limit, "pages": 0}
        query = query.join(models.Favorite).filter(models.Favorite.user_id == current_user.id)
    elif tab == "cooking":
        query = query.filter(models.Recipe.type == models.RecipeCategory.cooking)
    elif tab == "baking":
        query = query.filter(models.Recipe.type == models.RecipeCategory.baking)
    
    # Apply Search (Global for all tabs)
    if search:
        # Use explicit joins for better compatibility and performance
        # We need to join chapters and ingredients to search within them
        # Note: This might cause duplicates if multiple ingredients match, so we use distinct()
        query = query.join(models.Recipe.chapters).join(models.Chapter.ingredients)
        query = query.filter(
            or_(
                models.Recipe.title.ilike(f"%{search}%"),
                cast(models.Ingredient.name, String).ilike(f"%{search}%")
            )
        ).distinct()
    
    # Sort
    if sort_by == "oldest":
        query = query.order_by(models.Recipe.created_at.asc())
    elif sort_by == "rating":
        # Sort by rating is complex in SQL with eager load, do in memory or subquery
        # For simplicity/MVP, let's sort in memory after fetch (limit is 100)
        pass 
    else: # newest
        query = query.order_by(models.Recipe.created_at.desc())

    # Get Total Count
    total = query.count()

    # Apply Pagination
    recipes = query.offset(skip).limit(limit).all()

    # Populate extra fields
    for r in recipes:
        r.author = r.owner.username if r.owner else "Unknown"
        r.rating_count = len(r.ratings)
        r.average_rating = sum(rt.score for rt in r.ratings) / r.rating_count if r.rating_count > 0 else 0.0
        r.is_favorited = any(f.user_id == current_user.id for f in r.favorites) if current_user else False

    # In-memory sort for complex metrics
    if sort_by == "rating":
        recipes.sort(key=lambda x: x.average_rating, reverse=True)
    elif sort_by == "favorites":
        recipes.sort(key=lambda x: len(x.favorites), reverse=True)

    return {
        "items": recipes,
        "total": total,
        "page": (skip // limit) + 1 if limit > 0 else 1,
        "size": limit,
        "pages": (total + limit - 1) // limit if limit > 0 else 0
    }

@app.get("/recipes/{recipe_id}", response_model=schemas.Recipe)
def read_recipe(
    recipe_id: str, 
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_current_user)
):
    recipe = db.query(models.Recipe).options(
        joinedload(models.Recipe.ratings),
        joinedload(models.Recipe.favorites),
        joinedload(models.Recipe.owner),
        joinedload(models.Recipe.chapters).joinedload(models.Chapter.ingredients),
        joinedload(models.Recipe.chapters).joinedload(models.Chapter.steps)
    ).filter(models.Recipe.id == recipe_id).first()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    # Allow any authenticated user to view any recipe
    
    # Populate ingredient_overview
    all_ingredients = []
    for chapter in recipe.chapters:
        all_ingredients.extend(chapter.ingredients)
        
    aggregated = {}
    for ing in all_ingredients:
        # ing.name is a dict, so we need to make it hashable
        name_key = tuple(sorted(ing.name.items())) if isinstance(ing.name, dict) else ing.name
        # Group by name, unit, AND temperature
        key = (name_key, ing.unit, ing.temperature)
        
        if key in aggregated:
            aggregated[key].amount += ing.amount
        else:
            import copy
            new_ing = copy.copy(ing)
            aggregated[key] = new_ing
            
    recipe.ingredient_overview = list(aggregated.values())

    # Populate extra fields
    recipe.author = recipe.owner.username if recipe.owner else "Unknown"
    recipe.rating_count = len(recipe.ratings)
    recipe.average_rating = sum(rt.score for rt in recipe.ratings) / recipe.rating_count if recipe.rating_count > 0 else 0.0
    recipe.is_favorited = any(f.user_id == current_user.id for f in recipe.favorites) if current_user else False

    return recipe

@app.post("/recipes/{recipe_id}/plan")
def plan_recipe(
    recipe_id: str,
    start_time: datetime,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Sort chapters by order_index
    chapters = sorted(recipe.chapters, key=lambda c: c.order_index)
    
    if not recipe.chapters:
        return {"error": "No chapters found"}

    chapters = sorted(recipe.chapters, key=lambda c: c.order_index)
    main_chapter = chapters[-1]
    pre_chapters = chapters[:-1]

    # Helper to calculate duration
    def get_chapter_duration(chapter):
        return sum(s.duration_min for s in chapter.steps)

    pre_durations = {c.id: get_chapter_duration(c) for c in pre_chapters}
    
    if pre_durations:
        max_pre_duration_min = max(pre_durations.values())
    else:
        max_pre_duration_min = 0
        
    merge_time = start_time + timedelta(minutes=max_pre_duration_min)
    
    schedule_items = []

    # Schedule Pre-Chapters
    for chapter in pre_chapters:
        duration = pre_durations[chapter.id]
        # Start time for this chapter to finish exactly at merge_time
        chapter_start = merge_time - timedelta(minutes=duration)
        
        current_step_time = chapter_start
        for step in sorted(chapter.steps, key=lambda s: s.order_index):
            schedule_items.append({
                "time": current_step_time,
                "description": f"{chapter.name}: {step.description}",
                "duration": step.duration_min,
                "type": step.type
            })
            current_step_time += timedelta(minutes=step.duration_min)

    # Schedule Main Chapter
    current_step_time = merge_time
    for step in sorted(main_chapter.steps, key=lambda s: s.order_index):
        schedule_items.append({
            "time": current_step_time,
            "description": f"{main_chapter.name}: {step.description}",
            "duration": step.duration_min,
            "type": step.type
        })
        current_step_time += timedelta(minutes=step.duration_min)
        
    # Sort schedule by time
    schedule_items.sort(key=lambda x: x["time"])
    
    return schedule_items

@app.put("/recipes/{recipe_id}", response_model=schemas.Recipe)
def update_recipe(
    recipe_id: str,
    recipe_update: schemas.RecipeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    # Check permissions: Owner OR Admin OR Editor
    is_owner = recipe.user_id == current_user.id
    is_admin = current_user.role == models.UserRole.admin
    # Check for specific permissions if not admin/owner
    can_manage = False
    if current_user.role_rel:
        can_manage = "delete:recipes" in current_user.role_rel.permissions
    
    if not is_owner and not is_admin and not can_manage:
        raise HTTPException(status_code=403, detail="Not authorized to edit this recipe")

    # Update fields
    recipe.title = recipe_update.title
    recipe.source_url = recipe_update.source_url
    recipe.image_url = recipe_update.image_url
    recipe.created_type = recipe_update.created_type
    recipe.is_public = recipe_update.is_public
    recipe.yield_amount = recipe_update.yield_amount
    recipe.weight_per_piece = recipe_update.weight_per_piece
    recipe.reference_temperature = recipe_update.reference_temperature
    recipe.type = recipe_update.type
    
    # Update Chapters (Full replace)
    # First, delete existing chapters and their children
    # We delete explicitly to ensure cleanup
    existing_chapter_ids = [c.id for c in recipe.chapters]
    if existing_chapter_ids:
        db.query(models.Ingredient).filter(models.Ingredient.chapter_id.in_(existing_chapter_ids)).delete(synchronize_session=False)
        db.query(models.Step).filter(models.Step.chapter_id.in_(existing_chapter_ids)).delete(synchronize_session=False)
        db.query(models.Chapter).filter(models.Chapter.id.in_(existing_chapter_ids)).delete(synchronize_session=False)
    
    # Create new chapters
    for chapter in recipe_update.chapters:
        db_chapter = models.Chapter(
            recipe_id=recipe.id,
            name=chapter.name,
            order_index=chapter.order_index
        )
        db.add(db_chapter)
        db.flush() # Get ID
        
        for ing in chapter.ingredients:
            db_ing = models.Ingredient(**ing.dict(), chapter_id=db_chapter.id)
            db.add(db_ing)
            
        for step in chapter.steps:
            db_step = models.Step(**step.dict(), chapter_id=db_chapter.id)
            db.add(db_step)

    db.commit()
    db.refresh(recipe)
    return recipe

@app.delete("/recipes/{recipe_id}")
def delete_recipe(
    recipe_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    is_owner = recipe.user_id == current_user.id
    is_admin = current_user.role == models.UserRole.admin
    can_manage = False
    if current_user.role_rel:
        can_manage = "delete:recipes" in current_user.role_rel.permissions
    
    if not is_owner and not is_admin and not can_manage:
        raise HTTPException(status_code=403, detail="Not authorized to delete this recipe")
        
    db.delete(recipe)
    db.commit()
    return {"message": "Recipe deleted"}

@app.post("/recipes/{recipe_id}/favorite", response_model=bool)
def toggle_favorite(
    recipe_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
        
    existing = db.query(models.Favorite).filter(
        models.Favorite.user_id == current_user.id,
        models.Favorite.recipe_id == recipe_id
    ).first()
    
    if existing:
        db.delete(existing)
        db.commit()
        return False # Not favorited anymore
    else:
        new_fav = models.Favorite(user_id=current_user.id, recipe_id=recipe_id)
        db.add(new_fav)
        db.commit()
        return True # Favorited

@app.post("/recipes/{recipe_id}/rate", response_model=float)
def rate_recipe(
    recipe_id: str,
    rating: schemas.RatingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
        
    if not (1 <= rating.score <= 5):
        raise HTTPException(status_code=400, detail="Score must be between 1 and 5")
        
    existing = db.query(models.Rating).filter(
        models.Rating.user_id == current_user.id,
        models.Rating.recipe_id == recipe_id
    ).first()
    
    if existing:
        existing.score = rating.score
    else:
        new_rating = models.Rating(user_id=current_user.id, recipe_id=recipe_id, score=rating.score)
        db.add(new_rating)
        
    db.commit()
    
    # Calculate new average
    avg = db.query(func.avg(models.Rating.score)).filter(models.Rating.recipe_id == recipe_id).scalar()
    return float(avg) if avg else 0.0

# --- Import ---

@app.post("/import/url", response_model=schemas.RecipeCreate)
async def import_from_url(
    request: schemas.RecipeImportRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        # 1. Scrape
        text_content = ""
        if request.url:
            # Check for existing recipe
            existing = db.query(models.Recipe).filter(models.Recipe.source_url == request.url, models.Recipe.user_id == current_user.id).first()
            if existing:
                import json
                raise HTTPException(status_code=409, detail=json.dumps({"message": "Recipe exists", "recipe_id": str(existing.id)}))
            
            text_content = await scrape_url(request.url)
        elif request.raw_text:
            text_content = request.raw_text
        else:
            raise HTTPException(status_code=400, detail="Either url or raw_text must be provided")

        if not text_content:
             raise HTTPException(status_code=400, detail="Could not extract content from URL")

        # 2. Parse with AI
        # Fetch API Key
        api_key = get_gemini_api_key(db)

        recipe_data = await parse_recipe_from_text(text_content, source_url=request.url, language=request.language, api_key=api_key)
        
        return recipe_data
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel

class CheckUrlRequest(BaseModel):
    url: str

@app.post("/recipes/check-url")
def check_recipe_url(
    request: CheckUrlRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        # print(f"Checking URL: {request.url}")
        existing = db.query(models.Recipe).filter(models.Recipe.source_url == request.url, models.Recipe.user_id == current_user.id).first()
        if existing:
            return {"exists": True, "recipe_id": str(existing.id)}
        return {"exists": False, "recipe_id": None}
    except Exception as e:
        print(f"Error checking URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Schedule (Simple Calculation) ---

@app.post("/schedule/calculate")
def calculate_schedule(
    recipe_id: str, 
    target_time: str, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # target_time format: ISO 8601
    from datetime import datetime
    
    recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    target_dt = datetime.fromisoformat(target_time.replace("Z", "+00:00"))
    
    current_time = target_dt
    schedule_steps = []
    
    # Reverse iterate steps
    sorted_steps = sorted(recipe.steps, key=lambda x: x.order_index, reverse=True)
    
    for step in sorted_steps:
        duration = timedelta(minutes=step.duration_min)
        start_time = current_time - duration
        
        schedule_steps.append({
            "step_description": step.description,
            "start_time": start_time.isoformat(),
            "end_time": current_time.isoformat(),
            "duration_min": step.duration_min,
            "type": step.type
        })
        
        current_time = start_time

    return {
        "recipe_title": recipe.title,
        "target_time": target_time,
        "start_time": current_time.isoformat(),
        "steps": list(reversed(schedule_steps))
    }

# --- Schedule CRUD ---

@app.post("/schedules", response_model=schemas.Schedule)
def create_schedule(
    schedule: schemas.ScheduleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # If recipe_id is provided, verify it exists
    if schedule.recipe_id:
        recipe = db.query(models.Recipe).filter(models.Recipe.id == schedule.recipe_id).first()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
    
    new_schedule = models.Schedule(
        user_id=current_user.id,
        recipe_id=schedule.recipe_id,
        target_time=schedule.target_time,
        start_time=schedule.start_time,
        title=schedule.title,
        event_type=schedule.event_type,
        recurrence_rule=schedule.recurrence_rule,
        real_temperature=schedule.real_temperature
    )
    db.add(new_schedule)
    db.commit()
    db.refresh(new_schedule)
    return new_schedule

@app.put("/schedules/{schedule_id}", response_model=schemas.Schedule)
def update_schedule(
    schedule_id: str,
    schedule_update: schemas.ScheduleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    schedule = db.query(models.Schedule).filter(
        models.Schedule.id == schedule_id,
        models.Schedule.user_id == current_user.id
    ).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
        
    # If recipe_id is provided, verify it exists
    if schedule_update.recipe_id:
        recipe = db.query(models.Recipe).filter(models.Recipe.id == schedule_update.recipe_id).first()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")

    schedule.recipe_id = schedule_update.recipe_id
    schedule.target_time = schedule_update.target_time
    schedule.start_time = schedule_update.start_time
    schedule.title = schedule_update.title
    schedule.event_type = schedule_update.event_type
    schedule.recurrence_rule = schedule_update.recurrence_rule
    schedule.real_temperature = schedule_update.real_temperature
    
    db.commit()
    db.refresh(schedule)
    return schedule

@app.get("/schedules", response_model=List[schemas.Schedule])
def read_schedules(
    start_date: str = None, # Optional filter
    end_date: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Schedule).options(
        joinedload(models.Schedule.recipe)
        .selectinload(models.Recipe.chapters)
        .selectinload(models.Chapter.steps)
    ).filter(models.Schedule.user_id == current_user.id)
    
    if start_date:
        from datetime import datetime
        start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        query = query.filter(models.Schedule.target_time >= start)
        
    if end_date:
        from datetime import datetime
        end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        query = query.filter(models.Schedule.target_time <= end)
        
    return query.all()

@app.delete("/schedules/{schedule_id}")
def delete_schedule(
    schedule_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    schedule = db.query(models.Schedule).filter(
        models.Schedule.id == schedule_id,
        models.Schedule.user_id == current_user.id
    ).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
        
    db.delete(schedule)
    db.commit()
    return {"message": "Schedule deleted"}

# --- System / Version ---
from version import APP_VERSION
import requests

@app.post("/admin/system/email/test")
def test_email_config(
    request: schemas.EmailTestRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(has_permission("manage:system"))
):
    try:
        # Get app name
        app_name_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "app_name").first()
        app_name = app_name_setting.value if app_name_setting else "Bake'n'Cook"
        
        # Determine language: use request language if provided, else user language, else 'en'
        language = request.language if request.language else (current_user.language if current_user.language else "en")
        
        # Get HTML content
        from email_templates import get_test_email_template
        html_content = get_test_email_template(app_name, language)
        
        # Determine subject
        subjects = {
            "en": f"Test Email from {app_name}",
            "de": f"Test-E-Mail von {app_name}"
        }
        subject = subjects.get(language, subjects["en"])
        
        # Use email_utils to send the email with the provided config
        import email_utils
        
        # Construct config dict from request
        smtp_password = request.smtp_password
        
        # Check if password is masked and needs to be replaced with stored value
        # We need to fetch the stored password to compare
        stored_smtp_pass_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "smtp_password").first()
        if stored_smtp_pass_setting and stored_smtp_pass_setting.value:
            masked_stored = mask_sensitive_value(stored_smtp_pass_setting.value)
            if smtp_password == masked_stored:
                smtp_password = stored_smtp_pass_setting.value
        
        smtp_config = {
            "smtp_server": request.smtp_server,
            "smtp_port": request.smtp_port,
            "smtp_user": request.smtp_user,
            "smtp_password": smtp_password,
            "sender_email": request.sender_email
        }
        
        recipient = request.test_recipient
        if not recipient and current_user.email:
            recipient = current_user.email
            
        if not recipient:
             raise HTTPException(status_code=400, detail="No recipient specified")

        success = email_utils.send_mail(
            db=db,
            to_email=recipient,
            subject=subject,
            body=html_content,
            smtp_config=smtp_config
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to send test email (check server logs)")
            
        return {"message": "Test email sent successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to send test email: {str(e)}")

@app.get("/admin/system/info", response_model=schemas.SystemInfo)
def get_system_info(db: Session = Depends(get_db)):
    # Check Database
    db_status = "offline"
    try:
        db.execute(text("SELECT 1"))
        db_status = "online"
    except Exception:
        pass

    # Check Scraper (Basic check if module is importable and browser is installed)
    scraper_status = "offline"
    try:
        from playwright.sync_api import sync_playwright
        scraper_status = "online"
        # Optional: specific check if browser is installed?
    except ImportError:
        pass

    # Determine environment
    is_docker = os.path.exists("/.dockerenv")

    from version import VERSION
    
    return {
        "version": VERSION,
        "environment": "docker" if is_docker else "local",
        "services": {
            "frontend": "online", # If they can see this, it's online
            "backend": "online",
            "database": db_status,
            "scraper": scraper_status
        },
        "update_available": False # Default to false, client can trigger check
    }

@app.get("/system/config", response_model=schemas.SystemConfig)
def get_public_config(db: Session = Depends(get_db)):
    # Fetch settings
    settings = db.query(models.SystemSetting).all()
    settings_dict = {s.key: s.value for s in settings}
    
    return {
        "enable_ai": settings_dict.get("enable_ai", "false").lower() == "true",
        "enable_registration": settings_dict.get("enable_registration", "true").lower() == "true",
        "allow_guest_access": settings_dict.get("allow_guest_access", "false").lower() == "true",
        "app_name": settings_dict.get("app_name", "BakeAssist")
    }

@app.post("/admin/system/check-update")
def check_for_updates(
    current_user: models.User = Depends(has_permission("manage:system"))
):
    # In a real app, this would check GitHub releases or a version file
    # For now, we'll mock it or check a public file if available.
    # Let's mock a check against a hypothetical repo
    
    try:
        # Example: check github api
        # response = requests.get("https://api.github.com/repos/yourusername/breadplan/releases/latest")
        # latest_version = response.json()["tag_name"]
        # return {"update_available": latest_version != APP_VERSION, "latest_version": latest_version}
        
        # Mock response
        return {
            "update_available": False,
            "latest_version": APP_VERSION,
            "message": "You are on the latest version."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check for updates: {str(e)}")

