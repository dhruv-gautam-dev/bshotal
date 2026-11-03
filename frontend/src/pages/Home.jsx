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
  useSeo('B.S. Hotel & Delicee Restaurant | Hotel in Mathura NH-2', 'Family hotel and pure vegetarian restaurant near Township Nagar, NH-2, Baad (Mathura). Book rooms, order food, plan ring ceremony, birthday or wedding.');
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