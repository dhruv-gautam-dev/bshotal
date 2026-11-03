import { Outlet } from 'react-router-dom';
import Header from '@/components/site/Header';
import Footer from '@/components/site/Footer';
import MobileBar from '@/components/site/MobileBar';
import FloatingWhatsApp from '@/components/site/FloatingWhatsApp';

export default function SiteLayout() {
  return (
    <div className="min-h-screen pb-[56px] md:pb-0">
      <Header />
      <main><Outlet /></main>
      <Footer />
      <FloatingWhatsApp />
      <MobileBar />
    </div>
  );
}