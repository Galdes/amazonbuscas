import { useState } from 'react';
import { motion } from 'framer-motion';

export function SearchSection({
  keywords,
  onKeywordsChange,
  onSearch,
  filters,
  activeFilter,
  onFilterClick,
  loading,
}) {
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch();
  };

  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight"
      >
        Encontre os melhores produtos.
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-2 text-gray-500 text-base md:text-lg"
      >
        Pesquise por ofertas, tendências e os mais vendidos da Amazon.
      </motion.p>

      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        onSubmit={handleSubmit}
        className="mt-8 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center"
      >
        <div
          className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl border bg-gray-50/50 transition-all ${
            focused ? 'border-[#0071e3] ring-2 ring-[#0071e3]/20' : 'border-gray-200'
          }`}
        >
          <svg
            className="w-5 h-5 text-gray-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={keywords}
            onChange={(e) => onKeywordsChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Ex: 'secador de cabelo', 'cooktop 5 bocas'..."
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-gray-900 placeholder-gray-400"
          />
        </div>
        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-3 rounded-2xl font-medium bg-gray-900 text-white shadow-sm disabled:opacity-60"
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </motion.button>
      </motion.form>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-6 flex flex-wrap justify-center gap-2"
      >
        {filters.map((f) => (
          <motion.button
            key={f.id}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onFilterClick(f.id)}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-colors ${
              activeFilter === f.id
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>{f.icon}</span>
            {f.label}
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
