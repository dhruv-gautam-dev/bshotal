import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.booking import Booking
from app.models.order import Order


def generate_booking_invoice_pdf(booking: Booking) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36
    )
    styles = getSampleStyleSheet()
    story = []

    # Title & Header
    title_style = ParagraphStyle(
        "HeaderTitle",
        parent=styles["Heading1"],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#1e293b"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "HeaderSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#64748b"),
    )

    story.append(Paragraph("B.S. HOTEL & RESTAURANT", title_style))
    story.append(
        Paragraph(
            "Near Township Nagar, NH-2, Mathura, UP - 281006 | Ph: +91 91492 24039", subtitle_style
        )
    )
    story.append(Spacer(1, 16))

    # Invoice Details Bar
    invoice_info = [
        [
            Paragraph(f"<b>Booking Ref:</b> {booking.booking_reference}", styles["Normal"]),
            Paragraph(f"<b>Date:</b> {booking.created_at.strftime('%d-%b-%Y')}", styles["Normal"]),
        ],
        [
            Paragraph(f"<b>Guest Name:</b> {booking.guest_name}", styles["Normal"]),
            Paragraph(f"<b>Contact:</b> {booking.guest_phone}", styles["Normal"]),
        ],
        [
            Paragraph(f"<b>Check-In:</b> {booking.check_in_date}", styles["Normal"]),
            Paragraph(f"<b>Check-Out:</b> {booking.check_out_date}", styles["Normal"]),
        ],
        [
            Paragraph(
                f"<b>Rooms / Guests:</b> {booking.num_rooms} Room(s), {booking.num_guests} Guest(s)",
                styles["Normal"],
            ),
            Paragraph(f"<b>Status:</b> {booking.booking_status.upper()}", styles["Normal"]),
        ],
    ]
    info_table = Table(invoice_info, colWidths=[260, 260])
    info_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("PADDING", (0, 0), (-1, -1), 6),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ]
        )
    )
    story.append(info_table)
    story.append(Spacer(1, 20))

    # Pricing Table
    price_data = [
        ["Description", "Amount (INR)"],
        [
            f"Room Accommodation ({booking.num_rooms} room for {booking.check_in_date} to {booking.check_out_date})",
            f"{booking.base_amount:.2f}",
        ],
        ["Goods & Services Tax (GST 12%)", f"{booking.tax_amount:.2f}"],
        ["Total Amount", f"Rs. {booking.total_amount:.2f}"],
        ["Advance Paid", f"Rs. {booking.advance_paid:.2f}"],
        ["Balance Due", f"Rs. {max(0, booking.total_amount - booking.advance_paid):.2f}"],
    ]
    t = Table(price_data, colWidths=[380, 140])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563eb")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("PADDING", (0, 0), (-1, -1), 8),
                ("BACKGROUND", (0, 3), (-1, 3), colors.HexColor("#f1f5f9")),
                ("FONTNAME", (0, 3), (-1, 3), "Helvetica-Bold"),
            ]
        )
    )
    story.append(t)
    story.append(Spacer(1, 24))

    terms = Paragraph(
        "<b>Terms & House Rules:</b> Strictly 100% pure vegetarian premises. Government ID required at check-in. "
        "Standard check-in: 12:00 PM, check-out: 11:00 AM.",
        subtitle_style,
    )
    story.append(terms)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


def generate_order_kot_pdf(order: Order) -> bytes:
    """Generates Kitchen Order Ticket (KOT)."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=(4 * inch, 6 * inch),
        rightMargin=10,
        leftMargin=10,
        topMargin=10,
        bottomMargin=10,
    )
    styles = getSampleStyleSheet()
    story = []

    title = ParagraphStyle("KOTHeader", parent=styles["Heading2"], alignment=1, fontSize=14)
    story.append(Paragraph("KITCHEN ORDER TICKET (KOT)", title))
    story.append(
        Paragraph(
            f"Ref: {order.order_reference} | Type: {order.order_type.upper()}", styles["Normal"]
        )
    )
    if order.table_number:
        story.append(Paragraph(f"<b>TABLE: {order.table_number}</b>", styles["Normal"]))
    story.append(
        Paragraph(f"Time: {order.created_at.strftime('%H:%M:%S (%d-%b)')}", styles["Normal"])
    )
    story.append(Spacer(1, 8))

    item_rows = [["Item", "Qty"]]
    for it in order.items:
        desc = it.item_name
        if it.special_instructions:
            desc += f"<br/><font size=7 color=gray>Note: {it.special_instructions}</font>"
        item_rows.append([Paragraph(desc, styles["Normal"]), str(it.quantity)])

    t = Table(item_rows, colWidths=[200, 50])
    t.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ALIGN", (1, 0), (1, -1), "CENTER"),
                ("PADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(t)

    if order.kitchen_notes:
        story.append(Spacer(1, 8))
        story.append(Paragraph(f"<b>Instructions:</b> {order.kitchen_notes}", styles["Normal"]))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


def generate_order_bill_pdf(order: Order) -> bytes:
    """Generates customer receipt bill."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, margin=36)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("DELICEE RESTAURANT", styles["Heading1"]))
    story.append(Paragraph("Unit of B.S. Hotel & Restaurant, NH-2, Mathura", styles["Normal"]))
    story.append(Spacer(1, 10))

    story.append(
        Paragraph(
            f"Order: {order.order_reference} | Customer: {order.customer_name} ({order.customer_phone})",
            styles["Normal"],
        )
    )
    story.append(
        Paragraph(
            f"Type: {order.order_type} | Payment: {order.payment_status.upper()}", styles["Normal"]
        )
    )
    story.append(Spacer(1, 14))

    rows = [["Item", "Qty", "Price", "Total"]]
    for it in order.items:
        rows.append(
            [it.item_name, str(it.quantity), f"{it.unit_price:.2f}", f"{it.total_price:.2f}"]
        )

    rows.append(["Subtotal", "", "", f"Rs. {order.subtotal:.2f}"])
    rows.append(["GST (5%)", "", "", f"Rs. {order.tax_amount:.2f}"])
    if order.delivery_fee > 0:
        rows.append(["Delivery Charge", "", "", f"Rs. {order.delivery_fee:.2f}"])
    rows.append(["Grand Total", "", "", f"Rs. {order.total_amount:.2f}"])

    t = Table(rows, colWidths=[260, 50, 90, 100])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#059669")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("PADDING", (0, 0), (-1, -1), 6),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ]
        )
    )
    story.append(t)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
