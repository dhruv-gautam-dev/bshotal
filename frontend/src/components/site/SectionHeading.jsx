import Ornament from '@/components/site/Ornament';

export default function SectionHeading({ eyebrow, title, sub, align = 'center' }) {
  return (
    <div className={`mb-10 md:mb-14 ${align === 'center' ? 'text-center' : ''}`}>
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary mb-3">{eyebrow}</p>}
      <h2 className="text-3xl md:text-5xl font-semibold leading-tight">{title}</h2>
      {sub && <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">{sub}</p>}
      {align === 'center' && <Ornament className="mt-5" />}
    </div>
  );
}