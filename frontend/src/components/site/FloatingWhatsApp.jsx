import { MessageCircle } from 'lucide-react';
import { waLink } from '@/lib/whatsapp';

export default function FloatingWhatsApp() {
  return (
    <a href={waLink('Hello, I would like to know more about B.S. Hotel.')} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp" className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/40 transition hover:scale-105 md:bottom-6 md:right-6">
      <MessageCircle size={28} />
    </a>
  );
}