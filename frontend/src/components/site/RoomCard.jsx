import { Wind, Wifi, Tv, ShowerHead, Utensils, Car, Users, Check } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { AMENITIES } from '@/data/rooms';
import { useI18n } from '@/lib/i18n';
import { inr } from '@/lib/whatsapp';

const ICONS = {
  ac: Wind,
  air: Wind,
  wifi: Wifi,
  internet: Wifi,
  tv: Tv,
  led: Tv,
  smart: Tv,
  hotwater: ShowerHead,
  geyser: ShowerHead,
  bath: ShowerHead,
  food: Utensils,
  service: Utensils,
  dining: Utensils,
  parking: Car,
};

function getAmenityIcon(key) {
  if (!key) return Check;
  const lower = String(key).toLowerCase();
  for (const [k, Icon] of Object.entries(ICONS)) {
    if (lower.includes(k)) return Icon;
  }
  return Check;
}

function getAmenityLabel(k, tr) {
  if (!k) return '';
  if (AMENITIES && AMENITIES[k]) return tr(AMENITIES[k]);
  return String(k);
}

export function AmenityIcons({ keys = [] }) {
  const { tr } = useI18n();
  const list = Array.isArray(keys) ? keys : [];
  if (!list.length) return null;

  return (
    <ul className="flex flex-wrap gap-3">
      {list.slice(0, 5).map((k, idx) => {
        const Icon = getAmenityIcon(k);
        const label = getAmenityLabel(k, tr);
        return (
          <li key={idx} className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Icon size={16} className="text-primary shrink-0" />
            <span>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function RoomCard({ room, onDetails, onBook }) {
  const { t, tr } = useI18n();
  if (!room) return null;

  const roomName = typeof room.name === 'object' ? tr(room.name) : (room.name_en || room.name || 'Room');
  const imageSrc = (Array.isArray(room.images) && room.images[0]) || room.image || '/images/standard.webp';
  const capacity = room.capacity || room.max_guests || 2;
  const price = Number(room.price || room.base_price || 0);

  return (
    <article className="overflow-hidden rounded-2xl border border-primary/25 bg-card">
      <button type="button" onClick={onDetails} className="block w-full" aria-label={`${t('cta.details')}: ${roomName}`}>
        <Image src={imageSrc} alt={roomName} loading="lazy" decoding="async" className="aspect-[3/2] w-full" />
      </button>
      <div className="space-y-3 p-5">
        <h3 className="text-2xl font-semibold">{roomName}</h3>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Users size={16} className="text-primary" /> {capacity} Guests</p>
        <AmenityIcons keys={room.amenities} />
        <div className="flex items-end justify-between pt-2">
          <p><span className="text-2xl font-bold text-primary">{inr(price)}</span> <span className="text-xs text-muted-foreground">{t('common.perNight')} *</span></p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onDetails} className="btn-outline flex-1">{t('cta.details')}</button>
          <button type="button" onClick={onBook} className="btn-gold flex-1">{t('cta.requestBooking')}</button>
        </div>
      </div>
    </article>
  );
}
