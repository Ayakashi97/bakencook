import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.orm import Session
import models

from email.header import Header

def send_mail(db: Session, to_email: str, subject: str, body: str):
    """
    Sends an email using SMTP settings from the database.
    Returns True if successful, False otherwise.
    """
    # Fetch SMTP settings
    settings = db.query(models.SystemSetting).filter(
        models.SystemSetting.key.in_([
            "smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from_email", "smtp_tls"
        ])
    ).all()
    
    config = {s.key: s.value for s in settings}
    
    host = config.get("smtp_host")
    port = int(config.get("smtp_port", 587))
    user = config.get("smtp_user")
    password = config.get("smtp_password")
    from_email = config.get("smtp_from_email", "noreply@breadplan.com")
    use_tls = config.get("smtp_tls", "true").lower() == "true"
    
    if not host or not user or not password:
        print("SMTP settings not configured")
        return False
        
    try:
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
        print(f"Failed to send email: {e}")
        return False
