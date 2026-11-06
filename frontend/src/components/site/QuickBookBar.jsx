import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, AlertCircle, Phone, Loader2, ArrowRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import DatePicker from '@/components/ui/date-picker';
import { apiClient } from '@/api/apiClient';
import { inr } from '@/lib/whatsapp';
import { useSiteSettings } from '@/hooks/useSiteCatalog';

const today = () => new Date().toISOString().slice(0, 10);

function formatShortDate(dateStr, locale = 'en-IN') {
  if (!dateStr) return '';
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
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
      const quotes = await apiClient.rooms.checkAvailability(v.in, v.out, v.guests, 1);
      const list = Array.isArray(quotes) ? quotes : (quotes?.items || []);
      const totalNights = Math.max(1, Math.round((new Date(v.out) - new Date(v.in)) / (1000 * 60 * 60 * 24)));
      const availableTypes = list.filter((q) => q.is_available);

      // Night-by-night check
      const fullyBookedNights = [];
      const partiallyAvailableNights = [];

      for (let i = 0; i < totalNights; i++) {
        const d = new Date(new Date(v.in).getTime() + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const isNightAvail = list.some((q) => (q.available_dates || []).some((ad) => String(ad).slice(0, 10) === d));
        if (isNightAvail) {
          partiallyAvailableNights.push(d);
        } else {
          fullyBookedNights.push(d);
        }
      }

      setResult({
        totalNights,
        quotes: list,
        availableTypes,
        fullyBookedNights,
        partiallyAvailableNights,
        hasFullAvailability: availableTypes.length > 0,
        hasPartialAvailability: availableTypes.length === 0 && partiallyAvailableNights.length > 0,
        isCompletelySoldOut: availableTypes.length === 0 && partiallyAvailableNights.length === 0,
      });
    } catch (err) {
      console.warn('Availability check fallback:', err);
      try {
        const rooms = await apiClient.rooms.list();
        const totalNights = Math.max(1, Math.round((new Date(v.out) - new Date(v.in)) / (1000 * 60 * 60 * 24)));
        const fallbackQuotes = (rooms || []).map((r) => ({
          room_type_id: r.id,
          name: r.name_en || r.name,
          bed_type: r.bed_type || 'King Bed',
          max_guests: r.capacity || r.max_guests || 2,
          is_available: true,
          available_rooms: r.total_rooms || 1,
          total_amount: (r.price || 1500) * totalNights,
        }));
        setResult({
          totalNights,
          quotes: fallbackQuotes,
          availableTypes: fallbackQuotes,
          fullyBookedNights: [],
          partiallyAvailableNights: [],
          hasFullAvailability: true,
          hasPartialAvailability: false,
          isCompletelySoldOut: false,
        });
      } catch (e2) {
        setError(L('Unable to check live availability right now. Please call our reception or try again.', 'उपलब्धता जांचने में समस्या हुई। कृपया रिसेप्शन पर कॉल करें।'));
      }
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
            <div className="flex items-center gap-2">
              {result.hasFullAvailability ? (
                <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />
              ) : result.hasPartialAvailability ? (
                <AlertCircle size={22} className="text-amber-400 shrink-0" />
              ) : (
                <XCircle size={22} className="text-rose-400 shrink-0" />
              )}
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {result.hasFullAvailability
                    ? L('Rooms Available for Your Stay!', 'आपके ठहरने के लिए कमरे उपलब्ध हैं!')
                    : result.hasPartialAvailability
                    ? L('Partially Available Dates', 'चुनी गई तारीखों पर आंशिक उपलब्धता')
                    : L('No Rooms Available for Selected Dates', 'इन तारीखों पर कोई कमरा उपलब्ध नहीं है')}
                </h3>
                <p className="text-xs text-muted-foreground">
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

          {/* Partial Availability breakdown (user specific request: show which day available & which day not) */}
          {result.hasPartialAvailability && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
              <p className="font-semibold text-amber-300 mb-2">
                {L('Rooms are available on some of your selected nights, but sold out on others:', 'कमरे आपकी कुछ चुनी हुई रातों में उपलब्ध हैं, लेकिन कुछ पर सोल्ड आउट हैं:')}
              </p>
              <div className="space-y-1.5">
                {result.partiallyAvailableNights.length > 0 && (
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 size={15} className="shrink-0" />
                    <span className="font-bold">{L('Available on:', 'उपलब्ध है:')}</span>
                    <span className="font-semibold">
                      {result.partiallyAvailableNights.map((d) => formatShortDate(d, lang === 'hi' ? 'hi-IN' : 'en-IN')).join(', ')}
                    </span>
                  </div>
                )}
                {result.fullyBookedNights.length > 0 && (
                  <div className="flex items-center gap-2 text-rose-300">
                    <XCircle size={15} className="shrink-0" />
                    <span className="font-bold">{L('Sold Out / Not Available on:', 'उपलब्ध नहीं (सोल्ड आउट):')}</span>
                    <span className="font-semibold">
                      {result.fullyBookedNights.map((d) => formatShortDate(d, lang === 'hi' ? 'hi-IN' : 'en-IN')).join(', ')}
                    </span>
                  </div>
                )}
              </div>
              <p className="mt-2.5 text-[11px] text-muted-foreground">
                {L('Tip: Adjust your check-in or check-out date to match the available nights above, or call reception for assistance.', 'सलाह: ऊपर दी गई उपलब्ध तारीखों के अनुसार तारीखें बदलें, या सहायता के लिए रिसेप्शन पर कॉल करें।')}
              </p>
            </div>
          )}

          {/* Available Room Types Cards */}
          {result.hasFullAvailability && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {result.availableTypes.map((rt) => (
                <div
                  key={rt.room_type_id}
                  className="flex flex-col justify-between rounded-xl border border-primary/20 bg-background/60 p-3.5 shadow-sm transition hover:border-primary/60 hover:shadow-md"
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
