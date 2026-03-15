import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // Fallback to .env

const apiKey = process.env.API_KEY;
if (!apiKey) {
    console.error("API_KEY not found in .env");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const mockContext = {
    keyword: "como desentupir pia",
    metrics: { baseCount: 5, maxAllowed: 6 }, // 5 + 30% = 6.5 -> 6
    baseArticle: {
        url: "http://base.com",
        outline: [
            { tag: "H1", text: "Como desentupir pia: Guia Completo" },
            { tag: "H2", text: "Menu" }, // Should be removed
            { tag: "H2", text: "Sobre Nós" }, // Should be removed
            { tag: "H2", text: "Usando Bicarbonato" },
            { tag: "H2", text: "Usando Coca-Cola" },
            { tag: "H2", text: "Deixe um comentário" } // Should be removed
        ]
    },
    competitors: [
        {
            order: 1,
            url: "http://comp1.com",
            outline: [
                { tag: "H1", text: "Dicas de Pia" },
                { tag: "H2", text: "Usando Bicarbonato" }, // Duplicate
                { tag: "H2", text: "Usando Soda Cáustica" } // New (High Authority)
            ]
        },
        {
            order: 2,
            url: "http://comp2.com",
            outline: [
                { tag: "H1", text: "Pia Entupida?" },
                { tag: "H2", text: "Usando Soda Cáustica" }, // Recurring
                { tag: "H2", text: "Chame um encanador" } // New
            ]
        }
    ]
};

const prompt = `
      Você é um Arquiteto de SEO Sênior e Especialista em Estrutura de Conteúdo.
      
      OBJETIVO: Criar uma "Master Outline" consolidada para a palavra-chave: "${mockContext.keyword}".

      REGRAS CRÍTICAS DE FILTRAGEM (Aplicar a TODOS os passos):
      - REMOVER IMEDIATAMENTE: Cabeçalhos institucionais ("Sobre", "Contato", "Login"), Navegação ("Menu", "Busca"), Rodapés ("Política de Privacidade", "Termos"), Redes Sociais ("Instagram", "Facebook"), Newsletters, Comentários ("Deixe um comentário"), e "Veja também" / "Posts relacionados".
      - REMOVER: Conteúdos repetitivos ou que não agregam valor informacional direto ao tema.

      ALGORITMO DE GERAÇÃO:

      1. **LIMPEZA DA BASE (Passo Zero):**
         - Pegue a outline do "baseArticle".
         - Aplique as REGRAS CRÍTICAS DE FILTRAGEM. Remova todo o lixo.
         - O que sobrar é a sua **ESTRUTURA BASE**. Conte os tópicos (H2/H3) desta base limpa.
         - Calcule o LIMITE MÁXIMO: Base Limpa + 30% (arredondado para baixo).

      2. **ANÁLISE DE ENRIQUECIMENTO (Competidores):**
         - Analise os "competitors" na ordem fornecida (que reflete a posição na SERP: 1º, 2º, 3º...).
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

      SAÍDA OBRIGATÓRIA (JSON):
      {
        "baseHeadings": (int), // Contagem da base APÓS limpeza
        "maxHeadings": (int), // O limite calculado (+30%)
        "finalHeadings": (int), // Contagem final
        "metaDescription": "...",
        "masterOutline": [ 
           { "tag": "H1", "text": "Título Principal Otimizado" },
           { "tag": "H2", "text": "..." },
           { "tag": "H3", "text": "..." }
        ]
      }

      INPUT DADOS:
      ${JSON.stringify(mockContext)}
`;

async function run() {
    console.log("Testing Prompt Logic...");
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { temperature: 0.1 },
        });

        const text = response.text || "";
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
        const jsonString = jsonMatch ? jsonMatch[1] : text;

        console.log("--- RESULT ---");
        console.log(jsonString);
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
