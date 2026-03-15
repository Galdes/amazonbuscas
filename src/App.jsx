import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from './components/Header';
import { SearchSection } from './components/SearchSection';
import { ResultsList } from './components/ResultsList';
import { HomeSections } from './components/HomeSections';
import { Footer } from './components/Footer';
import { AddToHomeScreen } from './components/AddToHomeScreen';
import { searchProducts, getHomeSections } from './api/search';
import { exportToExcel } from './utils/excel';

const FILTERS = [
  { id: 'deals', label: 'Ofertas', icon: '🏷️' },
  { id: 'bestsellers', label: 'Mais Vendidos', icon: '⭐' },
  { id: 'trending', label: 'Em Alta', icon: '📈' },
];

export default function App() {
  const [keywords, setKeywords] = useState('');
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [resultsFetchedAt, setResultsFetchedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [homeSections, setHomeSections] = useState([]);
  const [homeLoading, setHomeLoading] = useState(true);
  const [partnerTag, setPartnerTag] = useState('');

  useEffect(() => {
    let cancelled = false;
    getHomeSections()
      .then((data) => {
        if (!cancelled && data.sections) setHomeSections(data.sections);
        if (!cancelled && data.partnerTag != null) setPartnerTag(data.partnerTag);
      })
      .catch(() => {
        if (!cancelled) setHomeSections([]);
      })
      .finally(() => {
        if (!cancelled) setHomeLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSearch = useCallback(async (searchKeywords = keywords, searchFilter = filter) => {
    setError(null);
    setLoading(true);
    setHasSearched(true);
    try {
      const { items: data } = await searchProducts({
        keywords: searchKeywords || 'produtos',
        filter: searchFilter,
      });
      setItems(data || []);
      setResultsFetchedAt(data?.length ? new Date() : null);
    } catch (err) {
      setError(err.message || 'Erro ao buscar produtos.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [keywords, filter]);

  const handleFilterClick = useCallback((filterId) => {
    setFilter(filterId);
    setHasSearched(true);
    handleSearch(keywords, filterId);
  }, [keywords, handleSearch]);

  const handleExportExcel = useCallback(() => {
    exportToExcel(items);
  }, [items]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header onExportExcel={handleExportExcel} hasResults={items.length > 0} />
      <main className="flex-1 flex flex-col items-center px-4 py-8 md:py-12">
        <SearchSection
          keywords={keywords}
          onKeywordsChange={setKeywords}
          onSearch={() => handleSearch()}
          filters={FILTERS}
          activeFilter={filter}
          onFilterClick={handleFilterClick}
          loading={loading}
        />
        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 text-red-600 text-sm text-center"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        {hasSearched ? (
          <ResultsList items={items} loading={loading} resultsFetchedAt={resultsFetchedAt} />
        ) : (
          <HomeSections sections={homeSections} loading={homeLoading} partnerTag={partnerTag} />
        )}
      </main>
      <Footer />
      <AddToHomeScreen />
    </div>
  );
}
