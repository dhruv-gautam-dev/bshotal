import { useI18n } from '@/lib/i18n';

export default function CategoryRail({ active, onPick, categories = [] }) {
  const { tr } = useI18n();
  return (
    <nav aria-label="Menu categories" className="sticky top-16 z-20 -mx-4 overflow-x-auto border-b border-primary/25 bg-background/95 px-4 backdrop-blur lg:top-20 lg:mx-0 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:border-0 lg:px-0">
      <ul className="flex gap-2 py-3 lg:flex-col lg:gap-1">
        {categories.map((c) => (
          <li key={c.id} className="shrink-0">
            <button type="button" onClick={() => onPick(c.id)} className={`min-h-[44px] whitespace-nowrap rounded-full px-4 text-sm font-medium transition lg:w-full lg:rounded-lg lg:text-left ${active === c.id ? 'bg-primary text-primary-foreground' : 'border border-primary/25 hover:border-primary lg:border-0'}`}>{tr(c.name)}</button>
          </li>
        ))}
      </ul>
    </nav>
  );
}