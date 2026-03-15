// Cliente para chamar a API do Amazon via backend (credenciais ficam no servidor)

export interface AmazonProduct {
  asin: string;
  title: string;
  price?: string;
  currency?: string;
  imageUrl?: string;
  detailPageURL: string;
  affiliateURL?: string;
  brand?: string;
  starRating?: number;
  totalReviews?: number;
  description?: string;
}

export interface AmazonSearchResponse {
  products: AmazonProduct[];
  totalResults?: number;
}

/**
 * Busca produtos na Amazon via backend
 */
export const searchAmazonProducts = async (
  keyword: string,
  associateTag: string,
  maxResults: number = 10
): Promise<AmazonSearchResponse> => {
  try {
    const response = await fetch('/api/amazon/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keyword,
        associateTag,
        maxResults,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao buscar produtos na Amazon');
    }

    return await response.json();
  } catch (error: any) {
    console.error('[Amazon Client] Erro:', error);
    throw error;
  }
};

/**
 * Busca múltiplos produtos por nome (para produtos extraídos dos artigos)
 */
export const searchMultipleProducts = async (
  productNames: string[],
  associateTag: string
): Promise<Map<string, AmazonProduct>> => {
  const productMap = new Map<string, AmazonProduct>();

  // Buscar cada produto (com delay para respeitar rate limits)
  for (const productName of productNames.slice(0, 10)) {
    try {
      const result = await searchAmazonProducts(productName, associateTag, 1);
      if (result.products.length > 0) {
        productMap.set(productName, result.products[0]);
      }
      // Delay maior entre requisições para evitar rate limiting (1 segundo)
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.warn(`[Amazon Client] Erro ao buscar "${productName}":`, error);
    }
  }

  return productMap;
};
