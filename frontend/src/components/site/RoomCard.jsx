import { Wind, Wifi, Tv, ShowerHead, Utensils, Car, Users } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { AMENITIES } from '@/data/rooms';
import { useI18n } from '@/lib/i18n';
import { inr } from '@/lib/whatsapp';

const ICONS = { ac: Wind, wifi: Wifi, tv: Tv, hotwater: ShowerHead, food: Utensils, parking: Car };

export function AmenityIcons({ keys }) {
  const { tr } = useI18n();
  return (
    <ul className="flex flex-wrap gap-3">
      {keys.map((k) => {
        const Icon = ICONS[k];
        return <li key={k} className="flex items-center gap-1.5 text-sm text-muted-foreground"><Icon size={16} className="text-primary" />{tr(AMENITIES[k])}</li>;
      })}
    </ul>
  );
}

export default function RoomCard({ room, onDetails, onBook }) {
  const { t, tr } = useI18n();
  return (
    <article className="overflow-hidden rounded-2xl border border-primary/25 bg-card">
      <button type="button" onClick={onDetails} className="block w-full" aria-label={`${t('cta.details')}: ${tr(room.name)}`}>
        <Image src={room.images[0]} alt={tr(room.name)} className="aspect-[3/2] w-full" />
      </button>
      <div className="space-y-3 p-5">
        <h3 className="text-2xl font-semibold">{tr(room.name)}</h3>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Users size={16} className="text-primary" /> {room.capacity}</p>
        <AmenityIcons keys={room.amenities} />
        <div className="flex items-end justify-between pt-2">
          <p><span className="text-2xl font-bold text-primary">{inr(room.price)}</span> <span className="text-xs text-muted-foreground">{t('common.perNight')} *</span></p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onDetails} className="btn-outline flex-1">{t('cta.details')}</button>
          <button type="button" onClick={onBook} className="btn-gold flex-1">{t('cta.requestBooking')}</button>
        </div>
      </div>
    </article>
  );
}