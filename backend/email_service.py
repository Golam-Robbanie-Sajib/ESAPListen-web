"""
Email service for sending password reset and verification emails.
Supports SMTP configuration for various email providers (Gmail, Outlook, SendGrid, etc.)
"""
import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

logger = logging.getLogger(__name__)

# Email configuration from environment variables
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", os.getenv("SMTP_USERNAME", ""))
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "ESAPListen")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Email enabled flag
EMAIL_ENABLED = bool(SMTP_USERNAME and SMTP_PASSWORD)


def send_email(to_email: str, subject: str, html_content: str, text_content: Optional[str] = None) -> bool:
    """
    Send an email using SMTP.

    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML email content
        text_content: Plain text fallback (optional)

    Returns:
        bool: True if email sent successfully, False otherwise
    """
    if not EMAIL_ENABLED:
        logger.warning(f"Email service not configured. Would send email to {to_email} with subject: {subject}")
        logger.info(f"Email content:\n{html_content}")
        return False

    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        message["To"] = to_email

        # Attach text and HTML versions
        if text_content:
            part1 = MIMEText(text_content, "plain")
            message.attach(part1)

        part2 = MIMEText(html_content, "html")
        message.attach(part2)

        # Send email
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()  # Secure the connection
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(message)

        logger.info(f"✓ Email sent successfully to {to_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}", exc_info=True)
        return False


def send_password_reset_email(to_email: str, reset_token: str) -> bool:
    """
    Send password reset email with reset link.

    Args:
        to_email: User's email address
        reset_token: Password reset token

    Returns:
        bool: True if email sent successfully, False otherwise
    """
    reset_url = f"{FRONTEND_URL}/reset-password?token={reset_token}"

    subject = "Reset Your ESAPListen Password"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
                background: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }}
            .header {{
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                padding: 40px 30px;
                text-align: center;
            }}
            .header h1 {{
                margin: 0;
                color: #ffffff;
                font-size: 32px;
                font-weight: 700;
            }}
            .content {{
                padding: 40px 30px;
            }}
            .button {{
                display: inline-block;
                padding: 16px 32px;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: #ffffff;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin: 20px 0;
                transition: transform 0.2s;
            }}
            .button:hover {{
                transform: translateY(-2px);
            }}
            .footer {{
                padding: 30px;
                text-align: center;
                background-color: #f9fafb;
                color: #6b7280;
                font-size: 14px;
            }}
            .security-notice {{
                background-color: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
            }}
            .link-text {{
                color: #6b7280;
                font-size: 12px;
                word-break: break-all;
                margin-top: 20px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 ESAPListen</h1>
            </div>
            <div class="content">
                <h2 style="color: #1f2937; margin-top: 0;">Reset Your Password</h2>
                <p>Hello,</p>
                <p>We received a request to reset your password for your ESAPListen account. Click the button below to create a new password:</p>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_url}" class="button">Reset Password</a>
                </div>

                <div class="security-notice">
                    <strong>⚠️ Security Notice:</strong>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li>This link will expire in 1 hour</li>
                        <li>If you didn't request this reset, please ignore this email</li>
                        <li>Your password won't change until you create a new one</li>
                    </ul>
                </div>

                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <div class="link-text">
                    <a href="{reset_url}" style="color: #10b981;">{reset_url}</a>
                </div>
            </div>
            <div class="footer">
                <p><strong>ESAPListen</strong> - Transform meetings into actionable insights</p>
                <p>This is an automated email. Please do not reply.</p>
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
    Reset Your ESAPListen Password

    Hello,

    We received a request to reset your password for your ESAPListen account.

    Click this link to reset your password:
    {reset_url}

    Security Notice:
    - This link will expire in 1 hour
    - If you didn't request this reset, please ignore this email
    - Your password won't change until you create a new one

    ---
    ESAPListen - Transform meetings into actionable insights
    This is an automated email. Please do not reply.
    """

    return send_email(to_email, subject, html_content, text_content)


def send_verification_email(to_email: str, verification_token: str, user_name: Optional[str] = None) -> bool:
    """
    Send email verification email with verification link.

    Args:
        to_email: User's email address
        verification_token: Email verification token
        user_name: User's name (optional)

    Returns:
        bool: True if email sent successfully, False otherwise
    """
    verification_url = f"{FRONTEND_URL}/verify-email?token={verification_token}"
    greeting = f"Hello {user_name}," if user_name else "Hello,"

    subject = "Verify Your ESAPListen Email"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
                background: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }}
            .header {{
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                padding: 40px 30px;
                text-align: center;
            }}
            .header h1 {{
                margin: 0;
                color: #ffffff;
                font-size: 32px;
                font-weight: 700;
            }}
            .content {{
                padding: 40px 30px;
            }}
            .button {{
                display: inline-block;
                padding: 16px 32px;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: #ffffff;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin: 20px 0;
                transition: transform 0.2s;
            }}
            .button:hover {{
                transform: translateY(-2px);
            }}
            .footer {{
                padding: 30px;
                text-align: center;
                background-color: #f9fafb;
                color: #6b7280;
                font-size: 14px;
            }}
            .features {{
                background-color: #ecfdf5;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }}
            .features ul {{
                margin: 10px 0;
                padding-left: 20px;
            }}
            .features li {{
                margin: 8px 0;
                color: #047857;
            }}
            .link-text {{
                color: #6b7280;
                font-size: 12px;
                word-break: break-all;
                margin-top: 20px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✉️ ESAPListen</h1>
            </div>
            <div class="content">
                <h2 style="color: #1f2937; margin-top: 0;">Welcome to ESAPListen!</h2>
                <p>{greeting}</p>
                <p>Thank you for signing up! We're excited to have you on board. Please verify your email address to activate your account and unlock all features.</p>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="{verification_url}" class="button">Verify Email Address</a>
                </div>

                <div class="features">
                    <strong>🚀 What you can do with ESAPListen:</strong>
                    <ul>
                        <li>Upload and analyze meeting recordings</li>
                        <li>Get AI-powered summaries and insights</li>
                        <li>Track action items and decisions</li>
                        <li>Sync events with Google Calendar</li>
                        <li>Search and organize notes</li>
                        <li>Access meeting history anytime</li>
                    </ul>
                </div>

                <p style="color: #6b7280; font-size: 14px;">
                    <strong>Note:</strong> This verification link will expire in 24 hours.
                    If you didn't create an account, you can safely ignore this email.
                </p>

                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <div class="link-text">
                    <a href="{verification_url}" style="color: #10b981;">{verification_url}</a>
                </div>
            </div>
            <div class="footer">
                <p><strong>ESAPListen</strong> - Transform meetings into actionable insights</p>
                <p>This is an automated email. Please do not reply.</p>
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
    Welcome to ESAPListen!

    {greeting}

    Thank you for signing up! We're excited to have you on board.
    Please verify your email address to activate your account and unlock all features.

    Click this link to verify your email:
    {verification_url}

    What you can do with ESAPListen:
    - Upload and analyze meeting recordings
    - Get AI-powered summaries and insights
    - Track action items and decisions
    - Sync events with Google Calendar
    - Search and organize notes
    - Access meeting history anytime

    Note: This verification link will expire in 24 hours.
    If you didn't create an account, you can safely ignore this email.

    ---
    ESAPListen - Transform meetings into actionable insights
    This is an automated email. Please do not reply.
    """

    return send_email(to_email, subject, html_content, text_content)


def send_welcome_email(to_email: str, user_name: Optional[str] = None) -> bool:
    """
    Send welcome email after successful email verification.

    Args:
        to_email: User's email address
        user_name: User's name (optional)

    Returns:
        bool: True if email sent successfully, False otherwise
    """
    greeting = f"Hello {user_name}," if user_name else "Hello,"
    dashboard_url = f"{FRONTEND_URL}/dashboard"

    subject = "Welcome to ESAPListen - You're All Set! 🎉"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
                background: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }}
            .header {{
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                padding: 40px 30px;
                text-align: center;
            }}
            .header h1 {{
                margin: 0;
                color: #ffffff;
                font-size: 32px;
                font-weight: 700;
            }}
            .content {{
                padding: 40px 30px;
            }}
            .button {{
                display: inline-block;
                padding: 16px 32px;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: #ffffff;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin: 20px 0;
            }}
            .footer {{
                padding: 30px;
                text-align: center;
                background-color: #f9fafb;
                color: #6b7280;
                font-size: 14px;
            }}
            .tips {{
                background-color: #ecfdf5;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 You're All Set!</h1>
            </div>
            <div class="content">
                <h2 style="color: #1f2937; margin-top: 0;">Welcome Aboard!</h2>
                <p>{greeting}</p>
                <p>Your email has been verified and your account is now fully activated. You're ready to start transforming your meetings into actionable insights!</p>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="{dashboard_url}" class="button">Go to Dashboard</a>
                </div>

                <div class="tips">
                    <strong>💡 Quick Start Tips:</strong>
                    <ol>
                        <li>Connect your Google Calendar for automatic event syncing</li>
                        <li>Upload your first meeting recording</li>
                        <li>Customize your meeting analysis preferences in Settings</li>
                        <li>Explore the Notes section to organize insights</li>
                    </ol>
                </div>

                <p>If you have any questions or need help, feel free to reach out. We're here to help you get the most out of ESAPListen!</p>
            </div>
            <div class="footer">
                <p><strong>ESAPListen</strong> - Transform meetings into actionable insights</p>
                <p>This is an automated email. Please do not reply.</p>
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
    Welcome Aboard!

    {greeting}

    Your email has been verified and your account is now fully activated.
    You're ready to start transforming your meetings into actionable insights!

    Visit your dashboard: {dashboard_url}

    Quick Start Tips:
    1. Connect your Google Calendar for automatic event syncing
    2. Upload your first meeting recording
    3. Customize your meeting analysis preferences in Settings
    4. Explore the Notes section to organize insights

    If you have any questions or need help, feel free to reach out.
    We're here to help you get the most out of ESAPListen!

    ---
    ESAPListen - Transform meetings into actionable insights
    This is an automated email. Please do not reply.
    """

    return send_email(to_email, subject, html_content, text_content)
