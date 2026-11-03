import { Link } from 'react-router-dom';
import ReviewCard from '@/components/site/ReviewCard';
import ReviewsSummary from '@/components/site/ReviewsSummary';
import SectionHeading from '@/components/site/SectionHeading';
import useReviews from '@/hooks/useReviews';
import { useI18n } from '@/lib/i18n';

export default function ReviewsPreview() {
  const { t } = useI18n();
  const reviews = useReviews();
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 md:py-28">
      <SectionHeading title={t('rev.title')} sub={t('rev.sub')} />
      <ReviewsSummary reviews={reviews} />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {reviews.slice(0, 3).map((r) => <ReviewCard key={r.id} review={r} />)}
      </div>
      <div className="mt-8 text-center"><Link to="/reviews" className="btn-outline">{t('cta.viewAll')}</Link></div>
    </section>
  );
}