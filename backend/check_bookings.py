import asyncio
from app.db.session import async_session_maker
from sqlalchemy import select
from app.models.booking import Booking

async def main():
    async with async_session_maker() as session:
        res = await session.execute(select(Booking))
        bookings = res.scalars().all()
        print(f"Total bookings in DB: {len(bookings)}")
        for b in bookings:
            print(f"- Ref: {b.booking_reference}, Name: {b.guest_name}, Status: {b.booking_status}, Dates: {b.check_in_date} to {b.check_out_date}")

if __name__ == '__main__':
    asyncio.run(main())

