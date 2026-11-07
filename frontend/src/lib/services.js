// Public submission layer. Every request is stored in the database by the admin
// dashboard; WhatsApp stays available as an optional extra button, never the only path.
import { inr, makeRef, openWhatsApp } from '@/lib/whatsapp';
import { createBookingRequest, createOrder, createEnquiry, createContactMessage } from '@/lib/publicApi';
import { ORDER_CONFIG } from '@/data/site';

export function bookingMessage(b) {
  const isUpi = b.payment_mode === 'upi_qr';
  return [
    `*Room Booking Request* (Ref: ${b.ref})`,
    `Name: ${b.name}`,
    `Phone: ${b.phone}`,
    b.email ? `Email: ${b.email}` : null,
    `Room: ${b.roomName}`,
    `Check-in: ${b.checkIn}`,
    `Check-out: ${b.checkOut} (${b.nights} night${b.nights > 1 ? 's' : ''})`,
    `Guests: ${b.guests}`,
    b.amount ? `Total Amount: ₹${Number(b.amount).toLocaleString('en-IN')}` : null,
    isUpi ? `\n*UPI Payment Proof (PhonePe):*` : `Payment Mode: Pay at Hotel desk`,
    isUpi && b.payment_utr ? `UTR No: ${b.payment_utr}` : null,
    isUpi && b.payment_name ? `Payer Name: ${b.payment_name}` : null,
    isUpi && b.payment_screenshot ? `Screenshot: Attached in booking` : null,
    b.special ? `\nSpecial Requests: ${b.special}` : null,
  ].filter(Boolean).join('\n');
}

export async function submitBooking(data) {
  const created = await createBookingRequest({
    guest_name: data.name,
    phone: data.phone,
    email: data.email,
    room_type_id: data.room,
    room_type_name: data.roomName,
    check_in: data.checkIn,
    check_out: data.checkOut,
    guests: data.guests,
    special_requests: data.special,
    amount: data.amount,
    payment_mode: data.payment_mode,
    payment_utr: data.payment_utr,
    payment_name: data.payment_name,
    payment_screenshot: data.payment_screenshot,
  });
  return created;
}

export function orderMessage(o) {
  const lines = (o.items || []).map((i, n) => `${n + 1}. ${i.name} x${i.qty} = ${inr(i.qty * i.price)}${i.note ? ` (${i.note})` : ''}`);
  const isUpi = o.payment_mode === 'upi_qr' || o.payment_mode === 'upi';

  return [
    `*Food Order* (Ref: ${o.ref})`,
    ...lines,
    `Subtotal: ${inr(o.subtotal)}`,
    o.delivery ? `Delivery charge: ${inr(o.delivery)}` : null,
    o.tax ? `Tax: ${inr(o.tax)}` : null,
    `*Total: ${inr(o.total)}*`,
    `Order type: ${o.type}${o.table ? ` (Table ${o.table})` : ''}`,
    o.address ? `Address: ${o.address}` : null,
    o.delivery_landmark ? `Landmark: ${o.delivery_landmark}` : null,
    o.delivery_distance_km ? `Distance: ~${Number(o.delivery_distance_km).toFixed(2)} km (Within 1 km delivery radius)` : null,
    `Name: ${o.customer_name || o.name}`,
    `Phone: ${o.phone}`,
    isUpi ? `*Payment:* PhonePe UPI QR (Submitted)` : `*Payment:* ${o.type === 'delivery' || o.type === 'Delivery' ? 'Cash on Delivery' : 'Pay at Restaurant'}`,
    isUpi && o.payment_utr ? `UTR No: ${o.payment_utr}` : null,
    isUpi && o.payment_name ? `Payer Name: ${o.payment_name}` : null,
    isUpi && o.payment_screenshot ? `Payment Screenshot: Attached` : null,
    o.notes ? `Notes: ${o.notes}` : null,
  ].filter(Boolean).join('\n');
}

export function computeTotals(subtotal, type, config = ORDER_CONFIG) {
  const delivery = type === 'Delivery' || type === 'delivery' ? config.deliveryCharge : 0;
  const tax = Math.round((subtotal * config.taxPercent) / 100);
  return { delivery, tax, total: subtotal + delivery + tax };
}

const TYPE_MAP = { 'Dine-in': 'dine-in', Pickup: 'pickup', Delivery: 'delivery' };

export async function submitOrder(data) {
  const created = await createOrder({
    customer_name: data.name,
    phone: data.phone,
    type: TYPE_MAP[data.type] || 'dine-in',
    table_no: data.table,
    address: data.address,
    items: (data.items || []).map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, note: i.note })),
    notes: data.notes,
    payment_mode: data.payment_mode || 'cash',
    payment_utr: data.payment_utr || null,
    payment_name: data.payment_name || null,
    payment_screenshot: data.payment_screenshot || null,
    delivery_lat: data.delivery_lat || null,
    delivery_lng: data.delivery_lng || null,
    delivery_distance_km: data.delivery_distance_km || null,
    delivery_landmark: data.delivery_landmark || null,
  });
  return {
    ...created,
    name: data.name,
    customer_name: data.name,
    phone: data.phone,
    type: data.type,
    table: data.table,
    address: data.address,
    items: data.items,
    subtotal: data.subtotal,
    delivery: data.delivery,
    tax: data.tax,
    total: data.total,
    payment_mode: data.payment_mode,
    payment_utr: data.payment_utr,
    payment_name: data.payment_name,
    payment_screenshot: data.payment_screenshot,
    delivery_distance_km: data.delivery_distance_km,
    delivery_landmark: data.delivery_landmark,
    notes: data.notes,
  };
}

export function enquiryMessage(e) {
  return [
    `*Event Enquiry* (Ref: ${e.ref})`,
    `Event: ${e.eventType}`,
    `Name: ${e.name}`,
    `Phone: ${e.phone}`,
    e.date ? `Date: ${e.date}` : null,
    e.guests ? `Expected guests: ${e.guests}` : null,
    e.message ? `Message: ${e.message}` : null,
  ].filter(Boolean).join('\n');
}

export async function submitEnquiry(data) {
  const created = await createEnquiry(data);
  return { ...data, ref: created.ref, id: created.id };
}

export async function submitContact(data) {
  const created = await createContactMessage(data);
  return { ...data, ref: created.ref };
}

export { makeRef, openWhatsApp };