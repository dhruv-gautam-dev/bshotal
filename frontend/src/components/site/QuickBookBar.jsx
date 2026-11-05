import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import DatePicker from '@/components/ui/date-picker';

const today = () => new Date().toISOString().slice(0, 10);

export default function QuickBookBar() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [v, setV] = useState({ in: '', out: '', guests: 2 });
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    nav(`/booking?in=${v.in}&out=${v.out}&guests=${v.guests}`);
  };
  return (
    <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-3 rounded-2xl border border-primary/40 bg-card/95 p-4 backdrop-blur md:grid-cols-4 md:items-end">
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">{t('f.checkIn')}</span>
        <DatePicker min={today()} value={v.in} onChange={set('in')} placeholder={t('f.checkIn')} className="field mt-1" />
      </div>
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">{t('f.checkOut')}</span>
        <DatePicker min={v.in || today()} value={v.out} onChange={set('out')} placeholder={t('f.checkOut')} className="field mt-1" />
      </div>
      <label className="text-xs text-muted-foreground">{t('f.guests')}<input type="number" min="1" max="10" value={v.guests} onChange={set('guests')} className="field mt-1" required /></label>
      <button type="submit" className="btn-gold">{t('cta.checkAvail')}</button>
    </form>
  );
}