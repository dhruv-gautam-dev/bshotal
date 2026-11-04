import logging
from email.message import EmailMessage

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger("email_service")


async def send_email(
    to_email: str, subject: str, html_content: str, text_content: str | None = None
) -> bool:
    """Sends email via SMTP or logs if credentials are unconfigured."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.info(f"[EMAIL STUB] To: {to_email} | Subject: {subject}")
        return True

    msg = EmailMessage()
    msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
    msg["To"] = to_email
    msg["Subject"] = subject

    if text_content:
        msg.set_content(text_content)
        msg.add_alternative(html_content, subtype="html")
    else:
        msg.set_content(html_content, subtype="html")

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=False,
            start_tls=True,
        )
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False
