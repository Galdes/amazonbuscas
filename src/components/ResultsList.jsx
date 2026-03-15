import { motion, AnimatePresence } from 'framer-motion';
import { ProductCard } from './ProductCard';

function formatFetchedAt(date) {
  if (!date || !(date instanceof Date)) return '';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ResultsList({ items, loading, resultsFetchedAt }) {
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-12 w-full max-w-3xl mx-auto grid gap-4"
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl bg-gray-100 animate-pulse"
          />
        ))}
      </motion.div>
    );
  }

  if (!items || items.length === 0) return null;

  const fetchedAtStr = formatFetchedAt(resultsFetchedAt);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-12 w-full max-w-6xl mx-auto px-2"
    >
      <h2 className="text-lg font-semibold text-gray-800 mb-2">
        {items.length} produto(s) encontrado(s)
      </h2>
      {fetchedAtStr && (
        <p className="text-xs text-gray-500 mb-1">
          Preços consultados em {fetchedAtStr}.
        </p>
      )}
      <p className="text-xs text-gray-500 mb-4">
        Os preços e a disponibilidade estão corretos na data indicada e podem sofrer alterações. As informações exibidas na Amazon no momento da compra serão aplicáveis.
      </p>
      <div className="w-full">
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
          <AnimatePresence>
            {items.map((item, index) => (
              <ProductCard key={item.asin || index} item={item} index={index} showRank />
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </motion.section>
  );
}
