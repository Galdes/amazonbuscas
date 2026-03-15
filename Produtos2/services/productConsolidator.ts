import { ProductSearchResult, ProductConsolidation, Product, FAQItem, RepeatedProduct } from "../types";

/**
 * Consolida produtos de múltiplos artigos seguindo a lógica:
 * - 1º artigo selecionado = base (todos os produtos)
 * - Adiciona 30% dos produtos mais repetidos que não estão na base
 * - Consolida FAQs removendo duplicatas
 */
export const consolidateProducts = (
  selectedResults: ProductSearchResult[]
): ProductConsolidation => {
  if (selectedResults.length === 0) {
    return {
      baseProducts: [],
      addedProducts: [],
      totalProducts: [],
      faqs: [],
      baseCount: 0,
      addedCount: 0,
      totalCount: 0,
    };
  }

  // Primeiro artigo = base
  const baseResult = selectedResults[0];
  const baseProducts = baseResult.products || [];
  const baseProductNames = new Set(
    baseProducts.map(p => p.name.toLowerCase().trim())
  );

  // Contar frequência de produtos nos demais artigos
  const productFrequency = new Map<string, { product: Product; count: number }>();

  // Processar artigos restantes (índices 1+)
  for (let i = 1; i < selectedResults.length; i++) {
    const result = selectedResults[i];
    const products = result.products || [];

    for (const product of products) {
      const normalizedName = product.name.toLowerCase().trim();
      
      // Ignorar produtos que já estão na base
      if (baseProductNames.has(normalizedName)) {
        continue;
      }

      // Contar frequência
      if (productFrequency.has(normalizedName)) {
        const existing = productFrequency.get(normalizedName)!;
        existing.count += 1;
      } else {
        productFrequency.set(normalizedName, {
          product: { name: product.name.trim() },
          count: 1,
        });
      }
    }
  }

  // Calcular 30% dos produtos da base
  const baseCount = baseProducts.length;
  const targetAddedCount = Math.floor(baseCount * 0.3);

  // Ordenar produtos por frequência (mais repetidos primeiro)
  const sortedProducts = Array.from(productFrequency.values())
    .sort((a, b) => {
      // Primeiro por frequência (decrescente)
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      // Em caso de empate, ordenar alfabeticamente
      return a.product.name.localeCompare(b.product.name);
    })
    .slice(0, targetAddedCount) // Pegar apenas os top N
    .map(item => item.product);

  const addedProducts = sortedProducts;
  const totalProducts = [...baseProducts, ...addedProducts];

  // Consolidar FAQs
  const faqMap = new Map<string, FAQItem>();
  
  for (const result of selectedResults) {
    const faqs = result.faqs || [];
    
    for (const faq of faqs) {
      // Usar pergunta normalizada como chave para evitar duplicatas
      const normalizedQuestion = faq.pergunta.toLowerCase().trim();
      
      if (!faqMap.has(normalizedQuestion)) {
        faqMap.set(normalizedQuestion, {
          pergunta: faq.pergunta.trim(),
          resposta: faq.resposta.trim(),
        });
      }
    }
  }

  // Converter Map para Array e ordenar por relevância (pode ser melhorado)
  const consolidatedFAQs = Array.from(faqMap.values());

  // Produtos repetidos não incluídos (todos os que não foram adicionados)
  const addedProductNames = new Set(
    addedProducts.map(p => p.name.toLowerCase().trim())
  );
  
  const availableRepeatedProducts: RepeatedProduct[] = Array.from(productFrequency.values())
    .filter(item => !addedProductNames.has(item.product.name.toLowerCase().trim()))
    .map(item => {
      // Encontrar em quais artigos este produto aparece
      const sourceArticles: number[] = [];
      for (let i = 1; i < selectedResults.length; i++) {
        const result = selectedResults[i];
        const products = result.products || [];
        const hasProduct = products.some(p => 
          p.name.toLowerCase().trim() === item.product.name.toLowerCase().trim()
        );
        if (hasProduct) {
          sourceArticles.push(i);
        }
      }
      
      return {
        name: item.product.name,
        frequency: item.count,
        sourceArticles
      };
    })
    .sort((a, b) => {
      // Ordenar por frequência (decrescente)
      if (b.frequency !== a.frequency) {
        return b.frequency - a.frequency;
      }
      return a.name.localeCompare(b.name);
    });

  return {
    baseProducts,
    addedProducts,
    totalProducts,
    faqs: consolidatedFAQs,
    baseCount: baseProducts.length,
    addedCount: addedProducts.length,
    totalCount: totalProducts.length,
    availableRepeatedProducts,
  };
};
