import { motion } from 'framer-motion';
import { ProductCard } from './ProductCard';

const SECTION_LINKS = {
  'Ofertas em Cozinha': 'https://www.amazon.com.br/gp/bestsellers/kitchen/ref=zg_bs_kitchen_sm',
  'Ofertas em Moda': 'https://www.amazon.com.br/gp/bestsellers/fashion/ref=zg_bs_fashion_sm',
  'Ofertas em Alimentos e Bebidas': 'https://www.amazon.com.br/gp/bestsellers/grocery/ref=zg_bs_grocery_sm',
  'Ofertas em Ferramentas e Materiais de Construção': 'https://www.amazon.com.br/gp/bestsellers/hi/ref=zg_bs_hi_sm',
  'Ofertas em Instrumentos Musicais': 'https://www.amazon.com.br/gp/bestsellers/musical-instruments/ref=zg_bs_musical-instruments_sm',
  'Ofertas em Móveis': 'https://www.amazon.com.br/gp/bestsellers/furniture/ref=zg_bs_furniture_sm',
};

export function HomeSections({ sections, loading, partnerTag = '' }) {
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-8 w-full max-w-6xl mx-auto px-2 space-y-10"
      >
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i}>
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="rounded-xl border border-gray-200 bg-gray-50 h-72 animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </motion.div>
    );
  }

  if (!sections?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-8 w-full max-w-6xl mx-auto px-2 space-y-10"
    >
      {sections.map((section) => {
        const verMaisUrl = SECTION_LINKS[section.name];
        const linkUrl = verMaisUrl && partnerTag
          ? `${verMaisUrl}${verMaisUrl.includes('?') ? '&' : '?'}tag=${encodeURIComponent(partnerTag)}`
          : verMaisUrl;
        return (
        <section key={section.name}>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-800">{section.name}</h2>
            {linkUrl && (
              <a
                href={linkUrl}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="text-sm font-medium text-[#0071e3] hover:underline"
              >
                Ver mais
              </a>
            )}
          </div>
          <div className="w-full">
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
              {(section.items || []).map((item, idx) => (
                <ProductCard key={item.asin || idx} item={item} index={idx} showRank={false} />
              ))}
            </ul>
          </div>
        </section>
        );
      })}
    </motion.div>
  );
}
