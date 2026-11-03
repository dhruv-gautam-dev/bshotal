import { Trash2 } from 'lucide-react';
import AddButton from '@/components/site/AddButton';
import { useCart } from '@/lib/cart';
import { inr } from '@/lib/whatsapp';

export default function CartLine({ item }) {
  const { setQty, setNote } = useCart();
  return (
    <li className="border-b border-primary/15 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{item.name}</p>
          <p className="text-sm text-muted-foreground">{inr(item.price)} × {item.qty} = <span className="text-primary">{inr(item.price * item.qty)}</span></p>
        </div>
        <div className="flex items-center gap-1">
          <AddButton item={item} />
          <button type="button" aria-label={`Remove ${item.name}`} onClick={() => setQty(item.id, 0)} className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-red-400"><Trash2 size={18} /></button>
        </div>
      </div>
      <input className="field mt-2 min-h-[40px] text-sm" placeholder="Note (e.g. less spicy)" value={item.note} onChange={(e) => setNote(item.id, e.target.value)} aria-label={`Note for ${item.name}`} />
    </li>
  );
}