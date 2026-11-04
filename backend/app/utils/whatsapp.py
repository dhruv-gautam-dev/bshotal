import urllib.parse

from app.core.config import settings


def get_whatsapp_order_link(order_ref: str, total: str, customer_name: str) -> str:
    phone = settings.HOTEL_BOOKINGS_PHONE.replace("+", "").replace(" ", "").replace("-", "")
    text = (
        f"Namaste Delicee Restaurant,\n\n"
        f"I placed order *{order_ref}*.\n"
        f"Customer: {customer_name}\n"
        f"Amount: Rs. {total}\n\n"
        f"Please share update on my order. Thank you!"
    )
    return f"https://wa.me/{phone}?text={urllib.parse.quote(text)}"
