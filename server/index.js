/**
 * Servidor Express: API de busca Amazon e frontend estático (build).
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { handleSearch, handleHome } from './routes/search.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/search', handleSearch);
app.get('/api/home', handleHome);

if (isProd) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  if (!isProd) console.log('Frontend: rode "npm run client" em outro terminal para desenvolvimento.');
});
