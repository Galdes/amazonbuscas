/**
 * Netlify Function: proxy para GET /api/home (seções da tela inicial).
 */
import 'dotenv/config';
import { handleHome } from '../../server/routes/search.js';

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
  try {
    const req = { query: event.queryStringParameters || {} };
    const res = createRes();
    await handleHome(req, res);
    return {
      statusCode: res._status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(res._body),
    };
  } catch (err) {
    console.error('[home]', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Erro na função home.' }),
    };
  }
}
