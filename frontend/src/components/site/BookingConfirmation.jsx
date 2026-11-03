import { Link } from 'react-router-dom';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { bookingMessage } from '@/lib/services';
import { openWhatsApp } from '@/lib/whatsapp';

export default function BookingConfirmation({ booking }) {
  const rows = [['Ref', booking.ref], ['Name', booking.name], ['Phone', booking.phone], ['Room', booking.roomName], ['Check-in', booking.checkIn], ['Check-out', `${booking.checkOut} (${booking.nights} night${booking.nights > 1 ? 's' : ''})`], ['Guests', booking.guests]];
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-primary/40 bg-card p-6 text-center md:p-8">
      <CheckCircle2 className="mx-auto text-primary" size={48} />
      <h2 className="mt-3 text-3xl font-semibold">Booking request received</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Your request is saved with reference <b className="text-primary">{booking.ref}</b>. Our team will check availability and confirm with you shortly.
      </p>
      <dl className="mt-6 divide-y divide-primary/15 text-left text-sm">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
      </dl>
      <button type="button" onClick={() => openWhatsApp(bookingMessage(booking))} className="btn-outline mt-6 w-full"><MessageCircle size={20} />Send on WhatsApp too (optional)</button>
      <Link to="/" className="mt-3 inline-block py-2 text-sm text-primary">Back to home</Link>
    </div>
  );
}