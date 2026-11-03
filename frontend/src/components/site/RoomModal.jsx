import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Image } from '@/components/ui/image';
import { AmenityIcons } from '@/components/site/RoomCard';
import { useI18n } from '@/lib/i18n';
import { inr } from '@/lib/whatsapp';

export default function RoomModal({ room, onClose }) {
  const { t, tr } = useI18n();
  const nav = useNavigate();
  return (
    <Dialog open={!!room} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        {room && (
          <>
            <Image src={room.images[0]} alt={tr(room.name)} className="aspect-[3/2] w-full rounded-lg" />
            <DialogHeader>
              <DialogTitle className="text-3xl">{tr(room.name)}</DialogTitle>
              <DialogDescription>{tr(room.desc)}</DialogDescription>
            </DialogHeader>
            <AmenityIcons keys={room.amenities} />
            <p className="text-sm text-muted-foreground">Capacity: {room.capacity} · <span className="font-bold text-primary">{inr(room.price)}</span> {t('common.perNight')} *</p>
            <button type="button" className="btn-gold" onClick={() => nav(`/booking?room=${room.id}`)}>{t('cta.requestBooking')}</button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}