import React from 'react';

interface ModeTabsProps {
  currentMode: 'outlines' | 'products';
  onModeChange: (mode: 'outlines' | 'products') => void;
  showManualToggle?: boolean;
}

export const ModeTabs: React.FC<ModeTabsProps> = ({ currentMode, onModeChange, showManualToggle = true }) => {
  return (
    <div className="flex justify-center gap-4 mb-6">
      <button
        onClick={() => onModeChange('outlines')}
        className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
          currentMode === 'outlines'
            ? 'bg-indigo-600 text-white shadow-md'
            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
        }`}
      >
        <span className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Outlines
        </span>
      </button>
      <button
        onClick={() => onModeChange('products')}
        className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
          currentMode === 'products'
            ? 'bg-indigo-600 text-white shadow-md'
            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
        }`}
      >
        <span className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          Produtos
        </span>
      </button>
    </div>
  );
};
