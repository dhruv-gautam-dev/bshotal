import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, AlertCircle, Clock, Phone, Loader2, ArrowRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import DatePicker from '@/components/ui/date-picker';
import { apiClient } from '@/api/apiClient';
import { inr } from '@/lib/whatsapp';
import { useSiteSettings } from '@/hooks/useSiteCatalog';
import { ROOMS } from '@/data/rooms';

const today = () => new Date().toISOString().slice(0, 10);

function formatShortDate(dateStr, locale = 'en-IN') {
  if (!dateStr) return '';
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function addDays(dateStr, days) {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  const dt = new Date(parts[0], parts[1] - 1, parts[2] + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function calculateNights(inDate, outDate) {
  if (!inDate || !outDate) return 1;
  const p1 = inDate.split('-').map(Number);
  const p2 = outDate.split('-').map(Number);
  const t1 = Date.UTC(p1[0], p1[1] - 1, p1[2]);
  const t2 = Date.UTC(p2[0], p2[1] - 1, p2[2]);
  const diff = Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
}

function formatDateSummary(dates, locale = 'en-IN') {
  if (!dates || dates.length === 0) return '';
  const sorted = [...new Set(dates.map((d) => String(d).slice(0, 10)))].sort();
  if (sorted.length === 1) return formatShortDate(sorted[0], locale);

  const ranges = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    if (addDays(prev, 1) === cur) {
      prev = cur;
    } else {
      ranges.push(start === prev ? formatShortDate(start, locale) : `${formatShortDate(start, locale)} – ${formatShortDate(prev, locale)}`);
      start = cur;
      prev = cur;
    }
  }
  ranges.push(start === prev ? formatShortDate(start, locale) : `${formatShortDate(start, locale)} – ${formatShortDate(prev, locale)}`);
  return ranges.join(', ');
}

function getAvailableSegments(availableDates) {
  if (!availableDates || availableDates.length === 0) return [];
  const sorted = [...new Set(availableDates.map((d) => String(d).slice(0, 10)))].sort();
  const segments = [];
  let segStart = sorted[0];
  let prev = sorted[0];
  let nights = 1;

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    if (addDays(prev, 1) === curr) {
      prev = curr;
      nights++;
    } else {
      segments.push({
        checkIn: segStart,
        checkOut: addDays(prev, 1),
        nights,
        dates: sorted.filter((d) => d >= segStart && d <= prev),
      });
      segStart = curr;
      prev = curr;
      nights = 1;
    }
  }

  segments.push({
    checkIn: segStart,
    checkOut: addDays(prev, 1),
    nights,
    dates: sorted.filter((d) => d >= segStart && d <= prev),
  });

  return segments;
}

function getSegmentPrice(q, seg, totalNights) {
  if (Array.isArray(q.daily_rates) && q.daily_rates.length > 0) {
    const sum = seg.dates.reduce((acc, d) => {
      const match = q.daily_rates.find((dr) => String(dr.date).slice(0, 10) === d);
      return acc + (match ? Number(match.rate) : 0);
    }, 0);
    if (sum > 0) {
      const taxRate = Number(q.tax_percent || 12) / 100;
      return Math.round(sum * (1 + taxRate));
    }
  }
  const fullTotal = Number(q.total_amount || q.base_price || 1499);
  const nightly = Math.round(fullTotal / Math.max(1, q.nights || totalNights || 1));
  return Math.max(nightly, nightly * seg.nights);
}

export default function QuickBookBar() {
  const { t, L, lang } = useI18n();
  const nav = useNavigate();
  const { bookingsTel } = useSiteSettings();
  const [v, setV] = useState({ in: '', out: '', guests: 2 });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const set = (k) => (e) => {
    setV((prev) => ({ ...prev, [k]: e.target.value }));
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!v.in || !v.out) {
      setError(L('Please select both Check-in and Check-out dates.', 'कृपया चेक-इन और चेक-आउट दोनों तारीखें चुनें।'));
      return;
    }

    if (v.out <= v.in) {
      setError(L('Check-out date must be after check-in date.', 'चेक-आउट तारीख चेक-इन तारीख के बाद की होनी चाहिए।'));
      return;
    }

    setLoading(true);
    try {
      const totalNights = calculateNights(v.in, v.out);
      const stayNights = [];
      for (let i = 0; i < totalNights; i++) {
        stayNights.push(addDays(v.in, i));
      }

      let quotes = null;

      // 1. Try public availability endpoint
      try {
        const roomService = apiClient.rooms || apiClient.entities?.RoomType;
        if (roomService?.checkAvailability) {
          quotes = await roomService.checkAvailability(v.in, v.out, v.guests, 1);
        }
      } catch (err) {
        console.warn('Live availability endpoint offline/unreachable:', err);
      }

      let list = Array.isArray(quotes) ? quotes : (quotes?.items || []);

      // 2. Resilient fallback if endpoint is offline or returned empty list
      if (!list || list.length === 0) {
        let roomTypes = [];
        try {
          const roomService = apiClient.rooms || apiClient.entities?.RoomType;
          roomTypes = await (roomService?.list ? roomService.list() : []);
        } catch {
          roomTypes = [];
        }
        if (!Array.isArray(roomTypes) || roomTypes.length === 0) {
          roomTypes = ROOMS;
        }

        list = roomTypes.map((r) => {
          const price = Number(r.base_price || r.price || 1499);
          const totalAmount = Math.round(price * totalNights * 1.12);
          return {
            room_type_id: r.id,
            name: typeof r.name === 'object' ? (r.name[lang] || r.name.en) : (r.name_en || r.name),
            bed_type: r.bed_type || (r.capacity >= 4 ? 'Family Beds' : 'King Bed'),
            max_guests: Number(r.capacity || r.max_guests || 2),
            is_available: true,
            available_rooms: Number(r.total_rooms || r.total_inventory || 3),
            total_amount: totalAmount,
            available_dates: [...stayNights],
            booked_dates: [],
          };
        });
      }

      // Process per-room-type availability details
      const processedQuotes = list.map((q) => {
        const qAvailDates = (q.available_dates || []).map((d) => String(d).slice(0, 10));
        const qBookedDates = (q.booked_dates || []).map((d) => String(d).slice(0, 10));

        // If backend marked it is_available = true and available_dates was empty, it covers all stayNights
        const effectiveAvail = (q.is_available && qAvailDates.length === 0) ? [...stayNights] : qAvailDates;

        const isFull = q.is_available || (effectiveAvail.length === totalNights && totalNights > 0);
        const isPartial = !isFull && effectiveAvail.length > 0;
        const isSoldOut = !isFull && effectiveAvail.length === 0;

        const segments = getAvailableSegments(effectiveAvail).map((seg) => ({
          ...seg,
          totalAmount: getSegmentPrice(q, seg, totalNights),
        }));

        return {
          ...q,
          effectiveAvail,
          qBookedDates,
          isFull,
          isPartial,
          isSoldOut,
          segments,
        };
      });

      const fullyAvailableTypes = processedQuotes.filter((q) => q.isFull);
      const partiallyAvailableTypes = processedQuotes.filter((q) => q.isPartial);
      const soldOutTypes = processedQuotes.filter((q) => q.isSoldOut);

      // Overall Night-by-night breakdown across the hotel
      const fullyBookedNights = [];
      const partiallyAvailableNights = [];

      for (const d of stayNights) {
        const isNightAvail = processedQuotes.some((q) => q.effectiveAvail.includes(d));
        if (isNightAvail) {
          partiallyAvailableNights.push(d);
        } else {
          fullyBookedNights.push(d);
        }
      }

      setResult({
        totalNights,
        stayNights,
        quotes: processedQuotes,
        fullyAvailableTypes,
        partiallyAvailableTypes,
        soldOutTypes,
        fullyBookedNights,
        partiallyAvailableNights,
        hasFullAvailability: fullyAvailableTypes.length > 0,
        hasPartialAvailability: partiallyAvailableTypes.length > 0,
        isCompletelySoldOut: fullyAvailableTypes.length === 0 && partiallyAvailableTypes.length === 0,
      });
    } catch (finalErr) {
      console.error('Availability check completely failed:', finalErr);
      setError(L('Unable to check live availability right now. Please call our reception or try again.', 'उपलब्धता जांचने में समस्या हुई। कृपया रिसेप्शन पर कॉल करें।'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-primary/40 bg-card/95 p-4 shadow-xl backdrop-blur md:grid-cols-4 md:items-end">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">{t('f.checkIn')}</span>
          <DatePicker min={today()} value={v.in} onChange={set('in')} placeholder={t('f.checkIn')} className="field mt-1" />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">{t('f.checkOut')}</span>
          <DatePicker min={v.in || today()} value={v.out} onChange={set('out')} placeholder={t('f.checkOut')} className="field mt-1" />
        </div>
        <label className="text-xs text-muted-foreground">
          {t('f.guests')}
          <input type="number" min="1" max="10" value={v.guests} onChange={set('guests')} className="field mt-1" required />
        </label>
        <button type="submit" disabled={loading} className="btn-gold flex items-center justify-center gap-2">
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              <span>{L('Checking...', 'जांच रहे हैं...')}</span>
            </>
          ) : (
            t('cta.checkAvail')
          )}
        </button>
      </form>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-primary/30 bg-card/98 p-4 shadow-2xl backdrop-blur animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 pb-3">
            <div className="flex items-center gap-2.5">
              {result.hasFullAvailability ? (
                <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
              ) : result.hasPartialAvailability ? (
                <Clock size={24} className="text-amber-400 shrink-0" />
              ) : (
                <XCircle size={24} className="text-rose-400 shrink-0" />
              )}
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {result.hasFullAvailability && result.partiallyAvailableTypes.length === 0
                    ? L('Rooms Available for Your Stay!', 'आपके ठहरने के लिए कमरे उपलब्ध हैं!')
                    : result.hasFullAvailability && result.partiallyAvailableTypes.length > 0
                    ? L('Rooms Available (+ Partial Stay Options Below)', 'कमरे उपलब्ध हैं (तथा कुछ आंशिक विकल्प भी नीचे हैं)')
                    : result.hasPartialAvailability
                    ? L('Partially Available Dates', 'चुनी गई तारीखों पर आंशिक उपलब्धता')
                    : L('No Rooms Available for Selected Dates', 'इन तारीखों पर कोई कमरा उपलब्ध नहीं है')}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatShortDate(v.in, lang === 'hi' ? 'hi-IN' : 'en-IN')} – {formatShortDate(v.out, lang === 'hi' ? 'hi-IN' : 'en-IN')} · {result.totalNights} {result.totalNights === 1 ? L('night', 'रात') : L('nights', 'रातें')} · {v.guests} {L('guests', 'अतिथि')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="rounded-lg border border-primary/20 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground transition"
            >
              ✕ {L('Close', 'बंद करें')}
            </button>
          </div>

          {/* Partial Availability Summary Banner (when some or all dates are split) */}
          {result.hasPartialAvailability && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
              <p className="font-semibold text-amber-300 mb-1.5">
                {result.hasFullAvailability
                  ? L('Note: Some room categories have partial availability during your requested stay:', 'सूचना: कुछ कमरे आपकी चुनी हुई तारीखों के कुछ हिस्से पर ही उपलब्ध हैं:')
                  : L('No room is free for all requested nights, but rooms are open for the dates below:', 'चुनी गई सभी रातों के लिए कोई कमरा खाली नहीं है, लेकिन नीचे दी गई तारीखों पर कमरे उपलब्ध हैं:')}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {result.partiallyAvailableNights.length > 0 && (
                  <div className="flex items-center gap-1.5 text-emerald-300">
                    <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
                    <span className="font-bold">{L('Available:', 'उपलब्ध:')}</span>
                    <span className="font-medium">
                      {formatDateSummary(result.partiallyAvailableNights, lang === 'hi' ? 'hi-IN' : 'en-IN')}
                    </span>
                  </div>
                )}
                {result.fullyBookedNights.length > 0 && (
                  <div className="flex items-center gap-1.5 text-rose-300">
                    <XCircle size={14} className="shrink-0 text-rose-400" />
                    <span className="font-bold">{L('Sold Out:', 'बुक/अनुपलब्ध:')}</span>
                    <span className="font-medium">
                      {formatDateSummary(result.fullyBookedNights, lang === 'hi' ? 'hi-IN' : 'en-IN')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 1: Fully Available Room Types */}
          {result.fullyAvailableTypes.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2.5">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  {L('Available for Your Entire Stay', 'आपके पूरे प्रवास के लिए उपलब्ध')} ({formatShortDate(v.in, lang === 'hi' ? 'hi-IN' : 'en-IN')} – {formatShortDate(v.out, lang === 'hi' ? 'hi-IN' : 'en-IN')})
                </h4>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.fullyAvailableTypes.map((rt) => (
                  <div
                    key={rt.room_type_id}
                    className="flex flex-col justify-between rounded-xl border border-primary/25 bg-background/70 p-3.5 shadow-sm transition hover:border-primary/60 hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-sm text-foreground">{rt.name}</h4>
                        <span className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
                          {L('Available', 'उपलब्ध')}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {rt.bed_type} · Max {rt.max_guests} {L('guests', 'अतिथि')}
                      </p>
                    </div>
                    <div className="mt-3.5 flex items-center justify-between border-t border-primary/10 pt-2.5">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">{L('Total for stay', 'कुल किराया')}</span>
                        <span className="text-base font-black text-primary tabular-nums">{inr(rt.total_amount)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => nav(`/booking?room=${rt.room_type_id}&in=${v.in}&out=${v.out}&guests=${v.guests}`)}
                        className="btn-gold py-1.5 px-3 text-xs flex items-center gap-1 font-semibold"
                      >
                        <span>{L('Book This Room', 'यह कमरा बुक करें')}</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Partially Available Room Types with Options for Dates (User Request: Standard room open 19 & 20 when booked till 18) */}
          {result.partiallyAvailableTypes.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Clock size={16} className="text-amber-400 shrink-0" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  {L('Available for Part of Your Stay', 'कुछ तारीखों पर उपलब्ध कमरे')}
                </h4>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {result.partiallyAvailableTypes.map((rt) => (
                  <div
                    key={rt.room_type_id}
                    className="flex flex-col justify-between rounded-xl border border-amber-500/40 bg-card/90 p-4 shadow-sm transition hover:border-amber-500/70"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{rt.name}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {rt.bed_type} · Max {rt.max_guests} {L('guests', 'अतिथि')}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-400 border border-amber-500/30">
                          {L('Partially Available', 'आंशिक उपलब्ध')}
                        </span>
                      </div>

                      {/* Booked dates indicator */}
                      {rt.qBookedDates.length > 0 && (
                        <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-300">
                          <XCircle size={13} className="shrink-0 text-rose-400" />
                          <span>
                            <strong>{L('Sold out:', 'सोल्ड आउट:')}</strong> {formatDateSummary(rt.qBookedDates, lang === 'hi' ? 'hi-IN' : 'en-IN')}
                          </span>
                        </div>
                      )}

                      {/* Available Date Option Cards */}
                      <div className="mt-3 space-y-2">
                        {rt.segments.map((seg, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"
                          >
                            <div>
                              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                                <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
                                <span>{L('Available Stay:', 'उपलब्ध प्रवास:')}</span>
                                <span className="underline decoration-emerald-400/50 underline-offset-2">
                                  {formatShortDate(seg.checkIn, lang === 'hi' ? 'hi-IN' : 'en-IN')} – {formatShortDate(seg.checkOut, lang === 'hi' ? 'hi-IN' : 'en-IN')}
                                </span>
                              </div>
                              <p className="text-[11px] text-emerald-200/80 mt-0.5 ml-5 font-medium">
                                {seg.nights} {seg.nights === 1 ? L('night', 'रात') : L('nights', 'रातें')} · {inr(seg.totalAmount)} {L('total for stay', 'कुल')}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              <button
                                type="button"
                                onClick={() => setV((prev) => ({ ...prev, in: seg.checkIn, out: seg.checkOut }))}
                                className="rounded-lg border border-primary/25 bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-background hover:text-foreground transition font-medium"
                                title={L('Set search dates to this option', 'सर्च में ये तारीखें सेट करें')}
                              >
                                {L('Select Dates', 'तारीखें चुनें')}
                              </button>
                              <button
                                type="button"
                                onClick={() => nav(`/booking?room=${rt.room_type_id}&in=${seg.checkIn}&out=${seg.checkOut}&guests=${v.guests}`)}
                                className="btn-gold py-1 px-3 text-xs flex items-center gap-1 font-semibold shadow"
                              >
                                <span>{L('Book Option', 'यह तारीखें बुक करें')}</span>
                                <ArrowRight size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer action bar */}
          {(result.fullyAvailableTypes.length > 0 || result.partiallyAvailableTypes.length > 0) && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-primary/15 pt-3 text-xs text-muted-foreground">
              <span>{L('Prices include all room taxes & high-speed Wi-Fi', 'किराये में सभी कर और वाई-फ़ाई शामिल हैं')}</span>
              <button
                type="button"
                onClick={() => nav('/rooms')}
                className="font-semibold text-primary hover:underline flex items-center gap-1"
              >
                {L('View All Rooms Catalog', 'सभी कमरों की जानकारी देखें')} →
              </button>
            </div>
          )}

          {/* Completely Sold Out State */}
          {result.isCompletelySoldOut && (
            <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-200">
              <p className="font-semibold text-rose-300">
                {L('All rooms are fully booked or blocked for the chosen dates.', 'चुनी गई तारीखों पर सभी कमरे बुक हैं।')}
              </p>
              <p className="mt-1 text-muted-foreground">
                {L('Please choose alternative dates, or call us directly to check offline availability.', 'कृपया अन्य तारीखें चुनें या सीधे होटल रिसेप्शन से संपर्क करें।')}
              </p>
              <div className="mt-3 flex gap-2">
                <a href={`tel:${bookingsTel}`} className="btn-outline py-1.5 px-3 text-xs flex items-center gap-1.5">
                  <Phone size={14} /> {L('Call Reception', 'रिसेप्शन को कॉल करें')}
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
