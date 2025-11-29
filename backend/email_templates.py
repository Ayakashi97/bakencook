from typing import Dict

def get_email_template(template_type: str, language: str, context: Dict[str, str]) -> Dict[str, str]:
    """
    Returns a dictionary with 'subject' and 'body' for the given template type and language.
    Context should contain necessary variables for the template.
    """
    lang = language if language in ['en', 'de'] else 'en'
    
    app_name = context.get('app_name', 'BakeAssist')
    
    # Common Styles
    style_base = """
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background-color: #f9f9f9;
    """
    style_header = """
        background-color: #ffffff;
        padding: 20px;
        text-align: center;
        border-radius: 8px 8px 0 0;
        border-bottom: 3px solid #eab308;
    """
    style_content = """
        background-color: #ffffff;
        padding: 30px;
        border-radius: 0 0 8px 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    """
    style_footer = """
        text-align: center;
        margin-top: 20px;
        font-size: 12px;
        color: #888;
    """
    style_button = """
        display: inline-block;
        padding: 12px 24px;
        background-color: #eab308;
        color: #ffffff;
        text-decoration: none;
        border-radius: 6px;
        font-weight: bold;
        margin: 20px 0;
    """
    style_code = """
        font-size: 32px;
        letter-spacing: 5px;
        font-weight: bold;
        color: #eab308;
        background: #fefce8;
        padding: 15px;
        border-radius: 8px;
        display: inline-block;
        margin: 20px 0;
        border: 1px dashed #eab308;
    """

    header_html = f"""
        <div style="{style_base}">
            <div style="{style_header}">
                <h1 style="margin: 0; color: #333; font-size: 24px;">{app_name}</h1>
            </div>
            <div style="{style_content}">
    """
    
    footer_html = f"""
            </div>
            <div style="{style_footer}">
                <p>&copy; {app_name}. All rights reserved.</p>
                <p>This is an automated message, please do not reply.</p>
            </div>
        </div>
    """

    templates = {
        'verification': {
            'en': {
                'subject': f"Verify your email - {app_name}",
                'content': f"""
                    <h2>Verify your email address</h2>
                    <p>Welcome to {app_name}! We're excited to have you on board.</p>
                    <p>Please use the following code to verify your email address:</p>
                    <div style="text-align: center;">
                        <div style="{style_code}">{context.get('code', '')}</div>
                    </div>
                    <p>If you did not create an account, please ignore this email.</p>
                """
            },
            'de': {
                'subject': f"E-Mail bestätigen - {app_name}",
                'content': f"""
                    <h2>E-Mail-Adresse bestätigen</h2>
                    <p>Willkommen bei {app_name}! Wir freuen uns, Sie dabei zu haben.</p>
                    <p>Bitte verwenden Sie den folgenden Code, um Ihre E-Mail-Adresse zu bestätigen:</p>
                    <div style="text-align: center;">
                        <div style="{style_code}">{context.get('code', '')}</div>
                    </div>
                    <p>Wenn Sie kein Konto erstellt haben, ignorieren Sie diese E-Mail bitte.</p>
                """
            }
        },
        'email_change': {
            'en': {
                'subject': f"Verify email change - {app_name}",
                'content': f"""
                    <h2>Confirm Email Change</h2>
                    <p>You have requested to change your email address for {app_name}.</p>
                    <p>Your verification code is:</p>
                    <div style="text-align: center;">
                        <div style="{style_code}">{context.get('code', '')}</div>
                    </div>
                    <p>If you did not request this change, please ignore this email.</p>
                """
            },
            'de': {
                'subject': f"E-Mail-Änderung bestätigen - {app_name}",
                'content': f"""
                    <h2>E-Mail-Änderung bestätigen</h2>
                    <p>Sie haben eine Änderung Ihrer E-Mail-Adresse für {app_name} angefordert.</p>
                    <p>Ihr Bestätigungscode lautet:</p>
                    <div style="text-align: center;">
                        <div style="{style_code}">{context.get('code', '')}</div>
                    </div>
                    <p>Wenn Sie diese Änderung nicht angefordert haben, ignorieren Sie diese E-Mail bitte.</p>
                """
            }
        },
        'security_alert_email_change': {
            'en': {
                'subject': f"Security Alert: Email Changed - {app_name}",
                'content': f"""
                    <h2 style="color: #ef4444;">Security Alert</h2>
                    <p>The email address for your account on <strong>{app_name}</strong> has been changed to <strong>{context.get('new_email', '')}</strong>.</p>
                    <p>If you authorized this change, no further action is needed.</p>
                    <p style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; color: #991b1b;">
                        <strong>If you did not authorize this change:</strong><br>
                        Please contact the administrator immediately to secure your account.
                    </p>
                """
            },
            'de': {
                'subject': f"Sicherheitswarnung: E-Mail geändert - {app_name}",
                'content': f"""
                    <h2 style="color: #ef4444;">Sicherheitswarnung</h2>
                    <p>Die E-Mail-Adresse für Ihr Konto bei <strong>{app_name}</strong> wurde in <strong>{context.get('new_email', '')}</strong> geändert.</p>
                    <p>Wenn Sie diese Änderung autorisiert haben, ist keine weitere Handlung erforderlich.</p>
                    <p style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; color: #991b1b;">
                        <strong>Wenn Sie diese Änderung NICHT autorisiert haben:</strong><br>
                        Bitte kontaktieren Sie sofort den Administrator, um Ihr Konto zu sichern.
                    </p>
                """
            }
        }
    }

    template = templates.get(template_type, {}).get(lang, templates['verification']['en'])
    
    return {
        'subject': template['subject'],
        'body': header_html + template['content'] + footer_html
    }
