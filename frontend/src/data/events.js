import { IMAGES } from '@/data/site';

export const INCLUDES = {
  decor: { en: 'Decoration', hi: 'सजावट' },
  catering: { en: 'Pure veg catering', hi: 'शुद्ध शाकाहारी केटरिंग' },
  rooms: { en: 'Guest rooms', hi: 'मेहमानों के कमरे' },
  music: { en: 'Music & DJ', hi: 'म्यूज़िक और डीजे' },
};

export const EVENTS = [
  {
    id: 'ring',
    value: 'Ring Ceremony / Engagement',
    name: { en: 'Ring Ceremony / Engagement', hi: 'रिंग सेरेमनी / सगाई' },
    desc: { en: 'An intimate, elegant setting for the first big step of your journey together, with warm hospitality for both families.', hi: 'आपके नए सफ़र के पहले बड़े क़दम के लिए आत्मीय और सुंदर माहौल, दोनों परिवारों के लिए आत्मीय सत्कार।' },
    capacity: '[CAPACITY e.g. 50–150 guests]',
    includes: ['decor', 'catering', 'rooms', 'music'],
    image: IMAGES.ring,
  },
  {
    id: 'birthday',
    value: 'Birthday Party',
    name: { en: 'Birthday Party', hi: 'जन्मदिन पार्टी' },
    desc: { en: 'Balloons, cake and a delicious veg menu for kids and grown-ups alike. We handle the details, you enjoy the day.', hi: 'बच्चों और बड़ों के लिए गुब्बारे, केक और स्वादिष्ट शाकाहारी मेन्यू। इंतज़ाम हमारा, मज़ा आपका।' },
    capacity: '[CAPACITY e.g. 20–80 guests]',
    includes: ['decor', 'catering', 'music'],
    image: IMAGES.birthday,
  },
  {
    id: 'wedding',
    value: 'Wedding',
    name: { en: 'Weddings', hi: 'शादी' },
    desc: { en: 'A grand celebration with room for rituals, family stays and a full pure-veg feast, planned around your traditions.', hi: 'आपकी परंपराओं के अनुसार रस्मों, परिवार के ठहराव और पूरे शुद्ध शाकाहारी भोज के साथ भव्य आयोजन।' },
    capacity: '[CAPACITY e.g. 200–500 guests]',
    includes: ['decor', 'catering', 'rooms', 'music'],
    image: IMAGES.wedding,
  },
];