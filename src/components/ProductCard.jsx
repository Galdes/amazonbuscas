import { motion } from 'framer-motion';

export function ProductCard({ item, index, showRank = true }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index ?? 0) * 0.03 }}
      className="w-full min-w-0 rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg transition-shadow flex flex-col"
    >
      <a
        href={item.url}
        target="_blank"
        rel="nofollow noopener noreferrer"
        className="block relative"
      >
        {showRank && index != null && (
          <span className="absolute top-2 left-2 z-10 bg-[#ff9900] text-white text-xs font-bold px-2 py-0.5 rounded">
            #{index + 1}
          </span>
        )}
        {item.discountPercent != null && item.discountPercent > 0 && (
          <span className="absolute top-2 right-2 z-10 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">
            -{item.discountPercent}%
          </span>
        )}
        <div className="aspect-square bg-gray-100 flex items-center justify-center">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt=""
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="text-gray-300 text-4xl">📦</span>
          )}
        </div>
      </a>
      <div className="p-3 flex-1 flex flex-col">
        <a
          href={item.url}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="font-medium text-gray-900 hover:text-[#0071e3] text-sm line-clamp-3 leading-snug"
        >
          {item.title || '—'}
        </a>
        {item.brand && (
          <p className="mt-1 text-xs text-gray-500">{item.brand}</p>
        )}
        {(item.price || item.discountPercent != null) && (
          <p className="mt-2 flex items-baseline gap-2 flex-wrap">
            {item.price && (
              <span className="text-xl font-bold text-red-600">{item.price}</span>
            )}
            {item.discountPercent != null && item.discountPercent > 0 && (
              <span className="text-sm font-semibold text-red-600">(-{item.discountPercent}%)</span>
            )}
          </p>
        )}
        <a
          href={item.url}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="mt-auto pt-3 inline-block text-center text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg py-2"
        >
          Ver na Amazon
        </a>
      </div>
    </motion.li>
  );
}
