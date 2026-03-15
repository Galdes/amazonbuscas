import { DefaultApi } from 'paapi5-nodejs-sdk';
import { Product } from '../types';

// Configuração da API Amazon
const ACCESS_KEY = process.env.AMAZON_ACCESS_KEY || '';
const SECRET_KEY = process.env.AMAZON_SECRET_KEY || '';
const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG || ''; // Será sobrescrito pela tag selecionada
const HOST = 'webservices.amazon.com.br';
const REGION = 'us-east-1';

export interface AmazonProduct {
  asin: string;
  title: string;
  price?: string;
  currency?: string;
  imageUrl?: string;
  detailPageURL: string;
  affiliateURL?: string; // URL com Associate Tag
  description?: string;
  brand?: string;
  customerReviews?: {
    starRating?: number;
    totalReviews?: number;
  };
}

export interface AmazonSearchResult {
  products: AmazonProduct[];
  totalResults?: number;
}

/**
 * Busca produtos na Amazon por palavra-chave
 */
export const searchAmazonProducts = async (
  keyword: string,
  associateTag: string,
  maxResults: number = 10
): Promise<AmazonSearchResult> => {
  try {
    if (!ACCESS_KEY || !SECRET_KEY) {
      throw new Error('Credenciais do Amazon não configuradas. Configure AMAZON_ACCESS_KEY e AMAZON_SECRET_KEY no .env.local');
    }

    if (!associateTag) {
      throw new Error('Associate Tag não fornecida');
    }

    const defaultApi = new DefaultApi({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      host: HOST,
      region: REGION,
    });

    const searchItemsRequest = {
      PartnerTag: associateTag,
      PartnerType: 'Associates',
      Keywords: keyword,
      SearchIndex: 'All', // Ou categorias específicas como 'Beauty', 'Electronics', etc.
      ItemCount: maxResults,
      Resources: [
        'ItemInfo.Title',
        'ItemInfo.ByLineInfo',
        'ItemInfo.Classifications',
        'ItemInfo.ContentInfo',
        'ItemInfo.ExternalIds',
        'ItemInfo.Features',
        'ItemInfo.ManufactureInfo',
        'ItemInfo.ProductInfo',
        'ItemInfo.TechnicalInfo',
        'ItemInfo.TradeInInfo',
        'Offers.Listings.Availability.MaxOrderQuantity',
        'Offers.Listings.Availability.Message',
        'Offers.Listings.Availability.MinOrderQuantity',
        'Offers.Listings.Availability.Type',
        'Offers.Listings.Condition',
        'Offers.Listings.Condition.ConditionNote',
        'Offers.Listings.Condition.SubCondition',
        'Offers.Listings.DeliveryInfo.IsAmazonFulfilled',
        'Offers.Listings.DeliveryInfo.IsFreeShippingEligible',
        'Offers.Listings.DeliveryInfo.IsPrimeEligible',
        'Offers.Listings.MerchantInfo',
        'Offers.Listings.Price',
        'Offers.Listings.ProgramEligibility.IsPrimeExclusive',
        'Offers.Listings.ProgramEligibility.IsPrimePantry',
        'Offers.Listings.Promotions',
        'Offers.Listings.SavingBasis',
        'Offers.Summaries.HighestPrice',
        'Offers.Summaries.LowestPrice',
        'Offers.Summaries.OfferCount',
        'CustomerReviews.StarRating',
        'CustomerReviews.TotalReviewCount',
        'Images.Primary.Large',
        'Images.Primary.Medium',
        'Images.Primary.Small',
        'Images.Variants.Large',
        'Images.Variants.Medium',
        'Images.Variants.Small',
      ],
    };

    const response = await defaultApi.searchItems(searchItemsRequest);
    
    if (!response.SearchResult || !response.SearchResult.Items) {
      return { products: [] };
    }

    const products: AmazonProduct[] = response.SearchResult.Items.map((item: any) => {
      const asin = item.ASIN || '';
      const title = item.ItemInfo?.Title?.DisplayValue || '';
      const price = item.Offers?.Listings?.[0]?.Price?.DisplayAmount || '';
      const currency = item.Offers?.Listings?.[0]?.Price?.Currency || 'BRL';
      const imageUrl = item.Images?.Primary?.Large?.URL || item.Images?.Primary?.Medium?.URL || '';
      const detailPageURL = item.DetailPageURL || '';
      const description = item.ItemInfo?.Features?.DisplayValues?.[0] || '';
      const brand = item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue || '';
      const starRating = item.CustomerReviews?.StarRating?.Value || 0;
      const totalReviews = item.CustomerReviews?.TotalReviewCount || 0;

      // Gerar URL de afiliado
      const affiliateURL = generateAffiliateURL(detailPageURL, associateTag);

      return {
        asin,
        title,
        price,
        currency,
        imageUrl,
        detailPageURL,
        affiliateURL,
        description,
        brand,
        customerReviews: {
          starRating,
          totalReviews,
        },
      };
    });

    return {
      products,
      totalResults: response.SearchResult.TotalResultCount,
    };

  } catch (error: any) {
    console.error('[Amazon] Erro ao buscar produtos:', error);
    throw new Error(`Erro ao buscar produtos na Amazon: ${error.message}`);
  }
};

/**
 * Busca produtos por ASIN (quando já temos o ASIN do produto)
 */
export const getAmazonProductByASIN = async (
  asin: string,
  associateTag: string
): Promise<AmazonProduct | null> => {
  try {
    if (!ACCESS_KEY || !SECRET_KEY) {
      throw new Error('Credenciais do Amazon não configuradas');
    }

    const defaultApi = new DefaultApi({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      host: HOST,
      region: REGION,
    });

    const getItemsRequest = {
      PartnerTag: associateTag,
      PartnerType: 'Associates',
      ItemIds: [asin],
      Resources: [
        'ItemInfo.Title',
        'ItemInfo.ByLineInfo',
        'ItemInfo.Features',
        'Offers.Listings.Price',
        'Images.Primary.Large',
        'CustomerReviews.StarRating',
        'CustomerReviews.TotalReviewCount',
      ],
    };

    const response = await defaultApi.getItems(getItemsRequest);
    
    if (!response.ItemsResult || !response.ItemsResult.Items || response.ItemsResult.Items.length === 0) {
      return null;
    }

    const item = response.ItemsResult.Items[0];
    const title = item.ItemInfo?.Title?.DisplayValue || '';
    const price = item.Offers?.Listings?.[0]?.Price?.DisplayAmount || '';
    const currency = item.Offers?.Listings?.[0]?.Price?.Currency || 'BRL';
    const imageUrl = item.Images?.Primary?.Large?.URL || '';
    const detailPageURL = item.DetailPageURL || '';
    const affiliateURL = generateAffiliateURL(detailPageURL, associateTag);

    return {
      asin,
      title,
      price,
      currency,
      imageUrl,
      detailPageURL,
      affiliateURL,
    };

  } catch (error: any) {
    console.error(`[Amazon] Erro ao buscar produto ${asin}:`, error);
    return null;
  }
};

/**
 * Gera URL de afiliado a partir de uma URL da Amazon
 */
export const generateAffiliateURL = (amazonURL: string, associateTag: string): string => {
  if (!amazonURL || !associateTag) {
    return amazonURL;
  }

  try {
    const url = new URL(amazonURL);
    url.searchParams.set('tag', associateTag);
    return url.toString();
  } catch (error) {
    // Se a URL já tiver parâmetros, adiciona o tag
    if (amazonURL.includes('?')) {
      return `${amazonURL}&tag=${associateTag}`;
    }
    return `${amazonURL}?tag=${associateTag}`;
  }
};

/**
 * Busca produtos na Amazon baseado em nomes de produtos extraídos
 * Tenta encontrar o produto mais relevante para cada nome
 */
export const searchProductsByName = async (
  productNames: string[],
  associateTag: string,
  maxResultsPerProduct: number = 1
): Promise<Map<string, AmazonProduct>> => {
  const productMap = new Map<string, AmazonProduct>();

  // Buscar cada produto (limitado para não exceder rate limits)
  for (const productName of productNames.slice(0, 10)) { // Limitar a 10 produtos por vez
    try {
      const result = await searchAmazonProducts(productName, associateTag, maxResultsPerProduct);
      if (result.products.length > 0) {
        // Pegar o primeiro resultado (mais relevante)
        productMap.set(productName, result.products[0]);
      }
      // Delay para respeitar rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.warn(`[Amazon] Erro ao buscar produto "${productName}":`, error);
    }
  }

  return productMap;
};
