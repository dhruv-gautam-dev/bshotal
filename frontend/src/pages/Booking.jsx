import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Copy,
  Check,
  CreditCard,
  QrCode,
  Building,
  UploadCloud,
  X,
  Smartphone,
  ShieldCheck,
  Sparkles,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import PageHero from '@/components/site/PageHero';
import BookingConfirmation from '@/components/site/BookingConfirmation';
import { useRoomTypes } from '@/hooks/useSiteCatalog';
import { ROOMS } from '@/data/rooms';
import { useI18n } from '@/lib/i18n';
import { isValidPhone, inr } from '@/lib/whatsapp';
import { submitBooking } from '@/lib/services';
import { apiClient } from '@/api/apiClient';
import useSeo from '@/lib/useSeo';
import DatePicker from '@/components/ui/date-picker';
import PhoneInput from '@/components/ui/phone-input';

const today = () => new Date().toISOString().slice(0, 10);
const Err = ({ m }) => (m ? <p className="mt-1 text-xs font-semibold text-rose-400" role="alert">{m}</p> : null);

const UPI_ID = '6377682442-6@ibl';
const UPI_PAYEE_NAME = 'B.S. Hotel & Restaurant';

// Granular date range formatter for availability suggestions
function formatAvailDateRanges(dates, lang = 'en') {
  if (!dates || !dates.length) return '';
  const sorted = [...dates]
    .map((d) => (typeof d === 'string' ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10)))
    .filter(Boolean)
    .sort();

  if (!sorted.length) return '';

  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsHi = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];

  const fmt = (iso) => {
    const parts = iso.split('-');
    const day = parseInt(parts[2], 10);
    const mIdx = parseInt(parts[1], 10) - 1;
    const month = lang === 'hi' ? monthsHi[mIdx] : monthsEn[mIdx];
    return `${day} ${month}`;
  };

  const ranges = [];
  let start = sorted[0];
  let prev = sorted[0];
  let count = 1;

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const prevDate = new Date(prev);
    const curDate = new Date(cur);
    const diff = Math.round((curDate - prevDate) / 86400000);
    if (diff === 1) {
      prev = cur;
      count++;
    } else {
      if (count === 1) {
        ranges.push(fmt(start));
      } else if (count === 2) {
        ranges.push(`${fmt(start)}, ${fmt(prev)}`);
      } else {
        ranges.push(lang === 'hi' ? `${fmt(start)} से ${fmt(prev)}` : `${fmt(start)} to ${fmt(prev)}`);
      }
      start = cur;
      prev = cur;
      count = 1;
    }
  }

  if (count === 1) {
    ranges.push(fmt(start));
  } else if (count === 2) {
    ranges.push(`${fmt(start)}, ${fmt(prev)}`);
  } else {
    ranges.push(lang === 'hi' ? `${fmt(start)} से ${fmt(prev)}` : `${fmt(start)} to ${fmt(prev)}`);
  }

  return ranges.join(', ');
}

// Client-side image compressor: keeps uploaded screenshot < 120KB without server upload dependency
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

export default function Booking() {
  const { lang, t, tr, L } = useI18n();
  const { data: rooms } = useRoomTypes();
  const roomList = rooms && rooms.length > 0 ? rooms : ROOMS;
  const [q] = useSearchParams();

  const fileInputRef = useRef(null);

  const [f, setF] = useState({
    name: '',
    phone: '',
    email: '',
    checkIn: q.get('in') || '',
    checkOut: q.get('out') || '',
    guests: q.get('guests') || 2,
    room: q.get('room') || (roomList[0]?.id || 'standard'),
    special: '',
    paymentMode: 'upi_qr', // 'upi_qr' | 'pay_at_hotel'
    paymentUtr: '',
    paymentName: '',
    paymentScreenshot: '',
    screenshotFileName: '',
  });

  const [copied, setCopied] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [availabilitySuggestion, setAvailabilitySuggestion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  // Two-step verification state: room availability must be verified before payment QR is revealed
  const [isAvailabilityVerified, setIsAvailabilityVerified] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [verifiedStayKey, setVerifiedStayKey] = useState('');

  // Auto-apply available dates when suggested
  const applyAvailableDates = (dates) => {
    if (!dates || !dates.length) return;
    const sorted = [...dates]
      .map((d) => (typeof d === 'string' ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10)))
      .filter(Boolean)
      .sort();
    const newCheckIn = sorted[0];
    const lastDate = new Date(sorted[sorted.length - 1]);
    const nextDay = new Date(lastDate.getTime() + 86400000);
    const newCheckOut = nextDay.toISOString().slice(0, 10);
    setF((prev) => ({
      ...prev,
      checkIn: newCheckIn,
      checkOut: newCheckOut,
    }));
    setServerError('');
    setAvailabilitySuggestion(null);
  };

  // If user modifies dates or room category, reset verified status so they must re-verify
  useEffect(() => {
    const currentKey = `${f.room}_${f.checkIn}_${f.checkOut}_${f.guests}`;
    if (verifiedStayKey && currentKey !== verifiedStayKey) {
      setIsAvailabilityVerified(false);
      setVerifiedStayKey('');
    }
    setServerError('');
    setAvailabilitySuggestion(null);
  }, [f.room, f.checkIn, f.checkOut, f.guests]);

  useSeo(
    'Online Room Booking | B.S. Hotel & Restaurant, Mathura',
    'Reserve your AC luxury room at B.S. Hotel & Restaurant near Mathura Refinery, NH-19 (NH-2), Baad, Mathura with instant PhonePe UPI QR or Pay at Hotel.',
    {
      keywords: 'bs hotel room booking, book bs hotel mathura, b.s. hotel reservation, hotel booking mathura nh-2',
      image: '/images/deluxe.webp',
    }
  );

  useEffect(() => {
    if (roomList.length > 0) {
      const exists = roomList.some((r) => r.id === f.room);
      if (!exists) {
        const matched = roomList.find((r) => r.id === f.room || r.slug === f.room || r.name_en === f.room || r.name === f.room);
        setF((prev) => ({ ...prev, room: matched ? matched.id : roomList[0].id }));
      }
    }
  }, [roomList, f.room]);

  const set = (k) => (e) => {
    setServerError('');
    setF((prev) => ({ ...prev, [k]: e?.target ? e.target.value : e }));
  };

  const copyUpiId = () => {
    navigator.clipboard?.writeText(UPI_ID);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleScreenshotChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(L('Please upload an image file (JPG, PNG, WebP).', 'कृपया केवल इमेज फ़ाइल (JPG, PNG, WebP) अपलोड करें।'));
      return;
    }

    setCompressing(true);
    try {
      const compressedDataUrl = await compressScreenshot(file);
      setF((prev) => ({
        ...prev,
        paymentScreenshot: compressedDataUrl,
        screenshotFileName: file.name,
      }));
      setErrors((prev) => ({ ...prev, payment: '' }));
    } catch (err) {
      console.error('Screenshot compression error:', err);
      alert(L('Could not process this image. Please try another image.', 'इमेज प्रोसेस नहीं हो सकी। कृपया दूसरी इमेज चुनें।'));
    } finally {
      setCompressing(false);
    }
  };

  const removeScreenshot = () => {
    setF((prev) => ({
      ...prev,
      paymentScreenshot: '',
      screenshotFileName: '',
    }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 1. Validate stay and guest details
  const validateStayDetails = () => {
    const e = {};
    if (f.name.trim().length < 2) e.name = L('Please enter your name.', 'कृपया अपना नाम दर्ज करें।');
    if (!isValidPhone(f.phone)) e.phone = L('Enter a valid 10-digit mobile number.', 'कृपया 10 अंकों का मान्य मोबाइल नंबर दर्ज करें।');
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = L('Enter a valid email or leave it blank.', 'मान्य ईमेल दर्ज करें या खाली छोड़ दें।');
    if (!f.checkIn) e.checkIn = L('Choose a check-in date.', 'चेक-इन तारीख चुनें।');
    else if (f.checkIn < today()) e.checkIn = L('Check-in cannot be in the past.', 'चेक-इन तारीख पिछली नहीं हो सकती।');
    if (!f.checkOut) e.checkOut = L('Choose a check-out date.', 'चेक-आउट तारीख चुनें।');
    else if (f.checkIn && f.checkOut <= f.checkIn) e.checkOut = L('Check-out must be after check-in.', 'चेक-आउट तारीख चेक-इन के बाद की होनी चाहिए।');
    if (!(Number(f.guests) >= 1)) e.guests = L('At least 1 guest.', 'कम से कम 1 अतिथि।');
    return e;
  };

  // 2. Validate payment proof when UPI QR is chosen
  const validatePaymentProof = () => {
    const e = {};
    if (f.paymentMode === 'upi_qr') {
      const utrClean = (f.paymentUtr || '').trim();
      const hasUtr = utrClean.length >= 8;
      const hasScreenshot = Boolean(f.paymentScreenshot);

      if (!hasUtr && !hasScreenshot) {
        e.payment = L(
          'Please enter your 12-digit UPI UTR number OR upload your payment screenshot.',
          'कृपया 12-अंकों का UPI UTR नंबर डालें या भुगतान स्क्रीनशॉट अपलोड करें।'
        );
      } else if (utrClean.length > 0 && utrClean.length < 8) {
        e.paymentUtr = L('UTR / Ref number is usually 12 digits.', 'UTR नंबर सामान्यतः 12 अंकों का होता है।');
      }

      if (hasUtr && (!f.paymentName || f.paymentName.trim().length < 2)) {
        e.paymentName = L('Enter the name registered on your UPI account.', 'कृपया अपने UPI खाते का नाम दर्ज करें।');
      }
    }
    return e;
  };

  const room = roomList.find((r) => r.id === f.room) || roomList[0];
  const nights = f.checkIn && f.checkOut && f.checkOut > f.checkIn
    ? Math.max(1, Math.round((new Date(f.checkOut) - new Date(f.checkIn)) / 86400000))
    : 0;
  const roomPrice = Number(room?.price || room?.base_price || 1499);
  const totalAmount = nights > 0 ? roomPrice * nights : 0;
  const roomName = room ? (typeof room.name === 'object' ? tr(room.name) : (room.name_en || room.name)) : 'Room';

  // Live availability verification with backend
  const verifyRoomAvailability = async () => {
    setServerError('');
    const stayErrors = validateStayDetails();
    setErrors(stayErrors);
    if (Object.keys(stayErrors).length > 0) {
      window.scrollTo({ top: 320, behavior: 'smooth' });
      return false;
    }

    setCheckingAvailability(true);
    try {
      const roomService = apiClient.rooms || apiClient.entities?.RoomType;
      if (roomService?.checkAvailability) {
        const quotes = await roomService.checkAvailability(f.checkIn, f.checkOut, f.guests, 1);
        if (Array.isArray(quotes) && quotes.length > 0) {
          const selectedRoom = roomList.find((r) => r.id === f.room) || roomList[0];
          const targetId = selectedRoom?.id || f.room;
          const targetName = selectedRoom?.name_en || (typeof selectedRoom?.name === 'object' ? tr(selectedRoom.name) : selectedRoom?.name) || roomName;

          const selectedQuote = quotes.find((q) => {
            if (q.room_type_id && (q.room_type_id === targetId || q.room_type_id === f.room)) return true;
            if (q.id && (q.id === targetId || q.id === f.room)) return true;
            if (selectedRoom?.slug && q.slug === selectedRoom.slug) return true;
            const qName = (q.name || '').toLowerCase().trim();
            const tName = (targetName || '').toLowerCase().trim();
            if (qName && tName && (qName === tName || qName.includes(tName) || tName.includes(qName))) return true;
            return false;
          }) || (quotes.length === 1 ? quotes[0] : null);

          if (!selectedQuote) {
            setServerError(L('Could not verify selected room category. Please re-select your room.', 'कमरे की श्रेणी जाँची नहीं जा सकी। कृपया पुनः कमरा चुनें।'));
            setIsAvailabilityVerified(false);
            window.scrollTo({ top: 300, behavior: 'smooth' });
            return false;
          }

          if (!selectedQuote.is_available || selectedQuote.available_rooms <= 0) {
            const availDates = Array.isArray(selectedQuote.available_dates) ? selectedQuote.available_dates : [];
            const bookedDates = Array.isArray(selectedQuote.booked_dates) ? selectedQuote.booked_dates : [];
            const availFmt = formatAvailDateRanges(availDates, lang);
            const bookedFmt = formatAvailDateRanges(bookedDates, lang);
            const currentRoomName = selectedQuote.name || targetName;

            const altRooms = quotes.filter((q) => {
              const qId = q.room_type_id || q.id;
              const currId = selectedQuote.room_type_id || selectedQuote.id;
              return qId !== currId && q.is_available && q.available_rooms > 0;
            });

            let errorMsg = '';
            if (availDates.length > 0) {
              if (lang === 'hi') {
                errorMsg = `"${currentRoomName}" ${availFmt} को उपलब्ध है, परंतु ${bookedFmt ? `${bookedFmt} को पहले से बुक है` : 'पूरी अवधि के लिए उपलब्ध नहीं है'}। कृपया उपलब्ध तारीखें चुनें या दूसरा कमरा चुनें।`;
              } else {
                errorMsg = `"${currentRoomName}" is available on ${availFmt}, but already booked on ${bookedFmt || 'other requested dates'}. Please choose available dates or another room category.`;
              }
            } else {
              if (lang === 'hi') {
                errorMsg = `"${currentRoomName}" चुनी गई सभी तारीखों (${f.checkIn} से ${f.checkOut}) पर पहले से बुक है। कृपया अन्य तारीखें या दूसरा कमरा चुनें।`;
              } else {
                errorMsg = `"${currentRoomName}" is fully booked for all chosen dates (${f.checkIn} to ${f.checkOut}). Please choose different dates or select another room category.`;
              }
            }

            setServerError(errorMsg);
            setAvailabilitySuggestion({
              roomName: currentRoomName,
              availDates,
              bookedDates,
              availFmt,
              bookedFmt,
              altRooms,
            });
            setIsAvailabilityVerified(false);
            window.scrollTo({ top: 300, behavior: 'smooth' });
            return false;
          }
        }
      }

      setServerError('');
      setAvailabilitySuggestion(null);
      const currentKey = `${f.room}_${f.checkIn}_${f.checkOut}_${f.guests}`;
      setVerifiedStayKey(currentKey);
      setIsAvailabilityVerified(true);
      return true;
    } catch (err) {
      console.warn('Availability check error:', err);
      setIsAvailabilityVerified(false);
      setServerError(
        err.message || L('Selected room is not available for these dates.', 'चुने गए कमरे इन तारीखों पर उपलब्ध नहीं हैं।')
      );
      window.scrollTo({ top: 300, behavior: 'smooth' });
      return false;
    } finally {
      setCheckingAvailability(false);
    }
  };

  // Step 1 Click Handler for UPI: verifies availability before unlocking QR code
  const handleProceedToPayment = async () => {
    const isAvailable = await verifyRoomAvailability();
    if (isAvailable) {
      setTimeout(() => {
        document.getElementById('upi-qr-payment-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // Final booking execution
  const executeBookingSubmission = async () => {
    setBusy(true);
    try {
      const res = await submitBooking({
        ...f,
        room: room?.id || '',
        roomName,
        nights,
        amount: totalAmount,
        payment_mode: f.paymentMode,
        payment_utr: f.paymentMode === 'upi_qr' && f.paymentUtr ? f.paymentUtr.trim() : null,
        payment_name: f.paymentMode === 'upi_qr' && f.paymentName ? f.paymentName.trim() : null,
        payment_screenshot: f.paymentMode === 'upi_qr' && f.paymentScreenshot ? f.paymentScreenshot : null,
      });

      setDone(res);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Booking submission error:', err);
      setServerError(
        err.message || L('Selected room is not available for the chosen dates. Please choose different dates.', 'चुने गए कमरे इन तारीखों पर उपलब्ध नहीं हैं। कृपया अन्य तारीखें चुनें।')
      );
    } finally {
      setBusy(false);
    }
  };

  // Click Handler for Pay at Hotel
  const handleBookPayAtHotel = async () => {
    const isAvailable = await verifyRoomAvailability();
    if (!isAvailable) return;
    await executeBookingSubmission();
  };

  // Step 2 Click Handler for UPI: submits payment proof
  const handleFinalSubmitWithPayment = async (ev) => {
    ev.preventDefault();
    setServerError('');
    const stayErrors = validateStayDetails();
    const paymentErrors = validatePaymentProof();
    const combinedErrors = { ...stayErrors, ...paymentErrors };
    setErrors(combinedErrors);

    if (Object.keys(combinedErrors).length > 0) {
      if (Object.keys(stayErrors).length > 0) {
        window.scrollTo({ top: 320, behavior: 'smooth' });
      }
      return;
    }

    await executeBookingSubmission();
  };

  // Deep Link for Mobile UPI (PhonePe, GPay, Paytm)
  const upiIntentUrl = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_PAYEE_NAME)}&am=${totalAmount}&cu=INR&tn=${encodeURIComponent(`BSH Booking - ${f.name || 'Stay'}`)}`;

  // Form submit router: handles Enter key or form submission safely
  const handleSubmitForm = (ev) => {
    ev.preventDefault();
    if (f.paymentMode === 'pay_at_hotel') {
      handleBookPayAtHotel();
    } else if (isAvailabilityVerified) {
      handleFinalSubmitWithPayment(ev);
    } else {
      handleProceedToPayment();
    }
  };

  const isPaymentDetailsOpen = f.paymentMode === 'upi_qr' && isAvailabilityVerified;

  // 1. Reusable Server Error Alert Banner with granular dates and alternative rooms
  const renderServerError = () => {
    if (!serverError) return null;
    return (
      <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-4 text-rose-100 shadow-lg backdrop-blur-sm animate-in fade-in duration-200">
        <div className="flex items-start gap-3.5">
          <div className="rounded-xl bg-rose-500/20 p-2 text-rose-400 shrink-0 mt-0.5">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-2 flex-1">
            <h4 className="font-semibold text-rose-200 text-sm">
              {String(serverError).toLowerCase().includes('not available') ||
              String(serverError).toLowerCase().includes('unavailable') ||
              String(serverError).toLowerCase().includes('booked') ||
              String(serverError).toLowerCase().includes('बुक')
                ? L('Dates Not Available for Full Stay', 'कमरा पूरी अवधि के लिए उपलब्ध नहीं है')
                : L('Booking Notice', 'बुकिंग सूचना')}
            </h4>
            <p className="text-xs font-medium leading-relaxed text-rose-100/90">{serverError}</p>

            {/* Quick Button to select only the dates that ARE available */}
            {availabilitySuggestion?.availDates?.length > 0 && (
              <div className="pt-2 border-t border-rose-500/20 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => applyAvailableDates(availabilitySuggestion.availDates)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow-md transition cursor-pointer"
                >
                  <Calendar size={13} />
                  <span>
                    {L('Auto-select Available Dates:', 'उपलब्ध तारीखें चुनें:')} {availabilitySuggestion.availFmt}
                  </span>
                </button>
              </div>
            )}

            {/* Alternative Room categories available for these dates */}
            {availabilitySuggestion?.altRooms?.length > 0 && (
              <div className="pt-2 border-t border-rose-500/20 space-y-1.5">
                <span className="text-[11px] font-semibold text-amber-300 block">
                  {L('Other rooms fully available for your requested dates:', 'अन्य कमरे जो आपकी पूरी अवधि के लिए उपलब्ध हैं:')}
                </span>
                <div className="flex flex-wrap gap-2">
                  {availabilitySuggestion.altRooms.map((alt) => (
                    <button
                      key={alt.room_type_id || alt.id}
                      type="button"
                      onClick={() => {
                        setF((prev) => ({ ...prev, room: alt.room_type_id || alt.id }));
                        setServerError('');
                        setAvailabilitySuggestion(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/20 hover:bg-amber-500/30 px-2.5 py-1 text-xs font-bold text-amber-200 transition cursor-pointer"
                    >
                      <Building size={13} />
                      <span>{alt.name}</span>
                      <span className="opacity-80 font-normal">({inr(alt.total_amount || alt.base_amount)})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 2. Reusable Guest & Stay Details Card
  const renderGuestDetailsCard = () => (
    <div className="rounded-3xl border border-primary/30 bg-card/95 p-6 shadow-2xl backdrop-blur md:p-8 space-y-5">
      <div className="border-b border-primary/20 pb-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Calendar className="text-primary" size={22} />
          <span>{L('Guest & Stay Details', 'मेहमान व ठहरने का विवरण')}</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {L('Fill in your details below to place your booking request.', 'अपनी बुकिंग दर्ज करने के लिए नीचे विवरण भरें।')}
        </p>
      </div>

      {/* Guest Details Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold text-foreground">
          {t('f.name')} *
          <input
            className="field mt-1"
            value={f.name}
            onChange={set('name')}
            placeholder={L('Full Name (e.g. Rahul Sharma)', 'पूरा नाम (उदा. राहुल शर्मा)')}
            autoComplete="name"
            required
          />
          <Err m={errors.name} />
        </label>

        <label className="text-xs font-semibold text-foreground">
          {t('f.phone')} *
          <PhoneInput value={f.phone} onChange={set('phone')} className="mt-1" required />
          <Err m={errors.phone} />
        </label>

        <label className="text-xs font-semibold text-foreground sm:col-span-2">
          {t('f.email')} ({L('Optional', 'वैकल्पिक')})
          <input
            className="field mt-1"
            type="email"
            value={f.email}
            onChange={set('email')}
            placeholder="name@example.com"
          />
          <Err m={errors.email} />
        </label>

        {/* Dates */}
        <div className="space-y-1">
          <span className="text-xs font-semibold text-foreground">{t('f.checkIn')} *</span>
          <DatePicker
            min={today()}
            value={f.checkIn}
            onChange={set('checkIn')}
            placeholder={t('f.checkIn')}
            className="field mt-1"
          />
          <Err m={errors.checkIn} />
        </div>

        <div className="space-y-1">
          <span className="text-xs font-semibold text-foreground">{t('f.checkOut')} *</span>
          <DatePicker
            min={f.checkIn || today()}
            value={f.checkOut}
            onChange={set('checkOut')}
            placeholder={t('f.checkOut')}
            className="field mt-1"
          />
          <Err m={errors.checkOut} />
        </div>

        <label className="text-xs font-semibold text-foreground">
          {t('f.guests')} *
          <input
            className="field mt-1"
            type="number"
            min="1"
            max="10"
            value={f.guests}
            onChange={set('guests')}
          />
          <Err m={errors.guests} />
        </label>

        <label className="text-xs font-semibold text-foreground">
          {t('f.roomType')} *
          <select className="field mt-1" value={f.room || roomList[0]?.id} onChange={set('room')}>
            {roomList.map((r) => (
              <option key={r.id} value={r.id}>
                {typeof r.name === 'object' ? tr(r.name) : r.name_en || r.name}
                {r.price || r.base_price ? ` — ${inr(r.price || r.base_price)}/${L('night', 'रात')}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold text-foreground sm:col-span-2">
          {t('f.special')} ({L('Optional', 'वैकल्पिक')})
          <textarea
            className="field mt-1 py-2.5"
            rows={2}
            value={f.special}
            onChange={set('special')}
            placeholder={L('Any special requests (e.g. early check-in, ground floor, extra pillows)', 'कोई विशेष अनुरोध (उदा. जल्दी चेक-इन, भूतल पर कमरा)')}
          />
        </label>
      </div>

      {/* Stay Summary Bar */}
      {nights > 0 && room && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="text-primary shrink-0" size={18} />
            <div>
              <span className="font-bold text-foreground text-sm block">
                {typeof room.name === 'object' ? tr(room.name) : room.name_en || room.name}
              </span>
              <span className="text-muted-foreground">
                {f.checkIn} → {f.checkOut} · {nights} {nights === 1 ? L('night', 'रात') : L('nights', 'रातें')} · {f.guests} {L('guests', 'अतिथि')}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">{L('Total Estimated Amount', 'कुल अनुमानित राशि')}</span>
            <span className="text-lg font-black text-primary tabular-nums">{inr(totalAmount)}</span>
          </div>
        </div>
      )}
    </div>
  );

  // 3. Reusable Payment Method Selector Card
  const renderPaymentModeSelector = () => (
    <div className="rounded-3xl border border-primary/30 bg-card/95 p-6 shadow-2xl backdrop-blur md:p-8 space-y-4">
      <div className="border-b border-primary/20 pb-3">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <CreditCard size={18} className="text-primary" />
          <span>{L('Payment Method', 'भुगतान का तरीका')}</span>
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {L('Choose how you would like to complete your reservation.', 'कृपया आरक्षण पूर्ण करने के लिए विकल्प चुनें।')}
        </p>
      </div>

      {/* Payment Mode Selector Cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Option 1: PhonePe UPI QR */}
        <button
          type="button"
          onClick={() => setF((prev) => ({ ...prev, paymentMode: 'upi_qr' }))}
          className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
            f.paymentMode === 'upi_qr'
              ? 'border-amber-400 bg-amber-500/10 shadow-md ring-1 ring-amber-400/50'
              : 'border-primary/20 bg-background/50 hover:border-primary/40'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                <QrCode size={18} className="text-amber-400" />
                <span>{L('Pay Online via PhonePe UPI QR', 'PhonePe UPI QR द्वारा भुगतान')}</span>
              </div>
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                <Sparkles size={11} /> {L('Recommended', 'अनुशंसित')}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {L('Guarantees your room reservation instantly. Pay via PhonePe, GPay, Paytm, or any UPI app.', 'आपके कमरे का आरक्षण तुरंत पक्का करता है। किसी भी UPI ऐप से भुगतान करें।')}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-amber-300">
            <span className={`h-4 w-4 rounded-full border flex items-center justify-center ${f.paymentMode === 'upi_qr' ? 'border-amber-400 bg-amber-400 text-slate-900' : 'border-muted-foreground'}`}>
              {f.paymentMode === 'upi_qr' && '✓'}
            </span>
            <span>{L('Selected for Instant Confirmation', 'चुना गया (त्वरित पुष्टि)')}</span>
          </div>
        </button>

        {/* Option 2: Pay at Hotel */}
        <button
          type="button"
          onClick={() => setF((prev) => ({ ...prev, paymentMode: 'pay_at_hotel' }))}
          className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
            f.paymentMode === 'pay_at_hotel'
              ? 'border-amber-400 bg-amber-500/10 shadow-md ring-1 ring-amber-400/50'
              : 'border-primary/20 bg-background/50 hover:border-primary/40'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                <Building size={18} className="text-primary" />
                <span>{L('Pay at Hotel Reception', 'होटल रिसेप्शन पर भुगतान')}</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {L('Pay via Cash, Card, or UPI upon arrival. Room is held tentatively subject to confirmation.', 'होटल पहुँचकर नकद, कार्ड या UPI द्वारा भुगतान करें।')}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span className={`h-4 w-4 rounded-full border flex items-center justify-center ${f.paymentMode === 'pay_at_hotel' ? 'border-amber-400 bg-amber-400 text-slate-900' : 'border-muted-foreground'}`}>
              {f.paymentMode === 'pay_at_hotel' && '✓'}
            </span>
            <span>{L('Pay on Arrival at Check-in', 'चेक-इन पर भुगतान')}</span>
          </div>
        </button>
      </div>

      {/* When UPI is chosen but NOT yet verified: Show Step 1 Verification Gate */}
      {f.paymentMode === 'upi_qr' && !isAvailabilityVerified && (
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 sm:p-6 text-center space-y-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
            <ShieldCheck size={28} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-base font-bold text-foreground">
              {L('Step 1: Check Live Room Availability', 'चरण 1: कमरे की उपलब्धता की पुष्टि करें')}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {L(
                'Before unlocking the PhonePe UPI payment QR, we will verify room availability and pricing for your exact dates so you never pay for a sold-out room.',
                'PhonePe UPI QR कोड खुलने से पहले हम आपकी तारीखों पर कमरे की उपलब्धता की पुष्टि करेंगे ताकि आपका भुगतान 100% सुरक्षित रहे।'
              )}
            </p>
          </div>

          <button
            type="button"
            disabled={checkingAvailability}
            onClick={handleProceedToPayment}
            className="btn-gold mx-auto flex items-center justify-center gap-2 py-3 px-6 text-sm font-bold shadow-xl cursor-pointer"
          >
            {checkingAvailability ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{L('Checking Room Availability...', 'कमरे की उपलब्धता जाँची जा रही है...')}</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>{L('Check Availability & Proceed to Pay', 'उपलब्धता जाँचें व भुगतान के लिए आगे बढ़ें')}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      )}

      {/* When UPI is chosen and ALREADY verified: Show reassuring notice */}
      {f.paymentMode === 'upi_qr' && isAvailabilityVerified && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>
            {L(
              '✓ Live Room Availability Verified! Complete payment on the right to guarantee reservation.',
              '✓ कमरे की उपलब्धता सत्यापित है! आरक्षण पक्का करने के लिए दाईं ओर दिए गए QR से भुगतान पूर्ण करें।'
            )}
          </span>
        </div>
      )}

      {/* When Pay at Hotel is chosen: Show Pay at Hotel submission button */}
      {f.paymentMode === 'pay_at_hotel' && (
        <div className="pt-2">
          <button
            type="button"
            onClick={handleBookPayAtHotel}
            disabled={busy || checkingAvailability}
            className="btn-gold flex w-full items-center justify-center gap-2 py-3.5 text-sm font-bold shadow-xl cursor-pointer"
          >
            {checkingAvailability ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{L('Checking Room Availability...', 'कमरे की उपलब्धता जाँची जा रही है...')}</span>
              </>
            ) : busy ? (
              <span>{L('Submitting Reservation...', 'आरक्षण दर्ज हो रहा है...')}</span>
            ) : (
              <>
                <CheckCircle2 size={18} />
                <span>{L('Check Availability & Confirm Booking (Pay at Hotel)', 'उपलब्धता जाँचें व कमरा बुक करें (होटल पर भुगतान)')}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );

  // 4. Dedicated Right Column for UPI QR Code & Payment Verification Proof
  const renderPaymentRightColumn = () => (
    <div id="upi-qr-payment-section" className="lg:col-span-5 lg:sticky lg:top-24 space-y-5 animate-in fade-in duration-300">
      <div className="rounded-3xl border border-emerald-500/40 bg-card/98 p-5 sm:p-7 shadow-2xl backdrop-blur space-y-5">
        {/* Verified Badge Header */}
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span>
            {L(
              `✓ Room is Available for your stay (${f.checkIn} to ${f.checkOut})! Please complete payment below to guarantee your reservation.`,
              `✓ आपके प्रवास (${f.checkIn} से ${f.checkOut}) के लिए कमरा उपलब्ध है! आरक्षण पक्का करने के लिए कृपया नीचे भुगतान करें।`
            )}
          </span>
        </div>

        {/* Merchant Badge Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 font-bold text-lg">
              पे
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                <span>{UPI_PAYEE_NAME}</span>
                <ShieldCheck size={16} className="text-emerald-400" />
              </h4>
              <p className="text-xs text-muted-foreground">
                {L('Official Verified UPI QR (PhonePe / All UPI Apps)', 'आधिकारिक सत्यापित UPI QR (PhonePe / सभी UPI ऐप्स)')}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">{L('Amount Payable', 'भुगतान राशि')}</span>
            <span className="text-xl font-black text-primary tabular-nums">
              {totalAmount > 0 ? inr(totalAmount) : L('Select Dates First', 'पहले तारीखें चुनें')}
            </span>
          </div>
        </div>

        {/* QR Presentation Card */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-primary/30 bg-background/80 p-5 text-center shadow-inner">
          <div className="relative rounded-2xl border-2 border-primary/50 bg-white p-2.5 shadow-xl">
            <img
              src="/images/phonepe-qr.jpg"
              alt="B.S. Hotel PhonePe UPI QR"
              className="h-52 w-52 sm:h-56 sm:w-56 object-contain rounded-xl"
            />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-foreground">
              {L('Scan with any UPI App', 'किसी भी UPI ऐप से स्कैन करें')}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            PhonePe · Google Pay · Paytm · BHIM · Cred
          </p>

          {/* Mobile 1-Tap Pay Button */}
          {totalAmount > 0 && (
            <div className="mt-3 w-full sm:hidden">
              <a
                href={upiIntentUrl}
                className="btn-gold flex w-full items-center justify-center gap-2 py-2.5 text-xs font-bold"
              >
                <Smartphone size={16} />
                <span>{L('Tap to Pay via UPI App', 'UPI ऐप खोलकर भुगतान करें')}</span>
              </a>
            </div>
          )}
        </div>

        {/* Copyable UPI Box */}
        <div className="rounded-2xl border border-primary/20 bg-background/50 p-3.5">
          <span className="text-[11px] font-medium text-muted-foreground block mb-1">
            {L('Payee UPI ID (VPA):', 'होटल UPI ID:')}
          </span>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-card px-3 py-2">
            <code className="font-mono text-sm font-bold text-foreground select-all tracking-wider">
              {UPI_ID}
            </code>
            <button
              type="button"
              onClick={copyUpiId}
              className="flex items-center gap-1 rounded-lg bg-primary/20 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/30 transition cursor-pointer"
            >
              {copied ? (
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

        {/* Step by Step Note */}
        <div className="space-y-1.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-200">
          <p className="font-bold text-amber-300">
            {L('How to complete payment:', 'भुगतान कैसे पूर्ण करें:')}
          </p>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-amber-100/90">
            <li>{L('Scan the QR code above or copy the UPI ID in your UPI app.', 'ऊपर दिए गए QR को स्कैन करें या UPI ID कॉपी करके ऐप में पेस्ट करें।')}</li>
            <li>
              {L('Pay the total amount: ', 'कुल राशि का भुगतान करें: ')}
              <strong>{inr(totalAmount || roomPrice)}</strong>
            </li>
            <li>{L('Provide verification proof below (either UTR number OR screenshot).', 'नीचे सत्यापन प्रमाण दर्ज करें (UTR नंबर या स्क्रीनशॉट में से कोई एक)।')}</li>
          </ol>
        </div>

        {/* PROOF OF PAYMENT SECTION */}
        <div className="border-t border-primary/20 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span>{L('Payment Verification Proof', 'भुगतान सत्यापन प्रमाण')}</span>
            </h5>
            <span className="text-[11px] text-amber-400 font-semibold">
              {L('*Any 1 required', '*कोई एक आवश्यक')}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            {L(
              'Enter your 12-digit UPI UTR number OR upload your payment screenshot:',
              'अपना 12-अंकों का UPI UTR नंबर डालें या स्क्रीनशॉट अपलोड करें:'
            )}
          </p>

          {errors.payment && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-xs font-semibold text-rose-300 flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{errors.payment}</span>
            </div>
          )}

          {/* Choice 1: 12-digit UTR + Payer Name */}
          <div className="rounded-2xl border border-primary/20 bg-background/60 p-4 space-y-3">
            <span className="text-xs font-bold text-foreground block">
              {L('Choice 1: 12-Digit UPI UTR / Ref No.', 'विकल्प 1: 12-अंकों का UTR / रेफ़रेंस नंबर')}
            </span>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block">
                {L('12-Digit UPI Ref / UTR Number', '12-अंकों का UTR नंबर')}
              </label>
              <input
                type="text"
                maxLength={16}
                value={f.paymentUtr}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\w]/g, '').toUpperCase();
                  setF((prev) => ({ ...prev, paymentUtr: val }));
                  setErrors((prev) => ({ ...prev, payment: '', paymentUtr: '' }));
                }}
                placeholder="e.g. 431209876543"
                className="field mt-1 font-mono tracking-wider text-sm"
              />
              <Err m={errors.paymentUtr} />
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                {L('Found in your UPI receipt as "UPI Ref ID" or "UTR"', 'UPI रसीद में "UPI Ref ID" या "UTR" के रूप में मिलेगा')}
              </span>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block">
                {L('Name on UPI Account (Payer Name)', 'UPI खाते का नाम (भुगतानकर्ता का नाम)')}
              </label>
              <input
                type="text"
                value={f.paymentName}
                onChange={(e) => {
                  setF((prev) => ({ ...prev, paymentName: e.target.value }));
                  setErrors((prev) => ({ ...prev, payment: '', paymentName: '' }));
                }}
                placeholder={L('e.g. Rahul Sharma', 'उदा. राहुल शर्मा')}
                className="field mt-1 text-sm"
              />
              <Err m={errors.paymentName} />
            </div>
          </div>

          <div className="flex items-center gap-3 my-2 text-xs text-muted-foreground">
            <div className="h-px bg-primary/20 flex-1" />
            <span className="font-semibold text-[11px] uppercase tracking-wider">{L('OR', 'अथवा')}</span>
            <div className="h-px bg-primary/20 flex-1" />
          </div>

          {/* Choice 2: Screenshot Upload */}
          <div className="rounded-2xl border border-primary/20 bg-background/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                {L('Choice 2: Upload Payment Screenshot', 'विकल्प 2: भुगतान स्क्रीनशॉट अपलोड करें')}
              </span>
              {f.paymentScreenshot && (
                <span className="text-[11px] font-bold text-emerald-400">✓ {L('Uploaded', 'अपलोड हुआ')}</span>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleScreenshotChange}
              accept="image/*"
              className="hidden"
            />

            {!f.paymentScreenshot ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={compressing}
                className="flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed border-primary/30 bg-card hover:bg-card/80 hover:border-primary/60 transition p-3 text-center cursor-pointer"
              >
                <UploadCloud size={24} className="text-primary mb-1" />
                <span className="text-xs font-bold text-foreground">
                  {compressing
                    ? L('Processing Image...', 'इमेज प्रोसेस हो रही है...')
                    : L('Click or Tap to Upload Screenshot', 'स्क्रीनशॉट अपलोड करने के लिए क्लिक करें')}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {L('PNG, JPG, WebP from Phone Gallery', 'फ़ोन गैलरी से PNG, JPG, WebP')}
                </span>
              </button>
            ) : (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <img
                    src={f.paymentScreenshot}
                    alt="Payment Proof Thumbnail"
                    className="h-12 w-12 object-cover rounded-lg border border-emerald-500/40 shrink-0"
                  />
                  <div className="truncate">
                    <span className="text-xs font-bold text-emerald-300 block truncate">
                      {f.screenshotFileName || L('Payment_Receipt.jpg', 'भुगतान_रसीद.jpg')}
                    </span>
                    <span className="text-[10px] text-emerald-200/70">
                      {L('Proof attached successfully', 'प्रमाण सफलतापूर्वक संलग्न')}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeScreenshot}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-500/20 hover:text-rose-300 transition cursor-pointer"
                  title={L('Remove screenshot', 'स्क्रीनशॉट हटाएं')}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Server Error Alert inside right card (if final submission triggers an error) */}
        {serverError && renderServerError()}

        {/* Final Submit Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleFinalSubmitWithPayment}
            disabled={busy}
            className="btn-gold flex w-full items-center justify-center gap-2 py-4 text-base font-bold shadow-2xl cursor-pointer"
          >
            {busy ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{L('Submitting Reservation...', 'आरक्षण दर्ज हो रहा है...')}</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={20} />
                <span>{L('Verify Payment & Confirm Booking', 'भुगतान सत्यापित करें व कमरा बुक करें')}</span>
              </>
            )}
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {L('🔒 SSL Encrypted · Direct Hotel Confirmation', '🔒 सुरक्षित भुगतान · सीधी होटल पुष्टि')}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <PageHero
        title={t('cta.bookRoom')}
        sub={L('Reserve your stay at B.S. Hotel with instant PhonePe UPI verification or Pay at Hotel on arrival.', 'PhonePe UPI सत्यापन अथवा होटल पर भुगतान के विकल्प के साथ कमरा बुक करें।')}
      />

      <section className={`mx-auto px-4 py-10 transition-all duration-300 ${isPaymentDetailsOpen ? 'max-w-7xl' : 'max-w-3xl'}`}>
        {done ? (
          <BookingConfirmation booking={done} />
        ) : (
          <form
            onSubmit={handleSubmitForm}
            noValidate
            className={isPaymentDetailsOpen ? 'grid gap-8 lg:grid-cols-12 lg:items-start' : 'space-y-6'}
          >
            {!isPaymentDetailsOpen ? (
              /* Scenario 1: Only Form & Availability Gate (Single Centered Column) */
              <div className="space-y-6">
                {renderGuestDetailsCard()}
                {renderPaymentModeSelector()}
                {serverError && renderServerError()}
              </div>
            ) : (
              /* Scenario 2: Payment Details Unlocked -> Split Desktop Layout (Form on Left, Payment on Right) */
              <>
                <div className="lg:col-span-7 space-y-6">
                  {renderGuestDetailsCard()}
                  {renderPaymentModeSelector()}
                  {serverError && renderServerError()}
                </div>
                {renderPaymentRightColumn()}
              </>
            )}
          </form>
        )}
      </section>
    </>
  );
}
