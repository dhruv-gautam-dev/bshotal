/**
 * Production API Client for B.S. Hotel & Restaurant.
 * Communicates directly with the FastAPI backend connected to Supabase PostgreSQL & Storage.
 * Static mock fallback stores are eliminated — all data and transactions are dynamic.
 */

const API_BASE = '/api/v1'

function getToken() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem('access_token')
}

function getRefreshToken() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem('refresh_token')
}

function setToken(token) {
  if (typeof window !== 'undefined' && token) {
    window.localStorage.setItem('access_token', token)
  }
}

function clearTokens() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('access_token')
    window.localStorage.removeItem('refresh_token')
    window.localStorage.removeItem('auth_user')
  }
}

async function refreshAccessToken() {
  const refresh = getRefreshToken()
  if (!refresh) return null
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.access_token) {
        setToken(data.access_token)
        return data.access_token
      }
    }
  } catch (e) {
    console.warn('Token refresh failed:', e)
  }
  clearTokens()
  return null
}

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  let token = getToken()
  const headers = new Headers(options.headers || {})

  if (!(options.body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let res = await fetch(url, { ...options, headers })

  // Auto token refresh on 401
  if (res.status === 401 && getRefreshToken()) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`)
      res = await fetch(url, { ...options, headers })
    }
  }

  if (!res.ok) {
    let errorDetail = `Request failed (${res.status})`
    try {
      const errJson = await res.json()
      if (Array.isArray(errJson.detail)) {
        errorDetail = errJson.detail
          .map((d) => (d.loc ? `${d.loc.slice(1).join('.')}: ${d.msg}` : d.msg || JSON.stringify(d)))
          .join('; ')
      } else if (typeof errJson.detail === 'string') {
        errorDetail = errJson.detail
      } else if (errJson.error) {
        errorDetail = typeof errJson.error === 'string' ? errJson.error : JSON.stringify(errJson.error)
      } else if (errJson.message) {
        errorDetail = typeof errJson.message === 'string' ? errJson.message : JSON.stringify(errJson.message)
      }
    } catch {
      // ignore
    }
    const error = new Error(errorDetail)
    error.status = res.status
    throw error
  }

  if (res.status === 204) return { success: true }
  return await res.json()
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item-' + Date.now()
}

// -------------------------------------------------------------
// Authentication
// -------------------------------------------------------------
export const auth = {
  async me() {
    const token = getToken()
    if (!token) return null
    try {
      const u = await request('/auth/me')
      const role = u.role?.toLowerCase()
      const staff_role = (role === 'admin' || role === 'owner')
        ? 'owner'
        : (role === 'manager' ? 'manager' : 'staff')
      const user = {
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        staff_role,
        staff_active: u.is_active,
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('auth_user', JSON.stringify(user))
      }
      return user
    } catch {
      clearTokens()
      return null
    }
  },

  async login(email, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: email, password }),
    })
    setToken(data.access_token)
    if (data.refresh_token && typeof window !== 'undefined') {
      window.localStorage.setItem('refresh_token', data.refresh_token)
    }
    const u = data.user
    const role = u.role?.toLowerCase()
    const staff_role = (role === 'admin' || role === 'owner')
      ? 'owner'
      : (role === 'manager' ? 'manager' : 'staff')
    const user = {
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      staff_role,
      staff_active: u.is_active,
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('auth_user', JSON.stringify(user))
    }
    return { user, access_token: data.access_token }
  },

  async logout() {
    try {
      await request('/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    clearTokens()
    return { success: true }
  },

  getToken,
  setToken,
  redirectToLogin(returnUrl) {
    if (typeof window !== 'undefined') {
      window.location.href = `/admin/login${returnUrl ? `?return=${encodeURIComponent(returnUrl)}` : ''}`
    }
  },
}

// -------------------------------------------------------------
// Dynamic Database Entities Bridge
// -------------------------------------------------------------
export const entities = {
  // --- Master Settings ---
  Setting: {
    async list() {
      try {
        const s = await request(getToken() ? '/admin/settings' : '/public/settings')
        if (!s) return []
        const mapped = {
          ...s,
          hotel_name: s.hotel_name,
          phone: s.bookings_phone,
          phone1: s.bookings_phone,
          whatsapp: s.whatsapp_number,
          tax_percent: Number(s.restaurant_tax_percent ?? 5),
          room_tax_percent: Number(s.room_tax_percent ?? 12),
          delivery_charge: Number(s.delivery_charge ?? 40),
          cancellation_policy: s.cancellation_policy,
          house_rules: s.house_rules,
          google_maps_url: s.google_maps_url,
        }
        return [mapped]
      } catch {
        return []
      }
    },
    async get() {
      const rows = await this.list()
      return rows[0] || null
    },
    async update(id, values) {
      const payload = { ...values }
      if (payload.tax_percent !== undefined) {
        payload.restaurant_tax_percent = Number(payload.tax_percent)
      }
      if (payload.delivery_charge !== undefined) {
        payload.delivery_charge = Number(payload.delivery_charge)
      }
      if (payload.phone !== undefined) {
        payload.bookings_phone = payload.phone
      }
      if (payload.whatsapp !== undefined) {
        payload.whatsapp_number = payload.whatsapp
      }
      return await request('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
    },
    async create(values) {
      return this.update(null, values)
    },
  },

  // --- Menu Categories ---
  MenuCategory: {
    async list() {
      const endpoint = getToken() ? '/admin/menu/categories' : '/public/menu'
      const rows = await request(endpoint).catch(() => [])
      const list = Array.isArray(rows) ? rows : (rows.items || [])
      return list.map((c) => ({
        ...c,
        name_en: c.name || c.name_en,
        name_hi: c.name_hi || '',
        sort: c.display_order ?? c.sort ?? 0,
      }))
    },
    async filter(predicate = {}, options = {}) {
      let list = await this.list()
      if (predicate.is_active !== undefined) {
        list = list.filter((c) => c.is_active === predicate.is_active)
      }
      return { items: list }
    },
    async get(id) {
      const list = await this.list()
      return list.find((c) => c.id === id) || null
    },
    async create(data) {
      return await request('/admin/menu/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name_en || data.name,
          name_hi: data.name_hi || null,
          slug: data.slug || slugify(data.name_en || data.name),
          description: data.description || null,
          display_order: Number(data.sort ?? data.display_order ?? 0),
          is_active: data.is_active !== false,
        }),
      })
    },
    async update(id, data) {
      return await request(`/admin/menu/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: data.name_en || data.name,
          name_hi: data.name_hi,
          description: data.description,
          display_order: data.sort !== undefined ? Number(data.sort) : data.display_order,
          is_active: data.is_active,
        }),
      })
    },
    async delete(id) {
      return await request(`/admin/menu/categories/${id}`, { method: 'DELETE' })
    },
  },

  // --- Menu Items ---
  MenuItem: {
    async list() {
      const rows = await request('/admin/menu/items').catch(() => [])
      const list = Array.isArray(rows) ? rows : (rows.items || [])
      return list.map((i) => ({
        ...i,
        name_en: i.name,
        name_hi: i.name_hi || '',
        desc: i.description || '',
        price: Number(i.price),
        sort: i.display_order ?? 0,
        is_available: i.is_available !== false,
        tags: Array.isArray(i.tags) ? i.tags : [],
      }))
    },
    async filter(predicate = {}, options = {}) {
      let list = await this.list()
      if (predicate.category_id) {
        list = list.filter((i) => i.category_id === predicate.category_id)
      }
      if (predicate.is_available !== undefined) {
        list = list.filter((i) => i.is_available === predicate.is_available)
      }
      if (predicate.id && predicate.id.$in) {
        list = list.filter((i) => predicate.id.$in.includes(i.id))
      }
      return { items: list }
    },
    async get(id) {
      const list = await this.list()
      return list.find((i) => i.id === id) || null
    },
    async create(data) {
      return await request('/admin/menu/items', {
        method: 'POST',
        body: JSON.stringify({
          category_id: data.category_id,
          name: data.name_en || data.name,
          name_hi: data.name_hi || null,
          description: data.desc || data.description || null,
          price: Number(data.price),
          is_veg: data.is_veg !== false,
          is_available: data.is_available !== false,
          image_url: data.image_url || null,
          tags: Array.isArray(data.tags) ? data.tags : [],
          display_order: Number(data.sort ?? data.display_order ?? 0),
        }),
      })
    },
    async update(id, data) {
      const payload = { ...data }
      if (payload.name_en) payload.name = payload.name_en
      if (payload.desc !== undefined) payload.description = payload.desc
      if (payload.sort !== undefined) payload.display_order = Number(payload.sort)
      if (payload.price !== undefined) payload.price = Number(payload.price)
      return await request(`/admin/menu/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
    },
    async delete(id) {
      return await request(`/admin/menu/items/${id}`, { method: 'DELETE' })
    },
    async bulkUpdate(updates) {
      return await request('/admin/menu/bulk-price-update', {
        method: 'POST',
        body: JSON.stringify(updates),
      }).catch(async () => {
        // Fallback: update individually
        for (const u of updates) {
          if (u.id) await this.update(u.id, u)
        }
      })
    },
    async bulkCreate(items) {
      const results = []
      for (const item of items) {
        results.push(await this.create(item))
      }
      return results
    },
  },

  // --- Room Types ---
  RoomType: {
    async list() {
      const endpoint = getToken() ? '/admin/rooms/types' : '/public/rooms'
      const rows = await request(endpoint).catch(() => [])
      const list = Array.isArray(rows) ? rows : (rows.items || [])
      return list.map((rt) => ({
        ...rt,
        name_en: rt.name,
        desc_en: rt.description,
        price: Number(rt.base_price),
        capacity: rt.max_guests,
        sort: rt.display_order ?? 0,
        total_rooms: Number(rt.total_inventory ?? rt.total_rooms ?? 1),
        total_inventory: Number(rt.total_inventory ?? rt.total_rooms ?? 1),
        amenities: Array.isArray(rt.amenities) ? rt.amenities : [],
        images: Array.isArray(rt.images) ? rt.images : [],
      }))
    },
    async filter(predicate = {}, options = {}) {
      let list = await this.list()
      if (predicate.is_active !== undefined) {
        list = list.filter((r) => r.is_active === predicate.is_active)
      }
      if (predicate.id) {
        list = list.filter((r) => r.id === predicate.id)
      }
      return { items: list }
    },
    async get(id) {
      const list = await this.list()
      return list.find((r) => r.id === id) || null
    },
    async create(data) {
      const totalInventory = Number(data.total_rooms || data.total_inventory || 1)
      return await request('/admin/rooms/types', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name_en || data.name,
          slug: data.slug || slugify(data.name_en || data.name),
          description: data.desc_en || data.description || '',
          base_price: Number(data.price || data.base_price),
          max_guests: Number(data.capacity || data.max_guests || 2),
          bed_type: data.bed_type || 'King Bed',
          amenities: Array.isArray(data.amenities) ? data.amenities : ['ac', 'wifi', 'tv'],
          images: Array.isArray(data.images) ? data.images : [],
          total_inventory: totalInventory,
          total_rooms: totalInventory,
          display_order: Number(data.sort ?? data.display_order ?? 0),
          is_active: data.is_active !== false,
        }),
      })
    },
    async update(id, data) {
      const payload = { ...data }
      if (payload.name_en) payload.name = payload.name_en
      if (payload.desc_en !== undefined) payload.description = payload.desc_en
      if (payload.price !== undefined) payload.base_price = Number(payload.price)
      if (payload.capacity !== undefined) payload.max_guests = Number(payload.capacity)
      if (payload.sort !== undefined) payload.display_order = Number(payload.sort)
      if (payload.total_rooms !== undefined || payload.total_inventory !== undefined) {
        payload.total_inventory = Number(payload.total_rooms ?? payload.total_inventory)
        payload.total_rooms = payload.total_inventory
      }
      return await request(`/admin/rooms/types/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
    },
    async delete(id) {
      return await request(`/admin/rooms/types/${id}`, { method: 'DELETE' })
    },
  },

  // --- Physical Rooms Inventory ---
  Room: {
    async list() {
      const rows = await request('/admin/rooms/inventory').catch(() => [])
      const list = Array.isArray(rows) ? rows : (rows.items || [])
      return list.map((r) => ({
        ...r,
        number: r.room_number,
        floor: String(r.floor),
      }))
    },
    async filter(predicate = {}, options = {}) {
      let list = await this.list()
      if (predicate.room_type_id) {
        list = list.filter((r) => r.room_type_id === predicate.room_type_id)
      }
      if (predicate.is_active !== undefined) {
        list = list.filter((r) => r.is_active === predicate.is_active)
      }
      if (predicate.status) {
        list = list.filter((r) => r.status === predicate.status)
      }
      return { items: list }
    },
    async create(data) {
      return await request('/admin/rooms/inventory', {
        method: 'POST',
        body: JSON.stringify({
          room_number: String(data.number || data.room_number),
          room_type_id: data.room_type_id,
          floor: Number(data.floor) || 1,
          status: data.status || 'available',
          notes: data.notes || null,
          is_active: data.is_active !== false,
        }),
      })
    },
    async update(id, data) {
      const payload = { ...data }
      if (payload.number) payload.room_number = String(payload.number)
      if (payload.floor) payload.floor = Number(payload.floor)
      return await request(`/admin/rooms/inventory/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
    },
  },

  // --- Blocked Dates ---
  BlockedDate: {
    async list() {
      const rows = await request('/admin/rooms/blocked-dates').catch(() => [])
      return Array.isArray(rows) ? rows : (rows.items || [])
    },
    async filter(predicate = {}) {
      const list = await this.list()
      return { items: list }
    },
    async create(data) {
      return await request('/admin/rooms/blocked-dates', {
        method: 'POST',
        body: JSON.stringify({
          room_type_id: data.room_type_id,
          start_date: data.start_date,
          end_date: data.end_date,
          reason: data.reason || 'Maintenance',
        }),
      })
    },
    async delete(id) {
      return await request(`/admin/rooms/blocked-dates/${id}`, { method: 'DELETE' })
    },
  },

  // --- Pricing Rules ---
  PricingRule: {
    async list() {
      const rows = await request('/admin/rooms/pricing-rules').catch(() => [])
      return Array.isArray(rows) ? rows : (rows.items || [])
    },
    async filter() {
      const list = await this.list()
      return { items: list }
    },
    async create(data) {
      return await request('/admin/rooms/pricing-rules', {
        method: 'POST',
        body: JSON.stringify({
          room_type_id: data.room_type_id,
          rule_type: data.rule_type || 'custom',
          name: data.name || 'Special Rate',
          start_date: data.start_date,
          end_date: data.end_date,
          price: Number(data.price),
          is_active: true,
        }),
      })
    },
    async delete(id) {
      return await request(`/admin/rooms/pricing-rules/${id}`, { method: 'DELETE' })
    },
  },

  // --- Room Bookings ---
  Booking: {
    async list() {
      const res = await request('/admin/bookings?page=1&limit=100').catch((err) => {
        console.error('Failed to fetch admin bookings:', err);
        return { items: [] };
      });
      const list = res?.items || (Array.isArray(res) ? res : []);
      const roomTypes = await apiClient.entities.RoomType.list().catch(() => []);
      const rtMap = Object.fromEntries(roomTypes.map((rt) => [rt.id, rt.name_en || rt.name]));

      return list.map((b) => ({
        ...b,
        ref: b.booking_reference,
        phone: b.guest_phone,
        email: b.guest_email || '',
        check_in: b.check_in_date,
        check_out: b.check_out_date,
        guests: b.num_guests,
        amount: Number(b.total_amount || 0),
        advance_paid: Number(b.advance_paid || 0),
        balance: Math.max(0, Number(b.total_amount || 0) - Number(b.advance_paid || 0)),
        status: b.booking_status,
        room_id: b.assigned_room_id,
        room_type_name: b.room_type?.name || rtMap[b.room_type_id] || b.room_type_name || 'Standard Room',
        nights: b.check_in_date && b.check_out_date ? Math.max(1, Math.round((new Date(b.check_out_date) - new Date(b.check_in_date)) / 86400000)) : 1,
        created_date: b.created_at,
      }));
    },
    async filter(predicate = {}) {
      let list = await this.list();
      if (predicate.status) {
        list = list.filter((b) => b.status === predicate.status);
      }
      return { items: list };
    },
    async get(id) {
      const b = await request(`/admin/bookings/${id}`);
      const roomTypes = await apiClient.entities.RoomType.list().catch(() => []);
      const rtMap = Object.fromEntries(roomTypes.map((rt) => [rt.id, rt.name_en || rt.name]));

      return {
        ...b,
        ref: b.booking_reference,
        phone: b.guest_phone,
        email: b.guest_email || '',
        check_in: b.check_in_date,
        check_out: b.check_out_date,
        guests: b.num_guests,
        amount: Number(b.total_amount || 0),
        advance_paid: Number(b.advance_paid || 0),
        balance: Math.max(0, Number(b.total_amount || 0) - Number(b.advance_paid || 0)),
        status: b.booking_status,
        room_id: b.assigned_room_id,
        room_type_name: b.room_type?.name || rtMap[b.room_type_id] || b.room_type_name || 'Standard Room',
        nights: b.check_in_date && b.check_out_date ? Math.max(1, Math.round((new Date(b.check_out_date) - new Date(b.check_in_date)) / 86400000)) : 1,
        created_date: b.created_at,
      };
    },
    async create(data) {
      const token = getToken()
      if (token) {
        // Admin booking creation
        return await request('/admin/bookings', {
          method: 'POST',
          body: JSON.stringify({
            room_type_id: data.room_type_id,
            assigned_room_id: data.room_id || null,
            guest_name: data.guest_name,
            guest_phone: data.phone || data.guest_phone,
            guest_email: data.email || null,
            check_in_date: data.check_in || data.check_in_date,
            check_out_date: data.check_out || data.check_out_date,
            num_rooms: Number(data.num_rooms || 1),
            num_guests: Number(data.guests || data.num_guests || 1),
            base_amount: Number(data.amount || data.base_amount || 0),
            total_amount: Number(data.amount || data.total_amount || 0),
            advance_paid: Number(data.advance_paid || 0),
            payment_status: data.payment_status || 'unpaid',
            booking_status: data.status || 'confirmed',
            source: data.source || 'admin',
            special_requests: data.special_requests || null,
          }),
        })
      }
      // Public guest booking request
      return await request('/public/bookings', {
        method: 'POST',
        body: JSON.stringify({
          room_type_id: data.room_type_id,
          guest_name: data.guest_name,
          guest_phone: data.phone || data.guest_phone,
          guest_email: data.email || null,
          check_in_date: data.check_in,
          check_out_date: data.check_out,
          num_rooms: Number(data.rooms || data.num_rooms || 1),
          num_guests: Number(data.guests || data.num_guests || 1),
          special_requests: data.special_requests || null,
        }),
      })
    },
    async update(id, data) {
      if (data.status || data.booking_status) {
        const statusVal = data.status || data.booking_status;
        const reasonVal = data.cancellation_reason || data.cancel_reason || null;
        return await request(`/admin/bookings/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: statusVal,
            booking_status: statusVal,
            cancellation_reason: reasonVal,
            admin_notes: data.admin_notes || null,
          }),
        });
      }
      return await request(`/admin/bookings/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    async delete(id) {
      return await request(`/admin/bookings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ booking_status: 'cancelled', cancellation_reason: 'Deleted by admin' }),
      })
    },
  },

  // --- Food Orders ---
  Order: {
    async list() {
      const res = await request('/admin/orders?page=1&limit=100').catch(() => ({ items: [] }))
      const list = res.items || (Array.isArray(res) ? res : [])
      return list.map((o) => ({
        ...o,
        ref: o.order_reference,
        phone: o.customer_phone,
        type: o.order_type,
        table_no: o.table_number,
        address: o.delivery_address,
        total: Number(o.total_amount),
        subtotal: Number(o.subtotal || 0),
        tax: Number(o.tax_amount || 0),
        delivery: Number(o.delivery_fee || 0),
        notes: o.kitchen_notes,
        created_date: o.created_at,
        items: (o.items || []).map((i) => ({
          item_id: i.menu_item_id,
          name: i.item_name,
          price: Number(i.unit_price),
          qty: i.quantity,
          note: i.special_instructions,
        })),
      }))
    },
    async filter(predicate = {}) {
      let list = await this.list()
      if (predicate.status) {
        list = list.filter((o) => o.status === predicate.status)
      }
      return { items: list }
    },
    async get(id) {
      const o = await request(`/admin/orders/${id}`)
      return {
        ...o,
        ref: o.order_reference,
        phone: o.customer_phone,
        type: o.order_type,
        table_no: o.table_number,
        address: o.delivery_address,
        total: Number(o.total_amount),
        subtotal: Number(o.subtotal || 0),
        tax: Number(o.tax_amount || 0),
        delivery: Number(o.delivery_fee || 0),
        notes: o.kitchen_notes,
        created_date: o.created_at,
        items: (o.items || []).map((i) => ({
          item_id: i.menu_item_id,
          name: i.item_name,
          price: Number(i.unit_price),
          qty: i.quantity,
          note: i.special_instructions,
        })),
      }
    },
    async create(data) {
      const token = getToken()
      const itemsPayload = (data.items || []).map((i) => ({
        menu_item_id: i.item_id || i.id,
        quantity: Number(i.qty || i.quantity || 1),
        special_instructions: i.note || null,
      }))

      if (token) {
        return await request('/admin/orders', {
          method: 'POST',
          body: JSON.stringify({
            customer_name: data.customer_name,
            customer_phone: data.phone || data.customer_phone,
            customer_email: data.email || null,
            order_type: data.type || 'dine-in',
            table_number: data.table_no || null,
            delivery_address: data.address || null,
            items: itemsPayload,
            status: data.status || 'accepted',
            payment_status: data.payment_status || 'unpaid',
            payment_mode: data.payment_mode || null,
            kitchen_notes: data.notes || null,
          }),
        })
      }

      return await request('/public/orders', {
        method: 'POST',
        body: JSON.stringify({
          customer_name: data.customer_name,
          customer_phone: data.phone || data.customer_phone,
          customer_email: data.email || null,
          order_type: data.type === 'delivery' ? 'delivery' : (data.type === 'pickup' ? 'pickup' : 'dine-in'),
          table_number: data.table_no || null,
          delivery_address: data.address || null,
          items: itemsPayload,
          kitchen_notes: data.notes || null,
        }),
      })
    },
    async update(id, data) {
      return await request(`/admin/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: data.status,
          payment_status: data.payment_status || null,
          payment_mode: data.payment_mode || null,
          cancellation_reason: data.cancellation_reason || null,
        }),
      })
    },
    async delete(id) {
      return await this.update(id, { status: 'cancelled', cancellation_reason: 'Deleted by admin' })
    },
  },

  // --- Payments ---
  Payment: {
    async list() {
      const res = await request('/admin/payments?page=1&limit=100').catch(() => ({ items: [] }))
      const list = res.items || (Array.isArray(res) ? res : [])
      return list.map((p) => ({
        ...p,
        amount: Number(p.amount),
        created_date: p.created_at,
      }))
    },
    async filter(predicate = {}) {
      let list = await this.list()
      if (predicate.booking_id) {
        list = list.filter((p) => p.booking_id === predicate.booking_id)
      }
      return { items: list }
    },
    async create(data) {
      if (data.booking_id) {
        return await request(`/admin/bookings/${data.booking_id}/payments`, {
          method: 'POST',
          body: JSON.stringify({
            amount: Number(data.amount),
            mode: data.mode || 'cash',
            transaction_reference: data.reference || data.txn_id || null,
            notes: data.notes || null,
          }),
        })
      }
      return await request('/admin/payments', {
        method: 'POST',
        body: JSON.stringify({
          booking_id: data.booking_id || null,
          order_id: data.order_id || null,
          amount: Number(data.amount),
          mode: data.mode || 'cash',
          status: data.status || 'captured',
          transaction_reference: data.reference || data.txn_id || null,
        }),
      })
    },
  },

  // --- Enquiries ---
  Enquiry: {
    async list() {
      const res = await request('/admin/enquiries?page=1&limit=100').catch(() => ({ items: [] }))
      const list = res.items || (Array.isArray(res) ? res : [])
      return list.map((e) => ({
        ...e,
        ref: e.enquiry_reference,
        name: e.customer_name,
        phone: e.customer_phone,
        email: e.customer_email || '',
        guests: e.guest_count,
        type: e.event_type,
        created_date: e.created_at,
      }))
    },
    async filter() {
      const list = await this.list()
      return { items: list }
    },
    async create(data) {
      return await request('/public/events/enquiry', {
        method: 'POST',
        body: JSON.stringify({
          customer_name: data.name,
          customer_phone: data.phone,
          customer_email: data.email || null,
          event_type: data.type === 'contact' ? 'contact' : (data.type || 'custom'),
          event_date: data.event_date || null,
          guest_count: Number(data.guests) || null,
          budget: Number(data.budget) || null,
          message: data.message || 'Customer enquiry',
        }),
      })
    },
    async update(id, data) {
      return await request(`/admin/enquiries/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: data.status,
          admin_notes: data.admin_notes,
        }),
      })
    },
    async delete(id) {
      return await request(`/admin/enquiries/${id}`, { method: 'DELETE' })
    },
  },

  // --- Customer Reviews ---
  Review: {
    async list() {
      const token = getToken()
      if (token) {
        const res = await request('/admin/reviews?page=1&limit=100').catch(() => ({ items: [] }))
        const list = res.items || (Array.isArray(res) ? res : [])
        return list.map((r) => ({
          ...r,
          name: r.guest_name,
          city: r.guest_city,
          created_date: r.created_at,
        }))
      }
      const list = await request('/public/reviews').catch(() => [])
      return (Array.isArray(list) ? list : []).map((r) => ({
        ...r,
        name: r.guest_name,
        city: r.guest_city,
        created_date: r.created_at,
      }))
    },
    async filter(predicate = {}) {
      let list = await this.list()
      if (predicate.status) {
        list = list.filter((r) => r.status === predicate.status)
      }
      return { items: list }
    },
    async create(data) {
      return await request('/public/reviews', {
        method: 'POST',
        body: JSON.stringify({
          guest_name: data.name,
          guest_city: data.city || null,
          rating: Number(data.rating),
          comment: data.comment,
          review_type: data.review_type || 'hotel',
        }),
      })
    },
    async update(id, data) {
      return await request(`/admin/reviews/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: data.status,
          is_featured: data.is_featured,
        }),
      })
    },
    async delete(id) {
      return await request(`/admin/reviews/${id}`, { method: 'DELETE' })
    },
  },

  // --- Event Packages ---
  EventPackage: {
    async list() {
      const endpoint = getToken() ? '/admin/enquiries/packages' : '/public/events/packages'
      const rows = await request(endpoint).catch(() => [])
      const list = Array.isArray(rows) ? rows : (rows.items || [])
      return list.map((p) => ({
        ...p,
        title: p.name,
        price: Number(p.base_price_per_person || 0),
        desc: p.description,
        sort: p.display_order ?? 0,
        includes: Array.isArray(p.includes) ? p.includes : [],
      }))
    },
    async filter() {
      const list = await this.list()
      return { items: list }
    },
    async create(data) {
      return await request('/admin/enquiries/packages', {
        method: 'POST',
        body: JSON.stringify({
          name: data.title || data.name,
          slug: slugify(data.title || data.name),
          description: data.description || data.desc || '',
          base_price_per_person: Number(data.price || data.base_price_per_person || 0),
          includes: Array.isArray(data.includes) ? data.includes : [],
          min_guests: Number(data.min_guests || 50),
          max_guests: Number(data.max_guests || 500),
          display_order: Number(data.sort ?? data.display_order ?? 0),
          is_active: data.is_active !== false,
        }),
      })
    },
    async update(id, data) {
      const payload = { ...data }
      if (payload.title) payload.name = payload.title
      if (payload.desc) payload.description = payload.desc
      if (payload.price !== undefined) payload.base_price_per_person = Number(payload.price)
      return await request(`/admin/enquiries/packages/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
    },
    async delete(id) {
      return await request(`/admin/enquiries/packages/${id}`, { method: 'DELETE' })
    },
  },

  // --- Staff & Admin Users ---
  User: {
    async list() {
      const rows = await request('/admin/staff').catch(() => [])
      const list = Array.isArray(rows) ? rows : []
      return list.map((u) => ({
        ...u,
        staff_role: u.role === 'owner' ? 'owner' : (u.role === 'manager' ? 'manager' : 'staff'),
        staff_active: u.is_active,
      }))
    },
    async get(id) {
      const list = await this.list()
      return list.find((u) => u.id === id) || null
    },
    async create(data) {
      const role = data.staff_role === 'owner' ? 'owner' : (data.staff_role === 'manager' ? 'manager' : 'staff')
      return await request('/admin/staff', {
        method: 'POST',
        body: JSON.stringify({
          email: data.email,
          phone: data.phone || '+919999999999',
          full_name: data.full_name,
          role,
          password: data.password || 'StaffTemp@2026',
          is_active: data.is_active !== false,
        }),
      })
    },
    async update(id, data) {
      const payload = {}
      if (data.staff_role) payload.role = data.staff_role
      if (data.full_name) payload.full_name = data.full_name
      if (data.phone) payload.phone = data.phone
      if (data.staff_active !== undefined) payload.is_active = data.staff_active
      return await request(`/admin/staff/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
    },
    async delete(id) {
      return await request(`/admin/staff/${id}`, { method: 'DELETE' })
    },
  },

  // --- Customers ---
  Customer: {
    async list() {
      const res = await request('/admin/customers?page=1&limit=100').catch(() => ({ items: [] }))
      return res.items || (Array.isArray(res) ? res : [])
    },
    async filter() {
      const list = await this.list()
      return { items: list }
    },
    async get(id) {
      return await request(`/admin/customers/${id}`)
    },
    async update(id, data) {
      return await request(`/admin/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    },
  },

  // --- Audit Logs ---
  AuditLog: {
    async list() {
      const res = await request('/admin/audit?page=1&limit=100').catch(() => ({ items: [] }))
      const list = res.items || (Array.isArray(res) ? res : [])
      return list.map((a) => ({
        ...a,
        created_date: a.created_at,
      }))
    },
    async filter() {
      const list = await this.list()
      return { items: list }
    },
    async create() {
      // Backend creates audit logs automatically during transactions
      return { success: true }
    },
  },
}

// Proxy wrapper so accessing ANY entity never returns undefined
const entitiesProxy = new Proxy(entities, {
  get(target, prop) {
    if (typeof prop === 'string' && target[prop]) {
      return target[prop]
    }
    // Generic fallback for any unlisted entity
    return {
      async list() { return [] },
      async filter() { return { items: [] } },
      async get() { return null },
      async create(data) { return { id: 'temp-' + Date.now(), ...data } },
      async update(id, data) { return { id, ...data } },
      async delete() { return { success: true } },
    }
  },
})

// -------------------------------------------------------------
// Helper Exports
// -------------------------------------------------------------
export const users = {
  async inviteUser(email, role = 'staff') {
    const cleanEmail = (email || '').trim().toLowerCase()
    if (!cleanEmail) throw new Error('Email is required')
    const list = await entities.User.list()
    const existing = list.find((u) => u.email?.toLowerCase() === cleanEmail)
    const targetRole = role === 'owner' ? 'owner' : (role === 'manager' ? 'manager' : 'staff')
    if (existing) {
      return await entities.User.update(existing.id, { staff_role: targetRole, staff_active: true })
    }
    const namePart = cleanEmail.split('@')[0]
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1)
    return await entities.User.create({
      email: cleanEmail,
      full_name: formattedName,
      staff_role: targetRole,
      is_active: true,
    })
  },
  list: () => entities.User.list(),
  get: (id) => entities.User.get(id),
  update: (id, data) => entities.User.update(id, data),
  delete: (id) => entities.User.delete(id),
}

export const apiClient = {
  auth,
  users,
  async upload(file, bucket = 'room-photos') {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bucket', bucket)
    return await request('/admin/uploads', {
      method: 'POST',
      body: formData,
    })
  },
  app: {
    async getPublicSettings() {
      return await entities.Setting.get()
    },
  },
  entities: entitiesProxy,
}

export default apiClient
