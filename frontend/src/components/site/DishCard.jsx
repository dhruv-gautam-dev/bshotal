import VegBadge from '@/components/site/VegBadge';
import AddButton from '@/components/site/AddButton';
import { inr } from '@/lib/whatsapp';

export default function DishCard({ item }) {
  return (
    <article className="flex h-full flex-col justify-between rounded-2xl border border-primary/25 bg-card p-5">
      <div>
        <VegBadge />
        <h3 className="mt-3 text-lg font-semibold sm:text-xl line-clamp-2 leading-snug">{item.name}</h3>
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{item.desc}</p>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <span className="text-lg font-bold text-primary">{inr(item.price)}</span>
        <AddButton item={item} />
      </div>
    </article>
  );
}