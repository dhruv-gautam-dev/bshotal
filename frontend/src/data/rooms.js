import { IMAGES } from '@/data/site';

// Prices are PLACEHOLDERS — replace with real rates.
export const AMENITIES = {
  ac: { en: 'AC', hi: 'एसी' },
  wifi: { en: 'Wi-Fi', hi: 'वाई-फ़ाई' },
  tv: { en: 'TV', hi: 'टीवी' },
  hotwater: { en: 'Hot water', hi: 'गर्म पानी' },
  parking: { en: 'Parking', hi: 'पार्किंग' },
  food: { en: 'Room service', hi: 'रूम सर्विस' },
};

export const ROOMS = [
  {
    id: 'standard',
    name: { en: 'Standard Room', hi: 'स्टैंडर्ड रूम' },
    desc: { en: 'A clean, comfortable room for solo travellers and couples. [PLACEHOLDER DESCRIPTION]', hi: 'अकेले यात्रियों और जोड़ों के लिए साफ़, आरामदायक कमरा। [नमूना विवरण]' },
    price: 1499,
    capacity: 2,
    amenities: ['ac', 'wifi', 'tv', 'hotwater'],
    images: [IMAGES.standard],
  },
  {
    id: 'deluxe',
    name: { en: 'Deluxe Room', hi: 'डीलक्स रूम' },
    desc: { en: 'More space, a king bed and a relaxed seating corner. [PLACEHOLDER DESCRIPTION]', hi: 'ज़्यादा जगह, किंग बेड और बैठने की आरामदायक जगह। [नमूना विवरण]' },
    price: 1999,
    capacity: 3,
    amenities: ['ac', 'wifi', 'tv', 'hotwater', 'food'],
    images: [IMAGES.deluxe],
  },
  {
    id: 'family',
    name: { en: 'Family Suite', hi: 'फ़ैमिली सुइट' },
    desc: { en: 'Roomy suite for the whole family, with two beds and a sitting area. [PLACEHOLDER DESCRIPTION]', hi: 'पूरे परिवार के लिए बड़ा सुइट, दो बेड और बैठक के साथ। [नमूना विवरण]' },
    price: 2999,
    capacity: 5,
    amenities: ['ac', 'wifi', 'tv', 'hotwater', 'food', 'parking'],
    images: [IMAGES.family],
  },
];