/**
 * Cliente da API de busca (proxy para o backend que chama a PA-API).
 */

const API_BASE = '/api';

export async function searchProducts({ keywords = '', filter = 'all', page = 1 }) {
  const params = new URLSearchParams();
  if (keywords) params.set('keywords', keywords);
  if (filter && filter !== 'all') params.set('filter', filter);
  if (page > 1) params.set('page', String(page));

  const url = `${API_BASE}/search?${params.toString()}`;
  const res = await fetch(url);
  const contentType = res.headers.get('content-type') || '';
  let data;
  try {
    data = contentType.includes('application/json') ? await res.json() : {};
  } catch {
    throw new Error('Resposta inválida do servidor. Tente novamente.');
  }

  if (!res.ok) {
    const msg = data?.error || `Erro ${res.status}`;
    const safeMsg = typeof msg === 'string' && (msg.startsWith('<') || msg.includes('</html>'))
      ? 'A API da Amazon está temporariamente indisponível. Tente novamente em alguns minutos.'
      : msg;
    throw new Error(safeMsg);
  }
  return data;
}

export async function getHomeSections() {
  const res = await fetch(`${API_BASE}/home`);
  const contentType = res.headers.get('content-type') || '';
  let data;
  try {
    data = contentType.includes('application/json') ? await res.json() : {};
  } catch {
    throw new Error('Resposta inválida do servidor. Tente novamente.');
  }
  if (!res.ok) {
    const msg = data?.error || `Erro ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : 'Erro ao carregar ofertas.');
  }
  return data;
}
