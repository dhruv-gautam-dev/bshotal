// Public website ↔ database bridge.
// All catalog data, pricing, bookings, orders, enquiries and reviews read & write directly to the database.
import { apiClient } from '@/api/apiClient';

export async function getPublicSettings() {
  try {
    const s = await apiClient.app.getPublicSettings();
    if (!s) return null;
    return {
      ...s,
      taxPercent: Number(s.tax_percent ?? s.restaurant_tax_percent ?? 5),
      roomTaxPercent: Number(s.room_tax_percent ?? 12),
      deliveryCharge: Number(s.delivery_charge ?? 40),
    };
  } catch {
    return null;
  }
}

export async function fetchMenu() {
  try {
    const res = await fetch('/api/v1/public/menu');
    if (!res.ok) return [];
    const categories = await res.json();
    if (!Array.isArray(categories)) return [];

    return categories.map((c) => ({
      id: c.id,
      name: { en: c.name, hi: c.name_hi || c.name },
      slug: c.slug,
      items: (c.items || [])
        .filter((i) => i.is_available !== false)
        .map((i) => ({
          id: i.id,
          name: i.name,
          name_en: i.name,
          name_hi: i.name_hi || '',
          price: Number(i.price) || 0,
          desc: i.description || '',
          category: c.id,
          image: i.image_url || '/images/food.png',
          tags: Array.isArray(i.tags) ? i.tags : [],
          is_veg: i.is_veg !== false,
          spicy_level: i.spicy_level || 0,
        })),
    })).filter((c) => c.items.length > 0);
  } catch (err) {
    console.error('Failed to load menu from database:', err);
    return [];
  }
}

export async function fetchRoomTypes() {
  try {
    const res = await fetch('/api/v1/public/rooms');
    if (!res.ok) return [];
    const roomTypes = await res.json();
    if (!Array.isArray(roomTypes)) return [];

    const defaultRoomImages = ['/images/standard.png', '/images/deluxe.png', '/images/family.png'];

    return roomTypes.map((t, idx) => ({
      id: t.id,
      name: { en: t.name, hi: t.name },
      name_en: t.name,
      desc: { en: t.description || '', hi: t.description || '' },
      price: Number(t.base_price) || 0,
      capacity: Number(t.max_guests) || 2,
      amenities: Array.isArray(t.amenities) && t.amenities.length ? t.amenities : ['Air Conditioning', 'Free High-Speed Wi-Fi', 'Geyser / Hot Water'],
      images: Array.isArray(t.images) && t.images.length ? t.images : [defaultRoomImages[idx % defaultRoomImages.length]],
      bed_type: t.bed_type || 'King Bed',
      total_inventory: t.total_inventory || 1,
    }));
  } catch (err) {
    console.error('Failed to load room types from database:', err);
    return [];
  }
}

export async function fetchEventPackages() {
  try {
    const res = await fetch('/api/v1/public/events/packages');
    if (!res.ok) return [];
    const packages = await res.json();
    if (!Array.isArray(packages)) return [];

    const defaultEventImages = ['/images/ring.png', '/images/birthday.png', '/images/wedding.png'];
    const eventValues = ['Ring Ceremony / Engagement', 'Birthday Party', 'Wedding'];

    return packages.map((p, idx) => {
      const lower = (p.name || '').toLowerCase();
      let img = defaultEventImages[idx % defaultEventImages.length];
      let val = eventValues[idx % eventValues.length];

      if (lower.includes('ring') || lower.includes('engagement')) {
        img = '/images/ring.png';
        val = 'Ring Ceremony / Engagement';
      } else if (lower.includes('birthday')) {
        img = '/images/birthday.png';
        val = 'Birthday Party';
      } else if (lower.includes('wedding') || lower.includes('marriage')) {
        img = '/images/wedding.png';
        val = 'Wedding';
      }

      return {
        id: p.id,
        title: p.name,
        name: { en: p.name, hi: p.name },
        value: val,
        slug: p.slug,
        desc: { en: p.description || '', hi: p.description || '' },
        description: p.description,
        price: Number(p.base_price_per_person) || 0,
        price_per_person: Number(p.base_price_per_person) || 0,
        capacity: `${p.min_guests || 50}–${p.max_guests || 500} guests`,
        min_guests: p.min_guests || 50,
        max_guests: p.max_guests || 500,
        includes: Array.isArray(p.features) && p.features.length ? p.features : (Array.isArray(p.includes) && p.includes.length ? p.includes : ['Banquet Hall', 'Stage Decor', 'Pure Veg Catering', 'Music & DJ']),
        image: img,
      };
    });
  } catch (err) {
    console.error('Failed to load event packages from database:', err);
    return [];
  }
}

/** Public booking request — creates booking row in Supabase and returns confirmation with WhatsApp URL */
export async function createBookingRequest(data) {
  const created = await apiClient.entities.Booking.create({
    room_type_id: data.room_type_id,
    guest_name: data.guest_name,
    phone: String(data.phone).replace(/\D/g, '').slice(-10),
    email: data.email || null,
    check_in: data.check_in,
    check_out: data.check_out,
    rooms: Number(data.rooms) || 1,
    guests: Number(data.guests) || 1,
    special_requests: data.special_requests || '',
  });

  return {
    ...created,
    ref: created.booking_reference || created.ref,
    name: data.guest_name,
    roomName: data.room_type_name || '',
    checkIn: data.check_in,
    checkOut: data.check_out,
    special: data.special_requests,
  };
}

/** Public food order — validates against menu and creates order row in Supabase */
export async function createOrder(data) {
  const items = (data.items || []).map((i) => ({
    id: i.id,
    qty: Math.max(1, Number(i.qty) || 1),
    note: i.note || '',
  }));

  const created = await apiClient.entities.Order.create({
    customer_name: data.customer_name,
    phone: String(data.phone).replace(/\D/g, '').slice(-10),
    email: data.email || null,
    type: data.type || 'dine-in',
    table_no: data.table_no || '',
    address: data.address || '',
    items,
    notes: data.notes || '',
  });

  return {
    ...created,
    ref: created.order_reference || created.ref,
    total: Number(created.total_amount || created.total || 0),
  };
}

const ENQUIRY_TYPES = {
  'Ring Ceremony': 'ring',
  'Birthday Party': 'birthday',
  'Wedding': 'wedding',
  'Custom package / Catering': 'custom',
  'Corporate Event': 'custom',
};

export async function createEnquiry(data) {
  const created = await apiClient.entities.Enquiry.create({
    name: data.name,
    phone: String(data.phone).replace(/\D/g, '').slice(-10),
    email: data.email || null,
    type: ENQUIRY_TYPES[data.eventType] || 'custom',
    event_date: data.date || null,
    guests: Number(data.guests) || null,
    budget: Number(data.budget) || null,
    message: data.message || 'Event enquiry',
  });
  return {
    ...created,
    ref: created.enquiry_reference || created.ref || 'ENQ-CONFIRMED',
  };
}

export async function createContactMessage(data) {
  return apiClient.entities.Enquiry.create({
    name: data.name,
    phone: String(data.phone).replace(/\D/g, '').slice(-10),
    message: data.message,
    type: 'contact',
  });
}
