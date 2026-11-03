import PageHero from '@/components/site/PageHero';
import ReviewCard from '@/components/site/ReviewCard';
import ReviewsSummary from '@/components/site/ReviewsSummary';
import ReviewForm from '@/components/site/ReviewForm';
import useReviews from '@/hooks/useReviews';
import { SITE } from '@/data/site';
import { useI18n } from '@/lib/i18n';
import useSeo from '@/lib/useSeo';

export default function Reviews() {
  const { t } = useI18n();
  const reviews = useReviews();
  useSeo('Guest Reviews | B.S. Hotel & Delicee Restaurant', 'Read guest reviews of B.S. Hotel and Delicee Restaurant, Mathura NH-2, and share your own.');
  return (
    <>
      <PageHero title={t('rev.title')} sub={t('rev.sub')} />
      <section className="mx-auto max-w-7xl px-4 py-12">
        <ReviewsSummary reviews={reviews} />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{reviews.map((r) => <ReviewCard key={r.id} review={r} />)}</div>
        <div className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2">
          <ReviewForm />
          <div className="flex flex-col items-center justify-center rounded-2xl border border-primary/30 p-6 text-center">
            <h3 className="text-2xl font-semibold">Review us on Google</h3>
            <p className="mt-2 text-sm text-muted-foreground">Your feedback helps other travellers find us.</p>
            <a href={SITE.googleReviewUrl} target="_blank" rel="noopener noreferrer" className="btn-outline mt-5">Leave a Google review</a>
          </div>
        </div>
      </section>
    </>
  );
}