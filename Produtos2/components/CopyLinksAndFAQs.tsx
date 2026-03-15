import React, { useState } from 'react';
import { Product, FAQItem } from '../types';
import { AmazonProduct } from '../services/amazonClient';

interface CopyLinksAndFAQsProps {
  products: Product[];
  faqs: FAQItem[];
  selectedAmazonProducts: Map<string, AmazonProduct>;
  associateTag: string;
  title: string;
  onClose: () => void;
}

export const CopyLinksAndFAQs: React.FC<CopyLinksAndFAQsProps> = ({
  products,
  faqs,
  selectedAmazonProducts,
  associateTag,
  title,
  onClose
}) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Formatar links da Amazon
  const formatAmazonLinks = (): string => {
    if (selectedAmazonProducts.size === 0) {
      return 'Nenhum produto selecionado na Amazon. Selecione os produtos primeiro.';
    }

    let linksText = `Links da Amazon - ${title}\n\n`;
    
    products.forEach((product, index) => {
      const amazonProduct = selectedAmazonProducts.get(product.name);
      if (amazonProduct) {
        linksText += `${index + 1}. ${product.name}\n`;
        linksText += `   Link: ${amazonProduct.affiliateURL || amazonProduct.detailPageURL}\n`;
        if (amazonProduct.price) {
          linksText += `   Preço: ${amazonProduct.price}\n`;
        }
        if (amazonProduct.brand) {
          linksText += `   Marca: ${amazonProduct.brand}\n`;
        }
        linksText += '\n';
      } else {
        linksText += `${index + 1}. ${product.name}\n`;
        linksText += `   (Produto não encontrado na Amazon)\n\n`;
      }
    });

    return linksText;
  };

  // Formatar apenas URLs puras (sem ID de afiliado) - uma por linha
  const formatAmazonURLs = (): string => {
    if (selectedAmazonProducts.size === 0) {
      return '';
    }

    return products
      .map(product => {
        const amazonProduct = selectedAmazonProducts.get(product.name);
        // Usar apenas detailPageURL (URL pura da API) sem ID de afiliado
        return amazonProduct?.detailPageURL || '';
      })
      .filter(url => url.length > 0)
      .join('\n');
  };

  // Formatar FAQs - apenas perguntas (outlines) sem respostas
  const formatFAQs = (): string => {
    if (faqs.length === 0) {
      return 'Nenhuma FAQ disponível.';
    }

    // Retornar apenas as perguntas (outlines), uma por linha
    return faqs.map((faq) => faq.pergunta).join('\n');
  };

  // Formatar tudo junto
  const formatAll = (): string => {
    let allText = `=== ${title} ===\n\n`;
    allText += 'LINKS DA AMAZON:\n';
    allText += formatAmazonLinks();
    allText += '\n\n=== PERGUNTAS FREQUENTES ===\n\n';
    allText += formatFAQs();
    return allText;
  };

  const amazonLinksText = formatAmazonLinks();
  const amazonURLsText = formatAmazonURLs();
  const faqsText = formatFAQs();
  const allText = formatAll();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            Copiar Links e FAQs
          </h2>
          <p className="text-green-100 mt-2 text-sm">
            {products.length} produtos • {faqs.length} FAQs • {selectedAmazonProducts.size} links da Amazon
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Links da Amazon */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Links da Amazon
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(amazonURLsText, 'urls')}
                  disabled={selectedAmazonProducts.size === 0}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors flex items-center gap-1 ${
                    selectedAmazonProducts.size === 0
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                  }`}
                >
                  {copiedSection === 'urls' ? '✓ Copiado!' : 'Copiar URLs'}
                </button>
                <button
                  onClick={() => copyToClipboard(amazonLinksText, 'links')}
                  disabled={selectedAmazonProducts.size === 0}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors flex items-center gap-1 ${
                    selectedAmazonProducts.size === 0
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                  }`}
                >
                  {copiedSection === 'links' ? '✓ Copiado!' : 'Copiar Links Completos'}
                </button>
              </div>
            </div>
            {selectedAmazonProducts.size === 0 ? (
              <p className="text-sm text-slate-500 italic">
                Nenhum produto selecionado na Amazon. Selecione os produtos primeiro usando "Selecionar Produtos na Amazon".
              </p>
            ) : (
              <div className="bg-white p-4 rounded-lg border border-slate-200 max-h-60 overflow-y-auto">
                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono">
                  {amazonLinksText}
                </pre>
              </div>
            )}
          </div>

          {/* FAQs */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Perguntas Frequentes ({faqs.length})
              </h3>
              <button
                onClick={() => copyToClipboard(faqsText, 'faqs')}
                disabled={faqs.length === 0}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors flex items-center gap-1 ${
                  faqs.length === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
                }`}
              >
                {copiedSection === 'faqs' ? '✓ Copiado!' : 'Copiar FAQs'}
              </button>
            </div>
            {faqs.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Nenhuma FAQ disponível.</p>
            ) : (
              <div className="bg-white p-4 rounded-lg border border-slate-200 max-h-60 overflow-y-auto">
                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono">
                  {faqs.map((faq) => faq.pergunta).join('\n')}
                </pre>
              </div>
            )}
          </div>

          {/* Copiar Tudo */}
          <div className="border-2 border-indigo-200 rounded-xl p-4 bg-indigo-50">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-indigo-900">Copiar Tudo Junto</h3>
                <p className="text-sm text-indigo-600 mt-1">Links da Amazon + FAQs em um único texto</p>
              </div>
              <button
                onClick={() => copyToClipboard(allText, 'all')}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-md transition-all hover:scale-105 flex items-center gap-2"
              >
                {copiedSection === 'all' ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copiado!
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copiar Tudo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-6 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
