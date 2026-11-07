import { useState } from 'react';
import PageHero from '@/components/site/PageHero';
import { Image } from '@/components/ui/image';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { IMAGES } from '@/data/site';
import { useI18n } from '@/lib/i18n';
import useSeo from '@/lib/useSeo';

// Replace/add photos here. category: rooms | food | events | property
const PHOTOS = [
  { src: IMAGES.hero, cat: 'property', alt: 'Hotel entrance' },
  { src: IMAGES.standard, cat: 'rooms', alt: 'Standard room' },
  { src: IMAGES.deluxe, cat: 'rooms', alt: 'Deluxe room' },
  { src: IMAGES.family, cat: 'rooms', alt: 'Family suite' },
  { src: IMAGES.food, cat: 'food', alt: 'Delicee veg thali and curries' },
  { src: IMAGES.ring, cat: 'events', alt: 'Ring ceremony' },
  { src: IMAGES.birthday, cat: 'events', alt: 'Birthday party' },
  { src: IMAGES.wedding, cat: 'events', alt: 'Wedding decor' },
];
const FILTERS = [['all', 'All', 'सभी'], ['rooms', 'Rooms', 'कमरे'], ['food', 'Food', 'भोजन'], ['events', 'Events', 'इवेंट्स'], ['property', 'Property', 'परिसर']];

export default function Gallery() {
  const { t, L } = useI18n();
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);
  useSeo(
    'Photo Gallery | B.S. Hotel & Delicee Restaurant, Mathura',
    'Explore photos of luxury AC rooms, Delicee restaurant food, banquet hall, and hotel exterior at B.S. Hotel & Restaurant, Mathura NH-19.',
    {
      keywords: 'bs hotel photos, b.s. hotel mathura gallery, delicee restaurant images, hotel pictures mathura',
      image: '/images/hero.webp',
    }
  );
  const shown = PHOTOS.filter((p) => filter === 'all' || p.cat === filter);
  return (
    <>
      <PageHero title={t('nav.gallery')} sub="Take a look around and feel at home already." />
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {FILTERS.map(([k, en, hi]) => <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} className={`min-h-[44px] rounded-full px-5 text-sm font-medium ${filter === k ? 'bg-primary text-primary-foreground' : 'border border-primary/30'}`}>{L(en, hi)}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {shown.map((p) => (
            <button key={p.src} type="button" onClick={() => setOpen(p)} className="group overflow-hidden rounded-xl border border-primary/25" aria-label={`Open ${p.alt}`}>
              <Image src={p.src} alt={p.alt} className="aspect-[4/3] w-full transition duration-500 group-hover:scale-105" />
            </button>
          ))}
        </div>
      </section>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-4xl border-primary/40 bg-background p-2">
          <DialogTitle className="sr-only">{open?.alt}</DialogTitle>
          {open && <Image src={open.src} alt={open.alt} fittingType="fit" className="max-h-[80vh] w-full" />}
          {open && <p className="pb-2 text-center text-sm text-muted-foreground">{open.alt}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}