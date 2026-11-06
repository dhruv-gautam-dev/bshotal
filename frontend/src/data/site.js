// Central contact + business details. Search for "[" to find placeholders to replace.
export const SITE = {
  name: 'B.S. Hotel & Restaurant',
  restaurant: 'Delicee Restaurant',
  tagline: { en: 'Serving Food With Love', hi: 'प्यार से परोसा गया भोजन' },
  // Bookings & Inquiries
  phone1: '+91 91492 24039',
  tel1: '+919149224039',
  bookingsPhone: '+91 91492 24039',
  // Payments & Accounts
  phone2: '+91 92592 73735',
  tel2: '+919259273735',
  paymentsPhone: '+91 92592 73735',
  whatsapp: '919149224039',
  address: {
    en: 'Near Township Nagar, NH-2, Baad (Mathura), Uttar Pradesh',
    hi: 'टाउनशिप नगर के पास, एन एच 2, बाद (मथुरा), उत्तर प्रदेश',
  },
  hours: {
    en: 'Restaurant: [OPENING HOURS - e.g. 8:00 AM – 11:00 PM] · Reception: 24 hours [CONFIRM]',
    hi: 'रेस्टोरेंट: [खुलने का समय] · रिसेप्शन: 24 घंटे [पुष्टि करें]',
  },
  fssai: '[FSSAI-LICENCE-NUMBER]',
  gst: '[GST-NUMBER]',
  googleReviewUrl: 'https://search.google.com/local/writereview?placeid=[GOOGLE-PLACE-ID]',
  mapEmbed: 'https://maps.google.com/maps?q=Township+Nagar+NH-2+Baad+Mathura&output=embed',
  mapLink: 'https://maps.google.com/?q=Township+Nagar+NH-2+Baad+Mathura',
  social: {
    instagram: 'https://www.instagram.com/',
    facebook: 'https://www.facebook.com/',
    youtube: 'https://www.youtube.com/',
  },
};

// Configurable order settings (placeholders)
export const ORDER_CONFIG = {
  deliveryCharge: 0, // [PLACEHOLDER] set delivery charge in ₹
  taxPercent: 0, // [PLACEHOLDER] set GST % for food
};

export const IMAGES = {
  hero: '/images/hero.webp',
  standard: '/images/standard.webp',
  deluxe: '/images/deluxe.webp',
  family: '/images/family.webp',
  food: '/images/food.webp',
  ring: '/images/ring.webp',
  birthday: '/images/birthday.webp',
  wedding: '/images/wedding.webp',
};