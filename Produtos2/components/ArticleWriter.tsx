import React, { useState, useEffect, useRef } from 'react';
import { generateFullArticle } from '../services/gemini';
import { MasterStrategy } from '../types';

interface ArticleWriterProps {
    title: string;
    masterStrategy: MasterStrategy;
    onClose: () => void;
}

export const ArticleWriter: React.FC<ArticleWriterProps> = ({ title, masterStrategy, onClose }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [status, setStatus] = useState('Pronto para iniciar');
    const [articleHtml, setArticleHtml] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [hasStarted, setHasStarted] = useState(false);
    const [enableSeoReview, setEnableSeoReview] = useState(false); // OTIMIZAÇÃO: Revisão SEO desabilitada por padrão
    const [associateTag, setAssociateTag] = useState<string>(''); // Associate Tag selecionada
    const [availableTags, setAvailableTags] = useState<string[]>([]); // Tags disponíveis

    const contentRef = useRef<HTMLDivElement>(null);

    // Carregar Associate Tags disponíveis do localStorage ou env
    useEffect(() => {
        // Tentar carregar do localStorage primeiro
        const savedTags = localStorage.getItem('amazon_associate_tags');
        if (savedTags) {
            const tags = JSON.parse(savedTags);
            setAvailableTags(tags);
            if (tags.length > 0 && !associateTag) {
                setAssociateTag(tags[0]); // Selecionar primeira tag por padrão
            }
        } else {
            // Se não tiver no localStorage, tentar do env (se disponível no frontend)
            // Por padrão, deixar vazio e usuário pode adicionar
            setAvailableTags([]);
        }
    }, []);

    // Não iniciar automaticamente - aguardar confirmação do usuário
    // useEffect removido para permitir configuração antes de gerar

    const handleGenerate = async () => {
        setHasStarted(true);
        setIsGenerating(true);
        setError(null);
        setArticleHtml('');
        setStatus('Iniciando geração...');

        try {
            // Convert outline array to string format expected by the service
            const outlinesText = masterStrategy.masterOutline
                .map(item => `${item.tag}: ${item.text}`)
                .join('\n');

            // Extrair produtos e FAQs do masterStrategy (se foram armazenados)
            let products: Array<{ name: string }> | undefined = undefined;
            let faqs: Array<{ pergunta: string; resposta: string }> | undefined = undefined;
            
            // Verificar se produtos/FAQs foram armazenados diretamente no masterStrategy
            const selectedAmazonProducts = (masterStrategy as any).selectedAmazonProducts;
            if ((masterStrategy as any).products) {
                products = (masterStrategy as any).products;
                faqs = (masterStrategy as any).faqs;
                console.log('[ArticleWriter] Produtos e FAQs do modo produtos:', products.length, faqs?.length || 0);
                if (selectedAmazonProducts && selectedAmazonProducts.size > 0) {
                    console.log('[ArticleWriter] Usando produtos pré-selecionados da Amazon:', selectedAmazonProducts.size);
                }
            } else {
                // Fallback: extrair produtos dos H2 (modo outlines)
                products = masterStrategy.masterOutline
                    .filter(item => item.tag === 'H2')
                    .map(item => ({ name: item.text }))
                    .filter(p => {
                        // Filtrar títulos genéricos que não são produtos
                        const genericTitles = ['introdução', 'conclusão', 'tabela', 'comparação', 'análise', 'melhores', 'top'];
                        const lowerName = p.name.toLowerCase();
                        return !genericTitles.some(g => lowerName.includes(g) && lowerName.length < 50);
                    });
                console.log('[ArticleWriter] Produtos extraídos dos H2:', products.map(p => p.name));
            }

            const articleOptions: any = {
                enableSeoReview: enableSeoReview,
                sectionBatchSize: 4, // Gerar 4 seções por lote (otimização de custos)
                associateTag: associateTag || undefined, // Amazon Associate Tag (opcional)
                products: products && products.length > 0 ? products : undefined, // Produtos para buscar na Amazon
                faqs: faqs && faqs.length > 0 ? faqs : undefined // FAQs para incluir no artigo
            };
            
            // Se houver produtos pré-selecionados da Amazon, passar para o generateFullArticle
            if (selectedAmazonProducts && selectedAmazonProducts.size > 0) {
                articleOptions.selectedAmazonProducts = selectedAmazonProducts;
            }

            await generateFullArticle(
                title,
                outlinesText,
                "", // Product summary is optional/empty for now in this flow
                (update) => {
                    setStatus(update.status);
                    setArticleHtml(update.html);
                    // Auto-scroll to bottom of preview
                    if (contentRef.current) {
                        contentRef.current.scrollTop = contentRef.current.scrollHeight;
                    }
                },
                articleOptions
            );
            setStatus('Artigo gerado com sucesso!');
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Ocorreu um erro durante a geração.');
            setStatus('Erro na geração.');
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(articleHtml);
        alert('HTML copiado para a área de transferência!');
    };

    const downloadHtml = () => {
        const element = document.createElement("a");
        const file = new Blob([articleHtml], { type: 'text/html' });
        element.href = URL.createObjectURL(file);
        element.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-700 p-1.5 rounded-lg">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </span>
                            Redator IA
                        </h2>
                        <p className="text-sm text-slate-500 mt-0.5">Gerando artigo baseado na estratégia consolidada</p>
                        
                        {/* Configurações antes de gerar */}
                        {!isGenerating && !hasStarted && (
                            <div className="mt-3 space-y-3">
                                {/* Checkbox de Revisão SEO */}
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="seoReview"
                                        checked={enableSeoReview}
                                        onChange={(e) => setEnableSeoReview(e.target.checked)}
                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                    />
                                    <label htmlFor="seoReview" className="text-sm text-slate-700 cursor-pointer">
                                        <span className="font-medium">Revisar SEO</span>
                                        <span className="text-slate-500 ml-1">(aumenta qualidade, mas custa mais)</span>
                                    </label>
                                </div>

                                {/* Seleção de Associate Tag */}
                                <div>
                                    <label htmlFor="associateTag" className="block text-sm font-medium text-slate-700 mb-1">
                                        Amazon Associate Tag (opcional)
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            id="associateTag"
                                            value={associateTag}
                                            onChange={(e) => setAssociateTag(e.target.value)}
                                            placeholder="ex: seuusuario-20"
                                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                        />
                                        {associateTag && !availableTags.includes(associateTag) && (
                                            <button
                                                onClick={() => {
                                                    const newTags = [...availableTags, associateTag];
                                                    setAvailableTags(newTags);
                                                    localStorage.setItem('amazon_associate_tags', JSON.stringify(newTags));
                                                }}
                                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                                                title="Salvar tag para uso futuro"
                                            >
                                                Salvar
                                            </button>
                                        )}
                                    </div>
                                    {availableTags.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {availableTags.map((tag) => (
                                                <button
                                                    key={tag}
                                                    onClick={() => setAssociateTag(tag)}
                                                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                                                        associateTag === tag
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-xs text-slate-500 mt-1">
                                        {associateTag 
                                            ? '✓ Links de afiliados serão gerados automaticamente nos produtos' 
                                            : 'Deixe vazio para não gerar links de afiliados'}
                                    </p>
                                </div>

                                {/* Botão para iniciar geração */}
                                <button
                                    onClick={handleGenerate}
                                    className="w-full mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    Iniciar Geração do Artigo
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Status Badge */}
                        <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 ${error ? 'bg-red-100 text-red-700' :
                                isGenerating ? 'bg-blue-100 text-blue-700' :
                                    'bg-green-100 text-green-700'
                            }`}>
                            {isGenerating && (
                                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            )}
                            {status}
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                            title="Fechar"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex overflow-hidden">

                    {/* Preview Column */}
                    <div className="flex-1 flex flex-col border-r border-slate-200 bg-slate-50/50">
                        <div className="p-3 border-b border-slate-200 bg-white flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Preview (HTML Renderizado)</span>
                        </div>
                        <div
                            ref={contentRef}
                            className="flex-1 overflow-y-auto p-8 prose prose-indigo max-w-none bg-white"
                        >
                            {articleHtml ? (
                                <div dangerouslySetInnerHTML={{ __html: articleHtml }} />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
                                    <p>Aguardando conteúdo...</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Code Column (Hidden on small screens, visible on large) */}
                    <div className="hidden lg:flex w-1/3 flex-col bg-slate-900 text-slate-300">
                        <div className="p-3 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Código HTML</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={copyToClipboard}
                                    disabled={!articleHtml}
                                    className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded transition-colors disabled:opacity-50"
                                >
                                    Copiar
                                </button>
                                <button
                                    onClick={downloadHtml}
                                    disabled={!articleHtml}
                                    className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition-colors disabled:opacity-50"
                                >
                                    Baixar
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
                            {articleHtml || <span className="text-slate-600 italic">// O código HTML aparecerá aqui...</span>}
                        </div>
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="bg-white border-t border-slate-200 p-4 flex justify-end gap-3">
                    {error && (
                        <button
                            onClick={handleGenerate}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                        >
                            Tentar Novamente
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-colors"
                    >
                        {isGenerating ? 'Cancelar e Fechar' : 'Fechar'}
                    </button>
                    {!isGenerating && articleHtml && (
                        <button
                            onClick={downloadHtml}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Baixar HTML Final
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
