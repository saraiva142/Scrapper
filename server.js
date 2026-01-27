const express = require('express');
const path = require('path');
const { scrapeElement } = require('./src/scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares básicos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Rota de health-check simples
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'WebUnlock', timestamp: new Date().toISOString() });
});

// Rota principal de scraping
app.post('/scrape', async (req, res) => {
  const { url, selector } = req.body || {};

  if (!url || !selector) {
    return res.status(400).json({
      success: false,
      error: 'Parâmetros inválidos. Envie "url" e "selector".',
    });
  }

  const result = await scrapeElement(url, selector);

  return res.json({
    success: true,
    url,
    selector,
    data: result,
  });
});

app.listen(PORT, () => {
  console.log(`WebUnlock rodando em http://localhost:${PORT}`);
});

