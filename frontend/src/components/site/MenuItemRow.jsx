import VegBadge from '@/components/site/VegBadge';
import AddButton from '@/components/site/AddButton';
import { inr } from '@/lib/whatsapp';

export default function MenuItemRow({ item }) {
  return (
    <article className="flex items-start justify-between gap-3 border-b border-dashed border-primary/25 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2"><VegBadge /><h3 className="font-body text-base font-semibold">{item.name}</h3></div>
        {item.desc && <p className="mt-1 pl-6 text-sm text-muted-foreground">{item.desc}</p>}
        <p className="mt-1 pl-6 font-semibold text-primary">{inr(item.price)}</p>
      </div>
      <AddButton item={item} />
    </article>
  );
}