import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageCircle,
  CheckCircle2,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  UploadCloud,
  Trash2,
  MapPin,
  Navigation,
  AlertTriangle,
  Store,
  Clock,
  Sparkles,
  Phone,
  Radar,
  Building2,
  Home,
} from 'lucide-react';
import PageHero from '@/components/site/PageHero';
import CartLine from '@/components/site/CartLine';
import { useCart } from '@/lib/cart';
import { useI18n } from '@/lib/i18n';
import { inr, isValidPhone, openWhatsApp } from '@/lib/whatsapp';
import { computeTotals, orderMessage, submitOrder } from '@/lib/services';
import { useOrderConfig } from '@/hooks/useSiteCatalog';
import useSeo from '@/lib/useSeo';
import PhoneInput from '@/components/ui/phone-input';

const HOTEL_COORDS = { lat: 27.4250, lng: 77.6920 };
const MAX_DELIVERY_RADIUS_KM = 1.25; // 1 km standard + GPS jitter buffer
const HOTEL_UPI_ID = '6377682442-6@ibl';
const HOTEL_PAYEE_NAME = 'B.S. Hotel & Restaurant';

// Known Mathura localities that are beyond the 1 km delivery radius of B.S. Hotel (NH-2, Baad)
const MATHURA_FAR_AREAS = [
  { kw: 'maholi', name: 'Maholi Road', dist: 8.5 },
  { kw: 'lajpat nagar', name: 'Lajpat Nagar', dist: 9.5 },
  { kw: 'dampier', name: 'Dampier Nagar', dist: 8.5 },
  { kw: 'krishna nagar', name: 'Krishna Nagar (City)', dist: 9.0 },
  { kw: 'civil lines', name: 'Civil Lines', dist: 10.0 },
  { kw: 'bsa', name: 'BSA College Area', dist: 8.5 },
  { kw: 'bhuteshwar', name: 'Bhuteshwar', dist: 9.5 },
  { kw: 'vrindavan', name: 'Vrindavan', dist: 22.0 },
  { kw: 'chhatikara', name: 'Chhatikara', dist: 18.0 },
  { kw: 'govardhan', name: 'Govardhan', dist: 28.0 },
  { kw: 'radha kund', name: 'Radha Kund', dist: 26.0 },
  { kw: 'barsana', name: 'Barsana', dist: 45.0 },
  { kw: 'kosi', name: 'Kosi Kalan', dist: 45.0 },
  { kw: 'masani', name: 'Masani', dist: 11.0 },
  { kw: 'govind nagar', name: 'Govind Nagar', dist: 10.0 },
  { kw: 'janmabhoomi', name: 'Janmabhoomi Area', dist: 10.5 },
  { kw: 'aurangabad', name: 'Aurangabad', dist: 5.5 },
  { kw: 'highway city', name: 'Highway City', dist: 8.0 },
  { kw: 'chandan van', name: 'Chandan Van', dist: 7.5 },
  { kw: 'radhika vihar', name: 'Radhika Vihar', dist: 9.0 },
  { kw: 'shri nagar', name: 'Shri Nagar', dist: 8.5 },
  { kw: 'gokul', name: 'Gokul', dist: 9.5 },
  { kw: 'farah', name: 'Farah', dist: 12.0 },
  { kw: 'raya', name: 'Raya', dist: 16.0 },
  { kw: 'sonkh', name: 'Sonkh', dist: 18.0 },
  { kw: 'baldeo', name: 'Baldeo', dist: 22.0 },
  { kw: 'chaumuha', name: 'Chaumuha', dist: 25.0 },
  { kw: 'jait', name: 'Jait', dist: 16.0 },
  { kw: 'cantt', name: 'Mathura Cantt', dist: 11.0 },
  { kw: 'holi gate', name: 'Holi Gate', dist: 10.0 },
  { kw: 'vishram ghat', name: 'Vishram Ghat', dist: 10.5 },
  { kw: 'deeg gate', name: 'Deeg Gate', dist: 10.0 },
  { kw: 'bharatpur gate', name: 'Bharatpur Gate', dist: 9.5 },
  { kw: 'manoharpura', name: 'Manoharpura', dist: 9.0 },
  { kw: 'motikunj', name: 'Motikunj', dist: 8.5 },
];

function checkAddressOutOfRange(fullText) {
  const text = (fullText || '').toLowerCase();
  for (const item of MATHURA_FAR_AREAS) {
    if (text.includes(item.kw)) {
      if (item.kw === 'krishna nagar' && (text.includes('ext') || text.includes('baad'))) {
        continue;
      }
      return item;
    }
  }
  return null;
}

// Client-side address geocoding via OpenStreetMap Nominatim
async function geocodeAddressQuery(query) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
  } catch {}
  return null;
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function compressScreenshot(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 900;
        const scale = Math.min(1, MAX_WIDTH / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

const TYPES = ['Dine-in', 'Pickup', 'Delivery'];
const Err = ({ m }) => (m ? <p className="mt-1 text-xs font-semibold text-rose-400" role="alert">{m}</p> : null);

export default function Order() {
  const { t, L } = useI18n();
  const cart = useCart();

  const [f, setF] = useState({
    type: 'Dine-in',
    table: '',
    // Standard Indian Delivery Address fields
    address1: '', // House/Flat/Shop no., Floor, Building, Estate
    address2: '', // Street, Road, Cross, Main
    landmark: '', // Nearby well-known location (Recommended)
    area: '', // Specific neighborhood/colony/village
    city: 'Mathura', // City
    state: 'Uttar Pradesh', // State
    pincode: '281006', // 6-digit PIN code
    name: '',
    phone: '',
    notes: '',
  });

  // Automated distance checking state
  const [checkingDistance, setCheckingDistance] = useState(false);

  // Payment state
  const [paymentMode, setPaymentMode] = useState('upi_qr'); // 'upi_qr' | 'pay_on_delivery'
  const [proofType, setProofType] = useState('utr'); // 'utr' | 'screenshot'
  const [paymentUtr, setPaymentUtr] = useState('');
  const [paymentName, setPaymentName] = useState('');
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [screenshotFileName, setScreenshotFileName] = useState('');
  const [compressing, setCompressing] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(null);

  useSeo(
    'Order Food | Delicee Restaurant, Mathura NH-2',
    'Order pure vegetarian food from Delicee Restaurant at B.S. Hotel with instant PhonePe UPI QR or Pay on Delivery. Fast delivery within 1 km of NH-2 Baad.'
  );

  const set = (k) => (e) => {
    setServerError('');
    setF((prev) => ({ ...prev, [k]: e?.target ? e.target.value : e }));
    setErrors((prev) => ({ ...prev, [k]: '' }));
  };

  const orderConfig = useOrderConfig();
  const { delivery, tax, total } = computeTotals(cart.subtotal, f.type, orderConfig);

  // Copy UPI ID helper
  const handleCopyUpi = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(HOTEL_UPI_ID).then(() => {
        setCopiedUpi(true);
        setTimeout(() => setCopiedUpi(false), 2500);
      });
    }
  };

  // Helper to query device geolocation via Promise
  const getDeviceLocation = (timeoutMs = 8000) => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        return reject(new Error('UNSUPPORTED'));
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 15000 }
      );
    });
  };

  // Screenshot upload & compression
  const handleScreenshotChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(L('Please upload a valid image file (JPG or PNG).', 'कृपया वैध फोटो फाइल चुनें (JPG/PNG)।'));
      return;
    }

    setCompressing(true);
    try {
      const compressed = await compressScreenshot(file);
      setPaymentScreenshot(compressed);
      setScreenshotFileName(file.name);
      setErrors((prev) => ({ ...prev, paymentProof: '' }));
    } catch (err) {
      console.error('Screenshot compression error:', err);
      alert(L('Could not process this screenshot. Please try another image.', 'स्क्रीनशॉट प्रोसेस नहीं हो सका। कृपया दूसरी फोटो चुनें।'));
    } finally {
      setCompressing(false);
    }
  };

  const removeScreenshot = () => {
    setPaymentScreenshot(null);
    setScreenshotFileName('');
  };

  // Submit order validation with structured address & instant automatic distance verification
  const send = async () => {
    setServerError('');
    const e = {};

    if (f.name.trim().length < 2) e.name = L('Please enter your name.', 'कृपया अपना नाम दर्ज करें।');
    if (!isValidPhone(f.phone)) e.phone = L('Enter a valid 10-digit Indian mobile number.', '10 अंकों का वैध मोबाइल नंबर दर्ज करें।');

    if (f.type === 'Dine-in' && !f.table.trim()) {
      e.table = L('Please enter your table number.', 'कृपया टेबल नंबर दर्ज करें।');
    }

    if (f.type === 'Delivery') {
      if (!f.address1.trim()) {
        e.address1 = L('Address Line 1 is required (House/Flat/Shop no., Building name).', 'मकान/फ्लैट/दुकान/बिल्डिंग का पता दर्ज करना अनिवार्य है।');
      }
      if (!f.area.trim()) {
        e.area = L('Area / Locality is required (e.g. IOCL Township, Baad).', 'क्षेत्र/कॉलोनी का नाम दर्ज करना अनिवार्य है।');
      }
      if (!f.city.trim()) {
        e.city = L('City / Town is required.', 'शहर दर्ज करना अनिवार्य है।');
      }
      if (!f.state.trim()) {
        e.state = L('State is required.', 'राज्य दर्ज करना अनिवार्य है।');
      }
      if (!/^\d{6}$/.test(f.pincode.trim())) {
        e.pincode = L('Enter a valid 6-digit PIN code.', '6 अंकों का वैध पिन कोड दर्ज करें।');
      }
    }

    // Payment validation if PhonePe UPI QR is selected
    if (paymentMode === 'upi_qr') {
      if (proofType === 'utr') {
        const cleanUtr = paymentUtr.trim();
        if (cleanUtr.length < 6) {
          e.paymentProof = L('Please enter the 12-digit UPI UTR / Reference number.', 'कृपया 12 अंकों का UPI UTR नंबर दर्ज करें।');
        }
        if (paymentName.trim().length < 2) {
          e.paymentName = L('Please enter the Payer / Account Name as on UPI.', 'कृपया UPI खाताधारक का नाम दर्ज करें।');
        }
      } else {
        if (!paymentScreenshot) {
          e.paymentProof = L('Please upload the payment screenshot or switch to UTR entry.', 'कृपया भुगतान का स्क्रीनशॉट अपलोड करें या UTR नंबर दर्ज करें।');
        }
      }
    }

    setErrors(e);
    if (Object.keys(e).length > 0) {
      return;
    }

    let detectedLat = null;
    let detectedLng = null;
    let detectedDist = null;

    // Build consolidated Indian address string
    const fullAddress = f.type === 'Delivery'
      ? [
          f.address1.trim(),
          f.address2.trim() || null,
          f.landmark.trim() ? `Near ${f.landmark.trim()}` : null,
          f.area.trim(),
          `${f.city.trim()}, ${f.state.trim()} - ${f.pincode.trim()}`,
        ].filter(Boolean).join(', ')
      : '';

    // Instant automatic distance check right before placing delivery order
    if (f.type === 'Delivery') {
      setCheckingDistance(true);
      setBusy(true);

      // 1. Text-based Mathura locality verification (catches Maholi Road, Lajpat Nagar, Dampier, etc.)
      const combinedAddressText = `${f.address1} ${f.address2} ${f.landmark} ${f.area}`;
      const outOfRangeArea = checkAddressOutOfRange(combinedAddressText);
      if (outOfRangeArea) {
        setCheckingDistance(false);
        setBusy(false);
        setServerError(
          L(
            `⚠️ Out of 1 KM Delivery Radius: "${outOfRangeArea.name}" is approximately ${outOfRangeArea.dist} km away from B.S. Hotel & Restaurant (NH-2, Baad). Delicee Restaurant exclusively delivers within 1 km (Township Nagar / Baad NH-2 area). Please select "Pickup" or contact the restaurant at +91 91492 24039.`,
            `⚠️ 1 किमी डिलीवरी दायरे से बाहर: "${outOfRangeArea.name}" B.S. Hotel (NH-2, Baad) से लगभग ${outOfRangeArea.dist} किमी दूर है। हमारी डिलीवरी केवल 1 किमी के भीतर उपलब्ध है। कृपया "Pickup" चुनें या होटल पर कॉल करें: +91 91492 24039।`
          )
        );
        window.scrollTo({ top: 300, behavior: 'smooth' });
        return;
      }

      // 2. Geocode the typed Area / Landmark via Nominatim OpenStreetMap
      try {
        const query = `${f.area}, Mathura, Uttar Pradesh`;
        const geocoded = await geocodeAddressQuery(query);
        if (geocoded) {
          const geoDist = calculateDistanceKm(HOTEL_COORDS.lat, HOTEL_COORDS.lng, geocoded.lat, geocoded.lng);
          if (geoDist > MAX_DELIVERY_RADIUS_KM) {
            setCheckingDistance(false);
            setBusy(false);
            setServerError(
              L(
                `⚠️ Address Out of 1 KM Delivery Area: "${f.area}" is located ~${geoDist.toFixed(1)} km away from B.S. Hotel (NH-2, Baad). Delivery is strictly limited to 1 km. Please select "Pickup" or contact +91 91492 24039.`,
                `⚠️ पता 1 किमी डिलीवरी दायरे से बाहर: "${f.area}" होटल से ~${geoDist.toFixed(1)} किमी दूर है। डिलीवरी केवल 1 किमी के भीतर उपलब्ध है। कृपया "Pickup" चुनें।`
              )
            );
            window.scrollTo({ top: 300, behavior: 'smooth' });
            return;
          }
          detectedLat = geocoded.lat;
          detectedLng = geocoded.lng;
          detectedDist = geoDist;
        }
      } catch (geoCodeErr) {
        console.warn('Geocoding check error:', geoCodeErr);
      }

      // 3. Device GPS verification if available
      try {
        const pos = await getDeviceLocation(5000);
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        const gpsDist = calculateDistanceKm(HOTEL_COORDS.lat, HOTEL_COORDS.lng, userLat, userLng);

        // Strict 1 km check (with slight GPS jitter tolerance up to 1.25 km)
        if (gpsDist > MAX_DELIVERY_RADIUS_KM) {
          setCheckingDistance(false);
          setBusy(false);
          setServerError(
            L(
              `⚠️ Out of 1 KM Delivery Radius: Your detected GPS location is ~${gpsDist.toFixed(2)} km away from B.S. Hotel & Restaurant, NH-2 Baad (Mathura). Delivery is strictly limited to 1 km. Please select 'Pickup' or contact the restaurant at +91 91492 24039.`,
              `⚠️ 1 किमी डिलीवरी दायरे से बाहर: आपकी जीपीएस लोकेशन होटल से ~${gpsDist.toFixed(2)} किमी दूर है। डिलीवरी केवल 1 किमी के भीतर उपलब्ध है। कृपया 'Pickup' चुनें या होटल पर कॉल करें: +91 91492 24039।`
            )
          );
          window.scrollTo({ top: 300, behavior: 'smooth' });
          return;
        }
        detectedLat = userLat;
        detectedLng = userLng;
        detectedDist = gpsDist;
      } catch (geoErr) {
        console.warn('Automatic location check warning:', geoErr);
      } finally {
        setCheckingDistance(false);
      }
    }

    setBusy(true);
    try {
      const order = await submitOrder({
        ...f,
        address: fullAddress,
        items: cart.items,
        subtotal: cart.subtotal,
        delivery,
        tax,
        total,
        payment_mode: paymentMode,
        payment_utr: paymentMode === 'upi_qr' && proofType === 'utr' ? paymentUtr.trim() : null,
        payment_name: paymentMode === 'upi_qr' && proofType === 'utr' ? paymentName.trim() : (paymentName.trim() || f.name.trim()),
        payment_screenshot: paymentMode === 'upi_qr' && proofType === 'screenshot' ? paymentScreenshot : null,
        delivery_lat: detectedLat,
        delivery_lng: detectedLng,
        delivery_distance_km: detectedDist,
        delivery_landmark: f.landmark.trim() || f.area.trim(),
      });

      setDone(order);
      cart.clear();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Order submission error:', err);
      setServerError(err.message || L('Unable to place order. You can still order directly via WhatsApp.', 'ऑर्डर सबमिट नहीं हो सका। आप सीधे व्हाट्सएप पर ऑर्डर कर सकते हैं।'));
    } finally {
      setBusy(false);
      setCheckingDistance(false);
    }
  };

  // UPI deep link for mobile devices
  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(HOTEL_UPI_ID)}&pn=${encodeURIComponent(HOTEL_PAYEE_NAME)}&am=${total}&cu=INR&tn=${encodeURIComponent(`Delicee Food Order`)}`;

  if (done) {
    const isUpi = done.payment_mode === 'upi_qr' || done.payment_mode === 'upi';
    return (
      <>
        <PageHero title={L('Order Placed Successfully!', 'ऑर्डर सफलतापूर्वक दर्ज हुआ!')} />
        <section className="mx-auto max-w-xl px-4 py-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 size={42} />
          </div>

          <h2 className="mt-4 text-2xl font-bold text-foreground">
            {L('Your order has been sent to the Kitchen!', 'आपका ऑर्डर किचन को भेज दिया गया है!')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {L('Order Reference Number:', 'ऑर्डर संदर्भ संख्या:')}{' '}
            <b className="font-mono text-base font-bold text-primary">{done.ref}</b>
          </p>

          {/* PhonePe UPI Proof Receipt Banner */}
          {isUpi && (
            <div className="mt-6 rounded-2xl border border-purple-500/30 bg-purple-950/20 p-5 text-left shadow-lg">
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white font-bold text-sm">
                    पे
                  </div>
                  <span className="font-bold text-sm text-foreground">
                    {L('PhonePe UPI Payment Submitted', 'PhonePe UPI भुगतान प्रमाण प्राप्त')}
                  </span>
                </div>
                <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-xs font-semibold text-amber-300 flex items-center gap-1">
                  <Clock size={12} />
                  {L('Kitchen Verifying', 'किचन सत्यापन जारी')}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">{L('Payment Mode', 'माध्यम')}</span>
                  <span className="font-semibold text-foreground">PhonePe UPI QR</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">{L('Total Amount', 'कुल राशि')}</span>
                  <span className="font-bold text-primary">{inr(done.total || total)}</span>
                </div>
                {done.payment_utr && (
                  <div>
                    <span className="text-muted-foreground block">{L('Submitted UTR / Ref No.', 'UTR नंबर')}</span>
                    <span className="font-mono font-bold text-foreground">{done.payment_utr}</span>
                  </div>
                )}
                {done.payment_name && (
                  <div>
                    <span className="text-muted-foreground block">{L('Payer Name on UPI', 'खाताधारक')}</span>
                    <span className="font-semibold text-foreground">{done.payment_name}</span>
                  </div>
                )}
              </div>

              {done.payment_screenshot && (
                <div className="mt-3 pt-3 border-t border-purple-500/20 flex items-center gap-3">
                  <img
                    src={done.payment_screenshot}
                    alt="Proof Preview"
                    className="h-12 w-12 rounded-lg object-cover border border-purple-400/40"
                  />
                  <div className="text-xs">
                    <p className="font-semibold text-foreground">{L('Screenshot Proof Attached', 'स्क्रीनशॉट संलग्न है')}</p>
                    <p className="text-muted-foreground">{L('Forwarded to kitchen desk', 'किचन डेस्क को भेज दिया गया है')}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Delivery destination info */}
          {done.type === 'Delivery' && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-card p-4 text-left text-xs">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <MapPin size={14} className="text-primary" />
                {L('Delivery Address:', 'डिलीवरी का पता:')}
              </p>
              <p className="mt-1 text-muted-foreground font-medium leading-relaxed">{done.address}</p>
              {done.delivery_distance_km && (
                <p className="mt-1.5 text-emerald-400 font-semibold">
                  ✓ {L('Within 1 km delivery zone (~', '1 किमी डिलीवरी दायरे में (~')}{Number(done.delivery_distance_km).toFixed(2)} km)
                </p>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => openWhatsApp(orderMessage(done))}
              className="btn-gold w-full flex items-center justify-center gap-2 py-3.5"
            >
              <MessageCircle size={20} />
              {L('Send on WhatsApp Too (With Proof)', 'व्हाट्सएप पर भी भेजें (प्रमाण सहित)')}
            </button>

            <Link to="/restaurant" className="btn-outline w-full py-3">
              {L('Back to Restaurant Menu', 'मेन्यू पर वापस जाएँ')}
            </Link>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHero
        title={t('nav.order')}
        sub={L(
          'Review your cart, fill your delivery address, choose UPI QR or Cash, and place your order.',
          'अपनी कार्ट चेक करें, डिलीवरी का पता भरें, UPI QR या नकद चुनें और आसानी से ऑर्डर करें।'
        )}
      />

      <section className="mx-auto max-w-5xl px-4 py-12">
        {cart.items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">{L('Your cart is empty.', 'आपकी कार्ट खाली है।')}</p>
            <Link to="/restaurant" className="btn-gold mt-5">
              {t('cta.viewMenu')}
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-[1.05fr_1.35fr]">
            {/* Left Column: Cart items & Totals */}
            <div>
              <div className="rounded-2xl border border-primary/20 bg-card p-5">
                <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                  <Store size={18} className="text-primary" />
                  {L('Order Summary', 'ऑर्डर सारांश')}
                </h2>

                <ul className="divide-y divide-border/60">
                  {cart.items.map((i) => (
                    <CartLine key={i.id} item={i} />
                  ))}
                </ul>

                <div className="mt-4 space-y-2 text-sm border-t border-border/80 pt-4">
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">{L('Subtotal', 'सबटोटल')}</span>
                    <span className="font-semibold">{inr(cart.subtotal)}</span>
                  </p>
                  <p className="flex justify-between text-muted-foreground">
                    <span>{L('Delivery charge', 'डिलीवरी शुल्क')}</span>
                    <span>{f.type === 'Delivery' ? (delivery > 0 ? inr(delivery) : L('FREE (Within 1km)', 'मुफ़्त (1 किमी)')) : '—'}</span>
                  </p>
                  <p className="flex justify-between text-muted-foreground">
                    <span>{L('Taxes (GST 5%)', 'टैक्स (जीएसटी 5%)')}</span>
                    <span>{inr(tax)}</span>
                  </p>
                  <p className="flex justify-between border-t border-primary/30 pt-3 text-lg font-black text-primary">
                    <span>{L('Total Payable', 'कुल देय राशि')}</span>
                    <span className="text-xl">{inr(total)}</span>
                  </p>
                </div>
              </div>

              {/* Delivery policy highlight */}
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-200">
                <p className="font-bold flex items-center gap-1.5 text-amber-300">
                  <Navigation size={14} />
                  {L('1 KM Fresh & Fast Delivery Policy', '1 किमी ताज़ा व त्वरित डिलीवरी नियम')}
                </p>
                <p className="mt-1 leading-relaxed text-amber-200/90">
                  {L(
                    'To ensure your food reaches piping hot, Delicee Restaurant delivers within a strict 1 km radius of B.S. Hotel, NH-2 Baad (Mathura). Distance is verified automatically before order placement.',
                    'भोजन पूरी तरह गर्म व ताज़ा पहुंचे, इसके लिए डिलीसी रेस्टोरेंट केवल 1 किमी के दायरे में डिलीवरी करता है। ऑर्डर करते ही दूरी की ऑटोमेटिक जांच होती है।'
                  )}
                </p>
              </div>
            </div>

            {/* Right Column: Order Details & Payment */}
            <div className="space-y-5 rounded-2xl border border-primary/30 bg-card p-6 shadow-md">
              {/* Step 1: Order Type */}
              <fieldset>
                <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {L('1. Select Order Type', '1. ऑर्डर का प्रकार चुनें')}
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {TYPES.map((ty) => (
                    <button
                      key={ty}
                      type="button"
                      aria-pressed={f.type === ty}
                      onClick={() => setF({ ...f, type: ty })}
                      className={`min-h-[46px] rounded-xl border text-sm font-bold transition-all ${
                        f.type === ty
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                          : 'border-input bg-card/60 text-muted-foreground hover:bg-accent/40'
                      }`}
                    >
                      {ty}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Dine-in Table Number */}
              {f.type === 'Dine-in' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {L('Table Number', 'टेबल नंबर')} *
                  </label>
                  <input
                    className="field mt-1"
                    placeholder="e.g. Table 4 or Lawn 2"
                    value={f.table}
                    onChange={set('table')}
                  />
                  <Err m={errors.table} />
                </div>
              )}

              {/* Standard Indian Delivery Address Format */}
              {f.type === 'Delivery' && (
                <div className="space-y-3.5 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
                  <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <MapPin size={15} className="text-primary" />
                      {L('Delivery Address (Within 1 km of B.S. Hotel)', 'डिलीवरी का पूरा पता (1 किमी के भीतर)')}
                    </span>
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      1 km Zone
                    </span>
                  </div>

                  {/* Automatic 1km Check Notice */}
                  <div className="rounded-xl border border-primary/20 bg-card/90 p-2.5 flex items-center gap-2.5 text-xs text-muted-foreground shadow-xs">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 text-primary shrink-0">
                      <Radar size={15} className={checkingDistance ? 'animate-spin' : ''} />
                    </div>
                    <p className="leading-snug text-[11px]">
                      <b className="text-foreground">{L('Automatic Distance Check: ', 'ऑटोमेटिक दूरी जांच: ')}</b>
                      {L(
                        'When you click Place Order, your live distance from B.S. Hotel (NH-2 Baad) is checked automatically.',
                        'ऑर्डर बटन दबाने पर होटल से आपकी दूरी की तुरंत ऑटोमेटिक जांच होगी।'
                      )}
                    </p>
                  </div>

                  {/* Address Line 1 (Required) */}
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      {L('Address Line 1: House / Flat / Shop / Building *', 'पता पंक्ति 1: मकान / फ्लैट / दुकान नं. / बिल्डिंग का नाम *')}
                    </label>
                    <input
                      className="field text-sm"
                      placeholder={L(
                        'House/Flat/Shop no., Floor, Building name, or Estate',
                        'मकान/फ्लैट नं., फ्लोर, बिल्डिंग का नाम'
                      )}
                      value={f.address1}
                      onChange={set('address1')}
                    />
                    <Err m={errors.address1} />
                  </div>

                  {/* Address Line 2 (Optional) */}
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">
                      {L('Address Line 2 (Optional): Street / Road / Cross', 'पता पंक्ति 2 (वैकल्पिक): गली / सड़क / लेन')}
                    </label>
                    <input
                      className="field text-sm"
                      placeholder={L('Street name, road, cross, or main lane', 'गली का नाम, मुख्य सड़क')}
                      value={f.address2}
                      onChange={set('address2')}
                    />
                  </div>

                  {/* Landmark (Highly Recommended) */}
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1 flex items-center justify-between">
                      <span>{L('Landmark (Highly Recommended)', 'लैंडमार्क / पहचान का स्थान (अनुशंसित)')}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        {L('Helps delivery rider locate easily', 'डिलीवरी बॉय को ढूंढने में आसान')}
                      </span>
                    </label>
                    <input
                      className="field text-sm"
                      placeholder={L(
                        'e.g. Opposite Township Main Gate, Near Hanuman Temple',
                        'उदा. टाउनशिप मेन गेट के सामने, हनुमान मंदिर के पास'
                      )}
                      value={f.landmark}
                      onChange={set('landmark')}
                    />
                  </div>

                  {/* Area / Locality (Required) */}
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      {L('Area / Locality / Sector *', 'क्षेत्र / कॉलोनी / सेक्टर *')}
                    </label>
                    <input
                      className="field text-sm"
                      placeholder={L(
                        'e.g. IOCL Township / Baad Village / NH-2 Highway Belt',
                        'उदा. आईओसीएल टाउनशिप / बाद गांव / एनएच-2 बेल्ट'
                      )}
                      value={f.area}
                      onChange={set('area')}
                    />
                    <Err m={errors.area} />
                  </div>

                  {/* City, State & PIN Code in responsive 3-col grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    {/* City / Town */}
                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1">
                        {L('City / Town *', 'शहर *')}
                      </label>
                      <input
                        className="field text-sm"
                        value={f.city}
                        onChange={set('city')}
                        placeholder="Mathura"
                      />
                      <Err m={errors.city} />
                    </div>

                    {/* State */}
                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1">
                        {L('State *', 'राज्य *')}
                      </label>
                      <input
                        className="field text-sm"
                        value={f.state}
                        onChange={set('state')}
                        placeholder="Uttar Pradesh"
                      />
                      <Err m={errors.state} />
                    </div>

                    {/* PIN Code */}
                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1">
                        {L('PIN Code *', 'पिन कोड *')}
                      </label>
                      <input
                        className="field text-sm font-mono tracking-wider"
                        maxLength={6}
                        value={f.pincode}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setF((prev) => ({ ...prev, pincode: val }));
                          setErrors((prev) => ({ ...prev, pincode: '' }));
                        }}
                        placeholder="281006"
                      />
                      <Err m={errors.pincode} />
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Contact Details */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t('f.name')} *
                  </label>
                  <input
                    className="field mt-1"
                    placeholder="Your Full Name"
                    value={f.name}
                    onChange={set('name')}
                    autoComplete="name"
                  />
                  <Err m={errors.name} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t('f.phone')} *
                  </label>
                  <PhoneInput value={f.phone} onChange={set('phone')} className="mt-1" />
                  <Err m={errors.phone} />
                </div>
              </div>

              {/* Kitchen Special Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {L('Special Kitchen Instructions / Notes', 'किचन निर्देश (जैसे कम मिर्च, एक्स्ट्रा चटनी)')}
                </label>
                <textarea
                  className="field mt-1 py-2 text-sm"
                  rows={2}
                  placeholder={L('e.g. Less spicy, send extra napkins, no onions', 'उदा. कम तीखा, सलाद अलग से')}
                  value={f.notes}
                  onChange={set('notes')}
                />
              </div>

              {/* Step 2: Payment Method (PhonePe UPI QR vs COD) */}
              <div className="border-t border-border/80 pt-4 space-y-3">
                <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>{L('2. Payment Method', '2. भुगतान का माध्यम')} *</span>
                  <span className="text-[11px] font-semibold text-primary">
                    {L('Payable: ', 'देय: ')}{inr(total)}
                  </span>
                </legend>

                {/* Payment Option Cards */}
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {/* Card 1: PhonePe UPI QR (Recommended) */}
                  <div
                    onClick={() => {
                      setPaymentMode('upi_qr');
                      setErrors((prev) => ({ ...prev, paymentProof: '', paymentName: '' }));
                    }}
                    className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                      paymentMode === 'upi_qr'
                        ? 'border-amber-400 bg-amber-500/10 shadow-md ring-2 ring-amber-400/30'
                        : 'border-border/80 bg-card/60 hover:border-amber-400/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white font-bold text-xs shadow-xs">
                          पे
                        </div>
                        <div>
                          <p className="font-bold text-sm text-foreground">PhonePe UPI QR</p>
                          <p className="text-[11px] text-muted-foreground">
                            {L('Instant QR & UPI Apps', 'क्यूआर कोड व यूपीआई')}
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-amber-400/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        {L('Recommended', 'तेज़ व सुरक्षित')}
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Cash / Pay on Delivery */}
                  <div
                    onClick={() => {
                      setPaymentMode('pay_on_delivery');
                      setErrors((prev) => ({ ...prev, paymentProof: '', paymentName: '' }));
                    }}
                    className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                      paymentMode === 'pay_on_delivery'
                        ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/30'
                        : 'border-border/80 bg-card/60 hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-700 text-white font-bold text-xs">
                        ₹
                      </div>
                      <div>
                        <p className="font-bold text-sm text-foreground">
                          {f.type === 'Delivery'
                            ? L('Cash on Delivery (COD)', 'कैश ऑन डिलीवरी (COD)')
                            : f.type === 'Dine-in'
                            ? L('Pay at Table / Cash', 'टेबल पर नकद भुगतान')
                            : L('Pay at Counter on Pickup', 'काउंटर पर भुगतान')}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {L('Pay when food arrives', 'खाना प्राप्त होने पर')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* UPI QR Display & Proof Box */}
                {paymentMode === 'upi_qr' && (
                  <div className="rounded-2xl border border-amber-400/40 bg-card p-5 space-y-4 shadow-lg">
                    {/* Merchant & Security Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-3">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                          <ShieldCheck size={16} />
                          <span>{L('Verified Merchant UPI', 'सत्यापित मर्चेंट यूपीआई')}</span>
                        </div>
                        <p className="text-sm font-bold text-foreground">{HOTEL_PAYEE_NAME}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-muted-foreground block">{L('Amount to Pay', 'कुल देय')}</span>
                        <span className="text-lg font-black text-primary">{inr(total)}</span>
                      </div>
                    </div>

                    {/* QR Code and Actions Container */}
                    <div className="grid gap-4 sm:grid-cols-[180px_1fr] items-center">
                      {/* High-res PhonePe QR */}
                      <div className="mx-auto rounded-xl border-2 border-amber-400/60 bg-white p-2 shadow-md">
                        <img
                          src="/images/phonepe-qr.jpg"
                          alt="PhonePe UPI QR Code"
                          className="h-40 w-40 object-contain mx-auto"
                        />
                        <div className="mt-1 text-center text-[10px] font-bold text-slate-800">
                          Scan with Any UPI App
                        </div>
                      </div>

                      {/* Copy UPI ID + Mobile App Button */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                            {L('Hotel UPI ID:', 'होटल का UPI ID:')}
                          </label>
                          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background p-1.5">
                            <span className="font-mono text-xs font-bold text-foreground px-2 flex-1 select-all truncate">
                              {HOTEL_UPI_ID}
                            </span>
                            <button
                              type="button"
                              onClick={handleCopyUpi}
                              className="inline-flex items-center gap-1 rounded-lg bg-primary/20 border border-primary/40 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/30 transition shrink-0"
                            >
                              {copiedUpi ? (
                                <>
                                  <Check size={13} className="text-emerald-400" />
                                  <span className="text-emerald-400">{L('Copied!', 'कॉपी हुआ!')}</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={13} />
                                  <span>{L('Copy', 'कॉपी')}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Mobile 1-Tap Launcher */}
                        <a
                          href={upiDeepLink}
                          className="btn-gold w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold"
                        >
                          <ExternalLink size={15} />
                          {L(`Open PhonePe / UPI App (${inr(total)})`, `PhonePe / UPI ऐप खोलें (${inr(total)})`)}
                        </a>

                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {L(
                            'Pay using PhonePe, Google Pay, Paytm, or BHIM. After paying, submit either UTR or screenshot below.',
                            'PhonePe, GPay, Paytm आदि से भुगतान करें, फिर UTR या स्क्रीनशॉट दर्ज करें।'
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Proof submission choice: UTR or Screenshot */}
                    <div className="border-t border-border/80 pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                          {L('Verification Proof (Choose Any One)', 'सत्यापन प्रमाण (कोई एक चुनें)')} *
                        </label>
                        <div className="flex rounded-lg bg-card border border-border p-0.5 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setProofType('utr');
                              setErrors((prev) => ({ ...prev, paymentProof: '', paymentName: '' }));
                            }}
                            className={`rounded-md px-2.5 py-1 font-semibold transition ${
                              proofType === 'utr' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            {L('UTR / Ref No.', 'UTR नंबर')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProofType('screenshot');
                              setErrors((prev) => ({ ...prev, paymentProof: '', paymentName: '' }));
                            }}
                            className={`rounded-md px-2.5 py-1 font-semibold transition ${
                              proofType === 'screenshot' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            {L('Screenshot', 'स्क्रीनशॉट')}
                          </button>
                        </div>
                      </div>

                      {/* Option 1: UTR & Payer Name */}
                      {proofType === 'utr' ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                              {L('12-Digit UPI Reference / UTR Number', '12 अंकों का UPI UTR नंबर')} *
                            </label>
                            <input
                              className="field text-sm font-mono tracking-wider"
                              placeholder="e.g. 412356789012"
                              value={paymentUtr}
                              onChange={(e) => {
                                setPaymentUtr(e.target.value.replace(/[^A-Za-z0-9]/g, ''));
                                setErrors((prev) => ({ ...prev, paymentProof: '' }));
                              }}
                              maxLength={22}
                            />
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {L('Found in your UPI app receipt details', 'यह आपकी यूपीआई रसीद में मिलेगा')}
                            </p>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                              {L('Payer Name on UPI', 'UPI में खाताधारक का नाम')} *
                            </label>
                            <input
                              className="field text-sm"
                              placeholder={f.name || 'e.g. Rahul Sharma'}
                              value={paymentName}
                              onChange={(e) => {
                                setPaymentName(e.target.value);
                                setErrors((prev) => ({ ...prev, paymentName: '' }));
                              }}
                            />
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {L('Name linked to the bank account', 'बैंक खाते से जुड़ा नाम')}
                            </p>
                          </div>
                        </div>
                      ) : (
                        /* Option 2: Screenshot Upload */
                        <div className="space-y-2">
                          {!paymentScreenshot ? (
                            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/40 bg-card/60 p-4 text-center hover:border-primary transition">
                              <UploadCloud size={24} className="text-primary mb-1" />
                              <span className="text-xs font-bold text-foreground">
                                {compressing ? L('Optimizing image…', 'फोटो प्रोसेस हो रही है…') : L('Click to upload payment screenshot', 'स्क्रीनशॉट अपलोड करने के लिए क्लिक करें')}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                PNG, JPG or WebP (Auto-compressed)
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleScreenshotChange}
                                className="hidden"
                                disabled={compressing}
                              />
                            </label>
                          ) : (
                            <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-2.5">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={paymentScreenshot}
                                  alt="Payment Proof"
                                  className="h-11 w-11 rounded-lg object-cover border border-emerald-400"
                                />
                                <div className="text-xs">
                                  <p className="font-bold text-foreground truncate max-w-[180px]">
                                    {screenshotFileName || 'payment_proof.jpg'}
                                  </p>
                                  <p className="text-emerald-400 text-[11px]">✓ {L('Screenshot Ready', 'स्क्रीनशॉट तैयार है')}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={removeScreenshot}
                                className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-950/40 transition"
                                title={L('Remove', 'हटाएँ')}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      <Err m={errors.paymentProof} />
                      <Err m={errors.paymentName} />
                    </div>
                  </div>
                )}
              </div>

              {serverError && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/50 p-3.5 text-xs text-rose-200 shadow-md">
                  <p className="font-bold flex items-center gap-1.5 mb-1 text-rose-300">
                    <AlertTriangle size={15} />
                    {L('Delivery / Order Notice', 'डिलीवरी सूचना')}
                  </p>
                  <p className="leading-relaxed">{serverError}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="button"
                onClick={send}
                disabled={busy || compressing || checkingDistance}
                className="btn-gold w-full flex items-center justify-center gap-2 py-3.5 text-base shadow-lg disabled:opacity-75 transition-all"
              >
                {checkingDistance ? (
                  <>
                    <Radar size={20} className="animate-spin text-primary-foreground" />
                    <span>{L('Checking Delivery Distance (1 km limit)…', '1 किमी डिलीवरी दूरी की जांच जारी…')}</span>
                  </>
                ) : busy ? (
                  <>
                    <Clock size={20} className="animate-pulse" />
                    <span>{L('Placing Order with Kitchen…', 'किचन में ऑर्डर भेजा जा रहा है…')}</span>
                  </>
                ) : (
                  <>
                    <MessageCircle size={20} />
                    <span>{L(`Place Order (${inr(total)})`, `ऑर्डर दर्ज करें (${inr(total)})`)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
