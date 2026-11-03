import { BOOKING_STATUS, ORDER_STATUS, ENQUIRY_STATUS, ROOM_STATUS } from '../lib/adminData';
import { useI18n } from '@/lib/i18n';

const MAPS = { booking: BOOKING_STATUS, order: ORDER_STATUS, enquiry: ENQUIRY_STATUS, room: ROOM_STATUS };

export default function StatusPill({ kind = 'booking', value }) {
  const { L } = useI18n();
  const meta = MAPS[kind]?.[value];
  if (!meta) return null;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
      {L(meta.en, meta.hi)}
    </span>
  );
}