import React, { useState } from 'react';

interface SearchInputProps {
  onSearch: (keyword: string) => void;
  isLoading: boolean;
}

const SearchInput: React.FC<SearchInputProps> = ({ onSearch, isLoading }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onSearch(query);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="relative group z-10">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative flex items-center bg-white rounded-xl shadow-lg p-2">
          <div className="pl-4 text-slate-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite sua palavra-chave para extrair outlines (ex: Marketing Digital)"
            className="flex-1 px-4 py-3 text-slate-700 bg-transparent border-none focus:ring-0 focus:outline-none placeholder-slate-400 text-lg"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className={`px-6 py-3 rounded-lg font-semibold text-white transition-all duration-200 flex items-center gap-2
              ${isLoading || !query.trim() 
                ? 'bg-slate-300 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg transform active:scale-95'
              }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Buscando...
              </>
            ) : (
              'Analisar'
            )}
          </button>
        </div>
      </form>
      <div className="mt-3 text-center">
        <p className="text-xs text-slate-400 font-medium">
          Powered by Gemini Grounding & Google Search
        </p>
      </div>
    </div>
  );
};

export default SearchInput;
