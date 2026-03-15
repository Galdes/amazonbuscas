import React, { useState } from 'react';
import { SearchResult } from '../types';

interface ResultCardProps {
  data: SearchResult;
  index: number;
  isSelected: boolean;
  onToggle: () => void;
  onAddOutlineItem?: (item: { tag: string; text: string }) => void;
}

const ResultCard: React.FC<ResultCardProps> = ({ data, index, isSelected, onToggle, onAddOutlineItem }) => {
  const [isExpanded, setIsExpanded] = useState(false); // Default collapsed to save space

  const getIndent = (tag: string) => {
    switch (tag) {
      case 'H1': return 'ml-0';
      case 'H2': return 'ml-4 md:ml-6';
      case 'H3': return 'ml-8 md:ml-12';
      default: return 'ml-4';
    }
  };

  const getBadgeColor = (tag: string) => {
    switch (tag) {
      case 'H1': return 'bg-indigo-100 text-indigo-800';
      case 'H2': return 'bg-sky-100 text-sky-800';
      case 'H3': return 'bg-slate-100 text-slate-600';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper function to ensure URL is absolute and valid
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
                {isExpanded ? 'Ocultar Outline' : `Ver Outline (${data.outline.length})`}
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

      {/* Outline Section */}
      {isExpanded && (
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 animate-fade-in">
          <div className="space-y-1.5">
            {data.outline.map((item, idx) => (
              <div key={idx} className={`group flex items-baseline gap-2 ${getIndent(item.tag)}`}>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide min-w-[24px] text-center select-none ${getBadgeColor(item.tag)}`}>
                  {item.tag}
                </span>
                <span className={`text-sm ${item.tag === 'H1' ? 'font-bold text-slate-800' : 'text-slate-600'}`}>
                  {item.text}
                </span>
                {onAddOutlineItem && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddOutlineItem(item);
                    }}
                    title="Adicionar à minha estrutura"
                    className="ml-2 p-0.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </button>
                )}
              </div>
            ))}
            {data.outline.length === 0 && (
              <p className="text-sm text-slate-400 italic pl-2">Nenhuma estrutura de outline detectada neste resultado.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultCard;