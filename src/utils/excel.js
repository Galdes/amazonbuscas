/**
 * Exporta lista de produtos para arquivo .xlsx (ASIN, Título, Descrição, Preço, Marca, URL, Link da imagem).
 */

import * as XLSX from 'xlsx';

const COLUMNS = [
  { key: 'asin', label: 'ASIN' },
  { key: 'title', label: 'Título' },
  { key: 'description', label: 'Descrição' },
  { key: 'price', label: 'Preço' },
  { key: 'discountPercent', label: 'Desconto %' },
  { key: 'brand', label: 'Marca' },
  { key: 'url', label: 'URL' },
  { key: 'imageUrl', label: 'Link da imagem' },
];

export function exportToExcel(items) {
  if (!items || items.length === 0) return;

  const rows = items.map((item) => ({
    [COLUMNS[0].label]: item.asin,
    [COLUMNS[1].label]: item.title,
    [COLUMNS[2].label]: item.description ?? '',
    [COLUMNS[3].label]: item.price,
    [COLUMNS[4].label]: item.discountPercent != null ? item.discountPercent : '',
    [COLUMNS[5].label]: item.brand,
    [COLUMNS[6].label]: item.url,
    [COLUMNS[7].label]: item.imageUrl ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
  XLSX.writeFile(wb, `amazon-produtos-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
