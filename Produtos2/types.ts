export interface OutlineItem {
  tag: 'H1' | 'H2' | 'H3';
  text: string;
}

export interface SearchResult {
  title: string;
  url: string;
  domain: string;
  summary: string;
  outline: OutlineItem[];
}

export interface MasterStrategy {
  baseHeadings: number;
  maxHeadings: number;
  finalHeadings: number;
  metaDescription: string;
  masterOutline: OutlineItem[];
}

export interface SearchServiceResponse {
  results: SearchResult[];
  isFallback: boolean;
}

// Interfaces para sistema de produtos
export interface Product {
  name: string;
}

export interface FAQItem {
  pergunta: string;
  resposta: string;
}

export interface ProductSearchResult extends SearchResult {
  products: Product[];
  faqs: FAQItem[];
}

export interface RepeatedProduct {
  name: string;
  frequency: number; // Quantos artigos mencionam
  sourceArticles: number[]; // Índices dos artigos que mencionam (relativo aos selecionados)
}

export interface ProductConsolidation {
  baseProducts: Product[];
  addedProducts: Product[];
  totalProducts: Product[];
  faqs: FAQItem[];
  baseCount: number;
  addedCount: number;
  totalCount: number;
  availableRepeatedProducts?: RepeatedProduct[]; // Produtos repetidos não incluídos nos 30%
}

// Interfaces para integração Amazon
export interface AmazonProductInfo {
  asin?: string;
  title: string;
  price?: string;
  currency?: string;
  imageUrl?: string;
  affiliateURL?: string;
  detailPageURL?: string;
  brand?: string;
  starRating?: number;
  totalReviews?: number;
}

export interface ProductWithAmazon extends Product {
  amazonInfo?: AmazonProductInfo;
}