import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

const MODEL = 'gemini-2.5-flash';

const commonSystemInstruction = `
Você é um especialista em redação de conteúdo SEO para blogs em português do Brasil. Sua tarefa é gerar conteúdo de alta qualidade, humanizado, original e otimizado para os motores de busca, seguindo estritamente as regras fornecidas. O resultado final deve ser um código HTML limpo e pronto para ser colado no WordPress.

REGRAS GERAIS (aplicam-se a todas as partes do texto):
- Linguagem: Clara, adequada ao público-alvo, e humanizada. Evite jargões técnicos excessivos.
- Parágrafos: Devem ser curtos, com no máximo quatro linhas cada.
- Estrutura HTML: Use apenas as tags HTML semânticas (<h1>, <h2>, <h3>, <p>, <ul>, <li>, <a>, <table>, <thead>, <tbody>, <tr>, <th>, <td>). Não inclua <html>, <head>, ou <body>. A tag <img> não deve ser usada.
- Palavra-chave (Keyword): Use a palavra-chave principal, derivada do título, de forma natural e estratégica. Dê preferência a sinônimos e variações para evitar repetição excessiva (keyword stuffing). Não use negrito ('<strong>' ou '<b>') na palavra-chave. A densidade ideal é sutil.
- Originalidade: O conteúdo deve ser 100% original e não plagiado.
- Correção: O texto deve ser gramaticalmente correto e sem erros de ortografia.
`;

const systemInstructionForSeoCheck = `
Você é um editor SEO sênior. Sua tarefa é revisar e reescrever um bloco de seções de um artigo para garantir que o texto seja coeso, natural, não repetitivo e otimizado para SEO, seguindo as melhores práticas do Google.
1.  **Fluxo Natural**: As seções devem se conectar logicamente entre si e com o conteúdo anterior.
2.  **Conteúdo Complementar**: Não pode haver repetição de ideias. Cada seção deve adicionar novo valor.
3.  **Uso de Listas e Tabelas**: Avalie o uso de listas (<ul>) e tabelas. Mantenha-as se apresentarem a informação de forma mais clara e organizada do que parágrafos. Se uma lista for apenas uma série de frases curtas que poderiam ser combinadas em um parágrafo coeso, considere reescrevê-la. O objetivo é a clareza para o leitor.
4.  **Humanização**: O texto deve soar natural e humano.
5.  **Otimização de Palavra-chave**: Verifique o uso da palavra-chave principal. Se estiver sendo repetida excessivamente, substitua-a por sinônimos ou reestruture as frases para que soem mais naturais. Remova qualquer formatação de negrito aplicada às palavras-chave.
6.  **Formato**: O resultado deve ser APENAS o código HTML do bloco revisado, sem NENHUMA marcação de código como \`\`\`html ou \`\`\`. Mantenha a mesma estrutura de cabeçalhos (h2, h3, etc.) do bloco original e NÃO ALTERE O TEXTO DENTRO DAS TAGS DE CABEÇALHO (h1, h2, h3). Não adicione nenhum comentário ou texto extra.
`;

const generateWithGemini = async (prompt: string, systemInstruction: string = commonSystemInstruction): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
      }
    });
    let cleanedText = response.text.trim();
    // Remove markdown code fences that the model might accidentally include
    cleanedText = cleanedText.replace(/^```html\n?/, '').replace(/\n?```$/, '');
    return cleanedText;
  } catch (error) {
    console.error("Erro na API Gemini:", error);
    throw new Error("Falha ao comunicar com a API da IA.");
  }
};

const getPromptForIntroduction = (title: string, productSummary: string): string => `
Gere a INTRODUÇÃO para um artigo com o título: "${title}".

REGRAS PARA A INTRODUÇÃO:
- Tamanho: Deve ter entre 100 e 150 palavras.
- Contexto: Deve estar diretamente relacionada ao tema do artigo.
- Promessas: Não prometa abordar tópicos que não serão desenvolvidos no corpo do texto.
${productSummary ? `- Produto: Mencione sutilmente o problema que o produto a seguir resolve, sem citar o nome do produto. Resumo do produto: "${productSummary}"` : ''}

Formato da saída: Gere apenas o código HTML para a introdução. Exemplo: <p>...</p><p>...</p>
`;

const getPromptForSection = (title: string, introduction: string, previousSection: string, sectionTitle: string, productSummary: string): string => `
Você está continuando a escrever um artigo com o título: "${title}".
A introdução do artigo é:
\`\`\`html
${introduction}
\`\`\`
A seção IMEDIATAMENTE ANTERIOR que você escreveu foi:
\`\`\`html
${previousSection || '(Esta é a primeira seção após a introdução)'}
\`\`\`
Sua tarefa agora é escrever o CONTEÚDO para a seção com o título: "${sectionTitle}".
O cabeçalho (ex: <h2>${sectionTitle}</h2>) já foi adicionado. Gere APENAS o conteúdo que vem DEPOIS do cabeçalho.

REGRAS PARA O CONTEÚDO DESTA SEÇÃO:
- Continuidade: O texto deve fluir naturalmente a partir da seção anterior. Não repita informações já ditas.
- Formato: Gere apenas o HTML para o corpo da seção (parágrafos, listas, etc.). NÃO inclua a tag do cabeçalho.
- Listas e Tabelas: Use listas (<ul>) ou tabelas (<table>) apenas quando a informação se tornar mais clara e organizada com essa estrutura (ex: passo a passo, listas de itens, comparações de dados). Para conteúdo discursivo, prefira parágrafos (<p>). O objetivo é a naturalidade e a legibilidade.
- Links: Evite adicionar links externos. Se um link for absolutamente essencial para a compreensão do texto, adicione-o com o atributo rel="nofollow". Ex: <a href="https://exemplo.com.br" target="_blank" rel="nofollow noopener noreferrer">texto âncora</a>.
- Imagens: NÃO adicione imagens. O texto não deve conter tags <img>.
${productSummary ? `- Produto: Se for relevante para esta seção, cite o produto de forma natural e contextualizada. Resumo do produto: "${productSummary}"` : ''}

Formato da saída: Gere apenas o código HTML para o corpo desta seção, começando com uma tag <p>.
`;

const getPromptForSeoCheck = (title: string, previousContent: string, currentBatch: string): string => `
Título do artigo: "${title}"

Conteúdo já revisado e aprovado (contexto):
\`\`\`html
${previousContent || '(Este é o primeiro bloco do artigo, após a introdução.)'}
\`\`\`

BLOCO PARA REVISAR E REESCREVER:
\`\`\`html
${currentBatch}
\`\`\`
`;

const getPromptForConclusion = (title: string, articleBody: string): string => `
Gere a CONCLUSÃO para um artigo com o título: "${title}".
O corpo do artigo gerado até agora é:
\`\`\`html
${articleBody}
\`\`\`

REGRAS PARA A CONCLUSÃO:
- Tamanho: Deve ter entre 100 e 150 palavras.
- Resumo: Deve resumir os pontos principais discutidos no artigo.
- CTA: Não inclua uma chamada para ação (Call to Action), apenas resuma o conteúdo.

Formato da saída: Gere apenas o código HTML para a conclusão, começando com um <h2>Conclusão</h2>.
`;

const parseOutline = (outlineLine: string): { tag: string; text: string } | null => {
    const match = outlineLine.trim().match(/^(H[1-6]):\s*(.*)$/i);
    if (match) {
        const [, tag, text] = match;
        return {
            tag: tag.toLowerCase(),
            text: text.trim(),
        };
    }
    return null;
};

export const generateFullArticle = async (
    title: string,
    outlinesText: string,
    productSummary: string,
    onProgress: (update: { status: string; html: string }) => void
): Promise<void> => {
    const outlines = outlinesText.split('\n').filter(line => line.trim() !== '');
    let fullArticleHtml = `<h1>${title}</h1>`;
    
    // 1. Generate Introduction
    onProgress({ status: 'Gerando introdução...', html: fullArticleHtml });
    const introPrompt = getPromptForIntroduction(title, productSummary);
    const introductionHtml = await generateWithGemini(introPrompt);
    fullArticleHtml += `\n${introductionHtml}`;
    onProgress({ status: 'Introdução gerada.', html: fullArticleHtml });

    let allSectionsHtml: string[] = [];
    let previousSectionHtml = introductionHtml;

    // 2. Generate All Sections Sequentially (Drafting)
    for (let i = 0; i < outlines.length; i++) {
        const outline = outlines[i];
        const parsedOutline = parseOutline(outline);

        if (!parsedOutline) {
            console.warn(`Linha de outline inválida ignorada: "${outline}"`);
            continue;
        }

        const currentPreviewHtml = fullArticleHtml + '\n' + allSectionsHtml.join('\n');
        onProgress({ status: `Gerando rascunho da seção ${i + 1}/${outlines.length}...`, html: currentPreviewHtml });
        
        const sectionPrompt = getPromptForSection(title, introductionHtml, previousSectionHtml, parsedOutline.text, productSummary);
        const sectionContentHtml = await generateWithGemini(sectionPrompt);
        
        const sectionHtml = `<${parsedOutline.tag}>${parsedOutline.text}</${parsedOutline.tag}>\n${sectionContentHtml}`;

        allSectionsHtml.push(sectionHtml);
        previousSectionHtml = sectionHtml;
    }
    
    // 3. SEO Verification and Revision in Batches
    let revisedArticleBody = '';
    const batchSize = 5;
    for (let i = 0; i < allSectionsHtml.length; i += batchSize) {
        const batch = allSectionsHtml.slice(i, i + batchSize);
        const batchHtml = batch.join('\n');
        const currentBatchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(allSectionsHtml.length / batchSize);

        const currentPreviewHtml = fullArticleHtml + '\n' + revisedArticleBody;
        onProgress({ status: `Revisando SEO do bloco ${currentBatchNumber}/${totalBatches}...`, html: currentPreviewHtml });

        const seoCheckPrompt = getPromptForSeoCheck(title, revisedArticleBody, batchHtml);
        const revisedBatchHtml = await generateWithGemini(seoCheckPrompt, systemInstructionForSeoCheck);

        revisedArticleBody += `\n${revisedBatchHtml}`;
        onProgress({ status: `Bloco ${currentBatchNumber} revisado.`, html: fullArticleHtml + '\n' + revisedArticleBody });
    }

    fullArticleHtml += revisedArticleBody;

    // 4. Generate Conclusion
    onProgress({ status: 'Gerando conclusão...', html: fullArticleHtml });
    const conclusionPrompt = getPromptForConclusion(title, fullArticleHtml);
    const conclusionHtml = await generateWithGemini(conclusionPrompt);
    fullArticleHtml += `\n${conclusionHtml}`;
    onProgress({ status: 'Artigo finalizado.', html: fullArticleHtml });
};
