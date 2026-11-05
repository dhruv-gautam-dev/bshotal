import { MENU } from '@/data/menu'
import { ROOMS } from '@/data/rooms'
import { EVENTS } from '@/data/events'
import { REVIEWS } from '@/data/reviews'
import { SITE, ORDER_CONFIG } from '@/data/site'

// Local storage prefix for data persistence
const STORAGE_PREFIX = 'bshotel_db_'

function getStore(key, defaultData) {
  if (typeof window === 'undefined') return defaultData
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) {
      window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(defaultData))
      return defaultData
    }
    // Auto-migrate legacy media CDN URLs or old phone numbers if stored in browser
    if (typeof raw === 'string' && (raw.includes('media.apiClient.com') || raw.includes('63776') || raw.includes('82735') || (key === 'Setting' && (!raw.includes(SITE.bookingsPhone) || !raw.includes(SITE.paymentsPhone))))) {
      window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(defaultData))
      return defaultData
    }
    return JSON.parse(raw)
  } catch {
    return defaultData
  }
}

function setStore(key, data) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data))
  } catch (err) {
    console.error('Storage write error for', key, err)
  }
}

const nowIso = new Date().toISOString()
const todayDateStr = nowIso.slice(0, 10)

// Initial Menu Categories
const initialCategories = MENU.map((c, idx) => ({
  id: c.id,
  name_en: c.name.en,
  name_hi: c.name.hi || c.name.en,
  sort: idx + 1,
  is_active: true,
}))

// Initial Menu Items
const initialMenuItems = MENU.flatMap((c, cIdx) =>
  c.items.map((item, iIdx) => ({
    id: item.id,
    category_id: c.id,
    name_en: item.name,
    desc: item.desc || '',
    price: item.price,
    is_available: true,
    tags: item.tags || [],
    image_url: item.image || '',
    sort: cIdx * 50 + iIdx + 1,
  }))
)

// Initial Room Types
const initialRoomTypes = ROOMS.map((r, idx) => ({
  id: r.id,
  name_en: r.name.en,
  name_hi: r.name.hi || r.name.en,
  desc_en: r.desc.en || '',
  desc_hi: r.desc.hi || '',
  price: r.price,
  capacity: r.capacity || 2,
  amenities: r.amenities || ['ac', 'wifi', 'tv'],
  images: Array.isArray(r.images) ? r.images : [r.images],
  is_active: true,
  total_rooms: r.id === 'standard' ? 10 : r.id === 'deluxe' ? 8 : 4,
  sort: idx + 1,
}))

// Initial Physical Rooms
const initialRooms = [
  { id: 'rm-101', number: '101', room_type_id: 'standard', floor: '1', status: 'available', is_active: true },
  { id: 'rm-102', number: '102', room_type_id: 'standard', floor: '1', status: 'available', is_active: true },
  { id: 'rm-103', number: '103', room_type_id: 'standard', floor: '1', status: 'available', is_active: true },
  { id: 'rm-104', number: '104', room_type_id: 'standard', floor: '1', status: 'cleaning', is_active: true },
  { id: 'rm-105', number: '105', room_type_id: 'standard', floor: '1', status: 'available', is_active: true },
  { id: 'rm-201', number: '201', room_type_id: 'deluxe', floor: '2', status: 'occupied', is_active: true },
  { id: 'rm-202', number: '202', room_type_id: 'deluxe', floor: '2', status: 'available', is_active: true },
  { id: 'rm-203', number: '203', room_type_id: 'deluxe', floor: '2', status: 'available', is_active: true },
  { id: 'rm-204', number: '204', room_type_id: 'deluxe', floor: '2', status: 'maintenance', is_active: true },
  { id: 'rm-301', number: '301', room_type_id: 'family', floor: '3', status: 'available', is_active: true },
  { id: 'rm-302', number: '302', room_type_id: 'family', floor: '3', status: 'available', is_active: true },
]

// Initial Settings
const initialSettings = [
  {
    id: 'setting-1',
    tax_percent: ORDER_CONFIG.taxPercent || 5,
    delivery_charge: ORDER_CONFIG.deliveryCharge || 30,
    phone1: SITE.phone1,
    phone2: SITE.phone2,
    phone_primary: SITE.phone1,
    phone_bookings: SITE.phone1,
    phone_payments: SITE.phone2,
    address_en: SITE.address.en,
    address: SITE.address.en,
    hotel_name: SITE.name,
    gst: '09AAACB1234F1Z5',
  },
]

// Initial Bookings
const initialBookings = [
  {
    id: 'bk-1',
    ref: 'RM-DEMO1',
    guest_name: 'Rahul Sharma',
    phone: '9876543210',
    email: 'rahul@example.com',
    room_type_id: 'deluxe',
    room_type_name: 'Deluxe Room',
    check_in: todayDateStr,
    check_out: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    nights: 2,
    guests: 2,
    amount: 3600,
    advance_paid: 1000,
    balance: 2600,
    payment_mode: 'upi',
    status: 'pending',
    source: 'website',
    created_at: nowIso,
    created_date: nowIso,
  },
  {
    id: 'bk-2',
    ref: 'RM-DEMO2',
    guest_name: 'Vikram Singh',
    phone: '9823456781',
    email: 'vikram@example.com',
    room_type_id: 'standard',
    room_type_name: 'Standard AC Room',
    check_in: todayDateStr,
    check_out: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    nights: 1,
    guests: 1,
    amount: 1400,
    advance_paid: 1400,
    balance: 0,
    payment_mode: 'cash',
    status: 'checked_in',
    source: 'walk-in',
    created_at: nowIso,
    created_date: nowIso,
  },
]

// Initial Orders
const initialOrders = [
  {
    id: 'ord-1',
    ref: 'FD-DEMO1',
    customer_name: 'Priya Verma',
    phone: '9812345678',
    type: 'dine-in',
    table_no: '4',
    address: '',
    items: [
      { item_id: 'paneer-tikka', name: 'Paneer Tikka', price: 240, qty: 1 },
      { item_id: 'dal-makhani', name: 'Dal Makhani', price: 210, qty: 1 },
      { item_id: 'butter-naan', name: 'Butter Naan', price: 45, qty: 3 },
    ],
    subtotal: 585,
    tax: 29,
    delivery: 0,
    total: 614,
    notes: 'Less spicy please',
    status: 'new',
    payment_status: 'paid',
    payment_mode: 'upi',
    source: 'website',
    created_at: nowIso,
    created_date: nowIso,
  },
  {
    id: 'ord-2',
    ref: 'FD-DEMO2',
    customer_name: 'Amit Kumar',
    phone: '9877712345',
    type: 'delivery',
    table_no: '',
    address: 'Near Township Nagar, NH-2 Baad',
    items: [
      { item_id: 'kadhai-paneer', name: 'Kadhai Paneer', price: 230, qty: 1 },
      { item_id: 'jeera-rice', name: 'Jeera Rice', price: 140, qty: 1 },
      { item_id: 'roti', name: 'Tandoori Roti', price: 20, qty: 4 },
    ],
    subtotal: 450,
    tax: 23,
    delivery: 30,
    total: 503,
    notes: 'Please ring bell upon arrival',
    status: 'preparing',
    payment_status: 'unpaid',
    payment_mode: 'cash',
    source: 'website',
    created_at: nowIso,
    created_date: nowIso,
  },
]

// Initial Payments
const initialPayments = [
  {
    id: 'pay-1',
    booking_id: 'bk-1',
    amount: 1000,
    payment_mode: 'upi',
    paid_at: nowIso,
    created_at: nowIso,
    created_date: nowIso,
    status: 'completed',
  },
  {
    id: 'pay-2',
    order_id: 'ord-1',
    amount: 614,
    payment_mode: 'upi',
    paid_at: nowIso,
    created_at: nowIso,
    created_date: nowIso,
    status: 'completed',
  },
]

// Initial Blocked Dates
const initialBlockedDates = [
  {
    id: 'blk-1',
    room_type_id: 'standard',
    start_date: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    reason: 'Annual AC Maintenance',
  },
]

// Initial Pricing Rules
const initialPricingRules = [
  {
    id: 'rule-1',
    room_type_id: 'deluxe',
    start_date: new Date(Date.now() + 86400000 * 10).toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 86400000 * 15).toISOString().slice(0, 10),
    price: 2400,
    label: 'Weekend Tariff',
  },
]

// Initial Reviews
const initialReviews = REVIEWS.map((r, i) => ({
  id: r.id || `rev-${i + 1}`,
  name: r.name,
  rating: r.rating || 5,
  date: r.date || 'Recent',
  text: r.text || r.comment || '',
  tag: r.tag || 'Stay & Dining',
  status: 'pending',
  is_approved: true,
}))

// Initial Enquiries
const initialEnquiries = [
  {
    id: 'enq-1',
    ref: 'EV-DEMO1',
    type: 'wedding',
    name: 'Amit Patel',
    phone: '9765432109',
    email: 'amit@example.com',
    event_date: new Date(Date.now() + 86400000 * 20).toISOString().slice(0, 10),
    guests: 150,
    message: 'Wedding reception catering inquiry with hall setup.',
    status: 'new',
    created_at: nowIso,
    created_date: nowIso,
  },
]

// Factory for Entity Storage with query support, sorting, and reactive subscriptions
function createEntityStore(entityName, defaultSeed = []) {
  const listeners = new Set()

  function notify() {
    listeners.forEach((cb) => {
      try {
        cb()
      } catch (e) {
        console.error('Entity listener error:', e)
      }
    })
  }

  return {
    async list() {
      return getStore(entityName, defaultSeed)
    },
    async filter(predicate = {}, options = {}) {
      let list = getStore(entityName, defaultSeed)
      if (typeof predicate === 'object' && Object.keys(predicate).length > 0) {
        list = list.filter((item) => {
          for (const [k, v] of Object.entries(predicate)) {
            const itemVal = item[k]
            if (v && typeof v === 'object') {
              if ('$in' in v) {
                if (!Array.isArray(v.$in) || !v.$in.includes(itemVal)) return false
              }
              if ('$lt' in v) {
                if (!(itemVal < v.$lt)) return false
              }
              if ('$gt' in v) {
                if (!(itemVal > v.$gt)) return false
              }
              if ('$lte' in v) {
                if (!(itemVal <= v.$lte)) return false
              }
              if ('$gte' in v) {
                if (!(itemVal >= v.$gte)) return false
              }
            } else if (itemVal !== v) {
              return false
            }
          }
          return true
        })
      }

      if (options.sort) {
        const isDesc = String(options.sort).startsWith('-')
        const field = isDesc ? String(options.sort).slice(1) : String(options.sort)
        list = [...list].sort((a, b) => {
          const valA = a[field] ?? a[field === 'created_date' ? 'created_at' : field] ?? ''
          const valB = b[field] ?? b[field === 'created_date' ? 'created_at' : field] ?? ''
          if (valA < valB) return isDesc ? 1 : -1
          if (valA > valB) return isDesc ? -1 : 1
          return 0
        })
      }

      if (options.limit) {
        list = list.slice(0, options.limit)
      }

      return { items: list }
    },
    async get(id) {
      const list = getStore(entityName, defaultSeed)
      return list.find((i) => i.id === id) || null
    },
    async create(data) {
      const list = getStore(entityName, defaultSeed)
      const ts = new Date().toISOString()
      const newItem = {
        id: data.id || `${entityName.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        created_at: ts,
        created_date: ts,
        ...data,
      }
      const updated = [newItem, ...list]
      setStore(entityName, updated)
      notify()
      return newItem
    },
    async bulkCreate(items = []) {
      const list = getStore(entityName, defaultSeed)
      const ts = new Date().toISOString()
      const createdItems = (Array.isArray(items) ? items : []).map((data, idx) => ({
        id: data.id || `${entityName.toLowerCase()}_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        created_at: ts,
        created_date: ts,
        ...data,
      }))
      const updated = [...createdItems, ...list]
      setStore(entityName, updated)
      notify()
      return createdItems
    },
    async bulkUpdate(updates = []) {
      const list = getStore(entityName, defaultSeed)
      const updateMap = new Map((Array.isArray(updates) ? updates : []).map((u) => [u.id, u]))
      const updated = list.map((item) => {
        if (updateMap.has(item.id)) {
          return { ...item, ...updateMap.get(item.id), updated_at: new Date().toISOString() }
        }
        return item
      })
      setStore(entityName, updated)
      notify()
      return { success: true }
    },
    async update(id, data) {
      const list = getStore(entityName, defaultSeed)
      let found = null
      const updated = list.map((item) => {
        if (item.id === id) {
          found = { ...item, ...data, updated_at: new Date().toISOString() }
          return found
        }
        return item
      })
      if (!found) {
        found = { id, ...data, created_at: new Date().toISOString(), created_date: new Date().toISOString() }
        updated.push(found)
      }
      setStore(entityName, updated)
      notify()
      return found
    },
    async delete(id) {
      const list = getStore(entityName, defaultSeed)
      const updated = list.filter((i) => i.id !== id)
      setStore(entityName, updated)
      notify()
      return { success: true }
    },
    subscribe(cb) {
      if (typeof cb === 'function') {
        listeners.add(cb)
        return () => listeners.delete(cb)
      }
      return () => {}
    },
  }
}

// User and Auth helper
const DEFAULT_ADMIN = {
  id: 'admin-1',
  email: 'admin@bshotel.com',
  full_name: 'B.S. Hotel Manager',
  role: 'admin',
  staff_role: 'owner',
  staff_active: true,
}

// API base URL for FastAPI backend
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '/api/v1'

export const auth = {
  async me() {
    if (typeof window === 'undefined') return DEFAULT_ADMIN
    const token = window.localStorage.getItem('access_token')
    if (token && !token.startsWith('token_')) {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const u = await res.json()
          const mapped = {
            id: u.id,
            email: u.email,
            full_name: u.full_name,
            role: u.role,
            staff_role: u.role === 'owner' ? 'owner' : (u.role === 'manager' ? 'manager' : 'staff'),
            staff_active: u.is_active,
          }
          window.localStorage.setItem(STORAGE_PREFIX + 'auth_user', JSON.stringify(mapped))
          return mapped
        }
      } catch {
        // Fallback to local session
      }
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_PREFIX + 'auth_user')
      if (stored) return JSON.parse(stored)
      if (token) return DEFAULT_ADMIN
      return null
    } catch {
      return null
    }
  },
  async login(email, password) {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
      })
      if (res.ok) {
        const data = await res.json()
        const user = {
          id: data.user.id,
          email: data.user.email,
          full_name: data.user.full_name,
          role: data.user.role,
          staff_role: data.user.role === 'owner' ? 'owner' : (data.user.role === 'manager' ? 'manager' : 'staff'),
          staff_active: data.user.is_active,
        }
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_PREFIX + 'auth_user', JSON.stringify(user))
          window.localStorage.setItem('access_token', data.access_token)
          if (data.refresh_token) {
            window.localStorage.setItem('refresh_token', data.refresh_token)
          }
        }
        return { user, access_token: data.access_token }
      }
    } catch {
      // Backend unavailable; fallback to offline demo
    }

    const user = {
      id: 'admin-' + Date.now(),
      email: email || 'admin@bshotel.com',
      full_name: 'B.S. Hotel Administrator',
      role: 'admin',
      staff_role: 'owner',
      staff_active: true,
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_PREFIX + 'auth_user', JSON.stringify(user))
      window.localStorage.setItem('access_token', 'token_' + Date.now())
    }
    return { user, access_token: 'token_' + Date.now() }
  },
  async logout() {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('access_token') : null
    if (token && !token.startsWith('token_')) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch {
        // ignore
      }
    }
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_PREFIX + 'auth_user')
      window.localStorage.removeItem('access_token')
      window.localStorage.removeItem('refresh_token')
      window.localStorage.removeItem('token')
    }
    return { success: true }
  },
  setToken(token) {
    if (typeof window !== 'undefined' && token) {
      window.localStorage.setItem('access_token', token)
    }
  },
  redirectToLogin(returnUrl) {
    if (typeof window !== 'undefined') {
      window.location.href = `/admin/login${returnUrl ? `?return=${encodeURIComponent(returnUrl)}` : ''}`
    }
  },
}

// Map of all known entities
const entityStores = {
  Setting: createEntityStore('Setting', initialSettings),
  MenuCategory: createEntityStore('MenuCategory', initialCategories),
  MenuItem: createEntityStore('MenuItem', initialMenuItems),
  RoomType: createEntityStore('RoomType', initialRoomTypes),
  Room: createEntityStore('Room', initialRooms),
  Booking: createEntityStore('Booking', initialBookings),
  Order: createEntityStore('Order', initialOrders),
  Payment: createEntityStore('Payment', initialPayments),
  Enquiry: createEntityStore('Enquiry', initialEnquiries),
  EventPackage: createEntityStore('EventPackage', EVENTS),
  Review: createEntityStore('Review', initialReviews),
  BlockedDate: createEntityStore('BlockedDate', initialBlockedDates),
  PricingRule: createEntityStore('PricingRule', initialPricingRules),
  AuditLog: createEntityStore('AuditLog', []),
  Customer: createEntityStore('Customer', []),
  User: createEntityStore('User', [DEFAULT_ADMIN]),
}

// Proxy wrapper so accessing ANY entity never returns undefined
const entitiesProxy = new Proxy(entityStores, {
  get(target, prop) {
    if (typeof prop === 'string' && !target[prop]) {
      target[prop] = createEntityStore(prop, [])
    }
    return target[prop]
  },
})

export const users = {
  async inviteUser(email, role = 'staff') {
    const cleanEmail = (email || '').trim().toLowerCase()
    if (!cleanEmail) throw new Error('Email is required')
    const list = await entityStores.User.list()
    const existing = list.find((u) => u.email?.toLowerCase() === cleanEmail)
    const targetRole = role === 'owner' ? 'owner' : (role === 'manager' ? 'manager' : 'staff')
    if (existing) {
      return await entityStores.User.update(existing.id, {
        staff_role: targetRole,
        staff_active: true,
      })
    }
    const namePart = cleanEmail.split('@')[0]
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1)
    return await entityStores.User.create({
      email: cleanEmail,
      full_name: formattedName,
      role: targetRole === 'owner' ? 'admin' : 'staff',
      staff_role: targetRole,
      staff_active: true,
    })
  },
  async list() {
    return await entityStores.User.list()
  },
  async get(id) {
    return await entityStores.User.get(id)
  },
  async update(id, data) {
    return await entityStores.User.update(id, data)
  },
  async delete(id) {
    return await entityStores.User.delete(id)
  },
}

export const apiClient = {
  auth,
  users,
  async upload(file, bucket = 'room-photos') {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('access_token') : null
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bucket', bucket)

    try {
      const res = await fetch(`${API_BASE}/admin/uploads`, {
        method: 'POST',
        headers: {
          ...(token && !token.startsWith('token_') ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      })

      if (res.ok) {
        return await res.json()
      }
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || err.detail || 'Upload failed')
    } catch (err) {
      console.warn('Backend storage upload unavailable, falling back to object URL preview:', err)
      return {
        url: URL.createObjectURL(file),
        filename: file.name,
        bucket,
      }
    }
  },
  app: {
    async getPublicSettings() {
      return {
        id: 'bs-hotel-settings',
        public_settings: {
          hotel_name: SITE.name,
          phone: SITE.phone1,
          whatsapp: SITE.whatsapp,
        },
      }
    },
  },
  entities: entitiesProxy,
}

export default apiClient
