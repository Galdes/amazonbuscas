/**
 * Netlify Function: proxy para GET /api/search (busca de produtos).
 * Carrega dotenv para variáveis de ambiente (Netlify injeta no build/deploy).
 */
import 'dotenv/config';
import { handleSearch } from '../../server/routes/search.js';

function createRes() {
  const res = { _status: 200, _body: null };
  res.status = (code) => {
    res._status = code;
    return res;
  };
  res.json = (data) => {
    res._body = data;
  };
  return res;
}

export async function handler(event) {
  const req = {
    query: event.queryStringParameters || {},
  };
  const res = createRes();
  await handleSearch(req, res);
  return {
    statusCode: res._status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(res._body),
  };
}
