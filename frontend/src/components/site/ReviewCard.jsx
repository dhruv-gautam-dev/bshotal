import { Stars } from '@/components/site/Stars';
import { useI18n } from '@/lib/i18n';

export default function ReviewCard({ review }) {
  const { t } = useI18n();
  return (
    <article className="flex h-full flex-col gap-3 rounded-2xl border border-primary/25 bg-card p-6">
      <Stars value={review.rating} />
      <p className="flex-1 text-sm leading-relaxed">“{review.comment}”</p>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{review.name}</span>
        {review.sample && <span className="rounded-full border border-primary/40 px-2 py-0.5 text-xs text-primary">{t('common.sample')}</span>}
      </div>
    </article>
  );
}