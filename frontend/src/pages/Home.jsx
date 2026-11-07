import HomeHero from '@/components/home/HomeHero';
import QuickBookBar from '@/components/site/QuickBookBar';
import Highlights from '@/components/home/Highlights';
import FeaturedDishes from '@/components/home/FeaturedDishes';
import RoomsPreview from '@/components/home/RoomsPreview';
import EventsPreview from '@/components/home/EventsPreview';
import ReviewsPreview from '@/components/home/ReviewsPreview';
import WhyUs from '@/components/home/WhyUs';
import LocationCta from '@/components/home/LocationCta';
import useSeo from '@/lib/useSeo';

export default function Home() {
  useSeo(
    'B.S. Hotel & Restaurant | Luxury AC Rooms & Pure Veg Dining in Mathura',
    'Welcome to B.S. Hotel & Restaurant (Delicee Restaurant), Mathura. Premium AC rooms, pure veg multi-cuisine restaurant, banquet hall near Mathura Refinery on NH-19 (NH-2). 24/7 room service & online food ordering.',
    {
      keywords: 'bs hotel, bs hotel and resturent, bs hotel and restaurant, b.s. hotel, bs hotel mathura, b.s. hotel and restaurant mathura, hotel bs, delicee restaurant, hotel near mathura refinery, hotel in baad mathura',
      image: '/images/hero.webp',
    }
  );
  return (
    <>
      <HomeHero />
      <div className="relative z-10 -mt-12 px-4"><QuickBookBar /></div>
      <Highlights />
      <FeaturedDishes />
      <RoomsPreview />
      <EventsPreview />
      <ReviewsPreview />
      <WhyUs />
      <LocationCta />
    </>
  );
}