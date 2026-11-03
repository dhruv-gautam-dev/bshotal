// Public website ↔ database bridge.
// The site always reads the live menu, room types and packages from the database;
// the built-in data files are only a fallback for a brand-new app with no seed yet.
import { apiClient } from '@/api/apiClient';
import { MENU } from '@/data/menu';
import { ROOMS, AMENITIES } from '@/data/rooms';
import { SITE, ORDER_CONFIG, IMAGES } from '@/data/site';

const makeRef = (p) => `${p}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const nights = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));

export async function getPublicSettings() {
  try {
    const rows = await apiClient.entities.Setting.list();
    const s = (Array.isArray(rows) ? rows : [])[0];
    if (!s) return null;
    return {
      ...s,
      taxPercent: Number(s.tax_percent) || 0,
      deliveryCharge: Number(s.delivery_charge) || 0,
    };
  } catch {
    return null;
  }
}

export async function fetchMenu() {
  try {
    const [categories, items] = await Promise.all([
      apiClient.entities.MenuCategory.filter({ is_active: true }, { sort: 'sort', limit: 100 }),
      apiClient.entities.MenuItem.filter({}, { sort: 'sort', limit: 500 }),
    ]);
    if (!(categories.items || []).length) return MENU;
    const cats = categories.items.map((c) => ({
      id: c.id,
      name: { en: c.name_en, hi: c.name_hi || c.name_en },
      items: (items.items || [])
        .filter((i) => i.category_id === c.id && i.is_available !== false)
        .map((i) => ({
          id: i.id, name: i.name_en, price: Number(i.price) || 0, desc: i.desc || '',
          category: c.id, image: i.image_url || '', tags: i.tags || [],
        })),
    })).filter((c) => c.items.length);
    return cats.length ? cats : MENU;
  } catch {
    return MENU;
  }
}

export async function fetchRoomTypes() {
  try {
    const rows = await apiClient.entities.RoomType.filter({ is_active: true }, { sort: 'sort', limit: 50 });
    if (!(rows.items || []).length) return ROOMS;
    return rows.items.map((t, n) => ({
      id: t.id,
      name: { en: t.name_en, hi: t.name_hi || t.name_en },
      desc: { en: t.desc_en || '', hi: t.desc_hi || t.desc_en || '' },
      price: Number(t.price) || 0,
      capacity: Number(t.capacity) || 2,
      amenities: (t.amenities || []).filter((a) => AMENITIES[a]).length ? t.amenities : ['ac', 'wifi', 'tv'],
      images: (t.images || []).length ? t.images : [IMAGES.standard, IMAGES.deluxe][n % 2],
    }));
  } catch {
    return ROOMS;
  }
}

/** Public booking request — always saved as "pending" so the hotel confirms it. */
export async function createBookingRequest(data) {
  const room = (await apiClient.entities.RoomType.filter({ id: data.room_type_id }, { limit: 1 })).items[0];
  const n = nights(data.check_in, data.check_out);
  const amount = room ? Number(room.price) * Math.max(1, n) : Number(data.amount) || 0;
  const created = await apiClient.entities.Booking.create({
    ref: makeRef('RM'),
    guest_name: data.guest_name,
    phone: String(data.phone).replace(/\D/g, '').slice(-10),
    email: data.email || '',
    room_type_id: data.room_type_id || '',
    room_type_name: room?.name_en || data.room_type_name || '',
    check_in: data.check_in,
    check_out: data.check_out,
    nights: Math.max(1, n),
    guests: Number(data.guests) || 1,
    special_requests: data.special_requests || '',
    amount,
    advance_paid: 0,
    balance: amount,
    payment_mode: 'none',
    status: 'pending',
    source: 'website',
    history: [{ status: 'pending', at: new Date().toISOString(), by: 'website' }],
  });
  return { ...created, name: created.guest_name, roomName: created.room_type_name, checkIn: created.check_in, checkOut: created.check_out, special: created.special_requests };
}

/** Public order — prices are re-read from the menu so the browser cannot change them. */
export async function createOrder(data) {
  const ids = (data.items || []).map((i) => i.id).filter(Boolean);
  let trusted = [];
  if (ids.length) {
    const rows = await apiClient.entities.MenuItem.filter({ id: { $in: ids } }, { limit: 100 });
    const byId = Object.fromEntries((rows.items || []).map((r) => [r.id, r]));
    trusted = (data.items || []).map((i) => {
      const db = byId[i.id];
      return {
        item_id: i.id,
        name: db?.name_en || i.name,
        price: db ? Number(db.price) || 0 : Number(i.price) || 0,
        qty: Math.max(1, Number(i.qty) || 1),
        note: i.note || '',
      };
    });
  }
  const subtotal = trusted.reduce((s, i) => s + i.price * i.qty, 0);
  const settings = await getPublicSettings();
  const taxPercent = Number(settings?.taxPercent ?? ORDER_CONFIG.taxPercent) || 0;
  const deliveryCharge = Number(settings?.deliveryCharge ?? ORDER_CONFIG.deliveryCharge) || 0;
  const tax = Math.round((subtotal * taxPercent) / 100);
  const delivery = data.type === 'delivery' ? deliveryCharge : 0;
  const created = await apiClient.entities.Order.create({
    ref: makeRef('FD'),
    customer_name: data.customer_name,
    phone: String(data.phone).replace(/\D/g, '').slice(-10),
    type: data.type || 'dine-in',
    table_no: data.table_no || '',
    address: data.address || '',
    items: trusted,
    subtotal, tax, delivery, total: subtotal + tax + delivery,
    notes: data.notes || '',
    status: 'new',
    payment_status: 'unpaid',
    payment_mode: 'none',
    source: 'website',
  });
  return { ...created, items: trusted };
}

const ENQUIRY_TYPES = {
  'Ring Ceremony': 'ring', 'Birthday Party': 'birthday', 'Wedding': 'wedding',
  'Custom package / Catering': 'custom', 'Corporate Event': 'custom',
};

export async function createEnquiry(data) {
  const created = await apiClient.entities.Enquiry.create({
    ref: makeRef('EV'),
    type: ENQUIRY_TYPES[data.eventType] || 'custom',
    name: data.name,
    phone: String(data.phone).replace(/\D/g, '').slice(-10),
    email: data.email || '',
    event_date: data.date || '',
    guests: Number(data.guests) || 0,
    message: data.message || '',
    status: 'new',
    package_id: data.package_id || '',
  });
  return { ...created, ref: created.ref };
}

export async function createContactMessage(data) {
  return apiClient.entities.Enquiry.create({
    ref: makeRef('CT'),
    type: 'contact',
    name: data.name,
    phone: String(data.phone).replace(/\D/g, '').slice(-10),
    message: data.message,
    status: 'new',
  });
}

export const SITE_FALLBACK = SITE;