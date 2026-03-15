/**
 * Cliente para Amazon Product Advertising API 5.0.
 * Assina requisições com AWS Signature Version 4 e envia para o host da PA-API.
 */

import aws4 from 'aws4';
import https from 'https';

const SEARCH_ITEMS_TARGET = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems';

const RESOURCES = [
  'ItemInfo.Title',
  'ItemInfo.ByLineInfo',
  'OffersV2.Listings.Price',
  'OffersV2.Listings.Condition',
  'Images.Primary.Medium',
];

/**
 * Deriva o marketplace (www.amazon.xx) a partir do host da API (webservices.amazon.xx).
 * @param {string} host - Ex: webservices.amazon.com.br
 * @returns {string} - Ex: www.amazon.com.br
 */
function hostToMarketplace(host) {
  const match = host.match(/webservices\.(amazon\.[^.]+(?:\.[^.]+)?)/);
  return match ? `www.${match[1]}` : 'www.amazon.com';
}

/**
 * Monta o payload de SearchItems.
 * @param {object} opts - Keywords, PartnerTag, Marketplace, filtros (deals, bestsellers, trending).
 */
function buildSearchPayload(opts) {
  const {
    keywords = '',
    partnerTag,
    marketplace,
    filter = 'all',
    itemCount = 10,
    itemPage = 1,
  } = opts;

  const payload = {
    PartnerTag: partnerTag,
    PartnerType: 'Associates',
    Marketplace: marketplace,
    Resources: RESOURCES,
    ItemCount: itemCount,
    ItemPage: itemPage,
  };

  if (keywords && keywords.trim()) {
    payload.Keywords = keywords.trim();
  } else {
    payload.Keywords = 'produtos';
  }

  switch (filter) {
    case 'deals':
      payload.SortBy = 'Relevance';
      break;
    case 'bestsellers':
      payload.SortBy = 'Relevance';
      break;
    case 'trending':
      payload.SortBy = 'NewestArrivals';
      break;
    default:
      payload.SortBy = 'Relevance';
  }

  return payload;
}

/**
 * Assina e envia uma requisição POST para a PA-API.
 * @param {object} options - host, region, accessKey, secretKey, body (objeto), xAmzTarget.
 * @returns {Promise<object>} - Resposta JSON da API.
 */
function signedRequest(options) {
  const { host, region, accessKey, secretKey, body, xAmzTarget } = options;
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

  const requestOptions = {
    host,
    path: '/',
    method: 'POST',
    service: 'ProductAdvertisingAPI',
    region: region || 'us-east-1',
    body: bodyStr,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Encoding': 'amz-1.0',
      'X-Amz-Target': xAmzTarget,
    },
  };

  aws4.sign(requestOptions, {
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: requestOptions.host,
      path: requestOptions.path,
      method: requestOptions.method,
      headers: requestOptions.headers,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const status = res.statusCode || 500;
        if (status >= 500) {
          reject(new Error('A API da Amazon está temporariamente indisponível. Tente novamente em alguns minutos.'));
          return;
        }
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (status >= 400) {
            const err = parsed.Errors?.[0];
            let msg = err
              ? `${err.Code || 'Error'}: ${err.Message || ''}`.trim() || null
              : null;
            if (!msg) {
              msg = parsed.__type || parsed.message || parsed.Message || (parsed.Error && (parsed.Error.Message || parsed.Error.Code)) || null;
            }
            if (!msg) {
              console.error('[PA-API 400] Resposta da Amazon:', JSON.stringify(parsed).slice(0, 500));
              msg = `Erro da API (${status}). Veja o terminal do servidor para detalhes.`;
            }
            reject(new Error(msg));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          if (status >= 500) {
            reject(new Error('A API da Amazon está temporariamente indisponível. Tente novamente em alguns minutos.'));
            return;
          }
          const body = String(data || '').toLowerCase();
          const is503Page = body.includes('503') || body.includes('temporarily unavailable') || body.includes('temporariamente indisponível');
          if (is503Page) {
            reject(new Error('A API da Amazon está temporariamente indisponível. Tente novamente em alguns minutos.'));
            return;
          }
          if (status === 400) {
            console.error('[PA-API 400] Resposta (corpo bruto):', (data || '').slice(0, 600));
          }
          const safeSnippet = data && !String(data).trimStart().startsWith('<') ? String(data).slice(0, 200) : '';
          reject(new Error(safeSnippet || `Erro da API (${status}). Veja o terminal para a resposta da Amazon.`));
        }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

/**
 * Busca itens na Amazon via SearchItems.
 * @param {object} config - accessKey, secretKey, partnerTag, host, region.
 * @param {object} params - keywords, filter ('all'|'deals'|'bestsellers'|'trending'), itemCount, itemPage.
 */
export async function searchItems(config, params) {
  const marketplace = hostToMarketplace(config.host);
  const payload = buildSearchPayload({
    keywords: params.keywords,
    partnerTag: config.partnerTag,
    marketplace,
    filter: params.filter || 'all',
    itemCount: params.itemCount ?? 10,
    itemPage: params.itemPage ?? 1,
  });

  const response = await signedRequest({
    host: config.host,
    region: config.region,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
    body: payload,
    xAmzTarget: SEARCH_ITEMS_TARGET,
  });

  return response;
}
