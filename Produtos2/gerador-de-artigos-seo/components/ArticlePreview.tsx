
import React, { useState, useEffect } from 'react';

interface ArticlePreviewProps {
    articleHtml: string;
    isGenerating: boolean;
    status: string;
}

export const ArticlePreview: React.FC<ArticlePreviewProps> = ({ articleHtml, isGenerating, status }) => {
    const [copySuccess, setCopySuccess] = useState<string>('');

    const handleCopy = () => {
        navigator.clipboard.writeText(articleHtml).then(() => {
            setCopySuccess('HTML copiado!');
            setTimeout(() => setCopySuccess(''), 2000);
        }, () => {
            setCopySuccess('Falha ao copiar.');
            setTimeout(() => setCopySuccess(''), 2000);
        });
    };

    useEffect(() => {
        // Reset copy message when new content is generated
        setCopySuccess('');
    }, [articleHtml]);

    return (
        <div className="relative h-[calc(100%-4rem)]">
            <div className="absolute top-0 right-0 z-10">
                {articleHtml && !isGenerating && (
                    <button
                        onClick={handleCopy}
                        className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition duration-300 text-sm"
                    >
                        {copySuccess || 'Copiar HTML'}
                    </button>
                )}
            </div>
            <div className="prose prose-invert max-w-none bg-gray-900 p-4 rounded-lg h-full overflow-y-auto border border-gray-700">
                {articleHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: articleHtml }} />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-400 text-center">
                           {isGenerating ? status : "O artigo gerado aparecerá aqui."}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
