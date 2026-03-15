/**
 * Cliente PA-API 5.0 usando o SDK oficial (paapi5-nodejs-sdk), igual ao projeto Produtos2.
 * A assinatura e o formato da requisição são feitos pelo SDK.
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Busca itens via SearchItems usando o SDK oficial.
 * Retorna o mesmo formato que amazon-paapi.js: { SearchResult: { Items, TotalResultCount } }.
 */
const SORT_BY = {
  all: 'Relevance',
  deals: 'Relevance',
  bestsellers: 'AvgCustomerReviews',
  trending: 'NewestArrivals',
};

export async function searchItems(config, params) {
  const { accessKey, secretKey, partnerTag, host, region } = config;
  const keywords = (params.keywords || 'produtos').trim() || 'produtos';
  const filter = params.filter || 'all';
  const itemCount = Math.min(params.itemCount ?? 10, 10);
  const itemPage = Math.max(1, params.itemPage ?? 1);

  const ProductAdvertisingAPIv1 = require('paapi5-nodejs-sdk/src/index');
  const defaultClient = ProductAdvertisingAPIv1.ApiClient.instance;
  defaultClient.accessKey = accessKey;
  defaultClient.secretKey = secretKey;
  defaultClient.host = host || 'webservices.amazon.com.br';
  defaultClient.region = region || 'us-east-1';

  const defaultApi = new ProductAdvertisingAPIv1.DefaultApi();
  const searchItemsRequest = new ProductAdvertisingAPIv1.SearchItemsRequest();
  searchItemsRequest['PartnerTag'] = partnerTag;
  searchItemsRequest['PartnerType'] = 'Associates';
  searchItemsRequest['Keywords'] = keywords;
  searchItemsRequest['SearchIndex'] = 'All';
  searchItemsRequest['ItemCount'] = itemCount;
  searchItemsRequest['ItemPage'] = itemPage;
  searchItemsRequest['SortBy'] = SORT_BY[filter] || SORT_BY.all;

  if (filter === 'deals') {
    searchItemsRequest['MinSavingPercent'] = 10;
  }

  searchItemsRequest['Resources'] = [
    'Images.Primary.Large',
    'Images.Primary.Medium',
    'ItemInfo.Title',
    'ItemInfo.Features',
    'ItemInfo.ByLineInfo',
    'Offers.Listings.Price',
    'Offers.Listings.SavingBasis',
  ];

  return new Promise((resolve, reject) => {
    defaultApi.searchItems(searchItemsRequest, (error, data, httpResponse) => {
      if (error) {
        const msg = error.body?.Errors?.[0]?.Message || error.message || `Erro da API (${error.status || 500})`;
        return reject(new Error(msg));
      }
      const searchItemsResponse = ProductAdvertisingAPIv1.SearchItemsResponse.constructFromObject(data);
      resolve(searchItemsResponse);
    });
  });
}
