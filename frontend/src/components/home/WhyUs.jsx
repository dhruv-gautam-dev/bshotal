import { Leaf, Users, Route, Car, ShieldCheck, HeartHandshake } from 'lucide-react';
import SectionHeading from '@/components/site/SectionHeading';
import Reveal from '@/components/site/Reveal';
import { useI18n } from '@/lib/i18n';

const POINTS = [
  [Leaf, 'Pure vegetarian kitchen', 'शुद्ध शाकाहारी रसोई'],
  [Users, 'Family friendly', 'परिवार के अनुकूल'],
  [Route, 'Right on NH-2', 'एन एच-2 पर स्थित'],
  [Car, 'Ample parking [CONFIRM]', 'पर्याप्त पार्किंग [पुष्टि करें]'],
  [ShieldCheck, 'Clean & safe rooms', 'साफ़ और सुरक्षित कमरे'],
  [HeartHandshake, 'Warm, personal service', 'आत्मीय सेवा'],
];

export default function WhyUs() {
  const { t, L } = useI18n();
  return (
    <section className="jali border-y border-primary/20 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading title={t('why.title')} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {POINTS.map(([Icon, en, hi], i) => (
            <Reveal key={en} delay={(i % 3) * 0.08}>
              <div className="flex items-center gap-4 rounded-xl border border-primary/20 p-5">
                <Icon className="shrink-0 text-primary" size={28} />
                <p className="font-semibold">{L(en, hi)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}