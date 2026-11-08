// Shared data helpers for the admin dashboard.
// All access goes through the entity SDK; the platform's row-level rules decide
// who may read or write each table (owner = app role "admin", staff = staff_role).
import { apiClient } from '@/api/apiClient';

// Only confirmed and checked_in bookings lock inventory; pending are requests awaiting confirmation
export const BLOCKING = ['confirmed', 'checked_in'];

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const money = (n) => Number(n || 0);

export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const nightsBetween = (a, b) =>
  Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));

export const PERMS = {
  owner: ['*'],
  manager: ['overview', 'bookings', 'orders', 'rooms', 'menu', 'reviews', 'enquiries', 'customers', 'reports'],
  staff: ['overview', 'bookings', 'orders'],
};

export function can(me, area) {
  if (!me?.allowed) return false;
  const list = PERMS[me.staff_role] || [];
  return list.includes('*') || list.includes(area);
}

export const BOOKING_STATUS = {
  pending: { en: 'Pending', hi: 'प्रतीक्षारत', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  confirmed: { en: 'Confirmed', hi: 'कन्फ़र्म', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  checked_in: { en: 'Checked in', hi: 'चेक-इन', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  checked_out: { en: 'Checked out', hi: 'चेक-आउट', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  cancelled: { en: 'Cancelled', hi: 'रद्द', cls: 'bg-red-100 text-red-700 border-red-200' },
  no_show: { en: 'No show', hi: 'नहीं आए', cls: 'bg-red-100 text-red-700 border-red-200' },
  failed: { en: 'Unavailable / Failed', hi: 'अनुपलब्ध / विफल', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
};

export const ORDER_STATUS = {
  new: { en: 'New', hi: 'नया', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  accepted: { en: 'Accepted', hi: 'स्वीकृत', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  preparing: { en: 'Preparing', hi: 'बन रहा है', cls: 'bg-violet-100 text-violet-800 border-violet-200' },
  ready: { en: 'Ready', hi: 'तैयार', cls: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  out_for_delivery: { en: 'Out for delivery', hi: 'डिलीवरी पर', cls: 'bg-pink-100 text-pink-800 border-pink-200' },
  served: { en: 'Served', hi: 'परोसा', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  completed: { en: 'Completed', hi: 'पूर्ण', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelled: { en: 'Cancelled', hi: 'रद्द', cls: 'bg-red-100 text-red-700 border-red-200' },
};

export const ENQUIRY_STATUS = {
  new: { en: 'New', hi: 'नया', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  contacted: { en: 'Contacted', hi: 'संपर्क हुआ', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  quote_sent: { en: 'Quote sent', hi: 'कोटेशन भेजा', cls: 'bg-violet-100 text-violet-800 border-violet-200' },
  confirmed: { en: 'Confirmed', hi: 'कन्फ़र्म', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  lost: { en: 'Lost', hi: 'खोया', cls: 'bg-red-100 text-red-700 border-red-200' },
};

export const ORDER_TYPES = {
  'dine-in': { en: 'Dine-in', hi: 'डाइन-इन' },
  pickup: { en: 'Pickup', hi: 'पिकअप' },
  delivery: { en: 'Delivery', hi: 'डिलीवरी' },
};

export const ROOM_STATUS = {
  available: { en: 'Available', hi: 'खाली', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  occupied: { en: 'Occupied', hi: 'भरा हुआ', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  cleaning: { en: 'Cleaning', hi: 'सफ़ाई', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  maintenance: { en: 'Maintenance', hi: 'मरम्मत', cls: 'bg-red-100 text-red-700 border-red-200' },
};

export const SESSIONS = ['cash', 'upi', 'card', 'online'];

/** The settings record is a singleton; create it on first save. */
export async function getSettings() {
  const rows = await apiClient.entities.Setting.list().catch(() => []);
  const list = Array.isArray(rows) ? rows : [];
  return list[0] || null;
}

export async function saveSettings(id, values) {
  if (id) return apiClient.entities.Setting.update(id, values);
  return apiClient.entities.Setting.create(values);
}

/**
 * Client-side availability guard.
 * Reads only the nights that overlap this stay and compares with the room count.
 * NOTE: without a backend function this cannot be truly atomic — the dashboard
 * still shows every pending request so a clash is caught before confirming.
 */
export async function checkAvailability(roomTypeId, checkIn, checkOut, excludeId = '') {
  const type = (await apiClient.entities.RoomType.filter({ id: roomTypeId }, { limit: 1 })).items[0];
  if (!type) return { available: 0, total: 0, error: 'Room type not found', is_available: false, available_dates: [], booked_dates: [] };
  const booked = (await apiClient.entities.Booking.filter({
    room_type_id: roomTypeId,
    status: { $in: BLOCKING },
    check_in: { $lt: checkOut },
    check_out: { $gt: checkIn },
  }, { limit: 100 })).items;
  const overlap = booked.filter((b) => b.id !== excludeId);
  const blocks = (await apiClient.entities.BlockedDate.filter({
    room_type_id: roomTypeId,
    start_date: { $lt: checkOut },
    end_date: { $gt: checkIn },
  }, { limit: 50 })).items.filter((b) => !b.room_id);
  const total = Number(type.total_rooms ?? type.total_inventory) || 1;

  // Night-by-night breakdown
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const totalNights = Math.max(1, Math.round((end - start) / 86400000));
  const availableDates = [];
  const bookedDates = [];
  let minAvail = total;

  for (let i = 0; i < totalNights; i++) {
    const cur = new Date(start.getTime() + i * 86400000);
    const curIso = cur.toISOString().slice(0, 10);
    const isBlocked = blocks.some((b) => b.start_date <= curIso && b.end_date > curIso);
    let availOnNight = 0;
    if (!isBlocked) {
      const bookedOnNight = overlap.filter((b) => b.check_in <= curIso && b.check_out > curIso).length;
      availOnNight = Math.max(0, total - bookedOnNight);
    }
    minAvail = Math.min(minAvail, availOnNight);
    if (availOnNight > 0) {
      availableDates.push(curIso);
    } else {
      bookedDates.push(curIso);
    }
  }

  return {
    type,
    total,
    booked: overlap.length,
    blocked: blocks.length,
    available: minAvail,
    is_available: bookedDates.length === 0,
    available_dates: availableDates,
    booked_dates: bookedDates,
  };
}

export async function rateForStay(roomTypeId, checkIn, basePrice) {
  try {
    const rules = (await apiClient.entities.PricingRule.filter({
      room_type_id: roomTypeId, start_date: { $lte: checkIn }, end_date: { $gte: checkIn },
    }, { limit: 10 })).items;
    return rules.length ? money(rules[0].price) : money(basePrice);
  } catch {
    return money(basePrice);
  }
}

export async function audit(me, action, area, entity, recordId, summary) {
  try {
    await apiClient.entities.AuditLog.create({
      actor_email: me?.email || 'unknown',
      actor_role: me?.staff_role || 'unknown',
      action, area, entity, record_id: String(recordId || ''), summary,
    });
  } catch { /* logging must never block the action */ }
}

/** Build the customer book from bookings + orders (always up to date). */
export function deriveCustomers(bookings, orders) {
  const map = new Map();
  const touch = (name, phone, spend, isFailed = false, failInfo = null) => {
    const key = String(phone || '').replace(/\D/g, '').slice(-10);
    if (!key) return;
    const row = map.get(key) || {
      name,
      phone: key,
      visits: 0,
      orders_count: 0,
      total_spend: 0,
      last_visit: '',
      has_failed: false,
      failed_attempts: [],
    };
    row.name = name || row.name;
    if (isFailed) {
      row.has_failed = true;
      if (failInfo) row.failed_attempts.push(failInfo);
    } else {
      row.visits += 1;
      row.total_spend += money(spend);
    }
    map.set(key, row);
  };
  bookings.forEach((b) => {
    const isFailed = (b.status === 'failed' || b.booking_status === 'failed');
    const failInfo = isFailed ? {
      date: b.created_date || b.created_at,
      room_type: b.room_type_name,
      check_in: b.check_in,
      check_out: b.check_out,
      reason: b.cancellation_reason || b.admin_notes,
    } : null;
    touch(b.guest_name, b.phone || b.guest_phone, b.amount || b.total_amount, isFailed, failInfo);
  });
  orders.forEach((o) => { touch(o.customer_name, o.phone, o.total); });
  return [...map.values()].sort((a, b) => b.total_spend - a.total_spend);
}

export function downloadCsv(filename, rows, columns) {
  const head = columns.map((c) => `"${c.label}"`).join(',');
  const body = rows.map((r) => columns.map((c) => `"${String(c.value(r) ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([`${head}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/** Printable documents (invoice, KOT, bill) — the browser's Save as PDF is the PDF export. */
export function printHtml(title, body) {
  const w = window.open('', '_blank', 'width=780,height=900');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;padding:28px;max-width:680px;margin:auto}
      h1{font-size:20px;margin:0 0 2px} h2{font-size:15px;margin:22px 0 6px}
      .muted{color:#64748b;font-size:12px} table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}
      th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e2e8f0}
      td.r,th.r{text-align:right} .total{font-size:16px;font-weight:700}
      .tag{display:inline-block;border:1px solid #cbd5e1;border-radius:6px;padding:2px 8px;font-size:11px}
    </style></head><body>${body}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}

/** Clean special requests or notes of raw technical tags (base64 screenshots, UTR lines, etc.) */
export function cleanSpecialRequests(text) {
  if (!text) return '';
  return String(text)
    .replace(/\[PAYMENT_SCREENSHOT:\s*[^\]]+\]/gi, '')
    .replace(/data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=\s]+/gi, '')
    .replace(/\[PAYMENT:\s*[^\]]+\]/gi, '')
    .replace(/\[UTR:\s*[^\]]+\]/gi, '')
    .replace(/\[Payer:\s*[^\]]+\]/gi, '')
    .replace(/\[PhonePe UPI[^\]]*\]/gi, '')
    .replace(/^Requests:\s*/i, '')
    .replace(/^Notes:\s*/i, '')
    .replace(/^\|\s*|\s*\|\s*$/g, '')
    .trim();
}
