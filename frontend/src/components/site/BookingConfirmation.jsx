import { Link } from 'react-router-dom';
import { CheckCircle2, MessageCircle, Clock, ShieldCheck, QrCode } from 'lucide-react';
import { bookingMessage } from '@/lib/services';
import { openWhatsApp, inr } from '@/lib/whatsapp';
import { useI18n } from '@/lib/i18n';

export default function BookingConfirmation({ booking }) {
  const { L } = useI18n();
  const isUpi = booking.payment_mode === 'upi_qr';

  const rows = [
    [L('Booking Ref', 'बुकिंग रेफ़रेंस'), booking.ref],
    [L('Guest Name', 'अतिथि का नाम'), booking.name],
    [L('Phone', 'फ़ोन'), booking.phone],
    [L('Room Category', 'कमरा श्रेणी'), booking.roomName],
    [L('Check-in', 'चेक-इन'), booking.checkIn],
    [L('Check-out', 'चेक-आउट'), `${booking.checkOut} (${booking.nights} ${booking.nights > 1 ? L('nights', 'रातें') : L('night', 'रात')})`],
    [L('Guests', 'मेहमान'), booking.guests],
    [L('Total Estimated Amount', 'कुल अनुमानित राशि'), inr(booking.amount)],
  ];

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-primary/40 bg-card p-6 text-center shadow-xl md:p-8 animate-in fade-in duration-200">
      {isUpi ? (
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
          <Clock size={32} />
        </div>
      ) : (
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
          <CheckCircle2 size={32} />
        </div>
      )}

      <h2 className="mt-3 text-2xl font-bold text-foreground">
        {isUpi
          ? L('Payment Proof Submitted & Booking Received', 'भुगतान प्रमाण प्राप्त हुआ व बुकिंग दर्ज की गई')
          : L('Booking Request Received', 'बुकिंग अनुरोध प्राप्त हुआ')}
      </h2>

      <p className="mt-2 text-sm text-muted-foreground">
        {isUpi
          ? L(
              'Thank you! Your PhonePe UPI payment proof is recorded. Our front desk is verifying the transaction and will confirm your room within 5–10 minutes.',
              'धन्यवाद! आपका PhonePe UPI भुगतान प्रमाण दर्ज हो गया है। होटल रिसेप्शन 5-10 मिनट में सत्यापन करके बुकिंग कन्फ़र्म कर देगा।'
            )
          : L(
              'Your request is saved. Our team will verify room availability and confirm with you shortly.',
              'आपका अनुरोध दर्ज हो गया है। होटल टीम जल्द ही आपसे संपर्क कर पुष्टि करेगी।'
            )}
      </p>

      {/* UPI Payment Verification Card */}
      {isUpi && (
        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-left text-xs">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
            <span className="font-bold text-amber-300 flex items-center gap-1.5">
              <ShieldCheck size={16} />
              {L('PhonePe UPI Payment Details', 'PhonePe UPI भुगतान विवरण')}
            </span>
            <span className="rounded-md bg-amber-500/20 px-2 py-0.5 font-bold text-amber-300">
              {L('Verification Pending', 'सत्यापन प्रक्रिया में')}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-amber-100">
            <div>
              <span className="text-amber-300/80 block text-[11px]">{L('Paid To UPI ID', 'भुगतान UPI ID')}</span>
              <span className="font-mono font-bold text-foreground">6377682442-6@ibl</span>
            </div>
            <div>
              <span className="text-amber-300/80 block text-[11px]">{L('Payable Amount', 'भुगतान राशि')}</span>
              <span className="font-bold text-foreground">{inr(booking.amount)}</span>
            </div>
            {booking.payment_utr && (
              <div>
                <span className="text-amber-300/80 block text-[11px]">{L('Submitted UTR / Ref No.', 'दर्ज UTR / रेफ़रेंस नंबर')}</span>
                <span className="font-mono font-bold text-foreground tracking-wider">{booking.payment_utr}</span>
              </div>
            )}
            {booking.payment_name && (
              <div>
                <span className="text-amber-300/80 block text-[11px]">{L('Payer Name on Account', 'खाताधारक का नाम')}</span>
                <span className="font-medium text-foreground">{booking.payment_name}</span>
              </div>
            )}
          </div>

          {booking.payment_screenshot && (
            <div className="mt-3 pt-2.5 border-t border-amber-500/20 flex items-center justify-between">
              <span className="text-amber-200">{L('Payment Screenshot Proof Attached', 'भुगतान स्क्रीनशॉट संलग्न है')}</span>
              <img
                src={booking.payment_screenshot}
                alt="Proof"
                className="h-10 w-10 object-cover rounded-md border border-amber-500/40 shadow-xs"
              />
            </div>
          )}
        </div>
      )}

      {/* Stay Details summary */}
      <dl className="mt-5 divide-y divide-primary/15 rounded-xl border border-primary/20 bg-background/50 px-4 text-left text-xs sm:text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2.5">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-semibold text-foreground">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 space-y-2">
        <button
          type="button"
          onClick={() => openWhatsApp(bookingMessage(booking))}
          className="btn-gold flex w-full items-center justify-center gap-2 py-3 text-sm font-bold shadow-lg"
        >
          <MessageCircle size={18} />
          {L('Send Booking & Payment Proof on WhatsApp', 'व्हाट्सएप पर बुकिंग व रसीद भेजें')}
        </button>

        <Link
          to="/"
          className="inline-block w-full py-2.5 text-center text-xs font-semibold text-muted-foreground hover:text-foreground transition"
        >
          {L('← Back to Home', '← होमपेज पर वापस जाएं')}
        </Link>
      </div>
    </div>
  );
}
