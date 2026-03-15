import { GoogleGenAI } from "@google/genai";
import { SearchResult, MasterStrategy, OutlineItem, SearchServiceResponse, ProductSearchResult } from "../types";
import { extractProductsFromContent, extractFAQsFromContent } from "./productExtractor";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// ===========================================================================
// DETECÇÃO DE BUSCA DE PRODUTOS
// ===========================================================================

const PRODUCT_PATTERNS = [
  /melhores\s+produtos/i,
  /top\s+produtos/i,
  /produtos\s+para/i,
  /melhor\s+produto/i,
  /produtos\s+de/i,
  /produtos\s+com/i,
  /lista\s+de\s+produtos/i,
  /ranking\s+de\s+produtos/i,
  /produtos\s+recomendados/i,
  /quais\s+produtos/i,
  /produtos\s+que/i,
];

export const isProductSearch = (keyword: string): boolean => {
  if (!keyword || keyword.trim().length === 0) return false;
  return PRODUCT_PATTERNS.some(pattern => pattern.test(keyword));
};

// ===========================================================================
// ÁREA DE CONFIGURAÇÃO - OUTSCRAPER
// ===========================================================================
const OUTSCRAPER_API_KEY = "Y2RkM2NlYWRkNmE4NDU5ODgzMjQ2MjA1OTM5N2E1NjR8MjVjNzgwNGJjYQ";
// ===========================================================================

/**
 * Função auxiliar para buscar dados reais via Outscraper (V3)
 * Tenta usar a API dedicada. Se falhar, retorna array vazio para ativar fallback.
 */
const fetchFromOutscraper = async (keyword: string, limit: number, start: number = 0): Promise<any[]> => {
  if (!OUTSCRAPER_API_KEY) {
    console.warn("Chave API do Outscraper não configurada. Usando fallback Gemini.");
    return [];
  }

  // Endpoint V3
  const url = "/api/outscraper/google-search-v3";

  // Parâmetros ajustados conforme documentação (pt-BR, BR)
  const params = new URLSearchParams({
    query: keyword,
    limit: limit.toString(),
    offset: start.toString(), // Outscraper usa 'offset'
    language: "pt-BR",
    region: "BR",
    async: "false" // Importante para receber resposta imediata se possível
  });

  // Configura um timeout mais longo (120000ms = 2 minutos) para dar tempo ao Outscraper.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    // Nota: Chamadas de navegador para APIs de scraping frequentemente sofrem bloqueio de CORS (Cross-Origin Resource Sharing).
    // Se isso ocorrer, o 'fetch' lançará um erro, que será capturado abaixo, ativando o fallback do Gemini.
    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
      headers: {
        "X-API-KEY": OUTSCRAPER_API_KEY
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Falha na API Outscraper (${response.status}). Ativando modo fallback.`);
      return [];
    }

    const data = await response.json();

    // Validação flexível para estrutura V3
    // V3 retorna { data: [ { results: [...] } ] }
    if (!data.data || !data.data[0]) {
      return [];
    }

    const results = data.data[0].results || data.data[0].organic_results || [];
    return results;

  } catch (error: any) {
    // Erros de rede (Failed to fetch), CORS ou Timeout caem aqui
    if (error.name === 'AbortError') {
      console.warn("Outscraper demorou muito (provável bloqueio).");
    } else {
      console.warn("Erro de conexão Outscraper (Bloqueio CORS ou Rede).", error);
    }
    return []; // Retorna vazio para tentar o próximo fallback
  }
};

// ===========================================================================
// ÁREA DE CONFIGURAÇÃO - SERPAPI
// ===========================================================================
const SERPAPI_KEY = "d2b024ca951dad6d0408a9f977ce627faf750736c41bdcf7e1ea296cd6caee83"; // <--- INSIRA SUA CHAVE AQUI
// ===========================================================================

/**
 * Função auxiliar para buscar dados via SerpApi (Fallback 1)
 */
const fetchFromSerpApi = async (keyword: string, limit: number, start: number = 0): Promise<any[]> => {
  if (!SERPAPI_KEY) {
    console.warn("Chave API do SerpApi não configurada. Pulando.");
    return [];
  }

  const url = "/api/serpapi/search";
  const params = new URLSearchParams({
    q: keyword,
    api_key: SERPAPI_KEY,
    engine: "google",
    google_domain: "google.com.br",
    gl: "br",
    num: limit.toString(),
    start: start.toString() // SerpApi usa 'start'
  });

  try {
    const response = await fetch(`${url}?${params.toString()}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`SerpApi Error (${response.status}):`, errorText);
      return [];
    }

    const data = await response.json();
    if (!data.organic_results) return [];

    return data.organic_results;
  } catch (error) {
    console.warn("Erro ao buscar no SerpApi:", error);
    return [];
  }
};

export const searchAndExtractOutlines = async (
  keyword: string,
  count: number = 10,
  excludeDomains: string[] = [],
  start: number = 0
): Promise<SearchServiceResponse> => {
  try {
    console.log("Iniciando busca híbrida...");

    let externalResults: any[] = [];
    let source = "";

    // 1. Tenta SerpApi (Prioridade)
    try {
      console.log(`Tentando buscar via SerpApi (start=${start})...`);
      externalResults = await fetchFromSerpApi(keyword, count + excludeDomains.length + 5, start);
      if (externalResults.length > 0) {
        console.log(`Sucesso via SerpApi! ${externalResults.length} resultados.`);
        source = "SerpApi";
      }
    } catch (e) {
      console.warn("SerpApi falhou, tentando Outscraper...");
    }

    // 2. Se falhar ou tiver poucos resultados, tenta Outscraper (Fallback)
    if (externalResults.length < 5) {
      console.log("Resultados insuficientes. Tentando Outscraper...");
      try {
        // Aumentamos o buffer para garantir 10 resultados após filtragem (social media, youtube, etc)
        // Antes: count + excludeDomains.length + 5
        // Agora: count * 2 + excludeDomains.length + 5
        const limitBuffer = (count * 2) + excludeDomains.length + 5;
        console.log(`Solicitando ${limitBuffer} resultados ao Outscraper para garantir ${count} finais (offset=${start}).`);

        const outscraperResults = await fetchFromOutscraper(keyword, limitBuffer, start);
        console.log(`Outscraper retornou ${outscraperResults.length} resultados brutos.`);

        if (outscraperResults.length > 0) {
          // Se já tínhamos alguns da SerpApi, podemos combinar ou substituir. 
          // Aqui vamos substituir se o Outscraper trouxe mais, ou combinar.
          // Estratégia simples: Adicionar os do Outscraper que não estão na lista (por URL)
          const currentUrls = new Set(externalResults.map(r => r.link));
          for (const item of outscraperResults) {
            if (!currentUrls.has(item.link)) {
              externalResults.push(item);
            }
          }
          source = source ? `${source} + Outscraper` : "Outscraper";
        }
      } catch (e) {
        console.warn("Outscraper falhou também...");
      }
    }

    const usingFallback = externalResults.length === 0;

    // Filtragem inicial
    const filteredExternalResults = externalResults
      .filter((r: any) => {
        if (!r.link) return false;
        try {
          const domain = new URL(r.link).hostname.replace('www.', '');
          return !excludeDomains.includes(domain) &&
            !domain.includes('youtube') &&
            !domain.includes('facebook') &&
            !domain.includes('instagram') &&
            !domain.includes('pinterest');
        } catch (e) {
          return false;
        }
      })
      .slice(0, count);

    // 2. SE TIVERMOS URLs, FAZEMOS SCRAPING DIRETO (Local Proxy)
    if (!usingFallback && filteredExternalResults.length > 0) {
      console.log("URLs encontradas. Iniciando scraping direto...");

      const scrapedResults = await Promise.all(filteredExternalResults.map(async (r: any) => {
        try {
          // Chama nosso proxy local
          const scrapeUrl = `/api/scrape?url=${encodeURIComponent(r.link)}`;
          const res = await fetch(scrapeUrl);
          if (!res.ok) throw new Error("Falha no scrape");

          const data = await res.json();
          const outline = data.outline || [];

          // Se não tiver H1/H2/H3, talvez o site bloqueou ou é SPA.
          // Nesse caso, mantemos o item mas com outline vazio (ou fallback)
          return {
            title: r.title,
            url: r.link,
            domain: new URL(r.link).hostname,
            summary: r.snippet,
            outline: outline
          };
        } catch (e) {
          console.warn(`Erro ao scrapear ${r.link}:`, e);
          return null;
        }
      }));

      // Filtra falhas (null) mas MANTÉM itens sem outline (para não sumir com resultados)
      const validResults = scrapedResults.filter(r => r !== null);

      if (validResults.length > 0) {
        // RETORNO DIRETO: Não enviamos para o Gemini "formatar".
        // Entregamos o dado real extraído pelo Cheerio.
        return {
          results: validResults as SearchResult[],
          isFallback: false
        };
      }
      // Se tudo falhar, cai no fallback do Gemini abaixo
      console.warn("Scraping falhou para todos os itens. Usando fallback do Gemini.");
    }

    // 3. FALLBACK: Se Outscraper falhou OU Scraping falhou
    // NOTA: Este fallback usa Gemini diretamente porque precisa da ferramenta googleSearch
    // que é específica do Gemini. Este é um caso raro (quando SerpApi e Outscraper falham).
    // O custo aqui é aceitável pois é apenas fallback de emergência.
    const prompt = `
      Você é um Extrator de Estrutura de Conteúdo (Crawler SEO Especialista).
      
      CONTEXTO:
      O usuário buscou por: "${keyword}".
      Modo de operação: BUSCA ATIVA (FALLBACK).

      TAREFA:
      USE A FERRAMENTA 'googleSearch' AGORA para buscar os ${count} melhores resultados orgânicos no Brasil para "${keyword}".
      Ignore vídeos (YouTube), redes sociais e PDFs. Foque em blogs e artigos de conteúdo.

      REGRAS DE FORMATAÇÃO:
      - O H1 deve ser sempre o Título do artigo.
      - Limpe elementos de navegação (Menu, Footer, Sidebar).
      - Retorne EXATAMENTE os tópicos encontrados.

      SAÍDA OBRIGATÓRIA (JSON Array Puro):
      [
        {
          "title": "Título exato",
          "url": "URL completa",
          "domain": "dominio.com.br",
          "summary": "Breve resumo (1 frase)",
          "outline": [
            { "tag": "H1", "text": "..." },
            { "tag": "H2", "text": "..." }
          ]
        }
      ]
    `;

    // NOTA: Mantido Gemini direto aqui porque precisa da ferramenta googleSearch específica do Gemini
    // Este é um fallback raro, então o custo é aceitável
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
      },
    });

    const text = response.text || "";
    console.log(`[Search Fallback] Usando Gemini com googleSearch tool (fallback raro)`);
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : text;

    try {
      const parsedData: SearchResult[] = JSON.parse(jsonString);
      return {
        results: parsedData.slice(0, count),
        isFallback: true
      };
    } catch (e) {
      console.error("Erro ao parsear resposta do Gemini", e);
      throw new Error("Não foi possível estruturar os resultados. Tente novamente.");
    }

  } catch (error) {
    console.error("Search Pipeline Error:", error);
    throw error;
  }
};

export const generateConsolidatedStrategy = async (
  keyword: string,
  selectedResults: SearchResult[]
): Promise<MasterStrategy> => {
  try {
    if (selectedResults.length === 0) throw new Error("Nenhum resultado selecionado.");

    const baseModel = selectedResults[0];
    const baseCount = baseModel.outline.length;
    const maxAllowed = Math.floor(baseCount * 1.3); // Limite estrito de 30%

    // OTIMIZAÇÃO: Enviar apenas outlines de forma compacta, sem URLs e metadados desnecessários
    const baseOutlineText = baseModel.outline.map(o => `${o.tag}: ${o.text}`).join('\n');
    const competitorsOutlines = selectedResults.slice(1).map((r, index) => 
      `Concorrente ${index + 1}:\n${r.outline.map(o => `${o.tag}: ${o.text}`).join('\n')}`
    ).join('\n\n');

    const prompt = `
      Você é um Arquiteto de SEO Sênior e Especialista em Estrutura de Conteúdo.
      
      OBJETIVO: Criar uma "Master Outline" consolidada para a palavra-chave: "${keyword}".

      REGRAS SUPREMAS (Violá-las anula o resultado):
      1. **CÓPIA IPSIS LITTERIS:** Ao usar um tópico de um concorrente ou da base, COPIE O TEXTO EXATAMENTE COMO ESTÁ. Não reescreva, não resuma, não "melhore". Se o H2 é "Como fazer bolo", use "Como fazer bolo".
      2. **NÃO INVENTE:** Não crie tópicos que não existam nos dados fornecidos.

      REGRAS CRÍTICAS DE FILTRAGEM (Aplicar a TODOS os passos):
      - REMOVER IMEDIATAMENTE: Cabeçalhos institucionais ("Sobre", "Contato", "Login"), Navegação ("Menu", "Busca"), Rodapés ("Política de Privacidade", "Termos"), Redes Sociais ("Instagram", "Facebook"), Newsletters, Comentários ("Deixe um comentário"), e "Veja também" / "Posts relacionados".
      - REMOVER: Conteúdos repetitivos ou que não agregam valor informacional direto ao tema.

      ALGORITMO DE GERAÇÃO:

      1. **LIMPEZA DA BASE (Passo Zero):**
         - Pegue a outline do artigo base abaixo.
         - Aplique as REGRAS CRÍTICAS DE FILTRAGEM. Remova todo o lixo.
         - O que sobrar é a sua **ESTRUTURA BASE**. Conte os tópicos (H2/H3) desta base limpa.
         - Calcule o LIMITE MÁXIMO: Base Limpa + 30% (arredondado para baixo).

      2. **ANÁLISE DE ENRIQUECIMENTO (Competidores):**
         - Analise os concorrentes na ordem fornecida (que reflete a posição na SERP: 1º, 2º, 3º...).
         - Identifique tópicos (H2/H3) que eles possuem e a Estrutura Base NÃO possui.
         - **CRITÉRIO DE SELEÇÃO (Prioridade):**
           a. **Alta Frequência:** O tópico aparece em múltiplos concorrentes? (Prioridade Máxima)
           b. **Autoridade da SERP:** O tópico aparece no concorrente mais bem ranqueado (logo após a base)? (Prioridade Alta)
         - Ignore tópicos únicos de concorrentes de baixa posição, a menos que sejam vitais para o tema.

      3. **CONSOLIDAÇÃO E INSERÇÃO:**
         - Insira os novos tópicos selecionados dentro da Estrutura Base, na posição lógica correta (não apenas no final). Mantenha o fluxo narrativo.
         - **TRAVA DE SEGURANÇA (+30%):** Monitore a contagem total. Se atingir o LIMITE MÁXIMO calculado no passo 1, PARE de adicionar novos tópicos. É melhor ter menos tópicos de alta qualidade do que ultrapassar o limite.

      4. **META DESCRIPTION:**
         - Crie uma meta description otimizada para CTR, resumindo o conteúdo consolidado.

      ARTIGO BASE:
      ${baseOutlineText}

      CONCORRENTES:
      ${competitorsOutlines}

      SAÍDA OBRIGATÓRIA (JSON):
      {
        "baseHeadings": (int) // Contagem da base APÓS limpeza
        "maxHeadings": (int) // O limite calculado (+30%)
        "finalHeadings": (int) // Contagem final
        "metaDescription": "...",
        "masterOutline": [ 
           { "tag": "H1", "text": "TEXTO EXATO DA FONTE" },
           { "tag": "H2", "text": "TEXTO EXATO DA FONTE" },
           { "tag": "H3", "text": "TEXTO EXATO DA FONTE" }
        ]
      }
    `;

    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt,
        systemInstruction: 'Você é um Arquiteto de SEO Sênior e Especialista em Estrutura de Conteúdo. Retorne APENAS JSON válido, sem markdown ou explicações.'
      }),
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || 'Falha ao gerar estratégia consolidada.');
    }
    
    const data = (await res.json()) as { text?: string; provider?: string };
    const text = (data.text ?? '').trim();
    const provider = data.provider || 'unknown';
    
    console.log(`[Strategy] Resposta obtida via ${provider}`);
    
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : text;

    return JSON.parse(jsonString);

  } catch (error) {
    console.error("Strategy Gen Error:", error);
    throw new Error("Falha ao gerar estratégia consolidada.");
  }
};

// ===========================================================================
// ARTICLE GENERATION LOGIC (Ported from gerador-de-artigos-seo)
// ===========================================================================

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

/**
 * Gera conteúdo via IA. Usa o backend (/api/ai/generate), que tenta DeepSeek primeiro
 * e faz fallback para Gemini — reduz custo mantendo qualidade e reversão possível.
 */
const generateWithGemini = async (prompt: string, systemInstruction: string = commonSystemInstruction): Promise<string> => {
  try {
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, systemInstruction }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || 'Falha ao gerar conteúdo.');
    }
    const data = (await res.json()) as { text?: string; provider?: string };
    let cleanedText = (data.text ?? '').trim();
    // Remove markdown code fences that the model might accidentally include
    cleanedText = cleanedText.replace(/^```html\n?/, '').replace(/\n?```$/, '');
    return cleanedText;
  } catch (error) {
    console.error("Erro na API de IA:", error);
    throw error instanceof Error ? error : new Error("Falha ao comunicar com a API da IA.");
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

// Prompt otimizado para seção única (mantido para compatibilidade)
const getPromptForSection = (title: string, introduction: string, previousSection: string, sectionTitle: string, productSummary: string): string => {
  // Otimização: Enviar apenas resumo da introdução (primeiras 200 palavras) ao invés do HTML completo
  const introSummary = introduction.replace(/<[^>]*>/g, '').substring(0, 200) + '...';
  const prevSummary = previousSection ? previousSection.replace(/<[^>]*>/g, '').substring(0, 150) + '...' : '(Esta é a primeira seção após a introdução)';
  
  // Detectar se é uma seção sobre produto específico (geralmente contém nome de produto ou características)
  const isProductSection = productSummary && productSummary.length > 0;
  
  return `
Você está continuando um artigo sobre: "${title}".
Contexto: ${introSummary}
Seção anterior: ${prevSummary}
Escreva o CONTEÚDO para: "${sectionTitle}".
O cabeçalho já foi adicionado. Gere APENAS o conteúdo HTML após o cabeçalho.

REGRAS:
- Continuidade natural com a seção anterior
- HTML limpo: <p>, <ul>, <li>, <table> quando apropriado
- Sem imagens, links externos apenas se essenciais (com rel="nofollow")
- NÃO use asteriscos (*) ou outros caracteres especiais no texto
- NÃO mencione preços, valores ou custos em nenhum momento
${isProductSection ? `- Esta seção é sobre um produto específico. Gere 2-3 parágrafos concisos (<p>...</p>) sobre o produto
- Use as informações reais do produto quando disponíveis: ${productSummary}
- Seja específico sobre características, funcionalidades e benefícios mencionados na descrição do produto
- Cada parágrafo deve ter entre 60-100 palavras
- Total máximo de 250 palavras` : '- Seja objetivo e informativo'}
- Baseie-se nas características reais do produto quando disponíveis

Saída: Apenas HTML do corpo da seção, começando com <p>. Limpe o texto removendo asteriscos.
`;
};

// Novo prompt otimizado para múltiplas seções em lote
const getPromptForSectionsBatch = (title: string, introduction: string, previousSection: string, sections: Array<{tag: string, text: string}>, productSummary: string): string => {
  const introSummary = introduction.replace(/<[^>]*>/g, '').substring(0, 200) + '...';
  const prevSummary = previousSection ? previousSection.replace(/<[^>]*>/g, '').substring(0, 150) + '...' : '(Primeiras seções do artigo)';
  const sectionsList = sections.map(s => `${s.tag}: ${s.text}`).join('\n');
  
  return `
Você está escrevendo um artigo sobre: "${title}".
Contexto: ${introSummary}
Seção anterior: ${prevSummary}

Escreva o CONTEÚDO HTML para estas ${sections.length} seções (em sequência):
${sectionsList}

REGRAS:
- Cada seção deve fluir naturalmente para a próxima
- HTML limpo: <p>, <ul>, <li>, <table> quando apropriado
- Sem imagens, links externos apenas se essenciais (com rel="nofollow")
- NÃO use asteriscos (*) ou outros caracteres especiais no texto
- NÃO mencione preços, valores ou custos
${productSummary && productSummary.length > 0 ? `- Esta seção é sobre um produto específico. Gere 2-3 parágrafos concisos (<p>...</p>)
- Use as informações reais do produto: ${productSummary}
- Seja específico sobre características mencionadas na descrição
- Cada parágrafo deve ter entre 60-100 palavras
- Total máximo de 250 palavras` : '- Seja objetivo e informativo'}
- Baseie-se nas características reais do produto quando disponíveis

SAÍDA OBRIGATÓRIA (JSON Array puro, sem markdown):
[
  {"content": "<p>Conteúdo da primeira seção...</p>"},
  {"content": "<p>Conteúdo da segunda seção...</p>"}
]

IMPORTANTE: Retorne APENAS o JSON array, sem texto adicional, sem markdown, sem explicações.
Gere o conteúdo HTML de cada seção na mesma ordem fornecida.
`;
};

const getPromptForSeoCheck = (title: string, previousContent: string, currentBatch: string): string => {
  // Otimização: Enviar apenas resumo do conteúdo anterior ao invés do HTML completo
  const prevSummary = previousContent ? previousContent.replace(/<[^>]*>/g, '').substring(0, 300) + '...' : '(Primeiro bloco do artigo)';
  
  return `
Título: "${title}"
Contexto anterior: ${prevSummary}

BLOCO PARA REVISAR E REESCREVER:
\`\`\`html
${currentBatch}
\`\`\`
`;
};

const getPromptForConclusion = (title: string, articleBody: string): string => {
  // Otimização: Enviar apenas resumo dos tópicos principais ao invés do HTML completo
  const bodySummary = articleBody.replace(/<[^>]*>/g, ' ').substring(0, 500) + '...';
  const topics = (articleBody.match(/<h[2-3][^>]*>(.*?)<\/h[2-3]>/gi) || []).slice(0, 10).map(h => h.replace(/<[^>]*>/g, '')).join(', ');
  
  return `
Gere a CONCLUSÃO para: "${title}".
Tópicos principais abordados: ${topics}
Resumo do conteúdo: ${bodySummary}

REGRAS:
- 100-150 palavras
- Resumir pontos principais
- Sem CTA

Saída: HTML da conclusão, começando com <h2>Conclusão</h2>.
`;
};

// Prompt para gerar prós e contras em formato de TABELA com cores
const getPromptForProsAndCons = (productName: string, productInfo?: string): string => `
Gere uma seção de PRÓS E CONTRAS para o produto: "${productName}".

${productInfo ? `DADOS REAIS DO PRODUTO DA AMAZON (USE ESSES DADOS COMO BASE PRINCIPAL - OBRIGATÓRIO):
${productInfo}

CRÍTICO: Você DEVE usar essas informações reais da API da Amazon para criar prós e contras ESPECÍFICOS sobre este produto. Analise cuidadosamente:

1. DESCRIÇÃO/FEATURES DO PRODUTO:
   - Leia TODA a descrição completa e características do produto
   - Identifique recursos específicos mencionados (ex: "à prova d'água", "recarregável", "leve", "ergonômico", "LED", "sem fio", etc.)
   - Use esses recursos REAIS nos prós - seja específico, não genérico
   - Se a descrição menciona materiais específicos (ex: "alumínio", "plástico ABS"), mencione como ponto positivo

2. MARCA:
   - Se a marca está presente e é conhecida, mencione como ponto positivo (ex: "Marca reconhecida no mercado")
   - Se não houver marca, não invente uma

3. AVALIAÇÕES:
   - Se a avaliação é alta (4+ estrelas), mencione como ponto positivo (ex: "Bem avaliado pelos clientes")
   - Se tem muitas avaliações (ex: 1000+), mencione como ponto positivo (ex: "Grande número de avaliações confiáveis")

4. REGRAS ABSOLUTAS:
   - NÃO mencione preço, valor, custo, R$, reais, dinheiro em nenhum momento
   - NÃO invente características que não estão na descrição
   - Use APENAS informações reais da API quando disponíveis
   - Se não houver informação específica, seja genérico mas honesto` : 'IMPORTANTE: Baseie-se nas características típicas deste tipo de produto, mas seja objetivo e honesto.'}

REGRAS OBRIGATÓRIAS:
- Liste EXATAMENTE 5 pontos positivos e EXATAMENTE 3 pontos a considerar
- NÃO mencione preço, valor ou custo em nenhum momento
- Os "pontos a considerar" devem ser suaves e NÃO devem desencorajar a compra (ex: "pode exigir prática inicial" ao invés de "difícil de usar")
- Use as informações reais da API quando disponíveis - seja específico sobre características mencionadas na descrição
- Se houver marca conhecida ou avaliação alta, mencione como ponto positivo
- Foque em características práticas e úteis para o consumidor

FORMATO OBRIGATÓRIO (HTML - TABELA COLORIDA):
<h4>Pros e contras</h4>
<table class="pros-cons-table">
<thead>
<tr>
<th style="background-color: #90EE90;">O que eu gostei</th>
<th style="background-color: #FFB6C1;">Pontos a considerar</th>
</tr>
</thead>
<tbody>
<tr>
<td>Vantagem 1 (baseada nos dados reais da API)</td>
<td>Consideração suave 1 (não desencoraje compra)</td>
</tr>
<tr>
<td>Vantagem 2 (baseada nos dados reais da API)</td>
<td>Consideração suave 2 (não desencoraje compra)</td>
</tr>
<tr>
<td>Vantagem 3 (baseada nos dados reais da API)</td>
<td>Consideração suave 3 (não desencoraje compra)</td>
</tr>
<tr>
<td>Vantagem 4 (baseada nos dados reais da API)</td>
<td></td>
</tr>
<tr>
<td>Vantagem 5 (baseada nos dados reais da API)</td>
<td></td>
</tr>
</tbody>
</table>

IMPORTANTE: 
- Preencha EXATAMENTE 5 prós e EXATAMENTE 3 contras
- Use os dados reais da API como base principal
- NÃO mencione preço
- Contras devem ser suaves e não desencorajar compra

Saída: APENAS o HTML acima, sem explicações, sem markdown.
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
  onProgress: (update: { status: string; html: string }) => void,
  options?: { 
    enableSeoReview?: boolean; 
    sectionBatchSize?: number;
    associateTag?: string; // Amazon Associate Tag para gerar links de afiliados
    products?: Array<{ name: string }>; // Lista de produtos para buscar na Amazon e gerar prós/contras
    faqs?: Array<{ pergunta: string; resposta: string }>; // FAQs para incluir no final do artigo
  }
): Promise<void> => {
  console.log('[generateFullArticle] Produtos recebidos:', options?.products?.map(p => p.name));
  console.log('[generateFullArticle] FAQs recebidas:', options?.faqs?.length || 0);
  const enableSeoReview = options?.enableSeoReview ?? false;
  const sectionBatchSize = options?.sectionBatchSize ?? 5; // Lotes de 5 seções por padrão (otimizado de 4 para 5)
  
  // Buscar produtos da Amazon ANTES de gerar seções (se houver Associate Tag e produtos)
  // Isso permite usar informações específicas dos produtos ao gerar o "sobre" de cada produto
  let amazonProductMap: Map<string, any> | null = null;
  if (options?.associateTag && options?.products && options.products.length > 0) {
    try {
      onProgress({ status: 'Buscando produtos na Amazon para enriquecer conteúdo...', html: `<h1>${title}</h1>` });
      
      // Se houver produtos pré-selecionados, usar esses
      if ((options as any).selectedAmazonProducts && (options as any).selectedAmazonProducts.size > 0) {
        console.log('[generateFullArticle] Usando produtos pré-selecionados da Amazon');
        amazonProductMap = (options as any).selectedAmazonProducts;
      } else {
        // Caso contrário, buscar automaticamente
        console.log('[generateFullArticle] Buscando produtos na Amazon:', options.products.map(p => p.name));
        const { searchMultipleProducts } = await import('./amazonClient');
        amazonProductMap = await searchMultipleProducts(
          options.products.map(p => p.name), 
          options.associateTag
        );
      }
      
      // Armazenar no options para uso posterior
      (options as any).amazonProductMap = amazonProductMap;
      console.log(`[generateFullArticle] ${amazonProductMap.size} produtos da Amazon carregados`);
    } catch (error) {
      console.warn('[generateFullArticle] Erro ao buscar produtos da Amazon (continuando sem enriquecimento):', error);
      // Continuar sem produtos da Amazon
    }
  }
  
  const outlines = outlinesText.split('\n').filter(line => line.trim() !== '');
  let fullArticleHtml = `<h1>${title}</h1>`;

  // 1. Generate Introduction
  onProgress({ status: 'Gerando introdução...', html: fullArticleHtml });
  const introPrompt = getPromptForIntroduction(title, productSummary);
  let introductionHtml = await generateWithGemini(introPrompt);
  
  // Limpar asteriscos e outros caracteres indesejados
  introductionHtml = introductionHtml.replace(/\*+/g, '').trim();
  
  // Garantir que a introdução tenha conteúdo válido
  if (!introductionHtml || introductionHtml.length < 50) {
    introductionHtml = `<p>Neste artigo, vamos explorar tudo sobre ${title}, fornecendo informações detalhadas e úteis para ajudá-lo a tomar a melhor decisão.</p>`;
  }
  
  fullArticleHtml += `\n${introductionHtml}`;
  
  // Adicionar texto em negrito após introdução (se houver produtos)
  if (options?.products && options.products.length > 0) {
    // Gerar texto em negrito dinamicamente usando o título
    const boldText = `\n<b>Neste artigo analisaremos as ${title}</b>\n`;
    fullArticleHtml += boldText;
  }
  
  // Inserir lista numerada e tabela comparativa ANTES das seções (se houver produtos da Amazon)
  if (options?.associateTag && amazonProductMap && amazonProductMap.size > 0) {
    const productMap = amazonProductMap;
    
    // Inserir lista numerada após texto negrito (ou introdução se não houver texto negrito)
    if (!fullArticleHtml.includes('<ol>')) {
      let listInsertPos = -1;
      
      // Buscar posição após texto negrito (se houver)
      const boldTextMatch = fullArticleHtml.match(/<b>Neste artigo analisaremos as.*?<\/b>/s);
      if (boldTextMatch && boldTextMatch.index !== undefined) {
        listInsertPos = boldTextMatch.index + boldTextMatch[0].length;
      } else {
        // Se não tem texto negrito, inserir após a introdução (último </p>)
        const h1End = fullArticleHtml.indexOf('</h1>');
        if (h1End > -1) {
          const afterH1 = fullArticleHtml.substring(h1End + 5);
          let lastPEnd = -1;
          let searchPos = 0;
          while (true) {
            const nextPEnd = afterH1.indexOf('</p>', searchPos);
            if (nextPEnd === -1) break;
            const between = afterH1.substring(lastPEnd + 4, nextPEnd);
            if (between.includes('<h2') || between.includes('<h3')) break;
            lastPEnd = nextPEnd;
            searchPos = nextPEnd + 4;
          }
          if (lastPEnd > -1) {
            listInsertPos = h1End + 5 + lastPEnd + 4;
          } else {
            listInsertPos = h1End + 5;
          }
        }
      }
      
      if (listInsertPos > -1) {
        const numberedList = '\n<ol>\n' + 
          Array.from(productMap.entries())
            .map(([productName, amazonProduct]) => {
              const displayName = amazonProduct.title || productName;
              return `  <li><a href="${amazonProduct.affiliateURL}" target="_blank" rel="nofollow noopener">${displayName}</a></li>`;
            })
            .join('\n') + 
          '\n</ol>\n';
        fullArticleHtml = fullArticleHtml.substring(0, listInsertPos) + numberedList + fullArticleHtml.substring(listInsertPos);
      }
    }
    
    // Inserir tabela comparativa após lista numerada
    if (!fullArticleHtml.match(/<h2[^>]*>.*?tabela.*?<\/h2>/i)) {
      const tableIntroPrompt = `
Gere um parágrafo introdutório para uma seção de tabela comparativa sobre "${title}".

O parágrafo deve:
- Explicar que a lista foi compilada pensando nas necessidades específicas do tema
- Mencionar que cada modelo foi selecionado com base em critérios relevantes
- Explicar que a tabela oferece uma visão detalhada para comparação
- Ter entre 50 e 80 palavras
- Ser objetivo e informativo
- NÃO mencionar preços

Saída: Apenas o parágrafo HTML <p>...</p>, sem explicações.
`;
      let tableIntroText = '';
      try {
        tableIntroText = await generateWithGemini(tableIntroPrompt);
        tableIntroText = tableIntroText.replace(/\*+/g, '').trim();
        if (!tableIntroText.startsWith('<p>')) {
          tableIntroText = `<p>${tableIntroText}</p>`;
        }
      } catch (error) {
        console.warn('[Tabela] Erro ao gerar introdução, usando texto padrão:', error);
        tableIntroText = `<p>Pensando nas necessidades específicas, compilamos uma lista exclusiva com as melhores opções disponíveis no mercado. Cada modelo foi cuidadosamente selecionado com base em critérios relevantes, permitindo que você compare e encontre a opção perfeita.</p>`;
      }
      
      const tableHtml = `\n<h2>Lista dos Top ${productMap.size} ${title}</h2>\n` +
        tableIntroText + '\n' +
        `<table class="product-table">\n<thead>\n<tr>\n<th>Produto</th>\n<th>Ver Valor</th>\n</tr>\n</thead>\n<tbody>\n` +
        Array.from(productMap.entries())
          .map(([productName, amazonProduct]) => {
            const displayName = amazonProduct.title || productName;
            const buttonHtml = `[su_button url="${amazonProduct.affiliateURL}" target="blank" style="3d" background="#ff0000" size="6" wide="yes" center="yes" icon="icon: amazon"]VER O MELHOR PREÇO[/su_button]`;
            return `<tr>\n<td>${displayName}</td>\n<td>${buttonHtml}</td>\n</tr>`;
          })
          .join('\n') +
        `\n</tbody>\n</table>\n`;
      
      const listEnd = fullArticleHtml.indexOf('</ol>');
      const tableInsertPos = listEnd > 0 ? listEnd + 5 : fullArticleHtml.indexOf('</h1>') + 5;
      if (tableInsertPos > 4) {
        fullArticleHtml = fullArticleHtml.substring(0, tableInsertPos) + tableHtml + fullArticleHtml.substring(tableInsertPos);
      }
    }
  }
  
  onProgress({ status: 'Introdução gerada.', html: fullArticleHtml });

  let allSectionsHtml: string[] = [];
  let previousSectionHtml = introductionHtml;

  // Função auxiliar para encontrar informações de produto específico para uma seção
  const getProductInfoForSection = (sectionTitle: string): string => {
    // Se não temos produtos da Amazon, usar productSummary genérico
    if (!amazonProductMap || amazonProductMap.size === 0) {
      return productSummary;
    }
    
    // Tentar encontrar produto correspondente na seção
    const sectionTitleLower = sectionTitle.toLowerCase();
    
    // Buscar no mapa de produtos da Amazon
    for (const [productName, amazonProduct] of amazonProductMap.entries()) {
      const productNameWords = productName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const matchingWords = productNameWords.filter(pw => sectionTitleLower.includes(pw));
      
      // Se encontrou correspondência significativa (pelo menos 2 palavras)
      if (matchingWords.length >= 2) {
        // Construir informações completas do produto específico
        const productInfo = [
          `Título completo do produto: ${amazonProduct.title || productName}`,
          amazonProduct.brand ? `Marca: ${amazonProduct.brand}` : '',
          amazonProduct.starRating ? `Avaliação: ${amazonProduct.starRating} estrelas de 5` : '',
          amazonProduct.totalReviews ? `Total de avaliações de clientes: ${amazonProduct.totalReviews}` : '',
          amazonProduct.description ? `Descrição completa e características do produto: ${amazonProduct.description}` : ''
        ].filter(Boolean).join('\n');
        
        console.log(`[generateFullArticle] Seção "${sectionTitle}" corresponde ao produto "${productName}"`);
        return productInfo;
      }
    }
    
    // Se não encontrou correspondência, usar productSummary genérico
    return productSummary;
  };

  // 2. Generate Sections in Batches (OTIMIZAÇÃO: Reduz chamadas de N para ⌈N/batchSize⌉)
  const parsedOutlines = outlines
    .map(outline => parseOutline(outline))
    .filter((outline): outline is { tag: string; text: string } => outline !== null);

  for (let i = 0; i < parsedOutlines.length; i += sectionBatchSize) {
    const batch = parsedOutlines.slice(i, i + sectionBatchSize);
    const currentBatchNumber = Math.floor(i / sectionBatchSize) + 1;
    const totalBatches = Math.ceil(parsedOutlines.length / sectionBatchSize);

    const currentPreviewHtml = fullArticleHtml + '\n' + allSectionsHtml.join('\n');
    onProgress({ 
      status: `Gerando seções ${i + 1}-${Math.min(i + sectionBatchSize, parsedOutlines.length)}/${parsedOutlines.length} (lote ${currentBatchNumber}/${totalBatches})...`, 
      html: currentPreviewHtml 
    });

    try {
      // Para lotes, usar productSummary genérico (otimização)
      // Seções individuais usarão informações específicas
      const batchPrompt = getPromptForSectionsBatch(title, introductionHtml, previousSectionHtml, batch, productSummary);
      const batchResponse = await generateWithGemini(batchPrompt);
      
      // Tentar parsear como JSON (formato de lote)
      let batchResults: Array<{content: string}> | null = null;
      
      // Tentar diferentes padrões de JSON
      const jsonPatterns = [
        /\[[\s\S]*?\]/, // Array simples
        /```json\s*(\[[\s\S]*?\])\s*```/, // JSON em code block
        /```\s*(\[[\s\S]*?\])\s*```/ // Array em code block genérico
      ];
      
      for (const pattern of jsonPatterns) {
        const match = batchResponse.match(pattern);
        if (match) {
          try {
            const jsonStr = match[1] || match[0];
            batchResults = JSON.parse(jsonStr);
            if (Array.isArray(batchResults) && batchResults.length === batch.length) {
              break; // Sucesso!
            }
          } catch (e) {
            continue; // Tentar próximo padrão
          }
        }
      }
      
      if (batchResults && Array.isArray(batchResults) && batchResults.length === batch.length) {
        // Sucesso: usar resultados do lote
        batch.forEach((outline, idx) => {
          let content = batchResults![idx]?.content || '';
          // Limpar asteriscos
          content = content.replace(/\*+/g, '').trim();
          const sectionHtml = `<${outline.tag}>${outline.text}</${outline.tag}>\n${content}`;
          allSectionsHtml.push(sectionHtml);
          previousSectionHtml = sectionHtml;
        });
      } else {
        // Fallback: Gerar seções individualmente se o lote falhar
        console.warn('Falha ao parsear resposta em lote, gerando individualmente...');
        for (const outline of batch) {
          // Usar informações específicas do produto para esta seção
          const sectionProductInfo = getProductInfoForSection(outline.text);
          const sectionPrompt = getPromptForSection(title, introductionHtml, previousSectionHtml, outline.text, sectionProductInfo);
          let sectionContentHtml = await generateWithGemini(sectionPrompt);
          // Limpar asteriscos
          sectionContentHtml = sectionContentHtml.replace(/\*+/g, '').trim();
          const sectionHtml = `<${outline.tag}>${outline.text}</${outline.tag}>\n${sectionContentHtml}`;
    allSectionsHtml.push(sectionHtml);
    previousSectionHtml = sectionHtml;
        }
      }
    } catch (error) {
      console.error('Erro ao gerar lote, tentando individualmente...', error);
      // Fallback: Gerar individualmente
      for (const outline of batch) {
        // Usar informações específicas do produto para esta seção
        const sectionProductInfo = getProductInfoForSection(outline.text);
        const sectionPrompt = getPromptForSection(title, introductionHtml, previousSectionHtml, outline.text, sectionProductInfo);
        const sectionContentHtml = await generateWithGemini(sectionPrompt);
        const sectionHtml = `<${outline.tag}>${outline.text}</${outline.tag}>\n${sectionContentHtml}`;
        allSectionsHtml.push(sectionHtml);
        previousSectionHtml = sectionHtml;
      }
    }
  }

  // 3. SEO Verification and Revision em Lotes (OPCIONAL)
  // IMPORTANTE: em modo produtos (quando há "products" em options), as análises detalhadas
  // já são geradas pela seção de Reviews com cards. Para evitar duplicar o conteúdo
  // (como uma segunda análise dos mesmos produtos antes do FAQ), NÃO anexamos
  // as seções geradas por outline quando products estiver definido.
  const isProductMode = !!(options?.products && options.products.length > 0);

  let revisedArticleBody = '';
  if (!isProductMode) {
    if (enableSeoReview) {
      const seoBatchSize = 5;
      for (let i = 0; i < allSectionsHtml.length; i += seoBatchSize) {
        const batch = allSectionsHtml.slice(i, i + seoBatchSize);
        const batchHtml = batch.join('\n');
        const currentBatchNumber = Math.floor(i / seoBatchSize) + 1;
        const totalBatches = Math.ceil(allSectionsHtml.length / seoBatchSize);

        const currentPreviewHtml = fullArticleHtml + '\n' + revisedArticleBody;
        onProgress({ status: `Revisando SEO do bloco ${currentBatchNumber}/${totalBatches}...`, html: currentPreviewHtml });

        const seoCheckPrompt = getPromptForSeoCheck(title, revisedArticleBody, batchHtml);
        const revisedBatchHtml = await generateWithGemini(seoCheckPrompt, systemInstructionForSeoCheck);

        revisedArticleBody += `\n${revisedBatchHtml}`;
        onProgress({ status: `Bloco ${currentBatchNumber} revisado.`, html: fullArticleHtml + '\n' + revisedArticleBody });
      }
      fullArticleHtml += revisedArticleBody;
    } else {
      // Se não revisar, usar o conteúdo original
      fullArticleHtml += '\n' + allSectionsHtml.join('\n');
    }
  }

  // 4. Adicionar seção de FAQs ANTES da conclusão (se houver) - OTIMIZADO: Geração em lote
  let faqsHtml = '';
  if (options?.faqs && options.faqs.length > 0) {
    onProgress({ status: 'Adicionando seção de Perguntas Frequentes...', html: fullArticleHtml });
    
    // OTIMIZAÇÃO: Gerar FAQs em lotes ao invés de individualmente
    const faqBatchSize = 5; // Processar 5 FAQs por vez
    const enrichedFaqs: Array<{pergunta: string; resposta: string}> = [];
    
    for (let i = 0; i < options.faqs.length; i += faqBatchSize) {
      const faqBatch = options.faqs.slice(i, i + faqBatchSize);
      const batchNumber = Math.floor(i / faqBatchSize) + 1;
      const totalBatches = Math.ceil(options.faqs.length / faqBatchSize);
      
      onProgress({ 
        status: `Enriquecendo FAQs ${i + 1}-${Math.min(i + faqBatchSize, options.faqs.length)}/${options.faqs.length} (lote ${batchNumber}/${totalBatches})...`, 
        html: fullArticleHtml 
      });
      
      try {
        // Criar prompt para lote de FAQs
        const faqsList = faqBatch.map((faq, idx) => 
          `${idx + 1}. Pergunta: "${faq.pergunta}"\n   Resposta base: "${faq.resposta}"`
        ).join('\n\n');
        
        const faqBatchPrompt = `
Você está enriquecendo perguntas frequentes para um artigo sobre: "${title}".

TAREFA:
Enriqueça as respostas das seguintes ${faqBatch.length} perguntas frequentes, tornando-as mais completas e detalhadas.

PERGUNTAS E RESPOSTAS BASE:
${faqsList}

REGRAS PARA CADA RESPOSTA:
- A resposta deve ter entre 80 e 150 palavras
- Seja específico e forneça informações úteis
- Use a resposta base como referência, mas expanda com mais detalhes
- Não use asteriscos (*) ou outros caracteres especiais
- Formato: Apenas parágrafos HTML <p>...</p>

SAÍDA OBRIGATÓRIA (JSON Array puro, sem markdown):
[
  {"pergunta": "Pergunta 1 completa", "resposta": "<p>Resposta enriquecida 1...</p>"},
  {"pergunta": "Pergunta 2 completa", "resposta": "<p>Resposta enriquecida 2...</p>"}
]

IMPORTANTE: 
- Retorne APENAS o JSON array, sem texto adicional, sem markdown
- Mantenha a mesma ordem das perguntas fornecidas
- Cada resposta deve ser HTML válido com tags <p>
`;
        
        const batchResponse = await generateWithGemini(faqBatchPrompt);
        
        // Tentar parsear JSON
        let batchResults: Array<{pergunta: string; resposta: string}> | null = null;
        const jsonPatterns = [
          /\[[\s\S]*?\]/,
          /```json\s*(\[[\s\S]*?\])\s*```/,
          /```\s*(\[[\s\S]*?\])\s*```/
        ];
        
        for (const pattern of jsonPatterns) {
          const match = batchResponse.match(pattern);
          if (match) {
            try {
              const jsonStr = match[1] || match[0];
              batchResults = JSON.parse(jsonStr);
              if (Array.isArray(batchResults) && batchResults.length === faqBatch.length) {
                break;
              }
            } catch (e) {
              continue;
            }
          }
        }
        
        if (batchResults && Array.isArray(batchResults) && batchResults.length === faqBatch.length) {
          // Sucesso: usar resultados do lote
          batchResults.forEach((enriched, idx) => {
            const cleanAnswer = enriched.resposta.replace(/\*+/g, '').trim();
            enrichedFaqs.push({
              pergunta: enriched.pergunta || faqBatch[idx].pergunta,
              resposta: cleanAnswer || `<p>${faqBatch[idx].resposta}</p>`
            });
          });
        } else {
          // Fallback: gerar individualmente se o lote falhar
          console.warn('[FAQ] Falha ao parsear lote de FAQs, gerando individualmente...');
          for (const faq of faqBatch) {
            try {
              const faqPrompt = `
Responda de forma COMPLETA e DETALHADA a seguinte pergunta sobre "${title}":
"${faq.pergunta}"

REGRAS:
- A resposta deve ter entre 80 e 150 palavras
- Seja específico e forneça informações úteis
- Use a resposta base como referência: "${faq.resposta}"
- Não use asteriscos (*) ou outros caracteres especiais
- Formato: Apenas parágrafos HTML <p>...</p>

Saída: APENAS o HTML, sem explicações.
`;
              const enrichedAnswer = await generateWithGemini(faqPrompt);
              const cleanAnswer = enrichedAnswer.replace(/\*+/g, '').trim();
              enrichedFaqs.push({
                pergunta: faq.pergunta,
                resposta: cleanAnswer || `<p>${faq.resposta}</p>`
              });
            } catch (error) {
              console.warn(`[FAQ] Erro ao enriquecer FAQ "${faq.pergunta}":`, error);
              enrichedFaqs.push({
                pergunta: faq.pergunta,
                resposta: `<p>${faq.resposta}</p>`
              });
            }
          }
        }
      } catch (error) {
        console.error('[FAQ] Erro ao processar lote de FAQs, gerando individualmente...', error);
        // Fallback: gerar individualmente
        for (const faq of faqBatch) {
          try {
            const faqPrompt = `
Responda de forma COMPLETA e DETALHADA a seguinte pergunta sobre "${title}":
"${faq.pergunta}"

REGRAS:
- A resposta deve ter entre 80 e 150 palavras
- Seja específico e forneça informações úteis
- Use a resposta base como referência: "${faq.resposta}"
- Não use asteriscos (*) ou outros caracteres especiais
- Formato: Apenas parágrafos HTML <p>...</p>

Saída: APENAS o HTML, sem explicações.
`;
            const enrichedAnswer = await generateWithGemini(faqPrompt);
            const cleanAnswer = enrichedAnswer.replace(/\*+/g, '').trim();
            enrichedFaqs.push({
              pergunta: faq.pergunta,
              resposta: cleanAnswer || `<p>${faq.resposta}</p>`
            });
          } catch (err) {
            enrichedFaqs.push({
              pergunta: faq.pergunta,
              resposta: `<p>${faq.resposta}</p>`
            });
          }
        }
      }
    }
    
    // Organizar FAQs em seção com estrutura melhorada
    faqsHtml = `\n<section>\n<h2>FAQ – ${title}</h2>\n` +
      enrichedFaqs.map(faq => 
        `<h3>${faq.pergunta}</h3>\n${faq.resposta}\n`
      ).join('\n') + '\n</section>\n';
    
    onProgress({ status: `${enrichedFaqs.length} FAQs adicionadas com respostas completas.`, html: fullArticleHtml + faqsHtml });
  }

  // 5. Generate Conclusion (depois dos FAQs)
  onProgress({ status: 'Gerando conclusão...', html: fullArticleHtml + faqsHtml });
  const conclusionPrompt = getPromptForConclusion(title, fullArticleHtml);
  let conclusionHtml = await generateWithGemini(conclusionPrompt);
  // Limpar asteriscos
  conclusionHtml = conclusionHtml.replace(/\*+/g, '').trim();
  fullArticleHtml += faqsHtml + `\n${conclusionHtml}`;

  // 6. Se tiver Associate Tag e produtos, enriquecer artigo com seção Reviews (cards de produtos)
  console.log('[generateFullArticle] Verificando enriquecimento:', {
    hasAssociateTag: !!options?.associateTag,
    hasProducts: !!options?.products,
    productsCount: options?.products?.length || 0,
    hasAmazonProductMap: !!amazonProductMap
  });
  
  if (options?.associateTag && amazonProductMap && amazonProductMap.size > 0) {
    onProgress({ status: 'Enriquecendo artigo com produtos da Amazon...', html: fullArticleHtml });
    try {
      // Usar o productMap que já foi carregado antes da geração das seções
      const productMap = amazonProductMap;
      
      if (productMap.size > 0) {

        // Criar seção dedicada "Reviews dos [Título]" após a tabela comparativa
        // Buscar seção "Reviews" ou "Análise" no outline, ou criar uma nova
        let reviewsSectionTitle = `Reviews dos ${title}`;
        let reviewsSectionIntro = ''; // Parágrafo introdutório da seção
        for (const outline of outlines) {
          const parsed = parseOutline(outline);
          if (parsed && parsed.tag === 'H2') {
            const lower = parsed.text.toLowerCase();
            if (lower.includes('reviews') || lower.includes('análise') || lower.includes('analise')) {
              reviewsSectionTitle = parsed.text;
              // Gerar parágrafo introdutório baseado no título da seção
              const introPrompt = `
Gere um parágrafo introdutório, natural e envolvente para a seção "${reviewsSectionTitle}" de um artigo sobre "${title}".

O parágrafo deve:
- Soar como alguém explicando para um amigo, mas mantendo tom profissional
- Explicar que agora vamos entrar nos reviews individuais, aprofundando pontos fortes, diferenciais e para quem cada modelo é mais indicado
- Conectar explicitamente com a lista/tabela anterior (ex: "depois de ver o panorama geral", "após a comparação da tabela")
- Ter entre 60 e 90 palavras, em 2 ou 3 frases
- NÃO mencionar preços

Saída: Apenas o parágrafo HTML <p>...</p>, sem explicações adicionais.
`;
              try {
                reviewsSectionIntro = await generateWithGemini(introPrompt);
                reviewsSectionIntro = reviewsSectionIntro.replace(/\*+/g, '').trim();
                if (!reviewsSectionIntro.startsWith('<p>')) {
                  reviewsSectionIntro = `<p>${reviewsSectionIntro}</p>`;
                }
              } catch (error) {
                console.warn('[Reviews] Erro ao gerar introdução, usando texto padrão:', error);
                reviewsSectionIntro = `<p>Depois de conferir o panorama geral na tabela comparativa, chegou a hora de olhar com mais carinho para cada modelo. Nesta seção de reviews, vamos explorar em detalhes os pontos fortes, diferenciais e para quem cada bolsa faz mais sentido, ajudando você a enxergar qual opção realmente combina com a sua rotina.</p>`;
              }
              break;
            }
          }
        }
        
        // Se não encontrou seção no outline, criar título e introdução padrão
        if (!reviewsSectionIntro) {
          reviewsSectionTitle = `Reviews dos ${title}`;
          reviewsSectionIntro = `<p>Depois de ver a lista completa e a tabela comparativa, esta seção de reviews aprofunda a análise de cada modelo. Aqui, você encontra uma visão mais humana e detalhada de cada bolsa, com destaques, pontos de atenção e para quem ela é mais indicada, facilitando a decisão de qual opção realmente combina com o seu dia a dia.</p>`;
        }
        
        // Encontrar posição após a tabela comparativa para inserir a seção Reviews
        const tableEndMatch = fullArticleHtml.match(/<\/table>/i);
        const reviewsSectionInsertPos = tableEndMatch 
          ? tableEndMatch.index! + tableEndMatch[0].length
          : fullArticleHtml.indexOf('</h2>', fullArticleHtml.indexOf('Lista dos Top')) + 5;
        
        // Criar conteúdo da seção Reviews com todos os produtos
        const productArray = Array.from(productMap.entries());
        
        // Estrutura para armazenar informações de produtos para processamento
        interface ProductInfo {
          productName: string;
          amazonProduct: any;
          productTitle: string; // Título do produto (H3)
        }
        
        const productsToProcess: ProductInfo[] = [];
        
        // Preparar dados de todos os produtos
        for (const [productName, amazonProduct] of productArray) {
          if (!amazonProduct.affiliateURL) continue;
          productsToProcess.push({
            productName,
            amazonProduct,
            productTitle: amazonProduct.title || productName
          });
        }
        
        // OTIMIZAÇÃO 1: Gerar TODOS os prós/contras e descrições em PARALELO
        console.log(`[generateFullArticle] Gerando ${productsToProcess.length} produtos com descrições e prós/contras em paralelo...`);
        
        // Gerar descrições e prós/contras para cada produto em paralelo
        const productCardsPromises = productsToProcess.map(async (productInfo) => {
          try {
            // Construir informações completas do produto da Amazon (SEM PREÇO)
            const productData = [
              `Título completo do produto: ${productInfo.amazonProduct.title || productInfo.productName}`,
              productInfo.amazonProduct.brand ? `Marca: ${productInfo.amazonProduct.brand}` : '',
              productInfo.amazonProduct.starRating ? `Avaliação: ${productInfo.amazonProduct.starRating} estrelas de 5` : '',
              productInfo.amazonProduct.totalReviews ? `Total de avaliações de clientes: ${productInfo.amazonProduct.totalReviews}` : '',
              productInfo.amazonProduct.description ? `Descrição completa e características do produto: ${productInfo.amazonProduct.description}` : ''
            ].filter(Boolean).join('\n');
            
            // Gerar descrição do produto (2-3 parágrafos, máximo 250 palavras)
            const descriptionPrompt = getPromptForSection(
              title,
              '', // Não precisa de introdução anterior
              '', // Não precisa de seção anterior
              productInfo.productTitle,
              productData
            );
            let productDescription = await generateWithGemini(descriptionPrompt);
            productDescription = productDescription.replace(/\*+/g, '').trim();
            
            // Gerar prós/contras
            const prosConsPrompt = getPromptForProsAndCons(productInfo.productName, productData);
            let prosConsHtml = await generateWithGemini(prosConsPrompt);
            prosConsHtml = prosConsHtml.replace(/\*+/g, '').trim();
            
            // Construir imagem e botão
            let imageHtml = '';
            if (productInfo.amazonProduct.imageUrl) {
              let imageUrl = productInfo.amazonProduct.imageUrl.replace(/_SL\d+_/g, '_SL1000_');
              imageHtml = `<center>\n<a href="${productInfo.amazonProduct.affiliateURL}" target="_blank" rel="nofollow noopener">\n<img class="product-image aligncenter" title="${productInfo.productTitle}" src="${imageUrl}" alt="${productInfo.productTitle}" style="max-width: 800px; width: 100%; height: auto;" />\n</a></center>\n`;
            }
            
            const buttonHtml = `[su_button url="${productInfo.amazonProduct.affiliateURL}" target="blank" style="3d" background="#ff0000" size="6" wide="yes" center="yes" icon="icon: amazon"]VER O MELHOR PREÇO[/su_button]`;
            
            // Construir card completo do produto na ordem: H3, Image, Button, Description, Pros/Cons
            const productCard = `<div class="product-card">
<h3>${productInfo.productTitle}</h3>
${imageHtml}
${buttonHtml}

${productDescription}

${prosConsHtml}
</div>`;
            
            return productCard;
          } catch (error) {
            console.warn(`[Amazon] Erro ao gerar card para ${productInfo.productName}:`, error);
            return ''; // Retornar vazio em caso de erro
          }
        });
        
        // Aguardar todas as gerações em paralelo
        const productCards = await Promise.all(productCardsPromises);
        const validProductCards = productCards.filter(card => card.length > 0);
        
        console.log(`[generateFullArticle] ${validProductCards.length} cards de produtos gerados com sucesso.`);
        
        // Construir seção Reviews completa com introdução e cards de produtos
        const reviewsSectionHtml = `\n<h2>${reviewsSectionTitle}</h2>\n${reviewsSectionIntro}\n` +
          validProductCards.join('\n\n') + '\n';
        
        // Inserir seção Reviews após a tabela comparativa
        fullArticleHtml = fullArticleHtml.substring(0, reviewsSectionInsertPos) + 
          reviewsSectionHtml + 
          fullArticleHtml.substring(reviewsSectionInsertPos);
        
        onProgress({ 
          status: `Artigo enriquecido: ${validProductCards.length} produtos com imagens, descrições, prós/contras e botões na seção Reviews.`, 
          html: fullArticleHtml 
        });
      }
    } catch (error: any) {
      console.warn('[Amazon] Erro ao enriquecer artigo:', error);
      // Não falhar a geração se Amazon falhar
    }
  }
  
  onProgress({ status: 'Artigo finalizado.', html: fullArticleHtml });
};

// ===========================================================================
// BUSCA E EXTRAÇÃO DE PRODUTOS
// ===========================================================================

export const searchAndExtractProducts = async (
  keyword: string,
  count: number = 10,
  excludeDomains: string[] = [],
  start: number = 0
): Promise<{ results: ProductSearchResult[]; isFallback: boolean }> => {
  try {
    console.log("Iniciando busca de produtos...");

    // Primeiro, buscar resultados da SERP (reutilizar lógica existente)
    const searchResponse = await searchAndExtractOutlines(keyword, count, excludeDomains, start);
    
    if (searchResponse.results.length === 0) {
      return { results: [], isFallback: searchResponse.isFallback };
    }

    // Para cada resultado, fazer scraping completo e extrair produtos/FAQ
    const productResults: ProductSearchResult[] = await Promise.all(
      searchResponse.results.map(async (result) => {
        try {
          console.log(`[Produtos] Processando: ${result.url}`);
          
          // Fazer scraping completo
          const scrapeUrl = `/api/scrape?url=${encodeURIComponent(result.url)}`;
          const scrapeRes = await fetch(scrapeUrl);
          
          if (!scrapeRes.ok) {
            const errorText = await scrapeRes.text();
            console.warn(`[Produtos] Falha ao fazer scraping de ${result.url}:`, scrapeRes.status, errorText);
            return {
              ...result,
              products: [],
              faqs: [],
            } as ProductSearchResult;
          }

          const scrapeData = await scrapeRes.json();
          const fullContent = scrapeData.fullContent || '';
          const contentLength = fullContent ? fullContent.length : 0;

          console.log(`[Produtos] Conteúdo extraído de ${result.url}: ${contentLength} caracteres`);

          if (!fullContent || fullContent.trim().length === 0) {
            console.warn(`[Produtos] Conteúdo vazio para ${result.url}`);
            return {
              ...result,
              products: [],
              faqs: [],
            } as ProductSearchResult;
          }

          // Extrair produtos e FAQ em paralelo
          console.log(`[Produtos] Extraindo produtos e FAQ de ${result.url}...`);
          const [products, faqs] = await Promise.all([
            extractProductsFromContent(fullContent, keyword),
            extractFAQsFromContent(fullContent),
          ]);

          console.log(`[Produtos] ${result.url}: ${products.length} produtos, ${faqs.length} FAQs encontrados`);
          
          if (faqs.length > 0) {
            console.log(`[Produtos] FAQs encontradas em ${result.url}:`, faqs.map(f => f.pergunta.substring(0, 50)));
          }

          return {
            ...result,
            products,
            faqs,
          } as ProductSearchResult;

        } catch (error) {
          console.error(`[Produtos] Erro ao processar ${result.url}:`, error);
          return {
            ...result,
            products: [],
            faqs: [],
          } as ProductSearchResult;
        }
      })
    );

    return {
      results: productResults,
      isFallback: searchResponse.isFallback,
    };

  } catch (error) {
    console.error("Erro na busca de produtos:", error);
    throw error;
  }
};