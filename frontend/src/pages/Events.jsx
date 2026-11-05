import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PageHero from '@/components/site/PageHero';
import EventStory from '@/components/site/EventStory';
import EnquiryForm from '@/components/site/EnquiryForm';
import SectionHeading from '@/components/site/SectionHeading';
import { useEventPackages } from '@/hooks/useSiteCatalog';
import { useI18n } from '@/lib/i18n';
import useSeo from '@/lib/useSeo';

export default function Events() {
  const { t, L } = useI18n();
  const [type, setType] = useState('');
  const { hash } = useLocation();
  const { data: packages } = useEventPackages();
  const list = packages || [];

  useSeo('Events: Ring Ceremony, Birthday, Wedding | B.S. Hotel Mathura', 'Host your ring ceremony, birthday party or wedding at B.S. Hotel near Township Nagar, NH-2, Mathura, with pure veg catering.');
  useEffect(() => { if (hash) setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' }), 100); }, [hash]);
  const enquire = (v) => { setType(v); document.getElementById('enquiry')?.scrollIntoView({ behavior: 'smooth' }); };

  return (
    <>
      <PageHero title={t('events.title')} sub={t('events.sub')} />
      {list.map((e, i) => <EventStory key={e.id} event={e} index={i} onEnquire={enquire} />)}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <SectionHeading title={L('Custom packages & event catering', 'कस्टम पैकेज और इवेंट केटरिंग')} sub={L('Need a different size or menu? We build packages around your guest list, budget and rituals, and can cater pure-veg food for events at your own venue too.', 'अलग आकार या मेन्यू चाहिए? हम आपकी मेहमान सूची, बजट और रस्मों के अनुसार पैकेज बनाते हैं, और आपके अपने स्थान पर भी शुद्ध शाकाहारी केटरिंग करते हैं।')} />
        <button type="button" className="btn-outline" onClick={() => enquire('Custom package / Catering')}>{t('cta.enquire')}</button>
      </section>
      <section className="pb-20 px-4"><EnquiryForm eventType={type} /></section>
    </>
  );
}