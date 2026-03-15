# Viabilidade: DeepSeek API para geração de artigos

## Objetivo
Avaliar o uso da API DeepSeek para reduzir custo na geração de artigos, mantendo a opção do Gemini como fallback e **sem alterar o código atual**.

---

## Custos atuais (Gemini 2.5 Flash)

- **Preço (Google):** Input US$ 0,30 / 1M tokens | Output US$ 2,50 / 1M tokens  
- **Uso estimado por artigo:** dezenas de chamadas (introdução, lotes de seções, cards de produtos, FAQs, etc.). Ordem de grandeza: ~150k tokens de input e ~200k tokens de output por artigo.  
- **Custo aproximado por artigo (Gemini):** ~US$ 0,50–0,55 → **10 artigos ≈ US$ 5–5,50 (≈ R$ 26–29).**  
- O valor que você citou (R$ 21 para 10 artigos) está alinhado com essa faixa, considerando câmbio e variação de uso.

---

## Preços DeepSeek (deepseek-chat, modelo padrão)

| Tipo        | Preço (US$ / 1M tokens) |
|------------|---------------------------|
| Input (cache miss) | 0,28 |
| Input (cache hit)  | 0,028 |
| Output     | **0,42** |

- **Contexto:** 128K tokens  
- **Saída máxima por chamada:** 8K tokens (padrão) — relevante para respostas longas (ex.: seções em lote).

Fonte: [DeepSeek API – Pricing](https://api-docs.deepseek.com/quick_start/pricing)

---

## Comparação de custo (ordem de grandeza)

Para o **mesmo volume de tokens** (ex.: 150k input + 200k output por artigo):

| Provider | Custo por artigo (US$) | 10 artigos (US$) | 10 artigos (R$, ~5,2) |
|----------|------------------------|------------------|-------------------------|
| Gemini 2.5 Flash | ~0,50–0,55 | ~5–5,50 | ~R$ 26–29 |
| DeepSeek (deepseek-chat) | ~0,10–0,13 | ~1,00–1,30 | **~R$ 5,20–6,75** |

**Economia estimada:** na faixa de **70–80%** (ex.: de R$ 21 para algo em torno de R$ 5–7 em 10 artigos), mantendo a mesma lógica de chamadas e tamanho de texto.

O custo do **output** domina (texto longo). No DeepSeek o output é US$ 0,42/1M vs Gemini US$ 2,50/1M — cerca de **6x mais barato** por token de saída.

---

## Viabilidade técnica (sem mudar nada ainda)

1. **Compatibilidade**
   - A API DeepSeek segue formato **OpenAI-compatible** (chat completions).  
   - O projeto hoje usa `@google/genai` e `generateContent`. Para usar DeepSeek seria preciso uma camada que convertisse “prompt + opções” em chamadas à API DeepSeek (ou um adapter que exponha a mesma interface e, internamente, escolha Gemini ou DeepSeek).

2. **Limite de 8K tokens por resposta**
   - Geração atual: em lotes (seções, FAQs, etc.), não um único “artigo inteiro” por chamada.  
   - Cada resposta individual (uma seção, um card, um lote de FAQs) tende a ficar abaixo de 8K tokens.  
   - **Risco:** algum lote (ex.: muitas seções ou FAQs em um único JSON) poder ultrapassar 8K. Seria preciso garantir que nenhuma chamada exija mais que 8K de output (dividir lotes ou reduzir `sectionBatchSize`/tamanho de FAQ batch se for usar DeepSeek).

3. **Idioma (português)**
   - DeepSeek é multilíngue e usado em produção para vários idiomas.  
   - Não há documento específico “só para PT-BR”; a qualidade em português costuma ser boa, mas **só dá para validar na prática** (1–2 artigos de teste) antes de confiar 100% em produção.

4. **Manter Gemini como fallback**
   - É viável: a decisão “qual provedor usar” pode ser por configuração (ex.: env) ou por tentativa (DeepSeek primeiro; em caso de erro ou timeout, retentar com Gemini).  
   - Assim você mantém a opção de “voltar” só trocando config, sem perder a base atual.

---

## Resumo: economia vs qualidade

| Aspecto | Conclusão |
|--------|-----------|
| **Economia** | **Alta** — redução bruta de custo na faixa de 70–80% é realista se o consumo de tokens for parecido. |
| **Qualidade** | **Provável** que seja próxima, mas não garantida em PT-BR; recomenda-se teste com 1–2 artigos antes de migrar todo o fluxo. |
| **Risco técnico** | **Baixo/médio** — limite de 8K por resposta pode exigir ajuste de tamanho de lote só para DeepSeek; adapter + fallback para Gemini é factível. |
| **Reversão** | **Fácil** — mantendo Gemini no código, basta desligar DeepSeek (config) e voltar a usar só Gemini. |

---

## Recomendações (quando for implementar)

1. **Não alterar nada agora** (conforme pedido); usar este doc só como base de decisão.  
2. Quando for implementar:
   - Criar um **provedor de IA abstrato** (ex.: `generateWithAI(prompt, options)`) que:
     - Chame DeepSeek quando configurado para isso, e  
     - Em caso de erro/falha, chame Gemini (fallback).  
   - Garantir que **nenhuma chamada ao DeepSeek espere mais de 8K tokens de saída** (ajustar batch sizes se necessário).  
   - Rodar **1–2 artigos completos** com DeepSeek e revisar qualidade (clareza, SEO, tom) antes de usar em escala.  
3. Manter **Gemini sempre disponível** como opção (config ou fallback) para poder voltar sem retrabalho.

---

## Implementação (concluída)

A geração de artigos passou a usar o backend como proxy de IA:

1. **Backend (`server.js`)**  
   - Rota `POST /api/ai/generate` recebe `{ prompt, systemInstruction }`.  
   - Tenta **DeepSeek** primeiro (se `DEEPSEEK_API_KEY` estiver definida).  
   - Em falha ou ausência da chave, usa **Gemini** (fallback) com `GEMINI_API_KEY` ou `API_KEY`.

2. **Frontend (`services/gemini.ts`)**  
   - `generateWithGemini` agora chama `fetch('/api/ai/generate', ...)` em vez do SDK do Google.  
   - As chaves de API ficam apenas no servidor.

### Variáveis de ambiente (servidor)

No `.env` ou `.env.local` na raiz do projeto (servidor carrega com `dotenv`):

| Variável | Obrigatório | Uso |
|----------|-------------|-----|
| `DEEPSEEK_API_KEY` | Não (mas recomendado para economia) | Se definida, a geração de artigos usa DeepSeek primeiro. Obtenha em [DeepSeek Platform](https://platform.deepseek.com/). |
| `GEMINI_API_KEY` ou `API_KEY` | Sim (para fallback ou uso único) | Usado quando DeepSeek falha ou quando `DEEPSEEK_API_KEY` não está definida. |

**Exemplo:**  
Para ativar DeepSeek e manter Gemini como fallback:
```env
DEEPSEEK_API_KEY=sk-xxxxxxxx
GEMINI_API_KEY=xxxxxxxx
```

**Como voltar a usar só Gemini:**  
Remova ou comente `DEEPSEEK_API_KEY` no `.env` e reinicie o servidor. O fallback usará apenas Gemini.

---

*Documento atualizado após implementação; alterações em `server.js` e `services/gemini.ts`.*
