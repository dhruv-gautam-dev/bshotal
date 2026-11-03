import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';

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
      <label className="text-xs text-muted-foreground">{t('f.checkIn')}<input type="date" min={today()} value={v.in} onChange={set('in')} className="field mt-1" required /></label>
      <label className="text-xs text-muted-foreground">{t('f.checkOut')}<input type="date" min={v.in || today()} value={v.out} onChange={set('out')} className="field mt-1" required /></label>
      <label className="text-xs text-muted-foreground">{t('f.guests')}<input type="number" min="1" max="10" value={v.guests} onChange={set('guests')} className="field mt-1" required /></label>
      <button type="submit" className="btn-gold">{t('cta.checkAvail')}</button>
    </form>
  );
}