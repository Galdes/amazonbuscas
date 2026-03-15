import { motion } from 'framer-motion';

export function Header({ onExportExcel, hasResults }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between px-4 py-4 md:px-8 border-b border-gray-200/80"
    >
      <div className="flex items-center gap-2">
        <img src="/icon-512.png" alt="" className="w-9 h-9 rounded-lg object-contain" />
        <span className="font-semibold text-gray-800 text-lg">AMZ Buscas</span>
      </div>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onExportExcel}
        disabled={!hasResults}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-[#0071e3] text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Exportar Excel
      </motion.button>
    </motion.header>
  );
}
