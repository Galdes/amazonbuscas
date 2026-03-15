import React, { useState, useCallback, useRef, useEffect } from 'react';
import SearchInput from './components/SearchInput';
import ResultCard from './components/ResultCard';
import { Loader } from './components/Loader';
import { ArticleWriter } from './components/ArticleWriter';
import { ModeTabs } from './components/ModeTabs';
import ProductResultCard from './components/ProductResultCard';
import { ProductConsolidationComponent } from './components/ProductConsolidation';
import { AmazonProductSelector } from './components/AmazonProductSelector';
import { CopyLinksAndFAQs } from './components/CopyLinksAndFAQs';
import { searchAndExtractOutlines, generateConsolidatedStrategy, searchAndExtractProducts, isProductSearch } from './services/gemini';
import { consolidateProducts } from './services/productConsolidator';
import { SearchResult, MasterStrategy, ProductSearchResult, ProductConsolidation } from './types';

const App: React.FC = () => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [masterStrategy, setMasterStrategy] = useState<MasterStrategy | null>(null);
  const [showArticleGenerator, setShowArticleGenerator] = useState(false);

  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [currentKeyword, setCurrentKeyword] = useState('');
  const [nextStart, setNextStart] = useState(0); // Controle de paginação

  // Manual Mode State
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualOutline, setManualOutline] = useState('');

  // Product Mode State
  const [searchMode, setSearchMode] = useState<'outlines' | 'products'>('outlines');
  const [productResults, setProductResults] = useState<ProductSearchResult[]>([]);
  const [selectedProductIndices, setSelectedProductIndices] = useState<Set<number>>(new Set());
  const [productConsolidation, setProductConsolidation] = useState<ProductConsolidation | null>(null);
  const [showAmazonSelector, setShowAmazonSelector] = useState(false);
  const [selectedAmazonProducts, setSelectedAmazonProducts] = useState<Map<string, any>>(new Map());
  const [associateTag, setAssociateTag] = useState<string>('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);

  const strategyRef = useRef<HTMLDivElement>(null);

  // Carregar Associate Tag do localStorage
  useEffect(() => {
    const savedTags = localStorage.getItem('amazon_associate_tags');
    if (savedTags) {
      try {
        const tags = JSON.parse(savedTags);
        if (tags.length > 0 && !associateTag) {
          setAssociateTag(tags[0]);
        }
      } catch (e) {
        console.warn('[App] Erro ao carregar tags do localStorage:', e);
      }
    }
  }, []);

  // Busca inicial (10 resultados)
  const handleSearch = useCallback(async (keyword: string) => {
    setError(null);
    setCurrentKeyword(keyword);
    setMasterStrategy(null);
    setProductConsolidation(null);
    setSelectedIndices(new Set());
    setSelectedProductIndices(new Set());

    // Detectar se é busca de produtos (automático ou manual)
    const isProductMode = searchMode === 'products' || isProductSearch(keyword);

    if (isProductMode) {
      // Modo Produtos
      setLoadingProducts(true);
      setProductResults([]);
      setIsFallback(false);

      try {
        const response = await searchAndExtractProducts(keyword, 10, [], 0);
        setProductResults(response.results);
        setIsFallback(response.isFallback);
        setNextStart(10);
      } catch (err: any) {
        setError(err.message || "Ocorreu um erro ao buscar produtos.");
      } finally {
        setLoadingProducts(false);
      }
    } else {
      // Modo Outlines (padrão)
      setLoadingSearch(true);
      setResults([]);
      setIsFallback(false);

      try {
        const response = await searchAndExtractOutlines(keyword, 10, [], 0);
        setResults(response.results);
        setIsFallback(response.isFallback);
        setNextStart(10);
      } catch (err: any) {
        setError(err.message || "Ocorreu um erro ao buscar os resultados.");
      } finally {
        setLoadingSearch(false);
      }
    }
  }, [searchMode]);

  const handleLoadMore = async () => {
    if (!currentKeyword) return;
    setLoadingMore(true);
    setError(null);

    try {
      // Coletar domínios já existentes para excluir da nova busca
      const existingDomains: string[] = results
        .map(r => r.domain)
        .filter((d): d is string => typeof d === 'string' && d.length > 0);

      // Remove duplicatas de domínios
      const uniqueDomains = [...new Set(existingDomains)];

      // Passamos nextStart para buscar a próxima página
      const response = await searchAndExtractOutlines(currentKeyword, 5, uniqueDomains, nextStart);
      const newResults = response.results;

      // Se o load more usar fallback, também setamos o aviso
      if (response.isFallback) setIsFallback(true);

      if (newResults && newResults.length > 0) {
        setResults(prev => [...prev, ...newResults]);
        setNextStart(prev => prev + 10); // Incrementa para a próxima página (assumindo blocos de 10 na origem, mesmo pedindo 5 úteis)
      } else {
        setError("Não foram encontrados novos resultados relevantes.");
      }
    } catch (err: any) {
      setError("Erro ao carregar mais resultados: " + err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  // Gerenciar seleção dos checkboxes
  // Gerenciar seleção dos checkboxes
  const toggleSelection = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedIndices(newSet);
  };

  // --- Funções de Edição da Estratégia ---

  const handleUpdateOutlineItem = (index: number, field: 'text' | 'tag', value: string) => {
    if (!masterStrategy) return;
    const newOutline = [...masterStrategy.masterOutline];
    newOutline[index] = { ...newOutline[index], [field]: value };
    setMasterStrategy({ ...masterStrategy, masterOutline: newOutline, finalHeadings: newOutline.length });
  };

  const handleDeleteOutlineItem = (index: number) => {
    if (!masterStrategy) return;
    const newOutline = masterStrategy.masterOutline.filter((_, i) => i !== index);
    setMasterStrategy({ ...masterStrategy, masterOutline: newOutline, finalHeadings: newOutline.length });
  };

  const handleAddOutlineItem = (index: number) => {
    if (!masterStrategy) return;
    const newOutline = [...masterStrategy.masterOutline];
    // Insere um novo H2 logo após o índice atual
    newOutline.splice(index + 1, 0, { tag: 'H2', text: 'Novo Tópico' });
    setMasterStrategy({ ...masterStrategy, masterOutline: newOutline, finalHeadings: newOutline.length });
  };

  const handleAddToStrategy = (item: { tag: string; text: string }) => {
    if (!masterStrategy) {
      // Se não houver estratégia ainda, cria uma nova com este item
      setMasterStrategy({
        baseHeadings: 0,
        maxHeadings: 100,
        finalHeadings: 1,
        metaDescription: "",
        masterOutline: [item]
      });
      // Scroll para a estratégia
      setTimeout(() => {
        strategyRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return;
    }

    const newOutline = [...masterStrategy.masterOutline, item];
    setMasterStrategy({ ...masterStrategy, masterOutline: newOutline, finalHeadings: newOutline.length });
  };

  // Gerar estratégia consolidada
  const handleGenerateStrategy = async () => {
    if (selectedIndices.size < 2) {
      setError("Selecione pelo menos 2 concorrentes para gerar uma estratégia enriquecida.");
      return;
    }

    setLoadingStrategy(true);
    setError(null);
    setMasterStrategy(null);

    try {
      // Importante: Mantemos a ordem dos resultados originais para respeitar
      // a regra de "Primeiro selecionado é a base".
      // O filter vai manter a ordem relativa (ex: se selecionei 0, 2, 5 -> o 0 é base, 2 e 5 enriquecem).
      const selectedItems = results.filter((_, idx) => selectedIndices.has(idx));

      const strategy = await generateConsolidatedStrategy(currentKeyword, selectedItems);
      setMasterStrategy(strategy);

      // Scroll suave para o resultado
      setTimeout(() => {
        strategyRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (err: any) {
      setError(err.message || "Erro ao consolidar estratégia.");
    } finally {
      setLoadingStrategy(false);
    }
  };

  // Toggle seleção de produtos
  const toggleProductSelection = (index: number) => {
    const newSet = new Set(selectedProductIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedProductIndices(newSet);
  };

  // Consolidação de produtos (híbrido: primeiro selecionado automaticamente + permite ajustar)
  const handleConsolidateProducts = () => {
    if (selectedProductIndices.size < 1) {
      setError("Selecione pelo menos 1 artigo para consolidar produtos.");
      return;
    }

    setError(null);
    setProductConsolidation(null);

    try {
      // Ordenar índices selecionados para manter ordem
      const sortedIndices = Array.from(selectedProductIndices).sort((a, b) => a - b);
      const selectedItems = sortedIndices.map(idx => productResults[idx]).filter(Boolean);

      if (selectedItems.length === 0) {
        setError("Nenhum resultado válido selecionado.");
        return;
      }

      // Se o primeiro selecionado não for o índice 0, garantir que o primeiro seja a base
      // Mas manter a ordem de seleção do usuário
      const consolidation = consolidateProducts(selectedItems);
      setProductConsolidation(consolidation);

      // Scroll suave para o resultado
      setTimeout(() => {
        strategyRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (err: any) {
      setError(err.message || "Erro ao consolidar produtos.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleManualGenerate = () => {
    if (!manualTitle || !manualOutline) {
      setError("Preencha o título e a estrutura (outline).");
      return;
    }

    const lines = manualOutline.split('\n').filter(l => l.trim());
    const outlineItems = lines.map(line => {
      const match = line.match(/^(H[1-6]):\s*(.*)$/i);
      if (match) {
        return { tag: match[1].toUpperCase(), text: match[2].trim() };
      }
      // Default to H2 if no tag specified, or handle as text
      return { tag: 'H2', text: line.trim() };
    });

    const manualStrategy: MasterStrategy = {
      baseHeadings: outlineItems.length,
      maxHeadings: outlineItems.length,
      finalHeadings: outlineItems.length,
      metaDescription: "Artigo gerado manualmente.",
      masterOutline: outlineItems
    };

    setMasterStrategy(manualStrategy);
    setCurrentKeyword(manualTitle);
    setShowArticleGenerator(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-inter">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 pt-10 pb-12 px-4 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
              SEO <span className="text-indigo-600">Outline</span>
            </h1>
            <p className="text-slate-500 max-w-xl mx-auto text-sm md:text-base">
              Busque a palavra-chave, selecione o <strong>1º artigo como BASE</strong> e outros para enriquecê-lo. O sistema cria uma estrutura aprimorada respeitando um limite de +30%.
            </p>
          </div>

          <div className="mt-6">
            {!isManualMode && (
              <ModeTabs
                currentMode={searchMode}
                onModeChange={(mode) => {
                  setSearchMode(mode);
                  setResults([]);
                  setProductResults([]);
                  setMasterStrategy(null);
                  setProductConsolidation(null);
                }}
              />
            )}
            <div className="flex justify-center gap-4 mb-6">
              <button
                onClick={() => setIsManualMode(false)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${!isManualMode ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Busca Automática
              </button>
              <button
                onClick={() => setIsManualMode(true)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${isManualMode ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Modo Manual
              </button>
            </div>

            {!isManualMode ? (
              <SearchInput onSearch={handleSearch} isLoading={loadingSearch || loadingStrategy} />
            ) : (
              <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-slate-200 text-left">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Título do Artigo</label>
                    <input
                      type="text"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder="Ex: Como criar uma estratégia de SEO"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Estrutura (Outline)</label>
                    <textarea
                      value={manualOutline}
                      onChange={(e) => setManualOutline(e.target.value)}
                      placeholder="H2: O que é SEO?&#10;H2: Importância das Palavras-chave&#10;H3: Ferramentas de Pesquisa"
                      rows={8}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                    />
                    <p className="text-xs text-slate-400 mt-1">Use o formato "TAG: Texto" (ex: H2: Título). Linhas sem tag serão tratadas como H2.</p>
                  </div>
                  <button
                    onClick={handleManualGenerate}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    Gerar Artigo Agora
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8">

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm mb-6 mx-auto max-w-3xl">
            <div className="flex items-center">
              <div className="flex-shrink-0 text-red-500">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Fallback Warning Alert - EXPLICIT */}
        {!loadingSearch && isFallback && results.length > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-sm mb-8 mx-auto max-w-4xl animate-fade-in">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-bold text-yellow-800">
                  Outscraper Indisponível - Usando API do Google
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    A API do Outscraper travou ou foi bloqueada pelo navegador (Erro: Failed to fetch).
                    <br />
                    <strong>Alternando automaticamente para a busca nativa do Google (Gemini Grounding).</strong> Os resultados abaixo foram gerados com sucesso pela API de backup.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {(loadingSearch || loadingProducts) && <Loader />}

        {/* Results List - Modo Outlines */}
        {!isManualMode && searchMode === 'outlines' && !loadingSearch && results.length > 0 && (
          <div className="grid lg:grid-cols-12 gap-8">

            {/* Left Column: Search Results */}
            <div className="lg:col-span-5 space-y-6">
              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Resultados ({results.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">1º selecionado = Modelo Base</p>
                </div>
                <div className="text-right">
                  <span className="block text-2xl font-bold text-indigo-600 leading-none">
                    {selectedIndices.size}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Selecionados</span>
                </div>
              </div>

              <div className="space-y-3">
                {results.map((result, index) => (
                  <ResultCard
                    key={`${result.url}-${index}`}
                    data={result}
                    index={index}
                    isSelected={selectedIndices.has(index)}
                    onToggle={() => toggleSelection(index)}
                    onAddOutlineItem={handleAddToStrategy}
                  />
                ))}
              </div>

              {/* Load More Button */}
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full py-3 bg-white border-2 border-dashed border-slate-300 text-slate-500 rounded-xl font-semibold hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Buscando mais...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Carregar mais resultados
                  </>
                )}
              </button>
            </div>

            {/* Right Column: Action & Master Strategy */}
            <div className="lg:col-span-7 space-y-6">

              {/* Action Box */}
              <div className="bg-indigo-900 rounded-2xl p-6 shadow-lg text-white">
                <h3 className="text-xl font-bold mb-2">Gerar Estratégia Enriquecida</h3>
                <p className="text-indigo-200 text-sm mb-6">
                  O 1º artigo selecionado será usado como BASE. Inseriremos tópicos dos demais sequencialmente, limitado a +30% de volume extra.
                </p>

                <button
                  onClick={handleGenerateStrategy}
                  disabled={selectedIndices.size < 2 || loadingStrategy}
                  className={`w-full py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-md
                    ${selectedIndices.size < 2 || loadingStrategy
                      ? 'bg-indigo-800 text-indigo-400 cursor-not-allowed'
                      : 'bg-white text-indigo-900 hover:bg-indigo-50 hover:scale-[1.02]'
                    }`}
                >
                  {loadingStrategy ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-indigo-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processando (Base + 30%)...
                    </>
                  ) : (
                    <>
                      <span>Gerar Estratégia</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </>
                  )}
                </button>
              </div>

              {/* Master Strategy Result */}
              <div ref={strategyRef}>
                {masterStrategy && (
                  <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in-up">
                    <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <h2 className="text-2xl font-bold flex items-center gap-2">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Estratégia Pronta
                          </h2>
                          <p className="text-green-100 mt-1 text-sm">Modelo Base enriquecido com +{Math.round(((masterStrategy.finalHeadings - masterStrategy.baseHeadings) / masterStrategy.baseHeadings) * 100)}%</p>
                        </div>
                        <div className="flex gap-2 text-center">
                          <div className="bg-white/20 rounded-lg p-2 backdrop-blur-sm min-w-[80px]">
                            <span className="block text-[10px] text-green-100 uppercase tracking-wider">Base (1º)</span>
                            <span className="block text-xl font-bold">{masterStrategy.baseHeadings}</span>
                          </div>
                          <div className="bg-white/20 rounded-lg p-2 backdrop-blur-sm min-w-[80px]">
                            <span className="block text-[10px] text-green-100 uppercase tracking-wider">Max (+30%)</span>
                            <span className="block text-xl font-bold">{masterStrategy.maxHeadings}</span>
                          </div>
                          <div className="bg-white text-green-700 rounded-lg p-2 shadow-sm min-w-[80px]">
                            <span className="block text-[10px] text-green-800 font-bold uppercase tracking-wider">Final</span>
                            <span className="block text-xl font-extrabold">{masterStrategy.finalHeadings}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-6">
                      {/* Meta Description */}
                      <div className="mb-8 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Meta Descrição ({masterStrategy.metaDescription.length} chars)</h3>
                          <button
                            onClick={() => copyToClipboard(masterStrategy.metaDescription)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            Copiar
                          </button>
                        </div>
                        <p className="text-slate-800 font-medium text-sm leading-relaxed">
                          {masterStrategy.metaDescription}
                        </p>
                      </div>

                      {/* Outline */}
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Estrutura Recomendada</h3>
                        <button
                          onClick={() => {
                            const text = masterStrategy.masterOutline.map(i => `${i.tag}: ${i.text}`).join('\n');
                            copyToClipboard(text);
                          }}
                          className="flex items-center gap-1 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg transition-colors font-medium"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                          Copiar Tudo
                        </button>
                      </div>

                      {/* Article Generation Button */}
                      <div className="mb-6 bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-indigo-900">Pronto para escrever?</h4>
                          <p className="text-xs text-indigo-600 mt-0.5">Gere o artigo completo usando esta estrutura.</p>
                        </div>
                        <button
                          onClick={() => setShowArticleGenerator(true)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-md transition-all hover:scale-105 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          Gerar Artigo Completo
                        </button>
                      </div>

                      <div className="space-y-3 border-l-2 border-slate-100 pl-4">
                        {masterStrategy.masterOutline.map((item, idx) => (
                          <div key={idx} className={`group flex items-center gap-3 ${item.tag === 'H2' ? 'ml-4' : item.tag === 'H3' ? 'ml-8' : ''}`}>

                            {/* Tag Selector */}
                            <select
                              value={item.tag}
                              onChange={(e) => handleUpdateOutlineItem(idx, 'tag', e.target.value)}
                              className={`
                                appearance-none cursor-pointer
                                mt-0.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide min-w-[40px] text-center outline-none border border-transparent hover:border-slate-300 focus:border-indigo-500
                                ${item.tag === 'H1' ? 'bg-indigo-600 text-white' :
                                  item.tag === 'H2' ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-500'}
                              `}
                            >
                              <option value="H1">H1</option>
                              <option value="H2">H2</option>
                              <option value="H3">H3</option>
                            </select>

                            {/* Editable Text */}
                            <input
                              type="text"
                              value={item.text}
                              onChange={(e) => handleUpdateOutlineItem(idx, 'text', e.target.value)}
                              className={`
                                flex-grow bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5 transition-all
                                text-slate-700 
                                ${item.tag === 'H1' ? 'font-bold text-lg' :
                                  item.tag === 'H2' ? 'font-semibold text-base' : 'font-normal text-sm'}
                              `}
                            />

                            {/* Actions (Show on Hover) */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleAddOutlineItem(idx)}
                                title="Adicionar tópico abaixo"
                                className="p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                              </button>
                              <button
                                onClick={() => handleDeleteOutlineItem(idx)}
                                title="Remover tópico"
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Results List - Modo Produtos */}
        {!isManualMode && searchMode === 'products' && !loadingProducts && productResults.length > 0 && (
          <div className="grid lg:grid-cols-12 gap-8">
            {/* Left Column: Product Results */}
            <div className="lg:col-span-5 space-y-6">
              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Artigos ({productResults.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">1º selecionado = Base de Produtos</p>
                </div>
                <div className="text-right">
                  <span className="block text-2xl font-bold text-indigo-600 leading-none">
                    {selectedProductIndices.size}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Selecionados</span>
                </div>
              </div>

              <div className="space-y-3">
                {productResults.map((result, index) => (
                  <ProductResultCard
                    key={`${result.url}-${index}`}
                    data={result}
                    index={index}
                    isSelected={selectedProductIndices.has(index)}
                    onToggle={() => toggleProductSelection(index)}
                  />
                ))}
              </div>
            </div>

            {/* Right Column: Action & Product Consolidation */}
            <div className="lg:col-span-7 space-y-6">
              {/* Action Box */}
              <div className="bg-green-900 rounded-2xl p-6 shadow-lg text-white">
                <h3 className="text-xl font-bold mb-2">Consolidar Produtos</h3>
                <p className="text-green-200 text-sm mb-6">
                  O 1º artigo selecionado será usado como BASE. Adicionaremos 30% dos produtos mais repetidos dos demais artigos.
                </p>

                <button
                  onClick={handleConsolidateProducts}
                  disabled={selectedProductIndices.size < 1}
                  className={`w-full py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-md
                    ${selectedProductIndices.size < 1
                      ? 'bg-green-800 text-green-400 cursor-not-allowed'
                      : 'bg-white text-green-900 hover:bg-green-50 hover:scale-[1.02]'
                    }`}
                >
                  <span>Consolidar Produtos</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </button>
              </div>

              {/* Product Consolidation Result */}
              <div ref={strategyRef}>
                {productConsolidation && (
                  <ProductConsolidationComponent 
                    consolidation={productConsolidation}
                    keyword={currentKeyword}
                    competitorTitles={Array.from(selectedProductIndices).sort((a, b) => a - b).map(i => productResults[i]).filter(Boolean).map(r => r.outline?.find(o => o.tag === 'H1')?.text || r.title)}
                    onGenerateArticle={(products, title) => {
                      // Criar uma estratégia básica para o modo produtos
                      const productStrategy: MasterStrategy = {
                        baseHeadings: products.length,
                        maxHeadings: products.length,
                        finalHeadings: products.length,
                        metaDescription: `Guia completo com ${products.length} produtos recomendados.`,
                        masterOutline: [
                          { tag: 'H1', text: title || currentKeyword },
                          ...products.map((p, idx) => ({ tag: 'H2', text: p.name }))
                        ]
                      };
                      // Armazenar produtos e FAQs para passar ao ArticleWriter
                      (productStrategy as any).products = products;
                      (productStrategy as any).faqs = productConsolidation.faqs;
                      setMasterStrategy(productStrategy);
                      setShowArticleGenerator(true);
                    }}
                    onGenerateWithAmazon={(products, title, tag) => {
                      setAssociateTag(tag);
                      setSelectedAmazonProducts(new Map());
                      setShowAmazonSelector(true);
                    }}
                    onCopyLinksAndFAQs={(products, faqs, title) => {
                      // Se já tiver produtos selecionados da Amazon, mostrar modal de cópia
                      if (selectedAmazonProducts.size > 0) {
                        setShowCopyModal(true);
                      } else {
                        // Se não tiver, primeiro precisa selecionar na Amazon
                        const tag = associateTag || (localStorage.getItem('amazon_associate_tags') ? JSON.parse(localStorage.getItem('amazon_associate_tags')!)[0] : '');
                        if (!tag) {
                          alert('Configure uma Associate Tag primeiro! Vá em "Gerar Artigo" e configure a tag no dropdown.');
                          return;
                        }
                        setAssociateTag(tag);
                        setSelectedAmazonProducts(new Map());
                        setShowAmazonSelector(true);
                        // Armazenar callback para depois mostrar modal de cópia
                        (window as any).pendingCopyAction = { products, faqs, title };
                      }
                    }}
                    articleTitle={currentKeyword}
                    associateTag={associateTag || (localStorage.getItem('amazon_associate_tags') ? JSON.parse(localStorage.getItem('amazon_associate_tags')!)[0] : '')}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isManualMode && !loadingSearch && !loadingProducts && results.length === 0 && productResults.length === 0 && !error && (
          <div className="text-center py-20 max-w-2xl mx-auto">
            <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Pronto para começar?</h2>
            <p className="text-slate-500">
              {searchMode === 'products' 
                ? 'Insira uma busca de produtos (ex: "melhores produtos X") no campo acima. O sistema buscará artigos e extrairá produtos e perguntas frequentes.'
                : 'Insira sua palavra-chave no campo acima. O sistema buscará os 10 melhores artigos do Google, excluirá vídeos, e permitirá que você selecione os melhores para criar sua "Super Outline".'
              }
            </p>
          </div>
        )}
      </main>

      {/* Amazon Product Selector Modal */}
      {showAmazonSelector && productConsolidation && associateTag && (
        <AmazonProductSelector
          products={productConsolidation.totalProducts}
          associateTag={associateTag}
          onConfirm={(selectedProducts) => {
            setSelectedAmazonProducts(selectedProducts);
            setShowAmazonSelector(false);
            
            // Verificar se há ação de cópia pendente
            const pendingCopy = (window as any).pendingCopyAction;
            if (pendingCopy) {
              // Limpar ação pendente
              delete (window as any).pendingCopyAction;
              // Mostrar modal de cópia
              setShowCopyModal(true);
            } else {
              // Criar estratégia com produtos selecionados
              const productStrategy: MasterStrategy = {
                baseHeadings: productConsolidation.totalProducts.length,
                maxHeadings: productConsolidation.totalProducts.length,
                finalHeadings: productConsolidation.totalProducts.length,
                metaDescription: `Guia completo com ${productConsolidation.totalProducts.length} produtos recomendados.`,
                masterOutline: [
                  { tag: 'H1', text: currentKeyword },
                  ...productConsolidation.totalProducts.map((p) => ({ tag: 'H2', text: p.name }))
                ]
              };
              
              // Armazenar produtos selecionados da Amazon e FAQs
              (productStrategy as any).products = productConsolidation.totalProducts;
              (productStrategy as any).faqs = productConsolidation.faqs;
              (productStrategy as any).selectedAmazonProducts = selectedProducts;
              
              setMasterStrategy(productStrategy);
              setShowArticleGenerator(true);
            }
          }}
          onCancel={() => {
            setShowAmazonSelector(false);
            delete (window as any).pendingCopyAction;
          }}
        />
      )}

      {/* Copy Links and FAQs Modal */}
      {showCopyModal && productConsolidation && (
        <CopyLinksAndFAQs
          products={productConsolidation.totalProducts}
          faqs={productConsolidation.faqs}
          selectedAmazonProducts={selectedAmazonProducts}
          associateTag={associateTag || (localStorage.getItem('amazon_associate_tags') ? JSON.parse(localStorage.getItem('amazon_associate_tags')!)[0] : '')}
          title={currentKeyword}
          onClose={() => setShowCopyModal(false)}
        />
      )}

      {/* Article Generator Modal */}
      {showArticleGenerator && masterStrategy && (
        <ArticleWriter
          title={masterStrategy.masterOutline.find(item => item.tag === 'H1')?.text || currentKeyword}
          masterStrategy={masterStrategy}
          onClose={() => setShowArticleGenerator(false)}
        />
      )}
    </div>
  );
};

export default App;