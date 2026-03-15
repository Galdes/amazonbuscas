import React, { useState } from 'react';
import { ProductSearchResult } from '../types';

interface ProductResultCardProps {
  data: ProductSearchResult;
  index: number;
  isSelected: boolean;
  onToggle: () => void;
}

const ProductResultCard: React.FC<ProductResultCardProps> = ({ data, index, isSelected, onToggle }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getSafeUrl = (url: string) => {
    if (!url) return '#';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
  };

  const safeUrl = getSafeUrl(data.url);

  return (
    <div
      className={`
        rounded-xl shadow-sm border overflow-hidden transition-all duration-300 relative
        ${isSelected
          ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50/10'
          : 'border-slate-200 bg-white hover:shadow-md hover:border-indigo-200'
        }
      `}
    >
      {/* Header Section */}
      <div className="p-4 border-b border-slate-100/50">
        <div className="flex items-start gap-4">
          {/* Checkbox Area */}
          <div className="pt-1 relative z-10">
            <label className="flex items-center cursor-pointer relative">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={onToggle}
                className="sr-only peer"
              />
              <div className="w-6 h-6 bg-white border-2 border-slate-300 rounded-md peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all flex items-center justify-center shadow-sm">
                <svg className="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </label>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                {data.domain}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                {data.products.length} produtos
              </span>
              {data.faqs.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                  {data.faqs.length} FAQs
                </span>
              )}
            </div>

            <h3 className="text-lg font-bold text-slate-900 leading-tight hover:text-indigo-600 transition-colors line-clamp-2 mb-2">
              <a href={safeUrl} target="_blank" rel="noopener noreferrer" title={data.title} className="relative z-10">
                {data.title}
              </a>
            </h3>

            <div className="flex items-center gap-3 mt-3">
              <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md transition-colors shadow-sm relative z-10"
              >
                Visitar Artigo
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>

              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs font-medium text-slate-600 hover:text-indigo-600 flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors relative z-10"
              >
                {isExpanded ? 'Ocultar Detalhes' : `Ver Detalhes (${data.products.length} produtos)`}
                <svg
                  className={`w-3 h-3 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Section - Produtos e FAQs */}
      {isExpanded && (
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 animate-fade-in space-y-4">
          {/* Produtos */}
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Produtos Encontrados ({data.products.length})
            </h4>
            {data.products.length > 0 ? (
              <div className="space-y-1.5">
                {data.products.map((product, idx) => (
                  <div key={idx} className="flex items-center gap-2 pl-2">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    <span className="text-sm text-slate-700">{product.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic pl-2">Nenhum produto encontrado neste artigo.</p>
            )}
          </div>

          {/* FAQs */}
          {data.faqs.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Perguntas Frequentes ({data.faqs.length})
              </h4>
              <div className="space-y-3">
                {data.faqs.map((faq, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200">
                    <p className="text-sm font-semibold text-slate-800 mb-1">{faq.pergunta}</p>
                    <p className="text-xs text-slate-600">{faq.resposta}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductResultCard;
