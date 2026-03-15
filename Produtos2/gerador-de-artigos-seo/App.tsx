
import React, { useState, useCallback } from 'react';
import { InputField } from './components/InputField';
import { TextAreaField } from './components/TextAreaField';
import { ArticlePreview } from './components/ArticlePreview';
import { Loader } from './components/Loader';
import { generateFullArticle } from './services/geminiService';

const App: React.FC = () => {
    const [title, setTitle] = useState<string>('');
    const [outlines, setOutlines] = useState<string>('');
    const [productSummary, setProductSummary] = useState<string>('');

    const [generatedArticle, setGeneratedArticle] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [generationStatus, setGenerationStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = useCallback(async () => {
        if (!title || !outlines) {
            setError('Título e Outlines são obrigatórios.');
            return;
        }

        setIsGenerating(true);
        setError(null);
        setGeneratedArticle('');
        setGenerationStatus('Iniciando geração...');

        const onProgress = (update: { status: string; html: string }) => {
            setGenerationStatus(update.status);
            setGeneratedArticle(update.html);
        };

        try {
            await generateFullArticle(title, outlines, productSummary, onProgress);
            setGenerationStatus('Artigo gerado com sucesso!');
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.';
            setError(`Falha na geração: ${errorMessage}`);
            setGenerationStatus('Erro!');
        } finally {
            setIsGenerating(false);
        }
    }, [title, outlines, productSummary]);

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
            <header className="bg-gray-800 border-b border-gray-700 shadow-lg">
                <div className="container mx-auto px-6 py-4">
                    <h1 className="text-3xl font-bold tracking-tight text-white">Gerador de Artigos SEO com IA</h1>
                    <p className="text-gray-400 mt-1">Crie conteúdo otimizado para WordPress de forma sequencial e inteligente.</p>
                </div>
            </header>

            <main className="container mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Coluna de Inputs */}
                    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-xl">
                        <h2 className="text-2xl font-semibold mb-6 border-b border-gray-600 pb-3">1. Insira os Dados</h2>
                        <div className="space-y-6">
                            <InputField
                                label="Título do Artigo"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Ex: O Guia Completo de Marketing Digital"
                            />
                            <TextAreaField
                                label="Outlines (um por linha, com H1:, H2:, H3:)"
                                value={outlines}
                                onChange={(e) => setOutlines(e.target.value)}
                                placeholder="H1: Título Principal&#10;H2: O que é Marketing Digital?&#10;H3: Ferramentas Essenciais"
                                rows={8}
                            />
                            <TextAreaField
                                label="Resumo do Produto (Opcional)"
                                value={productSummary}
                                onChange={(e) => setProductSummary(e.target.value)}
                                placeholder="Descreva um produto para ser citado naturalmente no artigo."
                                rows={4}
                            />
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="w-full flex justify-center items-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 shadow-lg disabled:cursor-not-allowed"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader />
                                        <span className="ml-2">{generationStatus}</span>
                                    </>
                                ) : (
                                    'Gerar Artigo'
                                )}
                            </button>
                            {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
                        </div>
                    </div>

                    {/* Coluna de Output */}
                    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-xl">
                        <h2 className="text-2xl font-semibold mb-6 border-b border-gray-600 pb-3">2. Resultado</h2>
                        <ArticlePreview articleHtml={generatedArticle} isGenerating={isGenerating} status={generationStatus} />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;
