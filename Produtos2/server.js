import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- Endpoints ---

// 1. SerpApi Proxy
app.get('/api/serpapi/search', async (req, res) => {
    try {
        const { query } = req;
        const apiKey = process.env.SERPAPI_KEY || 'd2b024ca951dad6d0408a9f977ce627faf750736c41bdcf7e1ea296cd6caee83';

        // Construct URL manually to ensure correct params
        const params = new URLSearchParams(query);
        if (!params.has('api_key')) params.append('api_key', apiKey);

        const url = `https://serpapi.com/search?${params.toString()}`;
        console.log(`[SerpApi] Fetching: ${url}`);

        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        console.error('[SerpApi] Error:', error.message);
        if (error.response) {
            console.error('[SerpApi] Response Data:', JSON.stringify(error.response.data, null, 2));
            res.status(error.response.status).send(error.response.data);
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// 2. Outscraper Proxy
app.get('/api/outscraper/google-search-v3', async (req, res) => {
    try {
        const { query } = req;
        const apiKey = process.env.OUTSCRAPER_API_KEY || 'Y2RkM2NlYWRkNmE4NDU5ODgzMjQ2MjA1OTM5N2E1NjR8MjVjNzgwNGJjYQ';

        const params = new URLSearchParams(query);

        const url = `https://api.app.outscraper.com/google-search-v3?${params.toString()}`;
        console.log(`[Outscraper] Fetching: ${url}`);

        const response = await axios.get(url, {
            headers: { 'X-API-KEY': apiKey }
        });
        res.json(response.data);
    } catch (error) {
        console.error('[Outscraper] Error:', error.message);
        if (error.response) {
            console.error('[Outscraper] Response Data:', JSON.stringify(error.response.data, null, 2));
            res.status(error.response.status).send(error.response.data);
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// 3. Local Scraper
app.get('/api/scrape', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        console.log(`[Scraper] Fetching: ${url}`);

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const outline = [];

        $('h1, h2, h3').each((_, element) => {
            const tag = $(element).prop('tagName');
            const text = $(element).text().trim();
            if (text) {
                outline.push({ tag, text });
            }
        });

        // Extrair conteúdo completo preservando estrutura de cabeçalhos para FAQs
        // Remove scripts, styles, e outros elementos não relevantes
        $('script, style, nav, footer, header, aside, .ad, .ads, .advertisement').remove();
        
        // Tentar pegar o conteúdo do artigo principal (mais específico)
        let fullContent = '';
        let articleElement = null;
        
        // Priorizar tags de artigo/conteúdo principal
        const articleSelectors = ['article', 'main', '.content', '.post-content', '.article-content', '[role="main"]'];
        for (const selector of articleSelectors) {
          const articleContent = $(selector).first();
          if (articleContent.length > 0) {
            articleElement = articleContent;
            if (articleContent.text().replace(/\s+/g, ' ').trim().length > 500) {
              console.log(`[Scraper] Conteúdo encontrado em ${selector}`);
              break;
            }
          }
        }
        
        // Fallback: usar body se não encontrou conteúdo suficiente
        if (!articleElement || articleElement.text().replace(/\s+/g, ' ').trim().length < 500) {
          articleElement = $('body');
          console.log(`[Scraper] Usando conteúdo do body`);
        }
        
        // Extrair conteúdo preservando estrutura de cabeçalhos (especialmente H3 para FAQs)
        // Converter H2, H3, H4 em marcadores especiais para o extrator identificar
        const contentParts = [];
        
        articleElement.contents().each((_, node) => {
          const $node = $(node);
          const tagName = node.tagName ? node.tagName.toLowerCase() : '';
          
          if (tagName === 'h2' || tagName === 'h3' || tagName === 'h4') {
            const text = $node.text().trim();
            if (text) {
              // Marcar cabeçalhos com prefixo especial para identificação
              contentParts.push(`\n[HEADING_${tagName.toUpperCase()}] ${text}\n`);
            }
          } else if (tagName === 'p' || tagName === 'div' || tagName === 'li' || !tagName) {
            // Texto normal
            const text = $node.text().trim();
            if (text && text.length > 10) { // Ignorar textos muito curtos
              contentParts.push(text);
            }
          }
        });
        
        fullContent = contentParts.join(' ').replace(/\s+/g, ' ').trim();
        
        console.log(`[Scraper] Conteúdo extraído: ${fullContent.length} caracteres (com estrutura de cabeçalhos)`);

        console.log(`[Scraper] Retornando: ${outline.length} outlines, ${fullContent.length} caracteres de conteúdo`);
        res.json({ outline, fullContent });
    } catch (error) {
        console.error(`[Scraper] Error fetching ${req.query.url}:`, error.message);
        res.status(500).json({ error: 'Failed to scrape URL', details: error.message });
    }
});

// 3.1 AI Generate (DeepSeek com fallback para Gemini) - chaves ficam no servidor
app.post('/api/ai/generate', async (req, res) => {
    try {
        const { prompt, systemInstruction } = req.body || {};
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ error: 'Campo "prompt" (string) é obrigatório.' });
        }
        const system = typeof systemInstruction === 'string' ? systemInstruction : '';

        const deepseekKey = process.env.DEEPSEEK_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

        // 1) Tentar DeepSeek primeiro (se a chave existir)
        if (deepseekKey) {
            try {
                const response = await axios.post(
                    'https://api.deepseek.com/v1/chat/completions',
                    {
                        model: 'deepseek-chat',
                        messages: [
                            ...(system ? [{ role: 'system', content: system }] : []),
                            { role: 'user', content: prompt }
                        ],
                        max_tokens: 8000,
                        temperature: 0.1
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${deepseekKey}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 120000
                    }
                );
                const text = response.data?.choices?.[0]?.message?.content;
                if (text != null && typeof text === 'string') {
                    console.log('[AI] Resposta obtida via DeepSeek.');
                    return res.json({ text: text.trim(), provider: 'deepseek' });
                }
            } catch (err) {
                console.warn('[AI] DeepSeek falhou, usando fallback Gemini:', err.response?.status || err.message);
            }
        }

        // 2) Fallback: Gemini
        if (!geminiKey) {
            return res.status(503).json({
                error: 'Nenhum provedor de IA disponível. Configure DEEPSEEK_API_KEY ou GEMINI_API_KEY no .env'
            });
        }
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
        const geminiBody = {
            contents: [{ parts: [{ text: prompt }] }],
            ...(system && { systemInstruction: { parts: [{ text: system }] } }),
            generationConfig: { temperature: 0.1 }
        };
        const gResponse = await axios.post(geminiUrl, geminiBody, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 120000
        });
        const candidate = gResponse.data?.candidates?.[0];
        const part = candidate?.content?.parts?.[0];
        const text = part?.text;
        if (text == null) {
            throw new Error('Resposta da API Gemini sem texto.');
        }
        console.log('[AI] Resposta obtida via Gemini (fallback).');
        return res.json({ text: text.trim(), provider: 'gemini' });
    } catch (error) {
        console.error('[AI] Erro em /api/ai/generate:', error.message);
        const status = error.response?.status || 500;
        const message = error.response?.data?.error?.message || error.message;
        res.status(status).json({ error: message || 'Falha ao gerar conteúdo.' });
    }
});

// 4. Amazon Product Advertising API Proxy
app.post('/api/amazon/search', async (req, res) => {
    try {
        const { keyword, associateTag, maxResults = 10 } = req.body;
        
        console.log('[Amazon API] Requisição recebida:', { keyword, associateTag, maxResults });
        
        if (!keyword || !associateTag) {
            console.warn('[Amazon API] Parâmetros faltando:', { hasKeyword: !!keyword, hasAssociateTag: !!associateTag });
            return res.status(400).json({ error: 'keyword e associateTag são obrigatórios' });
        }

        const accessKey = process.env.AMAZON_ACCESS_KEY;
        const secretKey = process.env.AMAZON_SECRET_KEY;

        console.log('[Amazon API] Verificando credenciais:', { 
            hasAccessKey: !!accessKey, 
            hasSecretKey: !!secretKey
        });

        if (!accessKey || !secretKey) {
            console.error('[Amazon API] Credenciais não configuradas!');
            return res.status(500).json({ 
                error: 'Credenciais do Amazon não configuradas no servidor',
                hint: 'Configure AMAZON_ACCESS_KEY e AMAZON_SECRET_KEY no arquivo .env.local'
            });
        }

        // Importar SDK usando createRequire (CommonJS em projeto ES modules)
        let defaultApi;
        let ProductAdvertisingAPIv1;
        try {
            const require = createRequire(import.meta.url);
            ProductAdvertisingAPIv1 = require('paapi5-nodejs-sdk/src/index');
            
            // Configurar ApiClient
            const defaultClient = ProductAdvertisingAPIv1.ApiClient.instance;
            defaultClient.accessKey = accessKey;
            defaultClient.secretKey = secretKey;
            defaultClient.host = 'webservices.amazon.com.br';
            defaultClient.region = 'us-east-1';
            
            // Criar instância da API
            defaultApi = new ProductAdvertisingAPIv1.DefaultApi();
            console.log('[Amazon API] Cliente criado com sucesso');
        } catch (importError) {
            console.error('[Amazon API] Erro ao importar/criar SDK:', importError);
            console.error('[Amazon API] Stack:', importError.stack);
            return res.status(500).json({ 
                error: 'Erro ao inicializar SDK do Amazon',
                details: importError.message,
                hint: 'Verifique se o paapi5-nodejs-sdk está instalado corretamente'
            });
        }
        
        console.log('[Amazon API] Cliente criado, fazendo busca...');
        
        const searchItemsRequest = new ProductAdvertisingAPIv1.SearchItemsRequest();
        searchItemsRequest['PartnerTag'] = associateTag;
        searchItemsRequest['PartnerType'] = 'Associates';
        searchItemsRequest['Keywords'] = keyword;
        // Usar 'All' pode causar problemas, mas vamos tentar primeiro
        searchItemsRequest['SearchIndex'] = 'All';
        searchItemsRequest['ItemCount'] = Math.min(maxResults, 10); // Máximo 10 por requisição
        // Recursos válidos para PA-API 5.0 SearchItems
        // Usando apenas Resources básicos que funcionam com searchitems
        // Nota: Alguns Resources como ByLineInfo, CustomerReviews podem não estar disponíveis em searchitems
        searchItemsRequest['Resources'] = [
            'Images.Primary.Medium',
            'ItemInfo.Title',
            'ItemInfo.Features',
            'Offers.Listings.Price'
        ];

        console.log('[Amazon API] Request configurado:', {
            keyword,
            associateTag,
            searchIndex: searchItemsRequest['SearchIndex'],
            itemCount: searchItemsRequest['ItemCount'],
            resources: searchItemsRequest['Resources']
        });
        console.log('[Amazon API] Buscando produtos...');
        
        // Converter callback para Promise com retry para erro 429 (rate limiting)
        let retries = 0;
        const maxRetries = 3;
        let response;
        
        while (retries <= maxRetries) {
            try {
                response = await new Promise((resolve, reject) => {
                    defaultApi.searchItems(searchItemsRequest, (error, data, httpResponse) => {
                        if (error) {
                            // Se for erro 429 (Too Many Requests), tentar novamente após delay
                            if (error.status === 429 && retries < maxRetries) {
                                const delaySeconds = (retries + 1) * 2;
                                console.warn(`[Amazon API] Rate limit atingido (429), tentando novamente em ${delaySeconds} segundos... (tentativa ${retries + 1}/${maxRetries})`);
                                setTimeout(() => {
                                    reject({ retry: true, originalError: error });
                                }, delaySeconds * 1000);
                                return;
                            }
                            console.error('[Amazon API] Erro na chamada:', error);
                            reject(error);
                        } else {
                            // Converter resposta para objeto usando constructFromObject
                            const searchItemsResponse = ProductAdvertisingAPIv1.SearchItemsResponse.constructFromObject(data);
                            resolve(searchItemsResponse);
                        }
                    });
                });
                break; // Sucesso, sair do loop
            } catch (error) {
                if (error.retry && retries < maxRetries) {
                    retries++;
                    continue; // Tentar novamente
                }
                throw error; // Re-throw se não for retry ou se excedeu tentativas
            }
        }
        
        console.log('[Amazon API] Resposta recebida:', {
            hasSearchResult: !!response.SearchResult,
            hasItems: !!response.SearchResult?.Items,
            itemsCount: response.SearchResult?.Items?.length || 0
        });
        
        if (!response.SearchResult || !response.SearchResult.Items) {
            console.warn('[Amazon API] Nenhum resultado encontrado');
            return res.json({ products: [] });
        }

        const products = response.SearchResult.Items.map((item) => {
            const asin = item.ASIN || '';
            const title = item.ItemInfo?.Title?.DisplayValue || '';
            const price = item.Offers?.Listings?.[0]?.Price?.DisplayAmount || '';
            const currency = item.Offers?.Listings?.[0]?.Price?.Currency || 'BRL';
            // Obter imagem Medium e aumentar tamanho na URL (Large pode não estar disponível em searchitems)
            let imageUrl = item.Images?.Primary?.Medium?.URL || '';
            // Remover limitação de tamanho da URL para obter imagem maior (substituir _SL160_, _SL500_, etc por _SL1000_)
            if (imageUrl) {
              imageUrl = imageUrl.replace(/_SL\d+_/g, '_SL1000_');
            }
            const detailPageURL = item.DetailPageURL || '';
            // Extrair dados disponíveis da API (ByLineInfo e CustomerReviews não estão nos Resources)
            const brand = ''; // ByLineInfo não disponível em searchitems
            const starRating = 0; // CustomerReviews não disponível em searchitems
            const totalReviews = 0; // CustomerReviews não disponível em searchitems
            // Extrair descrição completa das Features (juntar todas as features em uma string)
            const features = item.ItemInfo?.Features?.DisplayValues || [];
            const description = features.length > 0 ? features.join(' ') : '';

            // Gerar URL de afiliado
            let affiliateURL = detailPageURL;
            try {
                const url = new URL(detailPageURL);
                url.searchParams.set('tag', associateTag);
                affiliateURL = url.toString();
            } catch (e) {
                affiliateURL = detailPageURL.includes('?') 
                    ? `${detailPageURL}&tag=${associateTag}`
                    : `${detailPageURL}?tag=${associateTag}`;
            }

            return {
                asin,
                title,
                price,
                currency,
                imageUrl,
                detailPageURL,
                affiliateURL,
                brand,
                starRating,
                totalReviews,
                description,
            };
        });

        res.json({ products, totalResults: response.SearchResult.TotalResultCount });

    } catch (error) {
        console.error('[Amazon API] Erro completo:', error);
        console.error('[Amazon API] Stack:', error.stack);
        const errorMessage = error.message || 'Erro desconhecido';
        const errorDetails = {
            message: errorMessage,
            keyword: req.body?.keyword,
            associateTag: req.body?.associateTag,
            hasAccessKey: !!process.env.AMAZON_ACCESS_KEY,
            hasSecretKey: !!process.env.AMAZON_SECRET_KEY
        };
        console.error('[Amazon API] Detalhes:', errorDetails);
        res.status(500).json({ 
            error: 'Erro ao buscar produtos na Amazon', 
            details: errorMessage,
            debug: errorDetails
        });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
