import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShoppingBag } from 'lucide-react';
import PageHero from '@/components/site/PageHero';
import CategoryRail from '@/components/site/CategoryRail';
import MenuItemRow from '@/components/site/MenuItemRow';
import { useMenu } from '@/hooks/useSiteCatalog';
import { MENU } from '@/data/menu';
import { useCart } from '@/lib/cart';
import { useI18n } from '@/lib/i18n';
import { inr } from '@/lib/whatsapp';
import useSeo from '@/lib/useSeo';

export default function Restaurant() {
  const { t, tr } = useI18n();
  const { count, subtotal } = useCart();
  const [search, setSearch] = useState('');
  const { data: menu } = useMenu();
  const menuList = (menu && menu.length) ? menu : MENU;
  const [active, setActive] = useState(menuList[0]?.id || '');

  useEffect(() => {
    if (!active && menuList.length > 0) {
      setActive(menuList[0].id);
    }
  }, [menuList, active]);

  useSeo('Delicee Restaurant Menu | Pure Veg Restaurant near Township Nagar Mathura', 'Full pure vegetarian menu of Delicee Restaurant at B.S. Hotel, NH-2 Mathura: kebabs, paneer, dal, Chinese, pizza, dosa, shakes. Order on WhatsApp.');

  const q = search.trim().toLowerCase();
  const cats = menuList.map((c) => ({ ...c, items: q ? c.items.filter((i) => i.name.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)) : c.items })).filter((c) => c.items.length);
  const pick = (id) => { setActive(id); document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <>
      <PageHero title="Delicee Restaurant" sub="100% pure vegetarian · Serving Food With Love" />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6">
        <div className="relative mx-auto mb-4 max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search dishes…" aria-label="Search menu" className="field pl-11" />
        </div>
        <div className="lg:grid lg:grid-cols-[230px_1fr] lg:gap-10">
          <CategoryRail active={active} onPick={pick} categories={menu} />
          <div>
            {cats.length === 0 && <p className="py-16 text-center text-muted-foreground">No dishes match “{search}”.</p>}
            {cats.map((c) => (
              <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-40 pb-8" aria-label={tr(c.name)}>
                <h2 className="mb-1 mt-6 border-b border-primary/40 pb-2 text-3xl font-semibold text-primary">{tr(c.name)}</h2>
                {c.items.map((i) => <MenuItemRow key={i.id} item={i} />)}
              </section>
            ))}
          </div>
        </div>
      </section>
      {count > 0 && (
        <Link to="/order" className="fixed inset-x-4 bottom-[72px] z-30 mx-auto flex max-w-md items-center justify-between rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-xl md:bottom-6">
          <span className="flex items-center gap-2"><ShoppingBag size={20} />{count} · {inr(subtotal)}</span>
          <span>{t('nav.order')} →</span>
        </Link>
      )}
    </>
  );
}