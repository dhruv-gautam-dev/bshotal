import { useEffect, useState, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  UserPlus,
  ShieldCheck,
  Shield,
  Trash2,
  Phone,
  MessageCircle,
  Building,
  Clock,
  MapPin,
  Percent,
  CheckCircle2,
  Users,
  History,
  Info,
  Truck,
  FileText,
  Search,
  Filter,
  Edit3,
  Eye,
  EyeOff,
  Key,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  X,
  AlertTriangle,
  Lock,
  Mail,
  User as UserIcon,
  Check,
  Sparkles,
  Copy,
  ExternalLink,
  BedDouble,
  Calendar,
  CreditCard,
  Tag,
} from 'lucide-react';
import { apiClient } from '@/api/apiClient';
import { useI18n } from '@/lib/i18n';
import { useAdmin } from '../AdminContext';
import { getSettings, saveSettings, audit } from '../lib/adminData';
import { updateSettingsOptimistic } from '@/store/slices/settingsSlice';
import PhoneInput from '@/components/ui/phone-input';

function timeAgo(dateString, L) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffSec < 60) return L('Just now', 'अभी-अभी');
  const minutes = Math.floor(diffSec / 60);
  if (minutes < 60) return `${minutes} ${L('m ago', 'मिनट पहले')}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${L('h ago', 'घंटे पहले')}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${L('d ago', 'दिन पहले')}`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getRoleBadge(role, L) {
  const r = (role || 'staff').toLowerCase();
  if (r === 'owner' || r === 'admin') {
    return {
      label: L('Owner', 'मालिक'),
      cls: 'bg-purple-50 text-purple-700 border-purple-200',
      avatarBg: 'bg-purple-600 text-white',
    };
  }
  if (r === 'manager') {
    return {
      label: L('Manager', 'मैनेजर'),
      cls: 'bg-blue-50 text-blue-700 border-blue-200',
      avatarBg: 'bg-blue-600 text-white',
    };
  }
  if (r === 'staff') {
    return {
      label: L('Staff', 'स्टाफ'),
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      avatarBg: 'bg-emerald-600 text-white',
    };
  }
  return {
    label: role ? role.toUpperCase() : L('System', 'सिस्टम'),
    cls: 'bg-slate-100 text-slate-700 border-slate-200',
    avatarBg: 'bg-slate-600 text-white',
  };
}

function formatAuditAction(log, L, bookingInfo, orderInfo) {
  const action = (log.action || '').toLowerCase();
  const entity = (log.entity_type || log.area || log.entity || '').toLowerCase();
  const d = log.details || {};

  // --- Booking Events ---
  if (entity === 'booking') {
    const cust = bookingInfo?.customerName || d.customer_name || d.guest || d.guest_name || '';
    const ref = bookingInfo?.bookingRef || d.booking_reference || d.ref || (log.entity_id ? `#${log.entity_id.slice(-8)}` : '');
    const room = bookingInfo?.roomNumber || d.room_number ? `${L('Room', 'कमरा')} ${bookingInfo?.roomNumber || d.room_number}` : '';
    const roomType = bookingInfo?.roomType || d.room_type || '';
    const dates = bookingInfo?.checkIn && bookingInfo?.checkOut ? `(${bookingInfo.checkIn} → ${bookingInfo.checkOut})` : '';

    if (action === 'create' || action.includes('create')) {
      return {
        type: 'create',
        label: L('Booking Created', 'बुकिंग बनाई गई'),
        badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        description: L(
          `New room booking ${ref} created for customer "${cust || 'Guest'}"${room ? ` in ${room}` : ''}${roomType ? ` (${roomType})` : ''} ${dates}`,
          `ग्राहक "${cust || 'अतिथि'}" के लिए नई कमरा बुकिंग ${ref} बनाई गई${room ? ` (${room})` : ''}${roomType ? ` (${roomType})` : ''} ${dates}`
        ),
      };
    }
    if (action === 'status_change' || action === 'update_status') {
      const newStatus = d.new_status || d.status || bookingInfo?.status || 'updated';
      return {
        type: 'status',
        label: L('Booking Status Changed', 'बुकिंग स्थिति बदली'),
        badgeCls: 'bg-amber-50 text-amber-800 border-amber-200',
        description: L(
          `Changed status of booking ${ref} (Customer: "${cust || 'Guest'}"${room ? `, ${room}` : ''}) to "${newStatus}"`,
          `बुकिंग ${ref} (ग्राहक: "${cust || 'अतिथि'}"${room ? `, ${room}` : ''}) की स्थिति बदलकर "${newStatus}" की गई`
        ),
      };
    }
    if (action === 'payment_recorded' || action === 'payment') {
      const amt = d.amount || bookingInfo?.amount || '';
      const mode = d.mode || d.payment_method || 'Cash';
      return {
        type: 'payment',
        label: L('Payment Recorded', 'भुगतान दर्ज किया'),
        badgeCls: 'bg-teal-50 text-teal-700 border-teal-200',
        description: L(
          `Recorded payment of ₹${amt} via ${mode} for booking ${ref} (Customer: "${cust || 'Guest'}"${room ? `, ${room}` : ''})`,
          `बुकिंग ${ref} (ग्राहक: "${cust || 'अतिथि'}"${room ? `, ${room}` : ''}) के लिए ₹${amt} (${mode}) का भुगतान दर्ज किया गया`
        ),
      };
    }
    if (action === 'update') {
      const fields = Array.isArray(d.updated_fields) ? d.updated_fields.join(', ') : '';
      return {
        type: 'update',
        label: L('Booking Updated', 'बुकिंग अपडेट हुई'),
        badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',
        description: L(
          `Updated booking ${ref} for customer "${cust || 'Guest'}"${room ? ` (${room})` : ''}${fields ? ` [Fields: ${fields}]` : ''}`,
          `ग्राहक "${cust || 'अतिथि'}" की बुकिंग ${ref}${room ? ` (${room})` : ''} अपडेट की गई${fields ? ` [संशोधित: ${fields}]` : ''}`
        ),
      };
    }
  }

  // --- Restaurant Order Events ---
  if (entity === 'order') {
    const cust = orderInfo?.customerName || d.customer_name || d.guest || '';
    const ref = orderInfo?.orderRef || d.order_reference || d.ref || (log.entity_id ? `#${log.entity_id.slice(-8)}` : '');
    const ordType = orderInfo?.orderType || d.order_type || 'order';
    const table = orderInfo?.tableNumber || d.table_number ? `Table ${orderInfo?.tableNumber || d.table_number}` : '';
    const amt = orderInfo?.amount || d.amount || d.total_amount ? `₹${orderInfo?.amount || d.amount || d.total_amount}` : '';

    if (action === 'create' || action.includes('create')) {
      return {
        type: 'create',
        label: L('Order Created', 'ऑर्डर दर्ज हुआ'),
        badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        description: L(
          `New ${ordType} order ${ref} placed for customer "${cust || 'Guest'}"${table ? ` (${table})` : ''}${amt ? ` - Total: ${amt}` : ''}`,
          `ग्राहक "${cust || 'ग्राहक'}" का नया ${ordType} ऑर्डर ${ref} दर्ज हुआ${table ? ` (${table})` : ''}${amt ? ` - कुल: ${amt}` : ''}`
        ),
      };
    }
    if (action === 'status_change') {
      const newStatus = d.new_status || d.status || orderInfo?.status || 'updated';
      return {
        type: 'status',
        label: L('Order Status Changed', 'ऑर्डर स्थिति बदली'),
        badgeCls: 'bg-amber-50 text-amber-800 border-amber-200',
        description: L(
          `Changed order ${ref} (Customer: "${cust || 'Guest'}") status to "${newStatus}"`,
          `ऑर्डर ${ref} (ग्राहक: "${cust || 'ग्राहक'}") की स्थिति बदलकर "${newStatus}" की गई`
        ),
      };
    }
  }

  // --- Staff Management Events ---
  if (action === 'create_staff' || (action === 'staff' && d.summary?.includes('Invited'))) {
    const name = d.name || d.full_name || log.entity_id;
    const role = d.role || 'staff';
    return {
      type: 'create',
      label: L('Staff Added', 'स्टाफ जोड़ा गया'),
      badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description: L(
        `Added new staff member "${name}" with role "${role}"${d.email ? ` (${d.email})` : ''}`,
        `नया स्टाफ सदस्य "${name}" ("${role}") जोड़ा गया${d.email ? ` (${d.email})` : ''}`
      ),
    };
  }
  if (action === 'update_staff') {
    const fields = Array.isArray(d.updated_fields) ? d.updated_fields.join(', ') : '';
    return {
      type: 'update',
      label: L('Staff Updated', 'स्टाफ अपडेट किया गया'),
      badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',
      description: L(
        `Updated staff details for "${d.name || log.entity_id}"${fields ? ` (Modified: ${fields})` : ''}`,
        `"${d.name || log.entity_id}" के स्टाफ विवरण अपडेट किए गए${fields ? ` (संशोधित: ${fields})` : ''}`
      ),
    };
  }
  if (action === 'delete_staff' || action === 'staff_delete') {
    return {
      type: 'delete',
      label: L('Staff Deactivated', 'स्टाफ हटाया गया'),
      badgeCls: 'bg-rose-50 text-rose-700 border-rose-200',
      description: L(
        `Deactivated staff account for "${d.name || d.email || log.entity_id}"`,
        `"${d.name || d.email || log.entity_id}" का स्टाफ खाता निष्क्रिय किया गया`
      ),
    };
  }

  // --- Settings Events ---
  if (action === 'save' || action === 'update_settings' || entity === 'setting' || entity === 'settings') {
    return {
      type: 'update',
      label: L('Settings Saved', 'सेटिंग्स सेव की गईं'),
      badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      description: d.summary || L('Updated live phone numbers & hotel operational settings', 'लाइव फ़ोन नंबर और होटल सेटिंग्स अपडेट की गईं'),
    };
  }

  // Generic fallback
  return {
    type: 'general',
    label: action ? action.replace(/_/g, ' ').toUpperCase() : L('Activity', 'गतिविधि'),
    badgeCls: 'bg-slate-100 text-slate-700 border-slate-200',
    description: d.summary || log.summary || `${action || 'Action'} on ${entity || 'record'} #${log.entity_id || ''}`,
  };
}

export default function SettingsAdmin() {
  const { L } = useI18n();
  const { me, can } = useAdmin();
  const isOwner = me?.staff_role === 'owner' || me?.role === 'owner' || me?.role === 'admin';
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState('hotel');
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');
  const [saving, setSaving] = useState(false);

  // --- Staff Management State ---
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaff, setNewStaff] = useState({
    full_name: '',
    email: '',
    phone: '+91',
    role: 'staff',
    password: '',
    is_active: true,
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('all');

  // Edit Staff Modal
  const [editStaffModal, setEditStaffModal] = useState(null);
  const [editStaffForm, setEditStaffForm] = useState({
    full_name: '',
    email: '',
    phone: '+91',
    role: 'staff',
    password: '',
    is_active: true,
  });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // --- Audit Log State ---
  const [auditSearch, setAuditSearch] = useState('');
  const [auditEntityFilter, setAuditEntityFilter] = useState('all');
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [showRawJson, setShowRawJson] = useState({});
  const [auditRefreshing, setAuditRefreshing] = useState(false);

  // Load dashboard data including Bookings & Rooms for full audit visibility
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['admin-settings-dashboard'],
    queryFn: async () => {
      const settings = await getSettings();
      let users = [];
      let logs = [];
      let bookings = [];
      let rooms = [];
      if (isOwner) {
        try {
          users = await apiClient.entities.User.list();
        } catch {
          users = [];
        }
        try {
          const logsRes = await apiClient.entities.AuditLog.list({ limit: 200 });
          logs = Array.isArray(logsRes) ? logsRes : [];
        } catch {
          logs = [];
        }
        try {
          const bRes = await apiClient.entities.Booking.list().catch(() => []);
          bookings = Array.isArray(bRes) ? bRes : (bRes?.items || []);
        } catch {
          bookings = [];
        }
        try {
          const rRes = await apiClient.entities.Room.list().catch(() => []);
          rooms = Array.isArray(rRes) ? rRes : (rRes?.items || []);
        } catch {
          rooms = [];
        }
      }
      return {
        settings,
        users: Array.isArray(users) ? users : [],
        logs: Array.isArray(logs) ? logs : [],
        bookings: Array.isArray(bookings) ? bookings : [],
        rooms: Array.isArray(rooms) ? rooms : [],
      };
    },
    enabled: can('settings'),
  });

  // Cross-reference Maps for fast lookup
  const bookingMap = useMemo(() => {
    const map = new Map();
    (data?.bookings || []).forEach((b) => {
      if (b.id) map.set(b.id, b);
      if (b.booking_reference) map.set(b.booking_reference, b);
    });
    return map;
  }, [data?.bookings]);

  const roomMap = useMemo(() => {
    const map = new Map();
    (data?.rooms || []).forEach((r) => {
      if (r.id) map.set(r.id, r);
      if (r.room_number) map.set(r.room_number, r);
    });
    return map;
  }, [data?.rooms]);

  // Context resolver for bookings in audit logs
  const getAuditBookingInfo = (log) => {
    const entity = (log.entity_type || log.area || log.entity || '').toLowerCase();
    if (entity !== 'booking') return null;

    const d = log.details || {};
    const booking =
      bookingMap.get(log.entity_id) ||
      bookingMap.get(d.ref) ||
      bookingMap.get(d.booking_reference);

    const customerName =
      d.customer_name ||
      d.guest ||
      d.guest_name ||
      booking?.guest_name ||
      booking?.customer_name ||
      null;

    const bookingRef =
      d.booking_reference ||
      d.ref ||
      booking?.booking_reference ||
      (log.entity_id ? `#${log.entity_id.slice(-8)}` : null);

    let roomNumber = d.room_number || null;
    if (!roomNumber && booking?.assigned_room_id) {
      const r = roomMap.get(booking.assigned_room_id);
      roomNumber = r?.room_number || null;
    }
    if (!roomNumber && booking?.room_number) {
      roomNumber = booking.room_number;
    }

    const roomType =
      d.room_type ||
      booking?.room_type_name ||
      booking?.room_type?.name ||
      null;

    const checkIn = d.check_in || booking?.check_in || booking?.check_in_date || null;
    const checkOut = d.check_out || booking?.check_out || booking?.check_out_date || null;
    const phone = d.phone || d.guest_phone || booking?.guest_phone || booking?.phone || null;
    const amount = d.amount || d.total_amount || booking?.total_amount || null;
    const status = d.new_status || d.status || booking?.booking_status || booking?.status || null;

    return {
      customerName,
      bookingRef,
      roomNumber,
      roomType,
      checkIn,
      checkOut,
      phone,
      amount,
      status,
      hasDetails: Boolean(customerName || bookingRef || roomNumber || checkIn),
    };
  };

  // Context resolver for orders in audit logs
  const getAuditOrderInfo = (log) => {
    const entity = (log.entity_type || log.area || log.entity || '').toLowerCase();
    if (entity !== 'order') return null;

    const d = log.details || {};
    const customerName = d.customer_name || d.guest || d.guest_name || null;
    const orderRef =
      d.order_reference ||
      d.ref ||
      (log.entity_id ? `#${log.entity_id.slice(-8)}` : null);

    return {
      customerName,
      orderRef,
      orderType: d.order_type || null,
      tableNumber: d.table_number || null,
      phone: d.customer_phone || d.phone || null,
      amount: d.amount || d.total_amount || null,
      status: d.new_status || d.status || null,
      hasDetails: Boolean(customerName || orderRef),
    };
  };

  useEffect(() => {
    if (data?.settings) {
      const s = data.settings;
      setForm({
        hotel_name: s.hotel_name || 'B.S. Hotel & Restaurant',
        restaurant_name: s.restaurant_name || 'Delicee Restaurant',
        tagline: s.tagline || 'Pure Vegetarian Comfort & Dining on NH-2',
        whatsapp_number: s.whatsapp_number || '+919149224039',
        bookings_phone: s.bookings_phone || s.phone1 || '+919149224039',
        enquiries_phone: s.enquiries_phone || s.payments_phone || s.phone2 || '+919259273735',
        email: s.email || 'info@bshotel.in',
        address: s.address || 'Near Township Nagar, NH-2, Baad (Mathura), Uttar Pradesh',
        city: s.city || 'Mathura',
        state: s.state || 'Uttar Pradesh',
        pincode: s.pincode || '281006',
        google_maps_url: s.google_maps_url || 'https://maps.google.com/maps?q=Township+Nagar+NH-2+Baad+Mathura&output=embed',
        gstin: s.gstin || '',
        fssai_license: s.fssai_license || '',
        check_in_time: s.check_in_time || '12:00 PM',
        check_out_time: s.check_out_time || '11:00 AM',
        restaurant_tax_percent: Number(s.restaurant_tax_percent ?? s.tax_percent ?? 5),
        room_tax_percent: Number(s.room_tax_percent ?? 12),
        delivery_charge: Number(s.delivery_charge ?? 40),
        free_delivery_above: Number(s.free_delivery_above ?? 499),
        min_delivery_order: Number(s.min_delivery_order ?? 199),
        is_online_ordering_enabled: s.is_online_ordering_enabled !== false,
        is_room_booking_enabled: s.is_room_booking_enabled !== false,
        cancellation_policy: s.cancellation_policy || 'Free cancellation up to 24 hours before check-in. Non-refundable thereafter.',
      });
    } else if (data && !data.settings) {
      setForm({
        hotel_name: 'B.S. Hotel & Restaurant',
        restaurant_name: 'Delicee Restaurant',
        tagline: 'Pure Vegetarian Comfort & Dining on NH-2',
        whatsapp_number: '+919149224039',
        bookings_phone: '+919149224039',
        enquiries_phone: '+919259273735',
        email: 'info@bshotel.in',
        address: 'Near Township Nagar, NH-2, Baad (Mathura), Uttar Pradesh',
        city: 'Mathura',
        state: 'Uttar Pradesh',
        pincode: '281006',
        google_maps_url: 'https://maps.google.com/maps?q=Township+Nagar+NH-2+Baad+Mathura&output=embed',
        gstin: '',
        fssai_license: '',
        check_in_time: '12:00 PM',
        check_out_time: '11:00 AM',
        restaurant_tax_percent: 5,
        room_tax_percent: 12,
        delivery_charge: 40,
        free_delivery_above: 499,
        min_delivery_order: 199,
        is_online_ordering_enabled: true,
        is_room_booking_enabled: true,
        cancellation_policy: 'Free cancellation up to 24 hours before check-in. Non-refundable thereafter.',
      });
    }
  }, [data]);

  const setField = (k) => (e) => {
    setMsg('');
    let val = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    if (typeof val === 'object' && val !== null) {
      val = val.target?.value ?? val.value ?? '';
    }
    setForm((prev) => ({ ...prev, [k]: val }));
  };

  const showNotification = (text, type = 'success') => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => {
      setMsg('');
    }, 5000);
  };

  // Generate a friendly, secure password
  const generatePassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `BsHotel@${code}${Math.floor(10 + Math.random() * 89)}`;
  };

  // Save Hotel Settings
  const save = async () => {
    const payload = { ...form };
    ['id', 'created_date', 'updated_date', 'created_by_id'].forEach((k) => delete payload[k]);
    dispatch(updateSettingsOptimistic(payload));
    setSaving(true);
    try {
      await saveSettings(data?.settings?.id, payload);
      await audit(me, 'save', 'settings', 'Setting', data?.settings?.id || '', 'Updated hotel contact numbers and operations settings').catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['public-settings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-settings-dashboard'] });
      showNotification(L('Settings saved successfully! Website phone numbers and details updated.', 'सेटिंग्स सफलतापूर्वक सेव हो गईं! वेबसाइट के फ़ोन नंबर और विवरण अपडेट हो गए।'), 'success');
      refetch();
    } catch (err) {
      showNotification(err.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  // --- Staff Direct Creation (No email verification needed) ---
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.full_name.trim()) {
      showNotification(L('Please enter full name', 'कृपया पूरा नाम दर्ज करें'), 'error');
      return;
    }
    if (!newStaff.email.trim()) {
      showNotification(L('Please enter email address', 'कृपया ईमेल दर्ज करें'), 'error');
      return;
    }
    if (!newStaff.password || newStaff.password.length < 6) {
      showNotification(L('Password must be at least 6 characters', 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए'), 'error');
      return;
    }

    const cleanPhone = typeof newStaff.phone === 'object' && newStaff.phone !== null
      ? (newStaff.phone.target?.value ?? newStaff.phone.value ?? '')
      : String(newStaff.phone || '');

    setStaffSubmitting(true);
    try {
      await apiClient.entities.User.create({
        full_name: newStaff.full_name.trim(),
        email: newStaff.email.trim().toLowerCase(),
        phone: cleanPhone || '+919999999999',
        role: newStaff.role,
        password: newStaff.password,
        is_active: newStaff.is_active,
      });

      await audit(
        me,
        'create_staff',
        'staff',
        'User',
        newStaff.email,
        `Created staff account for ${newStaff.full_name} (${newStaff.role})`
      );

      showNotification(
        L(
          `Staff account created for ${newStaff.full_name}! They can log in immediately.`,
          `${newStaff.full_name} का स्टाफ खाता बन गया! वे तुरंत लॉगिन कर सकते हैं।`
        ),
        'success'
      );

      setNewStaff({
        full_name: '',
        email: '',
        phone: '+91',
        role: 'staff',
        password: '',
        is_active: true,
      });
      setShowAddStaffModal(false);
      refetch();
    } catch (err) {
      showNotification(err.message || L('Could not create staff account', 'स्टाफ खाता नहीं बनाया जा सका'), 'error');
    } finally {
      setStaffSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditStaff = (user) => {
    setEditStaffModal(user);
    setEditStaffForm({
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '+91',
      role: user.role === 'admin' ? 'owner' : (user.staff_role || user.role || 'staff'),
      password: '',
      is_active: user.is_active !== false && user.staff_active !== false,
    });
    setShowEditPassword(false);
  };

  // Save Edited Staff
  const handleUpdateStaff = async (e) => {
    e.preventDefault();
    if (!editStaffModal) return;

    const cleanPhone = typeof editStaffForm.phone === 'object' && editStaffForm.phone !== null
      ? (editStaffForm.phone.target?.value ?? editStaffForm.phone.value ?? '')
      : String(editStaffForm.phone || '');

    setEditSubmitting(true);
    try {
      const payload = {
        full_name: editStaffForm.full_name.trim(),
        email: editStaffForm.email.trim().toLowerCase(),
        phone: cleanPhone,
        role: editStaffForm.role,
        is_active: editStaffForm.is_active,
      };

      if (editStaffForm.password && editStaffForm.password.trim().length >= 6) {
        payload.password = editStaffForm.password.trim();
      }

      await apiClient.entities.User.update(editStaffModal.id, payload);

      await audit(
        me,
        'update_staff',
        'staff',
        'User',
        editStaffModal.id,
        `Updated staff details for ${editStaffForm.full_name} (${editStaffForm.role})`
      );

      showNotification(
        L(`Staff details updated for ${editStaffForm.full_name}!`, `${editStaffForm.full_name} के विवरण अपडेट कर दिए गए!`),
        'success'
      );

      setEditStaffModal(null);
      refetch();
    } catch (err) {
      showNotification(err.message || L('Could not update staff member', 'स्टाफ सदस्य अपडेट नहीं हो सका'), 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Quick 1-click Role change
  const setRole = async (user, newRole) => {
    try {
      await apiClient.entities.User.update(user.id, { role: newRole, is_active: true });
      await audit(me, 'update_staff', 'staff', 'User', user.id, `${user.email} role changed to ${newRole}`);
      showNotification(L(`Role updated to ${newRole}`, `भूमिका बदलकर ${newRole} कर दी गई`), 'success');
      refetch();
    } catch (err) {
      showNotification(err.message || 'Failed to update role', 'error');
    }
  };

  // Quick 1-click Toggle active/blocked
  const toggleActive = async (user) => {
    const nextActive = user.is_active === false || user.staff_active === false;
    try {
      await apiClient.entities.User.update(user.id, { is_active: nextActive });
      await audit(me, 'update_staff', 'staff', 'User', user.id, `${user.email} status changed to ${nextActive ? 'Active' : 'Blocked'}`);
      showNotification(
        nextActive
          ? L(`Account activated for ${user.full_name || user.email}`, `${user.full_name || user.email} का खाता सक्रिय किया`)
          : L(`Account blocked for ${user.full_name || user.email}`, `${user.full_name || user.email} का खाता ब्लॉक किया`),
        'success'
      );
      refetch();
    } catch (err) {
      showNotification(err.message || 'Failed to update status', 'error');
    }
  };

  // Deactivate staff
  const deleteStaff = async (user) => {
    if (
      !window.confirm(
        L(
          `Are you sure you want to remove staff account for ${user.full_name || user.email}?`,
          `क्या आप ${user.full_name || user.email} का स्टाफ खाता हटाना चाहते हैं?`
        )
      )
    )
      return;
    try {
      await apiClient.entities.User.delete(user.id);
      await audit(me, 'delete_staff', 'staff', 'User', user.id, `Removed ${user.email}`);
      showNotification(L('Staff member removed successfully.', 'स्टाफ सदस्य सफलतापूर्वक हटाया गया।'), 'success');
      refetch();
    } catch (err) {
      showNotification(err.message || 'Could not remove staff member', 'error');
    }
  };

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    const list = data?.users || [];
    return list.filter((u) => {
      const q = staffSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.phone || '').includes(q);

      const r = (u.role === 'admin' ? 'owner' : (u.staff_role || u.role || 'staff')).toLowerCase();
      const matchRole = staffRoleFilter === 'all' || r === staffRoleFilter;
      return matchSearch && matchRole;
    });
  }, [data?.users, staffSearch, staffRoleFilter]);

  // Filtered audit logs with deep search across guest name, booking ref, room number, etc.
  const filteredAuditLogs = useMemo(() => {
    const logs = data?.logs || [];
    return logs.filter((l) => {
      const q = auditSearch.trim().toLowerCase();
      const actor = (l.user_name || l.actor_name || l.actor_email || '').toLowerCase();
      const action = (l.action || '').toLowerCase();
      const entity = (l.entity_type || l.area || l.entity || '').toLowerCase();
      const id = String(l.entity_id || l.record_id || '').toLowerCase();
      const summary = (l.details?.summary || l.summary || '').toLowerCase();

      // Deep search in booking context
      const bInfo = getAuditBookingInfo(l);
      const cust = (bInfo?.customerName || l.details?.customer_name || l.details?.guest || '').toLowerCase();
      const ref = (bInfo?.bookingRef || l.details?.booking_reference || l.details?.ref || '').toLowerCase();
      const roomNum = String(bInfo?.roomNumber || l.details?.room_number || '').toLowerCase();
      const roomType = String(bInfo?.roomType || l.details?.room_type || '').toLowerCase();

      const matchSearch =
        !q ||
        actor.includes(q) ||
        action.includes(q) ||
        entity.includes(q) ||
        id.includes(q) ||
        summary.includes(q) ||
        cust.includes(q) ||
        ref.includes(q) ||
        roomNum.includes(q) ||
        roomType.includes(q);

      const matchEntity =
        auditEntityFilter === 'all' ||
        entity === auditEntityFilter ||
        (auditEntityFilter === 'setting' && (entity === 'setting' || entity === 'settings')) ||
        (auditEntityFilter === 'user' && (entity === 'user' || entity === 'staff'));

      let matchAction = true;
      if (auditActionFilter !== 'all') {
        if (auditActionFilter === 'create') {
          matchAction = action.includes('create') || action === 'staff';
        } else if (auditActionFilter === 'update') {
          matchAction = action.includes('update') || action === 'save';
        } else if (auditActionFilter === 'status') {
          matchAction = action.includes('status');
        } else if (auditActionFilter === 'delete') {
          matchAction = action.includes('delete');
        } else if (auditActionFilter === 'payment') {
          matchAction = action.includes('payment');
        }
      }

      return matchSearch && matchEntity && matchAction;
    });
  }, [data?.logs, auditSearch, auditEntityFilter, auditActionFilter, bookingMap, roomMap]);

  if (!can('settings') || !form) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        {L('Only the owner or managers can open settings.', 'केवल मालिक या प्रबंधक सेटिंग्स खोल सकते हैं।')}
      </div>
    );
  }

  const inputCls =
    'mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 bg-white text-slate-900 transition-all';

  const tabs = [
    ['hotel', L('Hotel & Contact Settings', 'होटल और संपर्क सेटिंग्स'), Building],
    ['staff', L('Staff Accounts', 'स्टाफ खाते'), Users, (data?.users || []).length],
    ['audit', L('Audit Log', 'ऑडिट लॉग'), History, (data?.logs || []).length],
  ];

  return (
    <div className="space-y-5 max-w-5xl pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{L('Settings', 'सेटिंग्स')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {L(
              'Manage live website phone numbers, direct staff accounts, permissions and clear activity audit trails.',
              'वेबसाइट के फ़ोन नंबर, स्टाफ खाते, अनुमतियाँ और स्पष्ट गतिविधि ऑडिट लॉग प्रबंधित करें।'
            )}
          </p>
        </div>
        {tab === 'hotel' && (
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60 transition-all"
          >
            <Save size={16} />
            {saving ? L('Saving…', 'सेव हो रहा है…') : L('Save Changes', 'बदलाव सेव करें')}
          </button>
        )}
      </div>

      {/* Tabs navigation */}
      <div className="flex gap-1.5 overflow-x-auto rounded-xl bg-slate-100 p-1.5 text-sm font-semibold">
        {tabs.map(([k, label, Icon, count]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 transition-all ${
              tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon size={16} />
            <span>{label}</span>
            {count !== undefined && (
              <span
                className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                  tab === k ? 'bg-slate-100 text-slate-700' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alert / Notification banner */}
      {msg && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium animate-in fade-in ${
            msgType === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {msgType === 'error' ? (
              <AlertTriangle size={18} className="text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            )}
            <span>{msg}</span>
          </div>
          <button onClick={() => setMsg('')} className="p-1 hover:opacity-75">
            <X size={15} />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 1: HOTEL & CONTACT SETTINGS */}
      {/* ============================================================== */}
      {tab === 'hotel' && (
        <div className="space-y-6">
          {/* Card 1: Working Phone Numbers (WhatsApp, Bookings, Enquiries) */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 sm:p-6 shadow-sm">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 shrink-0 mt-0.5">
                <Phone size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {L('Live Contact & Helpline Numbers', 'लाइव संपर्क और हेल्पलाइन नंबर')}
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  {L(
                    'Changing these numbers immediately updates the website header, mobile call bar, WhatsApp floating button, and contact page.',
                    'इन नंबरों को बदलने से वेबसाइट के हेडर, मोबाइल कॉल बार, व्हाट्सएप बटन और संपर्क पृष्ठ तुरंत अपडेट हो जाते हैं।'
                  )}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <MessageCircle size={14} className="text-emerald-600" />
                  {L('WhatsApp Number', 'व्हाट्सएप नंबर')}
                </label>
                <PhoneInput
                  variant="admin"
                  value={form.whatsapp_number}
                  onChange={setField('whatsapp_number')}
                  placeholder="91492 24039"
                  className="mt-1"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  {L('Controls floating button & WhatsApp ordering', 'फ्लोटिंग बटन और व्हाट्सएप ऑर्डरिंग नियंत्रित करता है')}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Phone size={14} className="text-blue-600" />
                  {L('Room Bookings Helpline', 'कमरा बुकिंग हेल्पलाइन')}
                </label>
                <PhoneInput
                  variant="admin"
                  value={form.bookings_phone}
                  onChange={setField('bookings_phone')}
                  placeholder="91492 24039"
                  className="mt-1"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  {L('Primary number on Header, Call Us & Reception', 'हेडर, कॉल अस और रिसेप्शन पर मुख्य नंबर')}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Phone size={14} className="text-indigo-600" />
                  {L('Event Enquiries & Support', 'इवेंट पूछताछ और सहायता')}
                </label>
                <PhoneInput
                  variant="admin"
                  value={form.enquiries_phone}
                  onChange={setField('enquiries_phone')}
                  placeholder="92592 73735"
                  className="mt-1"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  {L('Banquet, Wedding, Ring Ceremony & Billing', 'बैंक्वेट, शादी, सगाई और बिलिंग पूछताछ')}
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Hotel Identity */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Building size={18} className="text-slate-700" />
              {L('Business Profile & Identity', 'व्यावसायिक प्रोफ़ाइल और पहचान')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-700">{L('Hotel Name', 'होटल का नाम')}</label>
                <input
                  className={inputCls}
                  value={form.hotel_name}
                  onChange={setField('hotel_name')}
                  placeholder="B.S. Hotel & Restaurant"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">{L('Restaurant Name', 'रेस्टोरेंट का नाम')}</label>
                <input
                  className={inputCls}
                  value={form.restaurant_name}
                  onChange={setField('restaurant_name')}
                  placeholder="Delicee Restaurant"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">{L('Tagline / Slogan', 'टैगलाइन')}</label>
                <input
                  className={inputCls}
                  value={form.tagline}
                  onChange={setField('tagline')}
                  placeholder="Pure Vegetarian Comfort & Dining on NH-2"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">{L('Official Email', 'आधिकारिक ईमेल')}</label>
                <input
                  type="email"
                  className={inputCls}
                  value={form.email}
                  onChange={setField('email')}
                  placeholder="info@bshotel.in"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Location & Address */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin size={18} className="text-slate-700" />
              {L('Location & Address', 'स्थान और पता')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label className="text-xs font-medium text-slate-700">{L('Full Street Address', 'पूरा पता')}</label>
                <input
                  className={inputCls}
                  value={form.address}
                  onChange={setField('address')}
                  placeholder="Near Township Nagar, NH-2, Baad (Mathura), Uttar Pradesh"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">{L('City', 'शहर')}</label>
                <input className={inputCls} value={form.city} onChange={setField('city')} placeholder="Mathura" />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">{L('State', 'राज्य')}</label>
                <input className={inputCls} value={form.state} onChange={setField('state')} placeholder="Uttar Pradesh" />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">{L('Pincode', 'पिनकोड')}</label>
                <input className={inputCls} value={form.pincode} onChange={setField('pincode')} placeholder="281006" />
              </div>

              <div className="sm:col-span-3">
                <label className="text-xs font-medium text-slate-700">
                  {L('Google Maps Embed / Location URL', 'गूगल मैप्स एम्बेड / लोकेशन लिंक')}
                </label>
                <input
                  className={inputCls}
                  value={form.google_maps_url}
                  onChange={setField('google_maps_url')}
                  placeholder="https://maps.google.com/..."
                />
              </div>
            </div>
          </div>

          {/* Card 4: Operations, Timings & Taxes */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Percent size={18} className="text-slate-700" />
              {L('Operations, Timings & Taxes', 'संचालन, समय और टैक्स')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Clock size={13} className="text-slate-500" />
                  {L('Check-in Time', 'चेक-इन समय')}
                </label>
                <input className={inputCls} value={form.check_in_time} onChange={setField('check_in_time')} placeholder="12:00 PM" />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Clock size={13} className="text-slate-500" />
                  {L('Check-out Time', 'चेक-आउट समय')}
                </label>
                <input className={inputCls} value={form.check_out_time} onChange={setField('check_out_time')} placeholder="11:00 AM" />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">{L('Restaurant GST / Tax %', 'रेस्टोरेंट टैक्स %')}</label>
                <input
                  type="number"
                  step="0.5"
                  className={inputCls}
                  value={form.restaurant_tax_percent}
                  onChange={setField('restaurant_tax_percent')}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">{L('Room GST / Tax %', 'कमरा टैक्स %')}</label>
                <input
                  type="number"
                  step="0.5"
                  className={inputCls}
                  value={form.room_tax_percent}
                  onChange={setField('room_tax_percent')}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Truck size={13} className="text-slate-500" />
                  {L('Delivery Charge ₹', 'डिलीवरी शुल्क ₹')}
                </label>
                <input
                  type="number"
                  className={inputCls}
                  value={form.delivery_charge}
                  onChange={setField('delivery_charge')}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">{L('Free Delivery Above ₹', 'मुफ़्त डिलीवरी ₹ ऊपर')}</label>
                <input
                  type="number"
                  className={inputCls}
                  value={form.free_delivery_above}
                  onChange={setField('free_delivery_above')}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">{L('Min Order for Delivery ₹', 'न्यूनतम डिलीवरी ऑर्डर ₹')}</label>
                <input
                  type="number"
                  className={inputCls}
                  value={form.min_delivery_order}
                  onChange={setField('min_delivery_order')}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">{L('GSTIN Number', 'GSTIN नंबर')}</label>
                <input className={inputCls} value={form.gstin} onChange={setField('gstin')} placeholder="09AAAAA0000A1Z5" />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-700">{L('FSSAI Food License', 'FSSAI लाइसेंस')}</label>
                <input className={inputCls} value={form.fssai_license} onChange={setField('fssai_license')} placeholder="100XXXXXXXXXXX" />
              </div>

              <div className="sm:col-span-2 flex flex-col justify-center gap-2 pt-1">
                <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-amber-400"
                    checked={form.is_online_ordering_enabled}
                    onChange={setField('is_online_ordering_enabled')}
                  />
                  <span className="font-medium">{L('Enable Online Food Ordering', 'ऑनलाइन फूड ऑर्डर स्वीकार करें')}</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-amber-400"
                    checked={form.is_room_booking_enabled}
                    onChange={setField('is_room_booking_enabled')}
                  />
                  <span className="font-medium">{L('Enable Online Room Booking Requests', 'ऑनलाइन कमरा बुकिंग अनुरोध स्वीकार करें')}</span>
                </label>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {L('Cancellation & Refund Policy', 'रद्द करने और रिफंड की नीति')}
              </label>
              <textarea
                rows={3}
                className={inputCls}
                value={form.cancellation_policy}
                onChange={setField('cancellation_policy')}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60 transition-all"
            >
              <Save size={16} />
              {saving ? L('Saving…', 'सेव हो रहा है…') : L('Save Changes', 'बदलाव सेव करें')}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: DIRECT STAFF MANAGEMENT (NO EMAIL VERIFICATION) */}
      {/* ============================================================== */}
      {tab === 'staff' && (
        <div className="space-y-4">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users size={18} className="text-slate-800" />
                {L('Staff Accounts & Team Roles', 'स्टाफ खाते और टीम भूमिकाएं')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {L(
                  'Owner can directly add staff members with custom passwords and roles. No email verification required.',
                  'मालिक सीधे पासवर्ड और भूमिका के साथ स्टाफ सदस्यों को जोड़ सकता है। ईमेल सत्यापन की आवश्यकता नहीं है।'
                )}
              </p>
            </div>
            <button
              onClick={() => {
                setShowAddStaffModal(!showAddStaffModal);
                if (!showAddStaffModal && !newStaff.password) {
                  setNewStaff((prev) => ({ ...prev, password: generatePassword() }));
                }
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-all shrink-0"
            >
              <UserPlus size={16} />
              {showAddStaffModal ? L('Close Form', 'फॉर्म बंद करें') : L('+ Add Staff Member', '+ नया स्टाफ जोड़ें')}
            </button>
          </div>

          {/* Add Staff Form Card */}
          {showAddStaffModal && (
            <div className="rounded-2xl border-2 border-slate-900 bg-white p-5 sm:p-6 shadow-md animate-in slide-in-from-top-3">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-slate-900 text-white rounded-xl">
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {L('Direct Staff Account Registration', 'सीधा स्टाफ खाता पंजीकरण')}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {L(
                        'Set login credentials directly. Staff member can log in immediately upon creation.',
                        'सीधे लॉगिन क्रेडेंशियल सेट करें। स्टाफ तुरंत लॉगिन कर सकेगा।'
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateStaff} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {L('Full Name', 'पूरा नाम')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      className={inputCls}
                      value={newStaff.full_name}
                      onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {L('Staff Role & Permissions', 'स्टाफ भूमिका')} <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className={inputCls}
                      value={newStaff.role}
                      onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                    >
                      <option value="staff">
                        {L('Staff (Front Desk & Kitchen Orders)', 'स्टाफ (फ्रंट डेस्क और किचन ऑर्डर्स)')}
                      </option>
                      <option value="manager">
                        {L('Manager (Bookings, Menu, Orders & Reports)', 'मैनेजर (बुकिंग, मेन्यू, ऑर्डर्स और रिपोर्ट्स)')}
                      </option>
                      <option value="owner">
                        {L('Owner (Full Administrative Access)', 'मालिक (पूर्ण प्रशासनिक अधिकार)')}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {L('Email Address (Username)', 'ईमेल पता (यूज़रनेम)')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="rahul@bshotel.in"
                      className={inputCls}
                      value={newStaff.email}
                      onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {L('Mobile Phone Number', 'मोबाइल फ़ोन नंबर')} <span className="text-rose-500">*</span>
                    </label>
                    <PhoneInput
                      variant="admin"
                      value={newStaff.phone}
                      onChange={(e) => {
                        const val = typeof e === 'object' && e?.target ? e.target.value : (e?.value ?? String(e || ''));
                        setNewStaff((prev) => ({ ...prev, phone: val }));
                      }}
                      placeholder="91492 24039"
                      className="mt-1"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        {L('Login Password', 'लॉगिन पासवर्ड')} <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setNewStaff({ ...newStaff, password: generatePassword() })}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
                      >
                        <Sparkles size={13} />
                        {L('Generate Secure Password', 'सुरक्षित पासवर्ड बनाएं')}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="Enter password (minimum 6 characters)"
                        className={`${inputCls} pr-10`}
                        value={newStaff.password}
                        onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {L(
                        'Direct access: Provide this password to the staff member. They will sign in directly on the admin login page.',
                        'सीधा एक्सेस: यह पासवर्ड स्टाफ सदस्य को दें। वे सीधे एडमिन लॉगिन पेज पर साइन इन करेंगे।'
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-amber-400"
                      checked={newStaff.is_active}
                      onChange={(e) => setNewStaff({ ...newStaff, is_active: e.target.checked })}
                    />
                    <span>{L('Account Active (Can log in immediately)', 'खाता सक्रिय है (तुरंत लॉगिन कर सकते हैं)')}</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddStaffModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      {L('Cancel', 'रद्द करें')}
                    </button>
                    <button
                      type="submit"
                      disabled={staffSubmitting}
                      className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-60 transition-colors"
                    >
                      <UserPlus size={15} />
                      {staffSubmitting ? L('Creating Account…', 'खाता बन रहा है…') : L('Create Staff Account', 'स्टाफ खाता बनाएं')}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder={L('Search staff by name, email or phone…', 'नाम, ईमेल या फ़ोन से खोजें…')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3.5 py-2 text-xs outline-none focus:bg-white focus:border-amber-500"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
              />
              {staffSearch && (
                <button
                  onClick={() => setStaffSearch('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              <span className="text-slate-400 text-xs px-1 flex items-center gap-1">
                <Filter size={13} /> {L('Role:', 'भूमिका:')}
              </span>
              {[
                ['all', L('All', 'सभी')],
                ['owner', L('Owners', 'मालिक')],
                ['manager', L('Managers', 'मैनेजर')],
                ['staff', L('Staff', 'स्टाफ')],
              ].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setStaffRoleFilter(k)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    staffRoleFilter === k
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Staff Accounts Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">{L('Staff Member', 'स्टाफ सदस्य')}</th>
                  <th className="px-5 py-3.5">{L('Phone Number', 'फ़ोन नंबर')}</th>
                  <th className="px-5 py-3.5">{L('Role / Access', 'भूमिका')}</th>
                  <th className="px-5 py-3.5">{L('Status', 'स्थिति')}</th>
                  <th className="px-5 py-3.5 text-right">{L('Actions', 'कार्रवाई')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-sm text-slate-400">
                      <Users size={32} className="mx-auto text-slate-300 mb-2" />
                      {L('No staff members found matching criteria.', 'कोई स्टाफ सदस्य नहीं मिला।')}
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((u) => {
                    const currentRole = u.role === 'admin' ? 'owner' : (u.staff_role || u.role || 'staff');
                    const badge = getRoleBadge(currentRole, L);
                    const isActive = u.is_active !== false && u.staff_active !== false;
                    const isSelf = u.id === me?.id;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Member Identity */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${badge.avatarBg}`}
                            >
                              {(u.full_name || u.email || 'S').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-slate-900">{u.full_name || u.email}</p>
                                {isSelf && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                                    {L('You', 'आप')}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Mail size={11} className="text-slate-400" />
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="px-5 py-3.5 text-xs text-slate-700">
                          {u.phone ? (
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Phone size={12} className="text-slate-400" />
                              {u.phone}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">{L('No phone', 'कोई फ़ोन नहीं')}</span>
                          )}
                        </td>

                        {/* Role Dropdown */}
                        <td className="px-5 py-3.5">
                          <select
                            value={currentRole}
                            disabled={isSelf}
                            onChange={(e) => setRole(u, e.target.value)}
                            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold disabled:opacity-60 bg-white text-slate-800"
                          >
                            <option value="owner">{L('Owner', 'मालिक')}</option>
                            <option value="manager">{L('Manager', 'मैनेजर')}</option>
                            <option value="staff">{L('Staff', 'स्टाफ')}</option>
                          </select>
                        </td>

                        {/* Status Toggle */}
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => toggleActive(u)}
                            disabled={isSelf}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-50 transition-colors ${
                              !isActive
                                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-600' : 'bg-red-600'}`} />
                            {isActive ? L('Active', 'सक्रिय') : L('Blocked', 'अवरुद्ध')}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditStaff(u)}
                              className="inline-flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                              title={L('Edit staff details & reset password', 'स्टाफ विवरण संपादित करें और पासवर्ड बदलें')}
                            >
                              <Edit3 size={15} />
                            </button>

                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => deleteStaff(u)}
                                className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                title={L('Deactivate user account', 'खाता निष्क्रिय करें')}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Edit Staff Modal */}
          {editStaffModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-slate-100 rounded-xl text-slate-800">
                      <Edit3 size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">
                        {L('Edit Staff Details', 'स्टाफ विवरण संपादित करें')}
                      </h3>
                      <p className="text-xs text-slate-500">{editStaffModal.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditStaffModal(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleUpdateStaff} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {L('Full Name', 'पूरा नाम')}
                    </label>
                    <input
                      type="text"
                      required
                      className={inputCls}
                      value={editStaffForm.full_name}
                      onChange={(e) => setEditStaffForm({ ...editStaffForm, full_name: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        {L('Staff Role', 'भूमिका')}
                      </label>
                      <select
                        className={inputCls}
                        value={editStaffForm.role}
                        onChange={(e) => setEditStaffForm({ ...editStaffForm, role: e.target.value })}
                      >
                        <option value="staff">{L('Staff', 'स्टाफ')}</option>
                        <option value="manager">{L('Manager', 'मैनेजर')}</option>
                        <option value="owner">{L('Owner', 'मालिक')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        {L('Account Status', 'स्थिति')}
                      </label>
                      <select
                        className={inputCls}
                        value={editStaffForm.is_active ? 'active' : 'blocked'}
                        onChange={(e) =>
                          setEditStaffForm({ ...editStaffForm, is_active: e.target.value === 'active' })
                        }
                      >
                        <option value="active">{L('Active (Enabled)', 'सक्रिय')}</option>
                        <option value="blocked">{L('Blocked (Disabled)', 'अवरुद्ध')}</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {L('Mobile Phone Number', 'मोबाइल फ़ोन नंबर')}
                    </label>
                    <PhoneInput
                      variant="admin"
                      value={editStaffForm.phone}
                      onChange={(e) => {
                        const val = typeof e === 'object' && e?.target ? e.target.value : (e?.value ?? String(e || ''));
                        setEditStaffForm((prev) => ({ ...prev, phone: val }));
                      }}
                      placeholder="91492 24039"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {L('Email Address', 'ईमेल पता')}
                    </label>
                    <input
                      type="email"
                      required
                      className={inputCls}
                      value={editStaffForm.email}
                      onChange={(e) => setEditStaffForm({ ...editStaffForm, email: e.target.value })}
                    />
                  </div>

                  {/* Reset Password */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Key size={13} className="text-amber-700" />
                        {L('Reset Password Directly', 'सीधा पासवर्ड रीसेट')}
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setEditStaffForm({ ...editStaffForm, password: generatePassword() })
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 hover:text-amber-900 underline"
                      >
                        <Sparkles size={12} />
                        {L('Generate', 'बनाएं')}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showEditPassword ? 'text' : 'password'}
                        placeholder={L(
                          'Leave blank to keep existing password',
                          'मौजूदा पासवर्ड रखने के लिए खाली छोड़ें'
                        )}
                        className={`${inputCls} pr-10 bg-white`}
                        value={editStaffForm.password}
                        onChange={(e) => setEditStaffForm({ ...editStaffForm, password: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                      >
                        {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p className="text-[11px] text-amber-700 mt-1">
                      {L(
                        'Direct password reset: Owner can set any new password immediately without email link.',
                        'मालिक बिना किसी ईमेल लिंक के तुरंत नया पासवर्ड सेट कर सकता है।'
                      )}
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditStaffModal(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      {L('Cancel', 'रद्द करें')}
                    </button>
                    <button
                      type="submit"
                      disabled={editSubmitting}
                      className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-60"
                    >
                      <Save size={15} />
                      {editSubmitting ? L('Saving…', 'सेव हो रहा है…') : L('Save Changes', 'बदलाव सेव करें')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: CLEAN ACTIVITY AUDIT LOG (RICH BOOKING & ORDER DETAILS) */}
      {/* ============================================================== */}
      {tab === 'audit' && (
        <div className="space-y-4">
          {/* Audit Controls & Summary Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History size={18} className="text-slate-800" />
                {L('System & Operations Audit Log', 'सिस्टम और संचालन ऑडिट लॉग')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {L(
                  'Transparent activity trail showing customer names, booking refs, room numbers, and staff actions.',
                  'पारदर्शी गतिविधि रिकॉर्ड जो ग्राहक का नाम, बुकिंग संदर्भ, कमरा नंबर और स्टाफ की कार्रवाइयां दिखाता है।'
                )}
              </p>
            </div>
            <button
              onClick={async () => {
                setAuditRefreshing(true);
                await refetch();
                setTimeout(() => setAuditRefreshing(false), 500);
              }}
              disabled={auditRefreshing || isFetching}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <RefreshCw size={14} className={auditRefreshing || isFetching ? 'animate-spin' : ''} />
              {L('Refresh Logs', 'लॉग रीफ्रेश करें')}
            </button>
          </div>

          {/* Search & Filters */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder={L(
                  'Search by Customer Name, Booking #, Room Number, Staff Name, or Action…',
                  'ग्राहक का नाम, बुकिंग #, कमरा नंबर, स्टाफ का नाम या एक्शन से खोजें…'
                )}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3.5 py-2 text-xs outline-none focus:bg-white focus:border-amber-500"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
              />
              {auditSearch && (
                <button
                  onClick={() => setAuditSearch('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
              {/* Entity Filter */}
              <div className="flex items-center gap-1 overflow-x-auto py-1">
                <span className="text-slate-400 font-medium px-1 flex items-center gap-1">
                  <Filter size={12} /> {L('Entity:', 'इकाई:')}
                </span>
                {[
                  ['all', L('All', 'सभी')],
                  ['booking', L('Bookings', 'बुकिंग्स')],
                  ['order', L('Orders', 'ऑर्डर्स')],
                  ['user', L('Staff / Users', 'स्टाफ')],
                  ['setting', L('Settings', 'सेटिंग्स')],
                  ['menu', L('Menu', 'मेन्यू')],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setAuditEntityFilter(k)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      auditEntityFilter === k
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Action Filter */}
              <div className="flex items-center gap-1 overflow-x-auto py-1">
                <span className="text-slate-400 font-medium px-1">{L('Action:', 'एक्शन:')}</span>
                {[
                  ['all', L('All', 'सभी')],
                  ['create', L('Created / Added', 'नया')],
                  ['update', L('Updated', 'अपडेट')],
                  ['status', L('Status Changed', 'स्थिति')],
                  ['payment', L('Payments', 'पेमेंट')],
                  ['delete', L('Deleted / Removed', 'हटाया')],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setAuditActionFilter(k)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      auditActionFilter === k
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Audit Logs List */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>{L('Activity History', 'गतिविधि इतिहास')}</span>
              <span>
                {L(`Showing ${filteredAuditLogs.length} events`, `${filteredAuditLogs.length} घटनाएं प्रदर्शित`)}
              </span>
            </div>

            {filteredAuditLogs.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-400">
                <History size={36} className="mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-600">
                  {L('No audit activity matches your filter.', 'फ़िल्टर से मेल खाती कोई गतिविधि नहीं मिली।')}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {L('Try resetting search or filters to see all recorded logs.', 'सभी लॉग देखने के लिए सर्च या फ़िल्टर रीसेट करें।')}
                </p>
                {(auditSearch || auditEntityFilter !== 'all' || auditActionFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setAuditSearch('');
                      setAuditEntityFilter('all');
                      setAuditActionFilter('all');
                    }}
                    className="mt-3 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                  >
                    {L('Reset Filters', 'फ़िल्टर रीसेट करें')}
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredAuditLogs.map((log) => {
                  const bookingInfo = getAuditBookingInfo(log);
                  const orderInfo = getAuditOrderInfo(log);
                  const actionMeta = formatAuditAction(log, L, bookingInfo, orderInfo);
                  const actorRole = log.user_role || log.actor_role || 'system';
                  const roleBadge = getRoleBadge(actorRole, L);
                  const actorName = log.user_name || log.actor_name || log.actor_email || 'System / Guest';
                  const isExpanded = expandedLogId === log.id;
                  const logDate = log.created_at || log.created_date;
                  const details = log.details || {};
                  const detailKeys = Object.keys(details).filter((k) => k !== 'summary');

                  return (
                    <li key={log.id} className="p-4 hover:bg-slate-50/70 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        {/* Left: Actor & Action Description */}
                        <div className="flex items-start gap-3 flex-1">
                          {/* Actor Avatar */}
                          <div
                            className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${roleBadge.avatarBg}`}
                            title={`${actorName} (${roleBadge.label})`}
                          >
                            {actorName.charAt(0).toUpperCase()}
                          </div>

                          {/* Body */}
                          <div className="space-y-1.5 flex-1 min-w-0">
                            {/* Actor Name + Badges Header */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{actorName}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleBadge.cls}`}
                              >
                                {roleBadge.label}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${actionMeta.badgeCls}`}
                              >
                                {actionMeta.label}
                              </span>
                              {log.entity_type && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  {log.entity_type}
                                  {log.entity_id ? ` #${log.entity_id.slice(-8)}` : ''}
                                </span>
                              )}
                            </div>

                            {/* Human-readable Description */}
                            <p className="text-xs text-slate-800 font-medium leading-relaxed">
                              {actionMeta.description}
                            </p>

                            {/* --- CLEAR VISION: DEDICATED BOOKING HIGHLIGHT CHIP STRIP --- */}
                            {bookingInfo && bookingInfo.hasDetails && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {bookingInfo.customerName && (
                                  <span className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-900 shadow-2xs">
                                    <UserIcon size={12} className="text-blue-600 shrink-0" />
                                    <span className="text-slate-500 font-normal">{L('Guest:', 'अतिथि:')}</span>
                                    <span>{bookingInfo.customerName}</span>
                                    {bookingInfo.phone && (
                                      <span className="font-mono text-[10px] text-blue-700 font-normal">
                                        ({bookingInfo.phone})
                                      </span>
                                    )}
                                  </span>
                                )}

                                {bookingInfo.bookingRef && (
                                  <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 shadow-2xs font-mono">
                                    <FileText size={12} className="text-amber-600 shrink-0" />
                                    <span>{bookingInfo.bookingRef}</span>
                                  </span>
                                )}

                                {bookingInfo.roomNumber ? (
                                  <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 shadow-2xs">
                                    <BedDouble size={12} className="text-emerald-600 shrink-0" />
                                    <span>{L('Room', 'कमरा')} {bookingInfo.roomNumber}</span>
                                    {bookingInfo.roomType && (
                                      <span className="text-[10px] text-emerald-700 font-normal">
                                        ({bookingInfo.roomType})
                                      </span>
                                    )}
                                  </span>
                                ) : bookingInfo.roomType ? (
                                  <span className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-900 shadow-2xs">
                                    <BedDouble size={12} className="text-indigo-600 shrink-0" />
                                    <span>{bookingInfo.roomType}</span>
                                  </span>
                                ) : null}

                                {bookingInfo.checkIn && bookingInfo.checkOut && (
                                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-2xs">
                                    <Calendar size={12} className="text-slate-400 shrink-0" />
                                    <span>{bookingInfo.checkIn} → {bookingInfo.checkOut}</span>
                                  </span>
                                )}

                                {bookingInfo.amount && (
                                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-900 shadow-2xs">
                                    <CreditCard size={12} className="text-emerald-600 shrink-0" />
                                    <span>₹{Number(bookingInfo.amount).toLocaleString('en-IN')}</span>
                                  </span>
                                )}

                                {bookingInfo.status && (
                                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                                    {bookingInfo.status}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* --- CLEAR VISION: DEDICATED ORDER HIGHLIGHT CHIP STRIP --- */}
                            {orderInfo && orderInfo.hasDetails && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {orderInfo.customerName && (
                                  <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 shadow-2xs">
                                    <UserIcon size={12} className="text-amber-600 shrink-0" />
                                    <span className="text-slate-500 font-normal">{L('Customer:', 'ग्राहक:')}</span>
                                    <span>{orderInfo.customerName}</span>
                                    {orderInfo.phone && (
                                      <span className="font-mono text-[10px] text-amber-700 font-normal">
                                        ({orderInfo.phone})
                                      </span>
                                    )}
                                  </span>
                                )}

                                {orderInfo.orderRef && (
                                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-800 shadow-2xs font-mono">
                                    <FileText size={12} className="text-slate-500 shrink-0" />
                                    <span>{orderInfo.orderRef}</span>
                                  </span>
                                )}

                                {orderInfo.orderType && (
                                  <span className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-900 shadow-2xs capitalize">
                                    <Truck size={12} className="text-indigo-600 shrink-0" />
                                    <span>{orderInfo.orderType}</span>
                                    {orderInfo.tableNumber && (
                                      <span className="text-[10px] text-indigo-700">({L('Table', 'टेबल')} {orderInfo.tableNumber})</span>
                                    )}
                                  </span>
                                )}

                                {orderInfo.amount && (
                                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-900 shadow-2xs">
                                    <span>₹{Number(orderInfo.amount).toLocaleString('en-IN')}</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: Timestamp & Details toggle */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1 shrink-0 text-right">
                          <span className="text-xs font-semibold text-slate-700" title={new Date(logDate).toLocaleString('en-IN')}>
                            {timeAgo(logDate, L)}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(logDate).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>

                          <button
                            type="button"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors"
                          >
                            <span>{isExpanded ? L('Hide Details', 'विवरण छिपाएं') : L('View Details', 'विवरण देखें')}</span>
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Details Panel */}
                      {isExpanded && (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-800 space-y-3 animate-in fade-in">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Info size={14} className="text-slate-500" />
                              {L('Event Detailed Inspection', 'इवेंट विस्तृत विवरण')}
                            </span>
                            <div className="flex items-center gap-2">
                              {log.ip_address && (
                                <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                  IP: {log.ip_address}
                                </span>
                              )}
                              <button
                                onClick={() =>
                                  setShowRawJson((prev) => ({ ...prev, [log.id]: !prev[log.id] }))
                                }
                                className="text-[10px] font-semibold text-amber-700 hover:underline"
                              >
                                {showRawJson[log.id] ? L('Card View', 'कार्ड दृश्य') : L('Raw JSON', 'कच्चा JSON')}
                              </button>
                            </div>
                          </div>

                          {/* Dedicated Booking Highlight Box in Expanded View */}
                          {bookingInfo && bookingInfo.hasDetails && (
                            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
                              <h4 className="font-bold text-blue-950 text-xs mb-2 flex items-center gap-1.5">
                                <BedDouble size={14} className="text-blue-700" />
                                {L('Room Booking & Customer Overview', 'कमरा बुकिंग और ग्राहक विवरण')}
                              </h4>
                              <div className="grid gap-2 sm:grid-cols-3 text-xs">
                                <div className="bg-white p-2 rounded-lg border border-blue-100">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">{L('Customer Name', 'ग्राहक का नाम')}</span>
                                  <p className="font-bold text-slate-900">{bookingInfo.customerName || 'N/A'}</p>
                                  {bookingInfo.phone && <p className="text-[11px] text-slate-500 font-mono">{bookingInfo.phone}</p>}
                                </div>

                                <div className="bg-white p-2 rounded-lg border border-blue-100">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">{L('Booking Reference', 'बुकिंग संदर्भ')}</span>
                                  <p className="font-mono font-bold text-amber-800">{bookingInfo.bookingRef || log.entity_id}</p>
                                  {bookingInfo.status && (
                                    <span className="inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 rounded text-slate-700 uppercase">
                                      {bookingInfo.status}
                                    </span>
                                  )}
                                </div>

                                <div className="bg-white p-2 rounded-lg border border-blue-100">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">{L('Room & Room Type', 'कमरा और प्रकार')}</span>
                                  <p className="font-bold text-emerald-800">
                                    {bookingInfo.roomNumber ? `${L('Room', 'कमरा')} ${bookingInfo.roomNumber}` : L('Unassigned Room', 'कमरा अभी निर्धारित नहीं')}
                                  </p>
                                  {bookingInfo.roomType && <p className="text-[11px] text-slate-600">{bookingInfo.roomType}</p>}
                                </div>

                                {bookingInfo.checkIn && bookingInfo.checkOut && (
                                  <div className="bg-white p-2 rounded-lg border border-blue-100 sm:col-span-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{L('Stay Dates (Check-in → Check-out)', 'ठहरने की तिथियां')}</span>
                                    <p className="font-semibold text-slate-800">
                                      {bookingInfo.checkIn} → {bookingInfo.checkOut}
                                    </p>
                                  </div>
                                )}

                                {bookingInfo.amount && (
                                  <div className="bg-white p-2 rounded-lg border border-blue-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{L('Booking Total', 'कुल राशि')}</span>
                                    <p className="font-bold text-slate-900 text-sm">₹{Number(bookingInfo.amount).toLocaleString('en-IN')}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {showRawJson[log.id] ? (
                            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-[11px] text-emerald-400 font-mono">
                              {JSON.stringify(
                                {
                                  id: log.id,
                                  actor: actorName,
                                  role: actorRole,
                                  action: log.action,
                                  entity_type: log.entity_type,
                                  entity_id: log.entity_id,
                                  created_at: logDate,
                                  ip_address: log.ip_address,
                                  booking_info: bookingInfo,
                                  order_info: orderInfo,
                                  details: log.details,
                                },
                                null,
                                2
                              )}
                            </pre>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                  {L('Entity ID', 'इकाई आईडी')}
                                </span>
                                <p className="font-mono text-xs text-slate-900 break-all select-all">
                                  {log.entity_id || 'N/A'}
                                </p>
                              </div>

                              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                  {L('Exact Local Timestamp', 'सटीक समय')}
                                </span>
                                <p className="text-xs text-slate-900">
                                  {new Date(logDate).toLocaleString('en-IN', {
                                    dateStyle: 'medium',
                                    timeStyle: 'medium',
                                  })}
                                </p>
                              </div>

                              {Object.entries(details).map(([k, v]) => (
                                <div key={k} className="bg-white p-2.5 rounded-lg border border-slate-200 sm:col-span-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">{k}</span>
                                  <p className="text-xs text-slate-900 break-words font-mono mt-0.5">
                                    {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
