# AMZ Buscas

Aplicação full-stack que usa a **Amazon Product Advertising API (PA-API 5.0)** para buscar produtos e exportar resultados para Excel.

## Funcionalidades

- **Busca avançada**: pesquisa em tempo real via API oficial da Amazon
- **Filtros rápidos**: Ofertas, Mais Vendidos e Em Alta
- **Exportação Excel**: download de planilha .xlsx com ASIN, Título, Preço, Marca e URL
- **Interface**: design responsivo com Tailwind CSS e animações (Framer Motion)
- **Segurança**: backend em Express guarda as chaves da API e assina as requisições (AWS Sig V4)

## Como configurar

1. Clone o repositório e instale as dependências:

   ```bash
   npm install
   ```

2. Crie um arquivo `.env` na raiz (copie de `.env.example`) e preencha:

   - `AMAZON_ACCESS_KEY` – chave de acesso (Associados / PA-API)
   - `AMAZON_SECRET_KEY` – chave secreta
   - `AMAZON_PARTNER_TAG` – ID de associado (ex: `seu-site-20`)
   - `AMAZON_REGION` – região da API (ex: `us-east-1`, `eu-west-1`)
   - `AMAZON_HOST` – host da API (ex: `webservices.amazon.com.br`, `webservices.amazon.com`)

3. Obtenha credenciais no [Programa de Associados da Amazon](https://affiliate-program.amazon.com/) e no registro da [Product Advertising API](https://webservices.amazon.com/paapi5/documentation/).

## Como rodar

- **Desenvolvimento** (frontend + API em paralelo):

  ```bash
  npm run dev
  ```

  - Frontend: http://localhost:5173 (Vite com proxy para a API)
  - API: http://localhost:3001

- **Produção** (build + servidor único):

  ```bash
  npm run build
  NODE_ENV=production npm start
  ```

  Acesse http://localhost:3001 (Express serve o build do React e as rotas `/api/*`).

## Scripts

| Comando     | Descrição                          |
|------------|-------------------------------------|
| `npm run dev`   | Sobe backend e frontend em modo dev |
| `npm run server`| Sobe apenas o backend (porta 3001)  |
| `npm run client`| Sobe apenas o Vite (porta 5173)     |
| `npm run build` | Gera o build do frontend em `dist/` |
| `npm start`     | Sobe o servidor (usa `dist/` se existir) |

## Tecnologias

- **Backend**: Node.js, Express, aws4 (assinatura AWS Sig V4)
- **Frontend**: React, Vite, Tailwind CSS, Framer Motion, SheetJS (xlsx)
