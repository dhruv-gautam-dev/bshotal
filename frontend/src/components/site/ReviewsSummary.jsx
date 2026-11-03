import { Stars } from '@/components/site/Stars';

export default function ReviewsSummary({ reviews }) {
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  return (
    <div className="flex items-center justify-center gap-4">
      <span className="font-heading text-6xl font-bold text-primary">{avg.toFixed(1)}</span>
      <div><Stars value={avg} size={20} /><p className="text-sm text-muted-foreground">{reviews.length} reviews</p></div>
    </div>
  );
}