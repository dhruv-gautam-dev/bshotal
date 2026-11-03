import { Minus, Plus } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { useI18n } from '@/lib/i18n';

export default function AddButton({ item }) {
  const { add, setQty, qtyOf } = useCart();
  const { t } = useI18n();
  const qty = qtyOf(item.id);
  if (!qty) {
    return (
      <button type="button" onClick={() => add(item)} aria-label={`${t('cta.add')} ${item.name}`} className="min-h-[44px] min-w-[76px] rounded-full border border-primary px-4 text-sm font-bold text-primary transition hover:bg-primary hover:text-primary-foreground">
        {t('cta.add')}
      </button>
    );
  }
  return (
    <div className="flex min-h-[44px] items-center rounded-full bg-primary text-primary-foreground">
      <button type="button" onClick={() => setQty(item.id, qty - 1)} aria-label={`Remove one ${item.name}`} className="flex h-11 w-11 items-center justify-center"><Minus size={16} /></button>
      <span className="w-6 text-center text-sm font-bold" aria-live="polite">{qty}</span>
      <button type="button" onClick={() => setQty(item.id, qty + 1)} aria-label={`Add one more ${item.name}`} className="flex h-11 w-11 items-center justify-center"><Plus size={16} /></button>
    </div>
  );
}