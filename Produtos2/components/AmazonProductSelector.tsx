import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { searchAmazonProducts } from '../services/amazonClient';

interface AmazonProduct {
  asin: string;
  title: string;
  price?: string;
  currency?: string;
  imageUrl?: string;
  detailPageURL: string;
  affiliateURL?: string;
  brand?: string;
  starRating?: number;
  totalReviews?: number;
}

interface AmazonProductSelectorProps {
  products: Product[];
  associateTag: string;
  onConfirm: (selectedProducts: Map<string, AmazonProduct>) => void;
  onCancel: () => void;
}

export const AmazonProductSelector: React.FC<AmazonProductSelectorProps> = ({
  products,
  associateTag,
  onConfirm,
  onCancel
}) => {
  const [selectedProducts, setSelectedProducts] = useState<Map<string, AmazonProduct>>(new Map());
  const [searchResults, setSearchResults] = useState<Map<string, AmazonProduct[]>>(new Map());
  const [loading, setLoading] = useState<Map<string, boolean>>(new Map());
  const [searchErrors, setSearchErrors] = useState<Map<string, string>>(new Map());

  // Buscar produtos na Amazon para cada produto da lista
  useEffect(() => {
    const searchAllProducts = async () => {
      for (const product of products) {
        if (searchResults.has(product.name)) continue; // Já buscou
        
        setLoading(prev => new Map(prev).set(product.name, true));
        setSearchErrors(prev => new Map(prev).set(product.name, ''));
        
        try {
          const result = await searchAmazonProducts(product.name, associateTag, 5);
          setSearchResults(prev => new Map(prev).set(product.name, result.products));
          
          // Auto-selecionar o primeiro resultado se houver apenas um
          if (result.products.length === 1) {
            setSelectedProducts(prev => new Map(prev).set(product.name, result.products[0]));
          }
        } catch (error: any) {
          console.error(`[Selector] Erro ao buscar "${product.name}":`, error);
          setSearchErrors(prev => new Map(prev).set(product.name, error.message || 'Erro ao buscar produto'));
        } finally {
          setLoading(prev => {
            const newMap = new Map(prev);
            newMap.delete(product.name);
            return newMap;
          });
        }
        
        // Delay maior entre buscas para evitar rate limiting (1 segundo)
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    };

    if (products.length > 0 && associateTag) {
      searchAllProducts();
    }
  }, [products, associateTag]);

  const handleSelectProduct = (productName: string, amazonProduct: AmazonProduct) => {
    setSelectedProducts(prev => new Map(prev).set(productName, amazonProduct));
  };

  const handleSearchAgain = async (productName: string) => {
    setLoading(prev => new Map(prev).set(productName, true));
    setSearchErrors(prev => new Map(prev).set(productName, ''));
    
    try {
      const result = await searchAmazonProducts(productName, associateTag, 5);
      setSearchResults(prev => new Map(prev).set(productName, result.products));
    } catch (error: any) {
      setSearchErrors(prev => new Map(prev).set(productName, error.message || 'Erro ao buscar produto'));
    } finally {
      setLoading(prev => {
        const newMap = new Map(prev);
        newMap.delete(productName);
        return newMap;
      });
    }
  };

  // Permitir confirmar mesmo sem selecionar todos os produtos.
  // Apenas exigimos pelo menos 1 produto selecionado; os demais serão gerados sem link da Amazon.
  const canConfirm = selectedProducts.size > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Selecionar Produtos na Amazon
          </h2>
          <p className="text-indigo-100 mt-2 text-sm">
            Selecione o produto correto da Amazon para cada item da sua lista ({selectedProducts.size}/{products.length} selecionados).
            Você pode confirmar mesmo sem selecionar todos — os itens sem seleção serão gerados sem link da Amazon.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {products.map((product, index) => {
            const results = searchResults.get(product.name) || [];
            const selected = selectedProducts.get(product.name);
            const isLoading = loading.get(product.name);
            const error = searchErrors.get(product.name);

            return (
              <div key={index} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800 mb-1">
                      {index + 1}. {product.name}
                    </h3>
                    {selected && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-700 font-medium">✓ Produto selecionado</p>
                        <p className="text-xs text-green-600 mt-1">{selected.title}</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleSearchAgain(product.name)}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {isLoading ? 'Buscando...' : 'Buscar Novamente'}
                  </button>
                </div>

                {isLoading && (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <p className="text-sm text-slate-500 mt-2">Buscando produtos na Amazon...</p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-red-700">Erro: {error}</p>
                    <p className="text-xs text-red-600 mt-1">Tente buscar novamente ou pule este produto</p>
                  </div>
                )}

                {!isLoading && results.length > 0 && (
                  <div className="space-y-3">
                    {results.map((amazonProduct, idx) => (
                      <div
                        key={amazonProduct.asin}
                        onClick={() => handleSelectProduct(product.name, amazonProduct)}
                        className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
                          selected?.asin === amazonProduct.asin
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                        }`}
                      >
                        <div className="flex gap-4">
                          {amazonProduct.imageUrl && (
                            <img
                              src={amazonProduct.imageUrl}
                              alt={amazonProduct.title}
                              className="w-20 h-20 object-contain rounded border border-slate-200"
                            />
                          )}
                          <div className="flex-1">
                            <h4 className="font-medium text-slate-800 text-sm mb-1 line-clamp-2">
                              {amazonProduct.title}
                            </h4>
                            <div className="flex items-center gap-4 text-xs text-slate-600 mt-2">
                              {amazonProduct.brand && (
                                <span className="font-medium">Marca: {amazonProduct.brand}</span>
                              )}
                              {amazonProduct.price && (
                                <span className="font-bold text-green-600">{amazonProduct.price}</span>
                              )}
                              {amazonProduct.starRating && (
                                <span className="flex items-center gap-1">
                                  ⭐ {amazonProduct.starRating}
                                  {amazonProduct.totalReviews && ` (${amazonProduct.totalReviews})`}
                                </span>
                              )}
                            </div>
                            {selected?.asin === amazonProduct.asin && (
                              <div className="mt-2 text-xs text-indigo-600 font-medium">✓ Selecionado</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!isLoading && results.length === 0 && !error && (
                  <div className="text-center py-4 text-slate-500 text-sm">
                    Nenhum produto encontrado. Tente buscar novamente com um termo diferente.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-6 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(selectedProducts)}
            disabled={!canConfirm}
            className={`px-6 py-2 rounded-lg font-bold transition-all ${
              canConfirm
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:scale-105'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            Confirmar e Gerar Artigo ({selectedProducts.size}/{products.length} selecionados)
          </button>
        </div>
      </div>
    </div>
  );
};
