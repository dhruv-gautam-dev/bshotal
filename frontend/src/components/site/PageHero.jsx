import Ornament from '@/components/site/Ornament';

export default function PageHero({ title, sub }) {
  return (
    <section className="jali border-b border-primary/20 pt-28 pb-12 md:pt-36 md:pb-16 text-center px-4">
      <h1 className="text-4xl md:text-6xl font-semibold">{title}</h1>
      <Ornament className="my-4" />
      {sub && <p className="text-muted-foreground max-w-2xl mx-auto">{sub}</p>}
    </section>
  );
}