/**
 * Rotas de busca que delegam para a PA-API (credenciais apenas no servidor).
 * Suporta PA-API 5.0 (padrão, via SDK oficial como no Produtos2) e 4.0 via AMAZON_PAAPI_VERSION=4.
 */

import { searchItems as searchItemsV5 } from '../amazon-paapi-sdk.js';
import { searchItems as searchItemsV4 } from '../amazon-paapi-v4.js';

const PAAPI_VERSION = (process.env.AMAZON_PAAPI_VERSION || '5').trim();

function getConfig(req) {
  const accessKey = process.env.AMAZON_ACCESS_KEY;
  const secretKey = process.env.AMAZON_SECRET_KEY;
  const partnerTag = process.env.AMAZON_PARTNER_TAG;
  const region = process.env.AMAZON_REGION || 'us-east-1';
  const host = process.env.AMAZON_HOST || 'webservices.amazon.com';

  if (!accessKey || !secretKey || !partnerTag) {
    throw new Error('Credenciais da Amazon não configuradas. Defina AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY e AMAZON_PARTNER_TAG.');
  }
  return { accessKey, secretKey, partnerTag, region, host };
}

// Palavras-chave focadas em produtos com alto potencial de venda (evitam livros e itens de nicho)
const HOME_CATEGORIES = [
  { name: 'Ofertas em Cozinha', keywords: 'air fryer liquidificador cafeteira panela oferta' },
  { name: 'Ofertas em Moda', keywords: 'tênis camiseta calça jeans moda masculina feminina' },
  { name: 'Ofertas em Alimentos e Bebidas', keywords: 'café em cápsula achocolatado snacks chocolate bebida' },
  { name: 'Ofertas em Ferramentas e Materiais de Construção', keywords: 'furadeira parafusadeira kit ferramentas fita métrica' },
  { name: 'Ofertas em Instrumentos Musicais', keywords: 'violão guitarra teclado microfone fone ouvido' },
  { name: 'Ofertas em Móveis', keywords: 'cadeira escritório mesa apoio notebook estante' },
];

/**
 * GET /api/search?keywords=...&filter=all|deals|bestsellers|trending&page=1&itemCount=10
 * Retorna itens no formato normalizado para o frontend (ASIN, título, preço, marca, url).
 */
export async function handleSearch(req, res) {
  try {
    const config = getConfig(req);
    const keywords = req.query.keywords || '';
    const filter = req.query.filter || 'all';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const itemCount = Math.min(10, Math.max(1, parseInt(req.query.itemCount, 10) || 10));

    if (PAAPI_VERSION === '4') {
      const result = await searchItemsV4(config, {
        keywords,
        filter,
        itemPage: page,
      });
      return res.json({ items: result.items, totalResultCount: result.totalResultCount });
    }

    const response = await searchItemsV5(config, {
      keywords,
      filter,
      itemCount,
      itemPage: page,
    });

    const items = normalizeSearchResults(response, config.host, config.partnerTag);
    res.json({ items, totalResultCount: response.SearchResult?.TotalResultCount ?? 0 });
  } catch (err) {
    console.error('[search]', err.message);
    let message = err.message || 'Erro ao buscar produtos na Amazon.';
    if (process.env.NODE_ENV !== 'production') {
      console.error('[search] Detalhes:', err.message);
    }
    if (message.trimStart().startsWith('<') || message.includes('</html>')) {
      message = 'A API da Amazon está temporariamente indisponível. Tente novamente em alguns minutos.';
    }
    res.status(err.message?.includes('Credenciais') ? 503 : 502).json({
      error: message,
    });
  }
}

/**
 * GET /api/home
 * Retorna 6 seções com 4 produtos cada (ofertas por categoria) para a tela inicial.
 */
export async function handleHome(req, res) {
  try {
    const config = getConfig(req);
    if (PAAPI_VERSION === '4') {
      return res.json({ sections: [] });
    }
    const sections = await Promise.all(
      HOME_CATEGORIES.map(async ({ name, keywords }) => {
        try {
          const response = await searchItemsV5(config, {
            keywords,
            filter: 'deals',
            itemCount: 4,
            itemPage: 1,
          });
          const items = normalizeSearchResults(response, config.host, config.partnerTag);
          return { name, items };
        } catch (err) {
          console.error(`[home] ${name}:`, err.message);
          return { name, items: [] };
        }
      })
    );
    res.json({ sections, partnerTag: config.partnerTag || '' });
  } catch (err) {
    console.error('[home]', err.message);
    res.status(err.message?.includes('Credenciais') ? 503 : 502).json({
      error: err.message || 'Erro ao carregar ofertas.',
    });
  }
}

/**
 * Normaliza SearchItems response para { asin, title, price, brand, url }[].
 */
function normalizeSearchResults(response, apiHost, partnerTag = '') {
  const list = response.SearchResult?.Items ?? [];
  const marketplace = apiHost.replace('webservices.', 'www.');
  const baseUrl = `https://${marketplace}`;
  const tag = partnerTag ? `?tag=${encodeURIComponent(partnerTag)}` : '';

  return list.map((item) => {
    const asin = item.ASIN ?? '';
    const title = item.ItemInfo?.Title?.DisplayValue ?? '';
    const brand = item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue ?? item.ItemInfo?.ByLineInfo?.Manufacturer?.DisplayValue ?? '';
    const listing = item.OffersV2?.Listings?.[0] ?? item.Offers?.Listings?.[0];
    let price = '';
    let discountPercent = null;
    if (listing?.Price) {
      const displayAmount = listing.Price.DisplayAmount;
      if (displayAmount) {
        price = displayAmount;
      } else {
        const amount = listing.Price.Amount ?? 0;
        const currency = listing.Price.CurrencyCode ?? listing.Price.Currency ?? 'BRL';
        price = `${currency} ${Number(amount).toFixed(2)}`;
      }
      const pct = listing.Price.Savings?.Percentage;
      if (pct != null && Number(pct) > 0) {
        discountPercent = Math.round(Number(pct));
      } else {
        const basis = listing.SavingBasis ?? listing.Price?.SavingBasis;
        const currentAmount = Number(listing.Price?.Amount);
        const basisAmount = Number(basis?.Amount);
        if (basisAmount > 0 && currentAmount > 0 && currentAmount < basisAmount) {
          discountPercent = Math.round((1 - currentAmount / basisAmount) * 100);
        }
      }
    }
    const url = asin ? `${baseUrl}/dp/${asin}${tag}` : '';
    let imageUrl = item.Images?.Primary?.Large?.URL ?? item.Images?.Primary?.Medium?.URL ?? item.Images?.Primary?.Small?.URL ?? '';
    if (imageUrl && /_SL\d+_/.test(imageUrl)) {
      imageUrl = imageUrl.replace(/_SL\d+_/g, '_SL500_');
    }
    const features = item.ItemInfo?.Features?.DisplayValues ?? [];
    const description = Array.isArray(features) ? features.join(' | ') : '';

    return { asin, title, price, brand, url, imageUrl, description, discountPercent };
  });
}
