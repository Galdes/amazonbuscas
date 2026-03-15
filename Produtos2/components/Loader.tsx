import React from 'react';

export const Loader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="relative w-16 h-16">
        <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-200 rounded-full opacity-50"></div>
        <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
      </div>
      <p className="text-indigo-600 font-medium animate-pulse">Analisando resultados do Google...</p>
    </div>
  );
};
