import { Product, FAQItem } from "../types";

/**
 * Extrai nomes de produtos do conteúdo de um artigo usando IA (DeepSeek com fallback Gemini)
 */
export const extractProductsFromContent = async (content: string, keyword: string): Promise<Product[]> => {
  try {
    if (!content || content.trim().length === 0) {
      console.warn('[Extrator] Conteúdo vazio fornecido para extração de produtos');
      return [];
    }

    // Estratégia: Se o conteúdo for muito grande, priorizar seções que geralmente contêm listas de produtos
    // OTIMIZAÇÃO: Reduzido para 20000 chars (suficiente para capturar produtos, reduz tokens)
    let limitedContent = content;
    const maxChars = 20000; // Otimizado: reduzido de 30000 para 20000 para economizar tokens
    
    if (content.length > maxChars) {
      // Tentar encontrar seções relevantes primeiro
      const productKeywords = ['melhor', 'top', 'lista', 'ranking', 'produto', 'modelo', 'marca', 'recomendado'];
      const lowerContent = content.toLowerCase();
      
      // Encontrar índices de seções relevantes
      const relevantSections: number[] = [];
      productKeywords.forEach(keyword => {
        let index = lowerContent.indexOf(keyword, 0);
        while (index !== -1 && index < maxChars) {
          relevantSections.push(index);
          index = lowerContent.indexOf(keyword, index + 1);
        }
      });
      
      if (relevantSections.length > 0) {
        // Pegar desde o início até maxChars, mas priorizando seções relevantes
        const startPos = Math.max(0, Math.min(...relevantSections) - 2000); // 2000 chars antes da primeira seção relevante
        limitedContent = content.substring(startPos, startPos + maxChars);
        console.log(`[Extrator] Conteúdo otimizado: ${limitedContent.length} chars (posição ${startPos}-${startPos + maxChars} de ${content.length} total)`);
      } else {
        // Fallback: pegar do início
        limitedContent = content.substring(0, maxChars);
        console.log(`[Extrator] Extraindo produtos de ${limitedContent.length} caracteres (de ${content.length} total)`);
      }
    } else {
      console.log(`[Extrator] Extraindo produtos de ${limitedContent.length} caracteres (conteúdo completo)`);
    }
    
    const prompt = `
Você é um extrator especializado em identificar produtos mencionados em artigos de comparação e listas.

CONTEXTO:
A busca foi por: "${keyword}"
O artigo abaixo é sobre produtos relacionados a essa busca.

TAREFA:
Analise o conteúdo abaixo e extraia TODOS os nomes de produtos mencionados.
Procure por:
- Nomes de marcas e modelos (ex: "Escova Rotativa GA.MA Professional", "Conair Infiniti Pro")
- Produtos listados em rankings, comparações ou listas
- Produtos mencionados em seções como "Melhores produtos", "Top 10", etc.
- Nomes comerciais completos de produtos

REGRAS CRÍTICAS (MUITO IMPORTANTE):
- Extraia TODOS os produtos mencionados, SEM EXCEÇÃO
- Se o artigo menciona "10 melhores", "Top 15", "Lista de 20", etc., extraia EXATAMENTE esse número de produtos
- Inclua nomes completos (marca + modelo quando disponível)
- Se um produto aparecer múltiplas vezes, inclua apenas uma vez
- Ignore termos genéricos como "produto", "item", "artigo", "opção"
- Procure em TODAS as seções: listas numeradas, tabelas, parágrafos, títulos
- Se encontrar uma lista numerada (1, 2, 3...), extraia TODOS os itens da lista
- Se encontrar uma tabela com produtos, extraia TODOS os produtos da tabela
- Seja EXTREMAMENTE abrangente: não deixe nenhum produto de fora
- Se o artigo tem seções como "Melhores X", "Top Y", "Lista de Z", extraia TODOS os produtos dessas seções

CONTEÚDO DO ARTIGO:
${limitedContent}

SAÍDA OBRIGATÓRIA (JSON Array puro, sem markdown, sem explicações, sem texto antes ou depois):
["Nome Completo do Produto 1", "Nome Completo do Produto 2", "Nome Completo do Produto 3"]

EXEMPLO DE SAÍDA CORRETA:
["Escova Rotativa GA.MA Professional", "Conair Infiniti Pro", "Mondial PR-30", "Philips HP8660"]

IMPORTANTE CRÍTICO: 
- Retorne APENAS o JSON array
- Não adicione texto explicativo
- Não use markdown (sem \`\`\`)
- Extraia TODOS os produtos mencionados no artigo, SEM FALTA
- Se o artigo menciona um número específico de produtos (ex: "10 melhores"), você DEVE extrair exatamente esse número
- Não pare até ter extraído TODOS os produtos visíveis no conteúdo fornecido
- Se houver dúvida se algo é um produto, INCLUA (é melhor incluir demais do que faltar)
`;

    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt,
        systemInstruction: 'Você é um extrator especializado em identificar produtos mencionados em artigos de comparação e listas. Retorne APENAS JSON arrays válidos, sem markdown ou explicações.'
      }),
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || 'Falha ao gerar conteúdo.');
    }
    
    const data = (await res.json()) as { text?: string; provider?: string };
    const text = (data.text ?? '').trim();
    const provider = data.provider || 'unknown';
    
    console.log(`[Extrator] Resposta obtida via ${provider} (primeiros 500 chars): ${text.substring(0, 500)}`);
    console.log(`[Extrator] Tamanho total da resposta: ${text.length} caracteres`);
    
    // Tentar extrair JSON de diferentes formatos
    let products: string[] = [];
    
    // Padrão 1: JSON em code block (mais comum)
    const jsonBlockMatch = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
    if (jsonBlockMatch) {
      try {
        const parsed = JSON.parse(jsonBlockMatch[1]);
        if (Array.isArray(parsed)) {
          products = parsed;
          console.log(`[Extrator] Produtos extraídos via code block: ${products.length}`);
        }
      } catch (e) {
        console.warn("[Extrator] Erro ao parsear JSON do code block", e);
        console.warn("[Extrator] Conteúdo do code block:", jsonBlockMatch[1].substring(0, 500));
      }
    }
    
    // Padrão 2: JSON direto no texto (sem code block)
    if (products.length === 0) {
      // Tentar encontrar o maior array JSON no texto
      const jsonMatches = text.match(/\[[\s\S]*?\]/g);
      if (jsonMatches && jsonMatches.length > 0) {
        // Pegar o maior match (provavelmente é o array de produtos)
        const largestMatch = jsonMatches.reduce((a, b) => a.length > b.length ? a : b);
        try {
          const parsed = JSON.parse(largestMatch);
          if (Array.isArray(parsed)) {
            products = parsed;
            console.log(`[Extrator] Produtos extraídos via JSON direto: ${products.length}`);
          }
        } catch (e) {
          console.warn("[Extrator] Erro ao parsear JSON direto", e);
          console.warn("[Extrator] Conteúdo tentado:", largestMatch.substring(0, 200));
        }
      }
    }
    
    // Padrão 3: Tentar extrair lista numerada ou com bullets se JSON falhar
    if (products.length === 0) {
      console.warn(`[Extrator] Nenhum JSON válido encontrado. Tentando extrair de lista...`);
      // Procurar por padrões de lista
      const listPattern = /(?:^|\n)[\s]*[-•*]\s*(.+?)(?=\n|$)/gm;
      const listMatches = text.match(listPattern);
      if (listMatches && listMatches.length > 0) {
        products = listMatches.map(m => m.replace(/^[\s]*[-•*]\s*/, '').trim()).filter(p => p.length > 3);
        console.log(`[Extrator] Produtos extraídos de lista: ${products.length}`);
      }
    }

    if (products.length === 0) {
      console.warn(`[Extrator] Nenhum produto encontrado. Resposta completa: ${text}`);
    } else {
      console.log(`[Extrator] Total de produtos extraídos: ${products.length}`);
      console.log(`[Extrator] Primeiros produtos:`, products.slice(0, 5));
    }

    // Converter para formato Product
    return products
      .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
      .map(name => ({ name: name.trim() }))
      .filter((product, index, self) => 
        index === self.findIndex(p => p.name.toLowerCase() === product.name.toLowerCase())
      ); // Remover duplicatas (case-insensitive)

  } catch (error) {
    console.error("Erro ao extrair produtos:", error);
    return [];
  }
};

/**
 * Extrai perguntas frequentes (FAQ) do conteúdo de um artigo usando IA (DeepSeek com fallback Gemini)
 * Melhorado para detectar FAQs em múltiplas seções do artigo e com parsing mais robusto
 */
export const extractFAQsFromContent = async (content: string): Promise<FAQItem[]> => {
  try {
    if (!content || content.trim().length === 0) {
      console.warn('[Extrator FAQ] Conteúdo vazio fornecido');
      return [];
    }

    // ESTRATÉGIA MELHORADA: Buscar FAQs em múltiplas seções do artigo
    // FAQs podem estar no início, meio ou fim do artigo
    const contentLength = content.length;
    const sectionSize = 15000; // Tamanho de cada seção para análise
    
    let sectionsToAnalyze: string[] = [];
    
    if (contentLength <= sectionSize) {
      // Artigo pequeno: analisar tudo
      sectionsToAnalyze = [content];
      console.log(`[Extrator FAQ] Artigo pequeno (${contentLength} chars), analisando conteúdo completo`);
    } else {
      // Artigo grande: analisar início, meio e fim
      const startSection = content.substring(0, sectionSize);
      const middleStart = Math.floor((contentLength - sectionSize) / 2);
      const middleSection = content.substring(middleStart, middleStart + sectionSize);
      const endSection = content.substring(Math.max(0, contentLength - sectionSize));
      
      sectionsToAnalyze = [startSection, middleSection, endSection];
      console.log(`[Extrator FAQ] Artigo grande (${contentLength} chars), analisando 3 seções: início, meio e fim`);
    }
    
    // Analisar cada seção e combinar resultados
    const allFAQs: FAQItem[] = [];
    
    for (let i = 0; i < sectionsToAnalyze.length; i++) {
      const section = sectionsToAnalyze[i];
      const sectionLabel = sectionsToAnalyze.length === 1 ? 'completo' : (i === 0 ? 'início' : i === 1 ? 'meio' : 'fim');
      console.log(`[Extrator FAQ] Analisando seção ${sectionLabel} (${section.length} chars)`);
      
      const prompt = `
Você é um extrator especializado em identificar seções de Perguntas Frequentes (FAQ) em artigos.

TAREFA CRÍTICA:
Analise o conteúdo abaixo e identifique TODAS as seções de Perguntas Frequentes. Seja EXTREMAMENTE abrangente.

PADRÕES A PROCURAR (em ordem de prioridade):
1. Seções explicitamente marcadas:
   - "FAQ", "Perguntas Frequentes", "Dúvidas Comuns", "Perguntas e Respostas"
   - "Perguntas Frequentes sobre...", "Dúvidas sobre...", "Questões Comuns"
   - Qualquer título que contenha "pergunta", "dúvida", "questão", "FAQ"

2. Estruturas de cabeçalho seguido de resposta:
   - [HEADING_H2], [HEADING_H3], [HEADING_H4] que sejam perguntas seguidas de parágrafos
   - Qualquer cabeçalho que termine com "?" ou comece com palavras interrogativas
   - Cabeçalhos que pareçam perguntas mesmo sem "?"

3. Padrões de pergunta/resposta no texto:
   - Perguntas que começam com: "Como", "Qual", "O que", "Por que", "Quando", "Onde", "Quem", "Por quanto", "Quanto tempo", "É possível", "Vale a pena", "Funciona", "Serve para"
   - Seguidas imediatamente por respostas (parágrafos, listas, ou texto explicativo)
   - Padrões como "P: ... R: ..." ou "Pergunta: ... Resposta: ..."

4. Listas de perguntas:
   - Listas numeradas ou com bullets que contenham perguntas
   - Cada item da lista seguido de uma resposta

5. Estruturas HTML comuns de FAQ:
   - Divs com classes como "faq", "pergunta", "resposta", "question", "answer"
   - Elementos <dl> (definition list) com <dt> (pergunta) e <dd> (resposta)

REGRAS CRÍTICAS DE EXTRAÇÃO:
- Extraia TODOS os pares de pergunta e resposta encontrados, SEM EXCEÇÃO
- Se um cabeçalho [HEADING_*] for uma pergunta, use-o como pergunta e TODO o texto que vem DEPOIS dele até o próximo cabeçalho como resposta
- Se encontrar "P:" ou "Pergunta:" seguido de texto, esse é o início de uma FAQ
- Se encontrar "R:" ou "Resposta:" seguido de texto, esse é a resposta da FAQ anterior
- Mantenha as perguntas e respostas COMPLETAS, não resuma
- Se a resposta tiver múltiplos parágrafos, inclua TODOS
- Se não houver FAQ explícito, procure por QUALQUER padrão de pergunta seguida de resposta
- NÃO ignore FAQs que estejam em qualquer parte do conteúdo
- Se houver dúvida se algo é uma FAQ, INCLUA (é melhor incluir demais do que faltar)

CONTEÚDO DA SEÇÃO DO ARTIGO:
${section}

SAÍDA OBRIGATÓRIA (JSON Array puro, sem markdown, sem explicações, sem texto antes ou depois):
[
  {"pergunta": "Qual é a pergunta completa exatamente como aparece no texto?", "resposta": "Esta é a resposta completa, incluindo todos os parágrafos relevantes."},
  {"pergunta": "Outra pergunta encontrada?", "resposta": "Outra resposta completa encontrada no texto."}
]

IMPORTANTE CRÍTICO: 
- Retorne APENAS o JSON array válido
- Não adicione texto explicativo antes ou depois
- Não use markdown (sem \`\`\`json ou \`\`\`)
- Se não houver FAQ nesta seção, retorne: []
- Extraia TODAS as FAQs encontradas, mesmo que pareçam similares
- Seja EXTREMAMENTE abrangente - é melhor extrair demais do que faltar
`;

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt,
          systemInstruction: 'Você é um extrator especializado em identificar seções de Perguntas Frequentes (FAQ) em artigos. Seja EXTREMAMENTE abrangente. Retorne APENAS JSON arrays válidos, sem markdown ou explicações.'
        }),
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.warn(`[Extrator FAQ] Erro ao processar seção ${sectionLabel}:`, (data as { error?: string }).error || 'Falha ao gerar conteúdo.');
        continue; // Continuar com próxima seção
      }
      
      const data = (await res.json()) as { text?: string; provider?: string };
      const text = (data.text ?? '').trim();
      const provider = data.provider || 'unknown';
      
      console.log(`[Extrator FAQ] Resposta obtida via ${provider} para seção ${sectionLabel} (primeiros 300 chars): ${text.substring(0, 300)}`);
      
      // Tentar extrair JSON de diferentes formatos (parsing mais robusto)
      let faqs: Array<{pergunta: string; resposta: string}> = [];
      
      // Padrão 1: JSON em code block (com variações)
      const jsonBlockPatterns = [
        /```(?:json)?\s*(\[[\s\S]*?\])\s*```/,
        /```\s*(\[[\s\S]*?\])\s*```/,
        /`\s*(\[[\s\S]*?\])\s*`/
      ];
      
      for (const pattern of jsonBlockPatterns) {
        const match = text.match(pattern);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]);
            if (Array.isArray(parsed) && parsed.length > 0) {
              faqs = parsed;
              console.log(`[Extrator FAQ] FAQs extraídas via code block (seção ${sectionLabel}): ${faqs.length}`);
              break;
            }
          } catch (e) {
            // Continuar tentando outros padrões
          }
        }
      }
      
      // Padrão 2: JSON direto no texto (melhorado para encontrar o maior array)
      if (faqs.length === 0) {
        const jsonMatches = text.match(/\[[\s\S]*?\]/g);
        if (jsonMatches && jsonMatches.length > 0) {
          // Tentar parsear do maior para o menor (maior chance de ser o array completo)
          const sortedMatches = jsonMatches.sort((a, b) => b.length - a.length);
          for (const match of sortedMatches) {
            try {
              const parsed = JSON.parse(match);
              if (Array.isArray(parsed) && parsed.length > 0) {
                faqs = parsed;
                console.log(`[Extrator FAQ] FAQs extraídas via JSON direto (seção ${sectionLabel}): ${faqs.length}`);
                break;
              }
            } catch (e) {
              // Continuar tentando
            }
          }
        }
      }
      
      // Padrão 3: Tentar encontrar JSON após palavras-chave comuns
      if (faqs.length === 0) {
        const keywords = ['faq', 'perguntas', 'respostas', 'questions', 'answers'];
        for (const keyword of keywords) {
          const keywordIndex = text.toLowerCase().indexOf(keyword);
          if (keywordIndex !== -1) {
            const afterKeyword = text.substring(keywordIndex);
            const jsonMatch = afterKeyword.match(/\[[\s\S]*?\]/);
            if (jsonMatch) {
              try {
                const parsed = JSON.parse(jsonMatch[0]);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  faqs = parsed;
                  console.log(`[Extrator FAQ] FAQs extraídas após palavra-chave "${keyword}" (seção ${sectionLabel}): ${faqs.length}`);
                  break;
                }
              } catch (e) {
                // Continuar
              }
            }
          }
        }
      }

      // Validar e adicionar FAQs desta seção
      const validFAQs = faqs
        .filter((item): item is {pergunta: string; resposta: string} => 
          item && 
          typeof item.pergunta === 'string' && 
          typeof item.resposta === 'string' &&
          item.pergunta.trim().length > 5 && // Pergunta deve ter pelo menos 5 caracteres
          item.resposta.trim().length > 10 // Resposta deve ter pelo menos 10 caracteres
        )
        .map(item => ({
          pergunta: item.pergunta.trim(),
          resposta: item.resposta.trim()
        }));
      
      if (validFAQs.length > 0) {
        allFAQs.push(...validFAQs);
        console.log(`[Extrator FAQ] ${validFAQs.length} FAQs válidas extraídas da seção ${sectionLabel}`);
      } else {
        console.log(`[Extrator FAQ] Nenhuma FAQ encontrada na seção ${sectionLabel}`);
      }
    }
    
    // Remover duplicatas (comparando perguntas similares)
    const uniqueFAQs: FAQItem[] = [];
    const seenQuestions = new Set<string>();
    
    for (const faq of allFAQs) {
      // Normalizar pergunta para comparação (lowercase, remover pontuação)
      const normalized = faq.pergunta.toLowerCase()
        .replace(/[?!.,;:]/g, '')
        .trim();
      
      // Verificar se já vimos uma pergunta similar (com tolerância para pequenas diferenças)
      let isDuplicate = false;
      for (const seen of seenQuestions) {
        // Se as perguntas são muito similares (80% de similaridade), considerar duplicata
        const similarity = calculateSimilarity(normalized, seen);
        if (similarity > 0.8) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        seenQuestions.add(normalized);
        uniqueFAQs.push(faq);
      }
    }
    
    console.log(`[Extrator FAQ] Total de FAQs únicas encontradas: ${uniqueFAQs.length} (de ${allFAQs.length} extraídas)`);
    
    return uniqueFAQs;

  } catch (error) {
    console.error("Erro ao extrair FAQs:", error);
    return [];
  }
};

/**
 * Calcula similaridade entre duas strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  // Calcular distância de Levenshtein
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Calcula distância de Levenshtein entre duas strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}
