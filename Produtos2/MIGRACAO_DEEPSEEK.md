# Migração para DeepSeek - Documentação

## ✅ Migrações Concluídas

### Fase 1: Extração de Produtos e FAQs (Prioridade Alta)
- ✅ `services/productExtractor.ts` → `extractProductsFromContent()` - Migrado para `/api/ai/generate`
- ✅ `services/productExtractor.ts` → `extractFAQsFromContent()` - Migrado para `/api/ai/generate`

**Impacto**: Alto - Essas funções são chamadas para cada resultado de busca de produtos, gerando múltiplas chamadas ao Gemini.

### Fase 2: Busca e Estratégia (Prioridade Média)
- ✅ `services/gemini.ts` → `generateConsolidatedStrategy()` - Migrado para `/api/ai/generate`
- ⚠️ `services/gemini.ts` → `searchAndExtractOutlines()` (fallback) - **Mantido Gemini direto**

**Decisão sobre fallback**: O fallback de busca usa a ferramenta `googleSearch` específica do Gemini, que não está disponível no DeepSeek. Como este é um caso raro (quando SerpApi e Outscraper falham), o custo é aceitável. Documentado no código.

## 📝 Código Antigo

### `gerador-de-artigos-seo/`
- **Status**: Código antigo/duplicado não utilizado pelo App principal
- **Localização**: Diretório separado com seu próprio `App.tsx` e `vite.config.ts`
- **Ação**: Não removido (conforme regras do usuário). Pode ser removido manualmente se não for mais necessário.

## 🔍 Verificações

### Funções que ainda usam Gemini diretamente:
1. `services/gemini.ts` → `searchAndExtractOutlines()` (fallback) - **Intencional** (usa googleSearch tool)
2. `gerador-de-artigos-seo/services/geminiService.ts` - **Código antigo não utilizado**

### Funções migradas para DeepSeek:
1. ✅ `services/productExtractor.ts` → `extractProductsFromContent()`
2. ✅ `services/productExtractor.ts` → `extractFAQsFromContent()`
3. ✅ `services/gemini.ts` → `generateConsolidatedStrategy()`
4. ✅ `services/gemini.ts` → `generateWithGemini()` (já estava migrado)

## 💰 Impacto Esperado

Com essas migrações, espera-se uma redução de **70-80% nos custos** de geração de artigos, pois:
- Extração de produtos e FAQs (maior volume de chamadas) agora usa DeepSeek
- Geração de estratégia consolidada usa DeepSeek
- Apenas o fallback raro de busca continua usando Gemini (aceitável)

## 🧪 Próximos Passos

1. Testar extração de produtos com diferentes formatos de artigo
2. Testar extração de FAQs
3. Testar geração de estratégia consolidada
4. Monitorar logs para confirmar uso de DeepSeek
5. Monitorar custos por 1 semana após deploy

## 📊 Logs Esperados

Após a migração, os logs devem mostrar:
- `[Extrator] Resposta obtida via deepseek` (ou `gemini` como fallback)
- `[Extrator FAQ] Resposta obtida via deepseek` (ou `gemini` como fallback)
- `[Strategy] Resposta obtida via deepseek` (ou `gemini` como fallback)
- `[Search Fallback] Usando Gemini com googleSearch tool (fallback raro)` (apenas quando necessário)
