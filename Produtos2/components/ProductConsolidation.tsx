import React, { useState } from 'react';
import { ProductConsolidation, Product } from '../types';

interface SnippetSuggestions {
  titles: string[];
  metaDescriptions: string[];
}

interface ProductConsolidationProps {
  consolidation: ProductConsolidation;
  keyword?: string;
  competitorTitles?: string[];
  onGenerateArticle?: (products: Product[], title: string) => void;
  onGenerateWithAmazon?: (products: Product[], title: string, tag: string) => void;
  onCopyLinksAndFAQs?: (products: Product[], faqs: any[], title: string) => void;
  articleTitle?: string;
  associateTag?: string;
}

export const ProductConsolidationComponent: React.FC<ProductConsolidationProps> = ({ 
  consolidation, 
  keyword = '',
  competitorTitles = [],
  onGenerateArticle,
  onGenerateWithAmazon,
  onCopyLinksAndFAQs,
  articleTitle,
  associateTag
}) => {
  // Estado para gerenciamento manual de produtos
  const [manuallyAddedProducts, setManuallyAddedProducts] = useState<Product[]>([]);
  const [manuallyRemovedProducts, setManuallyRemovedProducts] = useState<Set<string>>(new Set());
  const [selectedRepeatedProducts, setSelectedRepeatedProducts] = useState<Set<string>>(new Set());
  const [showRepeatedProducts, setShowRepeatedProducts] = useState(false);
  // Sugestões de título e meta description (com base nos H1 dos concorrentes)
  const [snippetSuggestions, setSnippetSuggestions] = useState<SnippetSuggestions | null>(null);
  const [snippetLoading, setSnippetLoading] = useState(false);
  const [snippetError, setSnippetError] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Lista copiada para a área de transferência!');
  };

  // Calcular lista final de produtos (base + adicionados automaticamente + adicionados manualmente - removidos)
  const getFinalProducts = (): Product[] => {
    const allProducts = [
      ...consolidation.baseProducts,
      ...consolidation.addedProducts,
      ...manuallyAddedProducts
    ];
    
    // Remover produtos que foram removidos manualmente
    return allProducts.filter(p => !manuallyRemovedProducts.has(p.name.toLowerCase().trim()));
  };

  const finalProducts = getFinalProducts();
  const finalCount = finalProducts.length;
  const currentPercentage = consolidation.baseCount > 0 
    ? Math.round(((finalCount - consolidation.baseCount) / consolidation.baseCount) * 100)
    : 0;

  // Produtos repetidos disponíveis (não incluídos e não removidos manualmente)
  const availableRepeated = (consolidation.availableRepeatedProducts || []).filter(rp => 
    !manuallyRemovedProducts.has(rp.name.toLowerCase().trim()) &&
    !finalProducts.some(p => p.name.toLowerCase().trim() === rp.name.toLowerCase().trim())
  );

  const handleAddSelectedRepeated = () => {
    const productsToAdd = availableRepeated
      .filter(rp => selectedRepeatedProducts.has(rp.name))
      .map(rp => ({ name: rp.name }));
    
    setManuallyAddedProducts(prev => [...prev, ...productsToAdd]);
    setSelectedRepeatedProducts(new Set());
  };

  const handleRemoveProduct = (productName: string) => {
    setManuallyRemovedProducts(prev => new Set(prev).add(productName.toLowerCase().trim()));
    // Se estava nos adicionados manualmente, remover de lá também
    setManuallyAddedProducts(prev => prev.filter(p => p.name.toLowerCase().trim() !== productName.toLowerCase().trim()));
  };

  const handleRestoreProduct = (productName: string) => {
    setManuallyRemovedProducts(prev => {
      const newSet = new Set(prev);
      newSet.delete(productName.toLowerCase().trim());
      return newSet;
    });
  };

  const handleGenerateSnippetSuggestions = async () => {
    if (competitorTitles.length === 0) {
      setSnippetError('Não há títulos de concorrentes para basear as sugestões.');
      return;
    }
    setSnippetLoading(true);
    setSnippetError(null);
    setSnippetSuggestions(null);
    try {
      const systemInstruction = `Você é um especialista em SEO. Responda APENAS com um único objeto JSON válido, sem texto antes ou depois, no formato: {"titles": ["string","string",...], "metaDescriptions": ["string","string",...]}.`;
      const prompt = `Com base nos títulos H1 dos concorrentes listados abaixo, sugira 3 títulos e 3 meta descriptions para um artigo sobre o tema "${keyword}".

Títulos dos concorrentes (H1):
${competitorTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

REGRAS:
- Títulos: no máximo 60 caracteres cada; coloque a palavra-chave principal no início quando fizer sentido; use números quando for natural (ex.: "Top 10...", "7 Melhores...").
- Meta descriptions: no máximo 155 caracteres cada; texto persuasivo; inclua uma CTA clara como "Saiba mais", "Confira", "Descubra" ou "Veja"; use números quando relevante.

Retorne somente o JSON com as chaves "titles" (array de 3 strings) e "metaDescriptions" (array de 3 strings).`;
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, systemInstruction }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Falha ao gerar sugestões.');
      }
      const data = (await res.json()) as { text?: string };
      let raw = (data.text ?? '').trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) raw = jsonMatch[0];
      const parsed = JSON.parse(raw) as SnippetSuggestions;
      if (!Array.isArray(parsed.titles) || !Array.isArray(parsed.metaDescriptions)) {
        throw new Error('Resposta da IA em formato inesperado.');
      }
      setSnippetSuggestions({
        titles: parsed.titles.slice(0, 3).map(String),
        metaDescriptions: parsed.metaDescriptions.slice(0, 3).map(String),
      });
    } catch (e) {
      setSnippetError(e instanceof Error ? e.message : 'Erro ao gerar sugestões.');
    } finally {
      setSnippetLoading(false);
    }
  };

  const productsText = finalProducts.map(p => p.name).join('\n');
  const faqsText = consolidation.faqs.map(faq => `${faq.pergunta}\n${faq.resposta}`).join('\n\n');

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Lista Consolidada de Produtos
            </h2>
            <p className="text-green-100 mt-1 text-sm">
              Base: {consolidation.baseCount} produtos + {finalCount - consolidation.baseCount} adicionados ({currentPercentage}%)
            </p>
          </div>
          <div className="flex gap-2 text-center">
            <div className="bg-white/20 rounded-lg p-2 backdrop-blur-sm min-w-[80px]">
              <span className="block text-[10px] text-green-100 uppercase tracking-wider">Base</span>
              <span className="block text-xl font-bold">{consolidation.baseCount}</span>
            </div>
            <div className="bg-white/20 rounded-lg p-2 backdrop-blur-sm min-w-[80px]">
              <span className="block text-[10px] text-green-100 uppercase tracking-wider">Adicionados</span>
              <span className="block text-xl font-bold">{consolidation.addedCount}</span>
            </div>
            <div className="bg-white text-green-700 rounded-lg p-2 shadow-sm min-w-[80px]">
              <span className="block text-[10px] text-green-800 font-bold uppercase tracking-wider">Total</span>
              <span className="block text-xl font-extrabold">{consolidation.totalCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Sugestões de título e meta description */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2">
            <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-bold">SEO</span>
            Sugestões de título e meta description
          </h3>
          <p className="text-sm text-slate-600 mb-3">
            Baseado nos títulos H1 dos {competitorTitles.length} artigo(s) concorrente(s) selecionado(s). Título ideal &le; 60 caracteres; meta description &le; 155 caracteres.
          </p>
          <button
            type="button"
            onClick={handleGenerateSnippetSuggestions}
            disabled={snippetLoading || competitorTitles.length === 0}
            className="py-2 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
          >
            {snippetLoading ? 'Gerando…' : 'Gerar sugestões'}
          </button>
          {snippetError && <p className="mt-2 text-sm text-red-600">{snippetError}</p>}
          {snippetSuggestions && (
            <div className="mt-4 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Títulos</h4>
                <ul className="space-y-2">
                  {snippetSuggestions.titles.map((t, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-slate-500 text-xs shrink-0 w-6">{t.length}/60</span>
                      <span className="text-slate-800 text-sm flex-1">{t}</span>
                      <button type="button" onClick={() => copyToClipboard(t)} className="text-amber-600 hover:text-amber-700 text-xs font-medium shrink-0">Copiar</button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Meta descriptions</h4>
                <ul className="space-y-2">
                  {snippetSuggestions.metaDescriptions.map((m, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-slate-500 text-xs shrink-0 w-8">{m.length}/155</span>
                      <span className="text-slate-800 text-sm flex-1">{m}</span>
                      <button type="button" onClick={() => copyToClipboard(m)} className="text-amber-600 hover:text-amber-700 text-xs font-medium shrink-0">Copiar</button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Produtos Base */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">BASE</span>
              Produtos do 1º Artigo ({consolidation.baseCount})
            </h3>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            {consolidation.baseProducts.length > 0 ? (
              <div className="space-y-2">
                {consolidation.baseProducts.map((product, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="text-sm text-slate-700 font-medium">{product.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Nenhum produto na base.</p>
            )}
          </div>
        </div>

        {/* Produtos Adicionados Automaticamente */}
        {consolidation.addedProducts.filter(p => !manuallyRemovedProducts.has(p.name.toLowerCase().trim())).length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">AUTO</span>
                Produtos Adicionados Automaticamente ({consolidation.addedProducts.filter(p => !manuallyRemovedProducts.has(p.name.toLowerCase().trim())).length})
              </h3>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
              <div className="space-y-2">
                {consolidation.addedProducts
                  .filter(p => !manuallyRemovedProducts.has(p.name.toLowerCase().trim()))
                  .map((product, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 group">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        <span className="text-sm text-slate-700 font-medium">{product.name}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveProduct(product.name)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:bg-red-50 rounded transition-all"
                        title="Remover produto"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Produtos Adicionados Manualmente */}
        {manuallyAddedProducts.filter(p => !manuallyRemovedProducts.has(p.name.toLowerCase().trim())).length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold">MANUAL</span>
                Produtos Adicionados Manualmente ({manuallyAddedProducts.filter(p => !manuallyRemovedProducts.has(p.name.toLowerCase().trim())).length})
              </h3>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
              <div className="space-y-2">
                {manuallyAddedProducts
                  .filter(p => !manuallyRemovedProducts.has(p.name.toLowerCase().trim()))
                  .map((product, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 group">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                        <span className="text-sm text-slate-700 font-medium">{product.name}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveProduct(product.name)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:bg-red-50 rounded transition-all"
                        title="Remover produto"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Produtos Repetidos Disponíveis */}
        {availableRepeated.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold">DISPONÍVEIS</span>
                Produtos Repetidos Não Incluídos ({availableRepeated.length})
              </h3>
              <button
                onClick={() => setShowRepeatedProducts(!showRepeatedProducts)}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
              >
                {showRepeatedProducts ? 'Ocultar' : 'Mostrar'}
                <svg className={`w-4 h-4 transform transition-transform ${showRepeatedProducts ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {showRepeatedProducts && (
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                <div className="space-y-2 mb-4">
                  {availableRepeated.map((rp, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-amber-200">
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedRepeatedProducts.has(rp.name)}
                          onChange={(e) => {
                            const newSet = new Set(selectedRepeatedProducts);
                            if (e.target.checked) {
                              newSet.add(rp.name);
                            } else {
                              newSet.delete(rp.name);
                            }
                            setSelectedRepeatedProducts(newSet);
                          }}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm text-slate-700 font-medium">{rp.name}</span>
                          <span className="text-xs text-slate-500 ml-2">
                            (aparece em {rp.frequency} artigo{rp.frequency > 1 ? 's' : ''})
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {selectedRepeatedProducts.size > 0 && (
                  <button
                    onClick={handleAddSelectedRepeated}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Adicionar {selectedRepeatedProducts.size} Produto(s) Selecionado(s)
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Produtos Removidos (com opção de restaurar) */}
        {manuallyRemovedProducts.size > 0 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">REMOVIDOS</span>
                Produtos Removidos ({manuallyRemovedProducts.size})
              </h3>
            </div>
            <div className="bg-red-50 p-4 rounded-xl border border-red-200">
              <div className="space-y-2">
                {Array.from(manuallyRemovedProducts).map((productName, idx) => {
                  const originalProduct = [...consolidation.baseProducts, ...consolidation.addedProducts, ...manuallyAddedProducts]
                    .find(p => p.name.toLowerCase().trim() === productName);
                  if (!originalProduct) return null;
                  
                  return (
                    <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-red-200">
                      <span className="text-sm text-slate-600 line-through">{originalProduct.name}</span>
                      <button
                        onClick={() => handleRestoreProduct(originalProduct.name)}
                        className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Restaurar
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Lista Total Consolidada */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800">Lista Total ({finalCount} produtos)</h3>
            <button
              onClick={() => copyToClipboard(productsText)}
              className="flex items-center gap-1 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copiar Lista
            </button>
          </div>
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-xl border border-indigo-100">
            <div className="space-y-2">
              {finalProducts.map((product, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-indigo-600 font-bold text-xs w-6 text-right">{idx + 1}.</span>
                  <span className="text-sm text-slate-800 font-medium">{product.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQs Consolidadas */}
        {consolidation.faqs.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Perguntas Frequentes ({consolidation.faqs.length})
              </h3>
              <button
                onClick={() => copyToClipboard(faqsText)}
                className="flex items-center gap-1 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg transition-colors font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copiar FAQs
              </button>
            </div>
            <div className="space-y-3">
              {consolidation.faqs.map((faq, idx) => (
                <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="text-sm font-semibold text-slate-800 mb-2">{faq.pergunta}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{faq.resposta}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botões para Gerar Artigo */}
        {(onGenerateArticle || onGenerateWithAmazon) && (
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-xl border border-indigo-100">
              <div className="mb-3">
                <h4 className="text-sm font-bold text-indigo-900">Pronto para escrever?</h4>
                <p className="text-xs text-indigo-600 mt-0.5">Gere o artigo completo com {finalCount} produtos, imagens, prós/contras e botões de afiliado.</p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  {onGenerateWithAmazon && (
                    <button
                      onClick={() => {
                        const tag = associateTag || (localStorage.getItem('amazon_associate_tags') ? JSON.parse(localStorage.getItem('amazon_associate_tags')!)[0] : '');
                        if (!tag) {
                          alert('Configure uma Associate Tag primeiro! Vá em "Gerar Artigo" e configure a tag no dropdown.');
                          return;
                        }
                        onGenerateWithAmazon(finalProducts, articleTitle || 'Melhores Produtos', tag);
                      }}
                      className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-md transition-all hover:scale-105 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Selecionar Produtos na Amazon
                    </button>
                  )}
                  {onGenerateArticle && (
                    <button
                      onClick={() => onGenerateArticle(finalProducts, articleTitle || 'Melhores Produtos')}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-bold text-sm shadow-md transition-all hover:scale-105 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Gerar Sem Amazon
                    </button>
                  )}
                </div>
                {onCopyLinksAndFAQs && (
                  <button
                    onClick={() => onCopyLinksAndFAQs(finalProducts, consolidation.faqs, articleTitle || 'Melhores Produtos')}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm shadow-md transition-all hover:scale-105 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copiar Links e FAQs (Sem Gerar Artigo)
                  </button>
                )}
              </div>
              {!associateTag && onGenerateWithAmazon && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Configure uma Associate Tag no modal de geração de artigo para usar esta opção.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
