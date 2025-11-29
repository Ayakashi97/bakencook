import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.orm import Session
import models

from email.header import Header

def send_mail(db: Session, to_email: str, subject: str, body: str, smtp_config: dict = None):
    """
    Sends an email using SMTP settings from the database or provided config.
    Returns True if successful, False otherwise.
    """
    if smtp_config:
        config = smtp_config
    else:
        # Fetch SMTP settings
        settings = db.query(models.SystemSetting).filter(
            models.SystemSetting.key.in_([
                "smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from_email", "smtp_tls"
            ])
        ).all()
        
        config = {s.key: s.value for s in settings}
    
    host = config.get("smtp_host") or config.get("smtp_server")
    port = int(config.get("smtp_port", 587))
    user = config.get("smtp_user")
    password = config.get("smtp_password")
    from_email = config.get("smtp_from_email") or config.get("sender_email") or "noreply@breadplan.com"
    use_tls = str(config.get("smtp_tls", "true")).lower() == "true"
    
    if not host or not user or not password:
        from logger import logger
        logger.warning("SMTP settings not configured")
        return False
        
    try:
        # Sanitize inputs - Aggressively remove non-breaking spaces
        to_email = to_email.replace('\xa0', '').strip()
        from_email = from_email.replace('\xa0', '').strip()
        password = password.replace('\xa0', '').strip()
        user = user.replace('\xa0', '').strip()
        
        msg = MIMEMultipart()
        msg['From'] = from_email
        msg['To'] = to_email
        msg['Subject'] = Header(subject, 'utf-8')
        
        msg.attach(MIMEText(body, 'html', 'utf-8'))
        
        server = smtplib.SMTP(host, port)
        if use_tls:
            server.starttls()
        server.login(user, password)
        text = msg.as_string()
        server.sendmail(from_email, to_email, text)
        server.quit()
        return True
    except Exception as e:
        from logger import logger
        logger.error(f"Failed to send email: {e}")
        return False
        return False

def send_verification_email(to_email: str, code: str, db: Session, language: str = "en"):
    """
    Sends a verification email with the provided code.
    """
    from email_templates import get_email_template
    
    # Get app name
    app_name_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "app_name").first()
    app_name = app_name_setting.value if app_name_setting else "Bake'n'Cook"
    
    context = {
        "app_name": app_name,
        "code": code,
        "valid_minutes": "15"
    }
    
    template = get_email_template("verification", language, context)
    
    return send_mail(db, to_email, template['subject'], template['body'])
