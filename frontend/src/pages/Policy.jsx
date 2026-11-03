import PageHero from '@/components/site/PageHero';
import { POLICIES } from '@/data/policies';
import useSeo from '@/lib/useSeo';

export default function Policy({ type }) {
  const p = POLICIES[type];
  useSeo(`${p.title} | B.S. Hotel & Restaurant`, `${p.title} of B.S. Hotel & Restaurant, Mathura.`);
  return (
    <>
      <PageHero title={p.title} />
      <section className="mx-auto max-w-3xl space-y-4 px-4 py-12 text-muted-foreground">
        {p.body.map((x) => <p key={x}>{x}</p>)}
      </section>
    </>
  );
}