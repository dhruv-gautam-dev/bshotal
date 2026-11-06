import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Image } from '@/components/ui/image';
import { AmenityIcons } from '@/components/site/RoomCard';
import { useI18n } from '@/lib/i18n';
import { inr } from '@/lib/whatsapp';

export default function RoomModal({ room, onClose }) {
  const { t, tr } = useI18n();
  const nav = useNavigate();

  if (!room) return null;
  const roomName = typeof room.name === 'object' ? tr(room.name) : (room.name_en || room.name || 'Room');
  const roomDesc = typeof room.desc === 'object' ? tr(room.desc) : (room.desc_en || room.description || room.desc || '');
  const imageSrc = (Array.isArray(room.images) && room.images[0]) || room.image || '/images/standard.webp';
  const capacity = room.capacity || room.max_guests || 2;
  const price = Number(room.price || room.base_price || 0);

  return (
    <Dialog open={!!room} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <Image src={imageSrc} alt={roomName} className="aspect-[3/2] w-full rounded-lg" />
        <DialogHeader>
          <DialogTitle className="text-3xl">{roomName}</DialogTitle>
          <DialogDescription>{roomDesc}</DialogDescription>
        </DialogHeader>
        <AmenityIcons keys={room.amenities} />
        <p className="text-sm text-muted-foreground">Capacity: {capacity} Guests · <span className="font-bold text-primary">{inr(price)}</span> {t('common.perNight')} *</p>
        <button type="button" className="btn-gold" onClick={() => nav(`/booking?room=${room.id}`)}>{t('cta.requestBooking')}</button>
      </DialogContent>
    </Dialog>
  );
}
