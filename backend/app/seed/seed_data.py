import argparse
import asyncio
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.base import Base
from app.db.session import async_session_maker, engine
from app.models.booking import Booking
from app.models.enquiry import Enquiry
from app.models.event_package import EventPackage
from app.models.menu import MenuCategory, MenuItem
from app.models.order import Order, OrderItem
from app.models.pricing_rule import PricingRule
from app.models.review import Review
from app.models.room import Room
from app.models.room_type import RoomType
from app.models.setting import Setting
from app.models.user import User
from app.seed.menu_data import DELICEE_CATEGORIES


async def seed_database(demo: bool = False):
    print("[SEED] Starting database seed...")

    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as db:
        # 1. Site Settings (Singleton)
        res = await db.execute(select(Setting).limit(1))
        setting = res.scalar_one_or_none()
        if not setting:
            print("  -> Creating default site settings...")
            setting = Setting(
                hotel_name="B.S. Hotel & Restaurant",
                restaurant_name="Delicee Restaurant",
                tagline="Pure Vegetarian Comfort & Dining on NH-2, Mathura",
                bookings_phone=settings.HOTEL_BOOKINGS_PHONE,
                payments_phone=settings.HOTEL_PAYMENTS_PHONE,
                whatsapp_number=settings.HOTEL_BOOKINGS_PHONE,
                email="info@bshotel.in",
                address="Near Township Nagar, NH-2, Mathura, Uttar Pradesh",
                city="Mathura",
                state="Uttar Pradesh",
                pincode="281006",
                gstin="09AAACB2345M1Z8",
                fssai_license="12723055000142",
                check_in_time="12:00 PM",
                check_out_time="11:00 AM",
                room_tax_percent=Decimal("12.00"),
                restaurant_tax_percent=Decimal("5.00"),
                delivery_charge=Decimal("40.00"),
                free_delivery_above=Decimal("499.00"),
                min_delivery_order=Decimal("199.00"),
                is_online_ordering_enabled=True,
                is_room_booking_enabled=True,
            )
            db.add(setting)
            await db.commit()

        # 2. Initial Owner Account
        res = await db.execute(select(User).where(User.email == settings.INITIAL_OWNER_EMAIL))
        owner = res.scalar_one_or_none()
        if not owner:
            print(f"  -> Creating initial owner: {settings.INITIAL_OWNER_EMAIL}...")
            owner = User(
                email=settings.INITIAL_OWNER_EMAIL.lower(),
                phone=settings.INITIAL_OWNER_PHONE,
                full_name=settings.INITIAL_OWNER_NAME,
                role="owner",
                is_active=True,
                force_password_change=True,
                hashed_password=get_password_hash(settings.INITIAL_OWNER_PASSWORD),
            )
            db.add(owner)
            await db.commit()

        # 3. Room Types
        res = await db.execute(select(RoomType))
        existing_types = res.scalars().all()
        if not existing_types:
            print("  -> Seeding Room Types...")
            room_types_data = [
                {
                    "name": "Deluxe AC Room",
                    "slug": "deluxe-ac-room",
                    "description": "Comfortable air-conditioned room with king-size bed, private bath with geyser, LED TV and high-speed Wi-Fi.",
                    "base_price": Decimal("1800.00"),
                    "max_guests": 2,
                    "bed_type": "King Bed",
                    "size_sqft": 240,
                    "amenities": [
                        "Air Conditioning",
                        "Free High-Speed Wi-Fi",
                        "Geyser / Hot Water",
                        "Flat LED TV",
                        "Daily Housekeeping",
                        "24/7 Room Service",
                    ],
                    "images": [
                        "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=800&q=80"
                    ],
                    "total_inventory": 5,
                    "display_order": 1,
                },
                {
                    "name": "Super Deluxe Room",
                    "slug": "super-deluxe-room",
                    "description": "Spacious premium room featuring stylish interior decor, dedicated seating area, mini fridge, and balcony view.",
                    "base_price": Decimal("2400.00"),
                    "max_guests": 3,
                    "bed_type": "King Bed + Extra Mattress",
                    "size_sqft": 320,
                    "amenities": [
                        "Air Conditioning",
                        "Free High-Speed Wi-Fi",
                        "Geyser / Hot Water",
                        "Smart LED TV",
                        "Mini Fridge",
                        "Tea / Coffee Maker",
                        "City View Balcony",
                    ],
                    "images": [
                        "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80"
                    ],
                    "total_inventory": 5,
                    "display_order": 2,
                },
                {
                    "name": "Family Suite (4 Pax)",
                    "slug": "family-suite",
                    "description": "Expansive suite designed for visiting families and pilgrimage groups, with two double beds and generous lounge space.",
                    "base_price": Decimal("3500.00"),
                    "max_guests": 5,
                    "bed_type": "2 King Beds",
                    "size_sqft": 450,
                    "amenities": [
                        "Air Conditioning",
                        "Free High-Speed Wi-Fi",
                        "2 Bathrooms with Geyser",
                        '55" 4K Smart TV',
                        "Mini Fridge",
                        "Sofa Seating Lounge",
                        "Intercom",
                    ],
                    "images": [
                        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80"
                    ],
                    "total_inventory": 3,
                    "display_order": 3,
                },
            ]

            created_rts = {}
            for r_data in room_types_data:
                rt = RoomType(**r_data)
                db.add(rt)
                await db.flush()
                created_rts[rt.slug] = rt

            # Seed physical rooms
            rooms_to_create = [
                # Deluxe
                ("101", created_rts["deluxe-ac-room"].id, 1),
                ("102", created_rts["deluxe-ac-room"].id, 1),
                ("103", created_rts["deluxe-ac-room"].id, 1),
                ("104", created_rts["deluxe-ac-room"].id, 1),
                ("105", created_rts["deluxe-ac-room"].id, 1),
                # Super Deluxe
                ("201", created_rts["super-deluxe-room"].id, 2),
                ("202", created_rts["super-deluxe-room"].id, 2),
                ("203", created_rts["super-deluxe-room"].id, 2),
                ("204", created_rts["super-deluxe-room"].id, 2),
                ("205", created_rts["super-deluxe-room"].id, 2),
                # Family Suite
                ("301", created_rts["family-suite"].id, 3),
                ("302", created_rts["family-suite"].id, 3),
                ("303", created_rts["family-suite"].id, 3),
            ]
            for r_num, rt_id, floor in rooms_to_create:
                r = Room(room_number=r_num, room_type_id=rt_id, floor=floor, status="available")
                db.add(r)

            # Sample pricing rule (Weekend surge)
            rule = PricingRule(
                room_type_id=None,
                label="Weekend Surcharge",
                start_date=date.today(),
                end_date=date.today() + timedelta(days=90),
                rule_type="fixed_adjustment",
                price=Decimal("200.00"),
                days_of_week=[5, 6],  # Saturday, Sunday
            )
            db.add(rule)
            await db.commit()

        # 4. Event Packages
        res = await db.execute(select(EventPackage))
        if not res.scalars().all():
            print("  -> Seeding Event Packages...")
            packages = [
                {
                    "name": "Silver Ring Ceremony & Engagement",
                    "slug": "silver-ring-ceremony",
                    "description": "Complete banquet celebration including floral stage setup, dedicated welcome drinks, and Delicee 3-course pure veg buffet.",
                    "price_per_plate": Decimal("550.00"),
                    "min_guests": 50,
                    "max_guests": 150,
                    "features": [
                        "Air-conditioned Banquet Hall",
                        "Theme Floral Stage Setup",
                        "Welcome Drinks & Starters",
                        "Delicee Pure Veg 3-Course Buffet",
                        "Sound System & Stage Lights",
                    ],
                    "display_order": 1,
                },
                {
                    "name": "Golden Birthday Bash Package",
                    "slug": "golden-birthday-bash",
                    "description": "Vibrant party package with balloon decor, kids party snacks, custom cake table, DJ setup and dinner buffet.",
                    "price_per_plate": Decimal("499.00"),
                    "min_guests": 30,
                    "max_guests": 100,
                    "features": [
                        "Theme Balloon Decor & Entrance Arch",
                        "Dedicated Cake Cutting Table",
                        "Chaat & Live Tandoori Counter",
                        "Party DJ & Music",
                        "Dinner Buffet with Dessert",
                    ],
                    "display_order": 2,
                },
                {
                    "name": "Royal Marriage & Reception Banquet",
                    "slug": "royal-marriage-banquet",
                    "description": "Grand wedding package with royal entrance decor, mandap setup, bridal green room, and lavish 5-course Delicee feast.",
                    "price_per_plate": Decimal("850.00"),
                    "min_guests": 100,
                    "max_guests": 500,
                    "features": [
                        "Grand Hall & Lawn Setup",
                        "Royal Mandap & Entrance Decor",
                        "Bridal AC Changing Suites",
                        "5-Course Lavish Pure Veg Feast",
                        "Valet Parking & Generator Backup",
                    ],
                    "display_order": 3,
                },
            ]
            for p in packages:
                db.add(EventPackage(**p))
            await db.commit()

        # 5. Menu Categories & Items
        res = await db.execute(select(MenuCategory))
        if not res.scalars().all():
            print("  -> Seeding Delicee Menu Categories & Items...")
            for cat_data in DELICEE_CATEGORIES:
                items_data = cat_data.pop("items")
                cat = MenuCategory(**cat_data)
                db.add(cat)
                await db.flush()

                for order_idx, it_data in enumerate(items_data, start=1):
                    price_dec = Decimal(str(it_data.pop("price")))
                    item = MenuItem(
                        category_id=cat.id, price=price_dec, display_order=order_idx, **it_data
                    )
                    db.add(item)
            await db.commit()

        # 6. Demo Data (if requested with --demo)
        if demo:
            print("  -> Seeding interactive DEMO data (sample bookings, orders, reviews)...")
            from app.services.booking_service import get_or_create_customer

            # Demo Customers
            cust1 = await get_or_create_customer(
                db, phone="+919876543210", name="Vikram Sharma", email="vikram.sharma@example.com"
            )
            cust1.address = "Krishna Nagar, Mathura"
            cust1.total_spent = Decimal("4200.00")
            cust1.is_vip = True

            cust2 = await get_or_create_customer(
                db, phone="+919811223344", name="Ananya Verma", email="ananya.verma@example.com"
            )
            cust2.address = "Civil Lines, Agra"
            cust2.total_spent = Decimal("2100.00")
            await db.flush()

            # Room type for demo booking
            rt_res = await db.execute(select(RoomType).limit(1))
            rt = rt_res.scalar_one()

            # Demo Bookings
            today = date.today()
            b1_res = await db.execute(
                select(Booking).where(Booking.booking_reference == "BSH-2026-DEMO01")
            )
            if not b1_res.scalar_one_or_none():
                b1 = Booking(
                    booking_reference="BSH-2026-DEMO01",
                    room_type_id=rt.id,
                    customer_id=cust1.id,
                    guest_name=cust1.name,
                    guest_phone=cust1.phone,
                    guest_email=cust1.email,
                    check_in_date=today,
                    check_out_date=today + timedelta(days=2),
                    num_rooms=1,
                    num_guests=2,
                    base_amount=Decimal("3600.00"),
                    tax_amount=Decimal("432.00"),
                    total_amount=Decimal("4032.00"),
                    advance_paid=Decimal("1000.00"),
                    payment_status="partial",
                    booking_status="confirmed",
                    source="website",
                    special_requests="Arriving around 2 PM for pilgrimage to Vrindavan",
                )
                b2 = Booking(
                    booking_reference="BSH-2026-DEMO02",
                    room_type_id=rt.id,
                    customer_id=cust2.id,
                    guest_name=cust2.name,
                    guest_phone=cust2.phone,
                    check_in_date=today + timedelta(days=3),
                    check_out_date=today + timedelta(days=5),
                    num_rooms=1,
                    num_guests=2,
                    base_amount=Decimal("3600.00"),
                    tax_amount=Decimal("432.00"),
                    total_amount=Decimal("4032.00"),
                    advance_paid=Decimal("0.00"),
                    payment_status="unpaid",
                    booking_status="pending",
                    source="website",
                )
                db.add_all([b1, b2])
                await db.flush()

            # Demo Orders
            m_items = (await db.execute(select(MenuItem).limit(3))).scalars().all()
            o1_res = await db.execute(
                select(Order).where(Order.order_reference == "ORD-2026-DEMO01")
            )
            if m_items and not o1_res.scalar_one_or_none():
                o1 = Order(
                    order_reference="ORD-2026-DEMO01",
                    customer_id=cust1.id,
                    customer_name=cust1.name,
                    customer_phone=cust1.phone,
                    order_type="dine-in",
                    table_number="T-04",
                    subtotal=Decimal("530.00"),
                    tax_amount=Decimal("26.50"),
                    delivery_fee=Decimal("0.00"),
                    total_amount=Decimal("556.50"),
                    status="preparing",
                    payment_status="paid",
                    payment_mode="upi",
                    kitchen_notes="Make paneer tikka extra crispy with lemon slices",
                )
                db.add(o1)
                await db.flush()

                for it in m_items:
                    db.add(
                        OrderItem(
                            order_id=o1.id,
                            menu_item_id=it.id,
                            item_name=it.name,
                            quantity=1,
                            unit_price=it.price,
                            total_price=it.price,
                        )
                    )

            # Demo Reviews
            r_res = await db.execute(select(Review).limit(1))
            if not r_res.scalar_one_or_none():
                r1 = Review(
                    guest_name="Rajesh Gupta",
                    guest_city="Delhi",
                    rating=5,
                    title="Exceptional Pure Veg Dining & Comfortable Stay!",
                    comment="Stayed here during Janmashtami pilgrimage. The rooms were spotless, AC was chilled, and Delicee's Dal Makhani and Butter Naan were outstanding. Will definitely return!",
                    review_type="hotel",
                    status="approved",
                    is_featured=True,
                )
                r2 = Review(
                    guest_name="Pooja Agrawal",
                    guest_city="Mathura",
                    rating=5,
                    title="Best family restaurant on NH-2 highway",
                    comment="Celebrated my daughter's birthday at Delicee. The staff took great care of our guests and the Paneer Tikka was freshest in town.",
                    review_type="restaurant",
                    status="approved",
                    is_featured=True,
                )
                db.add_all([r1, r2])

            # Demo Enquiry
            e_res = await db.execute(
                select(Enquiry).where(Enquiry.enquiry_reference == "ENQ-2026-DEMO01")
            )
            if not e_res.scalar_one_or_none():
                enq = Enquiry(
                    enquiry_reference="ENQ-2026-DEMO01",
                    customer_name="Sanjay Aggarwal",
                    customer_phone="+919833445566",
                    customer_email="sanjay@example.com",
                    event_type="ring",
                    event_date=today + timedelta(days=25),
                    guest_count=120,
                    budget=Decimal("75000.00"),
                    message="Planning engagement ring ceremony for 120 guests with evening tea and dinner buffet.",
                    status="new",
                )
                db.add(enq)
            await db.commit()

    print("[SUCCESS] Database seeding finished successfully!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed database for B.S. Hotel & Restaurant")
    parser.add_argument(
        "--demo", action="store_true", help="Seed interactive demo bookings, orders and reviews"
    )
    args = parser.parse_args()
    asyncio.run(seed_database(demo=args.demo))
