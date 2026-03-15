/**
 * Cliente para Amazon Product Advertising API 4.0 (ItemSearch, assinatura Sig V2, resposta XML).
 * Use AMAZON_PAAPI_VERSION=4 no .env para ativar.
 */

import crypto from 'crypto';
import https from 'https';

const SERVICE = 'AWSECommerceService';
const VERSION = '2013-08-01';
const PATH = '/onca/xml';

function rfc3986Encode(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/**
 * Assinatura AWS Signature Version 2 para GET.
 * Parâmetros devem estar em ordem alfabética no query string.
 */
function sign(host, path, params, secretKey) {
  const sortedKeys = Object.keys(params).sort();
  const canonicalQuery = sortedKeys
    .map((k) => `${rfc3986Encode(k)}=${rfc3986Encode(String(params[k]))}`)
    .join('&');
  const stringToSign = `GET\n${host}\n${path}\n${canonicalQuery}`;
  const signature = crypto.createHmac('sha256', secretKey).update(stringToSign).digest('base64');
  params.Signature = signature;
  return params;
}

/**
 * Faz GET para o endpoint /onca/xml com os parâmetros assinados.
 */
function signedGet(host, params, secretKey) {
  sign(host, PATH, params, secretKey);
  const query = Object.keys(params)
    .sort()
    .map((k) => `${rfc3986Encode(k)}=${rfc3986Encode(String(params[k]))}`)
    .join('&');
  const url = `${PATH}?${query}`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        path: url,
        method: 'GET',
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 500) {
            reject(new Error('A API da Amazon está temporariamente indisponível. Tente novamente em alguns minutos.'));
            return;
          }
          if (res.statusCode >= 400) {
            const body = String(data).toLowerCase();
            if (body.includes('503') || body.includes('temporarily unavailable')) {
              reject(new Error('A API da Amazon está temporariamente indisponível. Tente novamente em alguns minutos.'));
            } else {
              reject(new Error(data.slice(0, 300) || `Erro da API (${res.statusCode})`));
            }
            return;
          }
          resolve(data);
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

/**
 * Extrai itens do XML da resposta ItemSearch (estrutura simplificada).
 * Suporta tanto objeto único quanto array para Item.
 */
function parseItemSearchXml(xml, host, partnerTag) {
  const marketplace = host.replace('webservices.', 'www.');
  const baseUrl = `https://${marketplace}`;
  const tag = partnerTag ? `?tag=${encodeURIComponent(partnerTag)}` : '';

  const items = [];
  const itemMatches = xml.matchAll(/<Item>([\s\S]*?)<\/Item>/gi);
  for (const m of itemMatches) {
    const block = m[1];
    const asin = block.match(/<ASIN>([^<]*)<\/ASIN>/i)?.[1]?.trim() || '';
    const title = block.match(/<Title>([^<]*)<\/Title>/i)?.[1]?.trim() || '';
    const brand = block.match(/<Brand>([^<]*)<\/Brand>/i)?.[1]?.trim() || block.match(/<Manufacturer>([^<]*)<\/Manufacturer>/i)?.[1]?.trim() || '';
    let price = '';
    const priceBlock = block.match(/<OfferListing>([\s\S]*?)<\/OfferListing>/i)?.[1];
    if (priceBlock) {
      const formatted = priceBlock.match(/<FormattedPrice>([^<]*)<\/FormattedPrice>/i)?.[1];
      const amount = priceBlock.match(/<Amount>(\d+)<\/Amount>/i)?.[1];
      const currency = priceBlock.match(/<CurrencyCode>([^<]*)<\/CurrencyCode>/i)?.[1];
      if (formatted) price = formatted.trim();
      else if (amount && currency) price = `${currency} ${(Number(amount) / 100).toFixed(2)}`;
    }
    const detailUrl = block.match(/<DetailPageURL>([^<]*)<\/DetailPageURL>/i)?.[1]?.trim();
    const url = detailUrl || (asin ? `${baseUrl}/dp/${asin}${tag}` : '');

    items.push({ asin, title, price, brand, url });
  }

  const totalResultCountMatch = xml.match(/<TotalResults>(\d+)<\/TotalResults>/i);
  const totalResultCount = totalResultCountMatch ? parseInt(totalResultCountMatch[1], 10) : items.length;

  return { items, totalResultCount };
}

/**
 * Busca itens via ItemSearch (PA-API 4.0).
 * Retorna { items: [{ asin, title, price, brand, url }], totalResultCount }.
 */
export async function searchItems(config, params) {
  const { accessKey, secretKey, partnerTag, host } = config;
  const keywords = (params.keywords || 'produtos').trim() || 'produtos';
  const itemPage = Math.max(1, params.itemPage ?? 1);

  const ts = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const requestParams = {
    AWSAccessKeyId: accessKey,
    AssociateTag: partnerTag,
    Keywords: keywords,
    Operation: 'ItemSearch',
    ResponseGroup: 'ItemAttributes,Offers,Images',
    SearchIndex: 'All',
    Service: SERVICE,
    Timestamp: ts,
    Version: VERSION,
  };
  if (itemPage > 1) requestParams.ItemPage = String(itemPage);

  const xml = await signedGet(host, requestParams, secretKey);

  if (xml.includes('<ItemSearchError>') || xml.includes('<Errors>')) {
    const msgMatch = xml.match(/<Message>([^<]*)<\/Message>/i);
    const codeMatch = xml.match(/<Code>([^<]*)<\/Code>/i);
    const msg = msgMatch?.[1] || codeMatch?.[1] || 'Erro na resposta da Amazon.';
    throw new Error(msg.trim());
  }

  return parseItemSearchXml(xml, host, partnerTag);
}
