"""initial_schema

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-11-05 21:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # 1. Enable required PostgreSQL extensions
    if is_postgres:
        op.execute('CREATE EXTENSION IF NOT EXISTS "btree_gist";')
        op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
        op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto";')

    # 2. settings table
    op.create_table(
        'settings',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('hotel_name', sa.String(length=100), nullable=False),
        sa.Column('restaurant_name', sa.String(length=100), nullable=False),
        sa.Column('tagline', sa.String(length=255), nullable=True),
        sa.Column('bookings_phone', sa.String(length=20), nullable=False),
        sa.Column('payments_phone', sa.String(length=20), nullable=False),
        sa.Column('whatsapp_number', sa.String(length=20), nullable=False),
        sa.Column('email', sa.String(length=100), nullable=False),
        sa.Column('address', sa.Text(), nullable=False),
        sa.Column('city', sa.String(length=50), nullable=False),
        sa.Column('state', sa.String(length=50), nullable=False),
        sa.Column('pincode', sa.String(length=10), nullable=False),
        sa.Column('gstin', sa.String(length=20), nullable=True),
        sa.Column('fssai_license', sa.String(length=30), nullable=True),
        sa.Column('check_in_time', sa.String(length=10), nullable=False),
        sa.Column('check_out_time', sa.String(length=10), nullable=False),
        sa.Column('room_tax_percent', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('restaurant_tax_percent', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('delivery_charge', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('free_delivery_above', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('min_delivery_order', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('is_online_ordering_enabled', sa.Boolean(), nullable=False, default=True),
        sa.Column('is_room_booking_enabled', sa.Boolean(), nullable=False, default=True),
    )

    # 3. users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('email', sa.String(length=100), unique=True, index=True, nullable=False),
        sa.Column('phone', sa.String(length=20), unique=True, index=True, nullable=False),
        sa.Column('full_name', sa.String(length=100), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('force_password_change', sa.Boolean(), nullable=False, default=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reset_password_token', sa.String(length=255), nullable=True),
        sa.Column('reset_password_expires_at', sa.DateTime(timezone=True), nullable=True),
    )

    # 4. refresh_tokens table
    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('token_hash', sa.String(length=64), unique=True, index=True, nullable=False),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_revoked', sa.Boolean(), nullable=False, default=False),
    )

    # 5. customers table
    op.create_table(
        'customers',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('phone', sa.String(length=20), unique=True, index=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=100), unique=True, index=True, nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('total_bookings_count', sa.Integer(), nullable=False, default=0),
        sa.Column('total_orders_count', sa.Integer(), nullable=False, default=0),
        sa.Column('total_spent', sa.Numeric(precision=12, scale=2), nullable=False, default=0),
        sa.Column('is_vip', sa.Boolean(), nullable=False, default=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('hashed_password', sa.String(length=255), nullable=True),
        sa.CheckConstraint('total_spent >= 0', name='ck_customers_total_spent_positive'),
        sa.CheckConstraint('total_bookings_count >= 0', name='ck_customers_bookings_count_positive'),
        sa.CheckConstraint('total_orders_count >= 0', name='ck_customers_orders_count_positive'),
    )

    # 6. room_types table
    op.create_table(
        'room_types',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('slug', sa.String(length=100), unique=True, index=True, nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('base_price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('max_guests', sa.Integer(), nullable=False, default=2),
        sa.Column('bed_type', sa.String(length=50), nullable=False, default='King Bed'),
        sa.Column('size_sqft', sa.Integer(), nullable=True),
        sa.Column('amenities', sa.JSON(), nullable=True),
        sa.Column('images', sa.JSON(), nullable=True),
        sa.Column('total_inventory', sa.Integer(), nullable=False, default=1),
        sa.Column('display_order', sa.Integer(), nullable=False, default=0),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.CheckConstraint('base_price >= 0', name='ck_room_types_base_price_positive'),
        sa.CheckConstraint('max_guests > 0', name='ck_room_types_max_guests_positive'),
        sa.CheckConstraint('total_inventory > 0', name='ck_room_types_total_inventory_positive'),
    )

    # 7. rooms table
    op.create_table(
        'rooms',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('room_number', sa.String(length=20), unique=True, index=True, nullable=False),
        sa.Column('room_type_id', sa.String(length=36), sa.ForeignKey('room_types.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('floor', sa.Integer(), nullable=False, default=1),
        sa.Column('status', sa.String(length=20), nullable=False, default='available'),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('notes', sa.Text(), nullable=True),
    )

    # 8. blocked_dates table
    op.create_table(
        'blocked_dates',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('room_type_id', sa.String(length=36), sa.ForeignKey('room_types.id', ondelete='CASCADE'), index=True, nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False, index=True),
        sa.Column('end_date', sa.Date(), nullable=False, index=True),
        sa.Column('reason', sa.String(length=255), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.CheckConstraint('end_date >= start_date', name='ck_blocked_dates_range'),
    )

    # 9. pricing_rules table
    op.create_table(
        'pricing_rules',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('room_type_id', sa.String(length=36), sa.ForeignKey('room_types.id', ondelete='CASCADE'), index=True, nullable=True),
        sa.Column('label', sa.String(length=100), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False, index=True),
        sa.Column('end_date', sa.Date(), nullable=False, index=True),
        sa.Column('rule_type', sa.String(length=30), nullable=False, default='override_price'),
        sa.Column('price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('days_of_week', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.CheckConstraint('end_date >= start_date', name='ck_pricing_rules_date_range'),
        sa.CheckConstraint('price >= 0', name='ck_pricing_rules_price_positive'),
    )

    # 10. bookings table
    op.create_table(
        'bookings',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('booking_reference', sa.String(length=30), unique=True, index=True, nullable=False),
        sa.Column('room_type_id', sa.String(length=36), sa.ForeignKey('room_types.id'), index=True, nullable=False),
        sa.Column('assigned_room_id', sa.String(length=36), sa.ForeignKey('rooms.id'), index=True, nullable=True),
        sa.Column('customer_id', sa.String(length=36), sa.ForeignKey('customers.id'), index=True, nullable=True),
        sa.Column('guest_name', sa.String(length=100), nullable=False),
        sa.Column('guest_phone', sa.String(length=20), index=True, nullable=False),
        sa.Column('guest_email', sa.String(length=100), nullable=True),
        sa.Column('check_in_date', sa.Date(), nullable=False, index=True),
        sa.Column('check_out_date', sa.Date(), nullable=False, index=True),
        sa.Column('num_rooms', sa.Integer(), nullable=False, default=1),
        sa.Column('num_guests', sa.Integer(), nullable=False, default=1),
        sa.Column('num_children', sa.Integer(), nullable=False, default=0),
        sa.Column('base_amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('tax_amount', sa.Numeric(precision=10, scale=2), nullable=False, default=0),
        sa.Column('total_amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('advance_paid', sa.Numeric(precision=10, scale=2), nullable=False, default=0),
        sa.Column('payment_status', sa.String(length=20), nullable=False, default='unpaid', index=True),
        sa.Column('booking_status', sa.String(length=20), nullable=False, default='pending', index=True),
        sa.Column('cancellation_reason', sa.Text(), nullable=True),
        sa.Column('source', sa.String(length=20), nullable=False, default='website'),
        sa.Column('special_requests', sa.Text(), nullable=True),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('id_proof_type', sa.String(length=50), nullable=True),
        sa.Column('id_proof_number', sa.String(length=50), nullable=True),
        sa.CheckConstraint('check_out_date > check_in_date', name='ck_bookings_date_range'),
        sa.CheckConstraint('num_rooms > 0', name='ck_bookings_num_rooms_positive'),
        sa.CheckConstraint('num_guests > 0', name='ck_bookings_num_guests_positive'),
        sa.CheckConstraint('total_amount >= 0', name='ck_bookings_total_amount_positive'),
        sa.CheckConstraint('advance_paid >= 0', name='ck_bookings_advance_paid_positive'),
    )
    op.create_index(
        'ix_bookings_availability_lookup',
        'bookings',
        ['room_type_id', 'check_in_date', 'check_out_date', 'booking_status'],
    )

    # 11. booking_history table
    op.create_table(
        'booking_history',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('booking_id', sa.String(length=36), sa.ForeignKey('bookings.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('from_status', sa.String(length=20), nullable=False),
        sa.Column('to_status', sa.String(length=20), nullable=False),
        sa.Column('changed_by_user_id', sa.String(length=36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
    )

    # 12. menu_categories table
    op.create_table(
        'menu_categories',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('name_hi', sa.String(length=100), nullable=True),
        sa.Column('slug', sa.String(length=100), unique=True, index=True, nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, default=0, index=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True, index=True),
    )

    # 13. menu_items table
    op.create_table(
        'menu_items',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('category_id', sa.String(length=36), sa.ForeignKey('menu_categories.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('name_hi', sa.String(length=150), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('is_veg', sa.Boolean(), nullable=False, default=True),
        sa.Column('spicy_level', sa.Integer(), nullable=False, default=0),
        sa.Column('is_available', sa.Boolean(), nullable=False, default=True, index=True),
        sa.Column('is_bestseller', sa.Boolean(), nullable=False, default=False),
        sa.Column('image_url', sa.String(length=500), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, default=0),
        sa.CheckConstraint('price >= 0', name='ck_menu_items_price_positive'),
    )
    op.create_index(
        'ix_menu_items_cat_avail_order',
        'menu_items',
        ['category_id', 'is_available', 'display_order'],
    )

    # 14. orders table
    op.create_table(
        'orders',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('order_reference', sa.String(length=30), unique=True, index=True, nullable=False),
        sa.Column('customer_id', sa.String(length=36), sa.ForeignKey('customers.id'), index=True, nullable=True),
        sa.Column('customer_name', sa.String(length=100), nullable=False),
        sa.Column('customer_phone', sa.String(length=20), index=True, nullable=False),
        sa.Column('customer_email', sa.String(length=100), nullable=True),
        sa.Column('order_type', sa.String(length=20), nullable=False, default='dine-in', index=True),
        sa.Column('table_number', sa.String(length=20), nullable=True),
        sa.Column('delivery_address', sa.Text(), nullable=True),
        sa.Column('subtotal', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('tax_amount', sa.Numeric(precision=10, scale=2), nullable=False, default=0),
        sa.Column('delivery_fee', sa.Numeric(precision=10, scale=2), nullable=False, default=0),
        sa.Column('discount_amount', sa.Numeric(precision=10, scale=2), nullable=False, default=0),
        sa.Column('total_amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('status', sa.String(length=25), nullable=False, default='new', index=True),
        sa.Column('payment_status', sa.String(length=20), nullable=False, default='unpaid', index=True),
        sa.Column('payment_mode', sa.String(length=20), nullable=True),
        sa.Column('cancellation_reason', sa.Text(), nullable=True),
        sa.Column('kitchen_notes', sa.Text(), nullable=True),
        sa.Column('estimated_prep_minutes', sa.Integer(), nullable=False, default=25),
        sa.CheckConstraint('total_amount >= 0', name='ck_orders_total_amount_positive'),
        sa.CheckConstraint('subtotal >= 0', name='ck_orders_subtotal_positive'),
        sa.CheckConstraint('tax_amount >= 0', name='ck_orders_tax_positive'),
    )
    op.create_index(
        'ix_orders_status_created_at',
        'orders',
        ['status', 'created_at'],
    )

    # 15. order_items table
    op.create_table(
        'order_items',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('order_id', sa.String(length=36), sa.ForeignKey('orders.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('menu_item_id', sa.String(length=36), sa.ForeignKey('menu_items.id'), nullable=False),
        sa.Column('item_name', sa.String(length=150), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, default=1),
        sa.Column('unit_price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('total_price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('special_instructions', sa.Text(), nullable=True),
        sa.CheckConstraint('quantity > 0', name='ck_order_items_quantity_positive'),
        sa.CheckConstraint('unit_price >= 0', name='ck_order_items_unit_price_positive'),
        sa.CheckConstraint('total_price >= 0', name='ck_order_items_total_price_positive'),
    )

    # 16. payments table
    op.create_table(
        'payments',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('payment_reference', sa.String(length=30), unique=True, index=True, nullable=False),
        sa.Column('booking_id', sa.String(length=36), sa.ForeignKey('bookings.id', ondelete='CASCADE'), index=True, nullable=True),
        sa.Column('order_id', sa.String(length=36), sa.ForeignKey('orders.id', ondelete='CASCADE'), index=True, nullable=True),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False, default='INR'),
        sa.Column('mode', sa.String(length=20), nullable=False, default='cash'),
        sa.Column('status', sa.String(length=20), nullable=False, default='completed', index=True),
        sa.Column('payment_type', sa.String(length=20), nullable=False, default='full'),
        sa.Column('transaction_id', sa.String(length=100), nullable=True),
        sa.Column('gateway_order_id', sa.String(length=100), nullable=True),
        sa.Column('gateway_payment_id', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('recorded_by_user_id', sa.String(length=36), sa.ForeignKey('users.id'), nullable=True),
        sa.CheckConstraint('amount >= 0', name='ck_payments_amount_positive'),
    )

    # 17. enquiries table
    op.create_table(
        'enquiries',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('enquiry_reference', sa.String(length=30), unique=True, index=True, nullable=False),
        sa.Column('customer_name', sa.String(length=100), nullable=False),
        sa.Column('customer_phone', sa.String(length=20), index=True, nullable=False),
        sa.Column('customer_email', sa.String(length=100), nullable=True),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('event_date', sa.Date(), nullable=True),
        sa.Column('guest_count', sa.Integer(), nullable=True),
        sa.Column('budget', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, default='new', index=True),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('assigned_to_user_id', sa.String(length=36), sa.ForeignKey('users.id'), nullable=True),
    )

    # 18. event_packages table
    op.create_table(
        'event_packages',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('slug', sa.String(length=100), unique=True, index=True, nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('price_per_plate', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('min_guests', sa.Integer(), nullable=False, default=50),
        sa.Column('max_guests', sa.Integer(), nullable=False, default=500),
        sa.Column('features', sa.JSON(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, default=0),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True, index=True),
        sa.CheckConstraint('price_per_plate >= 0', name='ck_event_packages_price_positive'),
        sa.CheckConstraint('min_guests > 0', name='ck_event_packages_min_guests_positive'),
    )

    # 19. reviews table
    op.create_table(
        'reviews',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('guest_name', sa.String(length=100), nullable=False),
        sa.Column('guest_city', sa.String(length=50), nullable=True),
        sa.Column('rating', sa.Integer(), nullable=False, index=True),
        sa.Column('title', sa.String(length=150), nullable=True),
        sa.Column('comment', sa.Text(), nullable=False),
        sa.Column('review_type', sa.String(length=20), nullable=False, default='hotel', index=True),
        sa.Column('status', sa.String(length=20), nullable=False, default='pending', index=True),
        sa.Column('is_featured', sa.Boolean(), nullable=False, default=False),
        sa.Column('approved_by_user_id', sa.String(length=36), sa.ForeignKey('users.id'), nullable=True),
        sa.CheckConstraint('rating >= 1 AND rating <= 5', name='ck_reviews_rating_range'),
    )
    op.create_index(
        'ix_reviews_status_created_at',
        'reviews',
        ['status', 'created_at'],
    )

    # 20. audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id'), index=True, nullable=True),
        sa.Column('user_name', sa.String(length=100), nullable=True),
        sa.Column('user_role', sa.String(length=20), nullable=True),
        sa.Column('action', sa.String(length=50), nullable=False, index=True),
        sa.Column('entity_type', sa.String(length=50), nullable=False, index=True),
        sa.Column('entity_id', sa.String(length=100), nullable=False, index=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
    )
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])

    # 21. notifications table
    op.create_table(
        'notifications',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=30), nullable=False, default='system'),
        sa.Column('reference_id', sa.String(length=100), nullable=True),
        sa.Column('for_role', sa.String(length=20), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, default=False),
    )


def downgrade() -> None:
    tables = [
        'notifications', 'audit_logs', 'reviews', 'event_packages', 'enquiries',
        'payments', 'order_items', 'orders', 'menu_items', 'menu_categories',
        'booking_history', 'bookings', 'pricing_rules', 'blocked_dates', 'rooms',
        'room_types', 'customers', 'refresh_tokens', 'users', 'settings',
    ]
    for table in tables:
        op.drop_table(table)

