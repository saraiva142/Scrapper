const express = require('express');
const path = require('path');
const { scrapeElements, scrapeTable, takeScreenshot } = require('./src/scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares básicos
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Rota de health-check simples
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'WebUnlock', timestamp: new Date().toISOString() });
});

// Rota principal de scraping (múltiplos seletores)
app.post('/scrape', async (req, res) => {
  const startTime = Date.now();
  const { url, selector, selectors, options = {} } = req.body || {};

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'Parâmetro "url" é obrigatório.',
    });
  }

  const sel = selectors || selector;
  if (!sel) {
    return res.status(400).json({
      success: false,
      error: 'Parâmetro "selector" ou "selectors" é obrigatório.',
    });
  }

  try {
    const result = await scrapeElements(url, sel, options);
    const executionTime = Date.now() - startTime;

    if (result === null) {
      return res.status(500).json({
        success: false,
        error: 'Falha ao executar o scraping.',
        executionTime,
      });
    }

    // Calcula estatísticas
    const stats = {
      totalSelectors: Object.keys(result).length,
      totalElements: Object.values(result).reduce((sum, arr) => sum + arr.length, 0),
      executionTime,
    };

    return res.json({
      success: true,
      url,
      selectors: Array.isArray(sel) ? sel : [sel],
      data: result,
      stats,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor.',
      executionTime: Date.now() - startTime,
    });
  }
});

// Rota para scraping de tabelas
app.post('/scrape/table', async (req, res) => {
  const startTime = Date.now();
  const { url, tableSelector, options = {} } = req.body || {};

  if (!url || !tableSelector) {
    return res.status(400).json({
      success: false,
      error: 'Parâmetros "url" e "tableSelector" são obrigatórios.',
    });
  }

  try {
    const result = await scrapeTable(url, tableSelector, options);
    const executionTime = Date.now() - startTime;

    if (result === null) {
      return res.status(500).json({
        success: false,
        error: 'Falha ao executar o scraping da tabela.',
        executionTime,
      });
    }

    return res.json({
      success: true,
      url,
      tableSelector,
      data: result,
      stats: {
        totalRows: result.length,
        executionTime,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor.',
      executionTime: Date.now() - startTime,
    });
  }
});

// Rota para screenshot
app.post('/screenshot', async (req, res) => {
  const startTime = Date.now();
  const { url, options = {} } = req.body || {};

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'Parâmetro "url" é obrigatório.',
    });
  }

  try {
    const screenshot = await takeScreenshot(url, options);
    const executionTime = Date.now() - startTime;

    if (screenshot === null) {
      return res.status(500).json({
        success: false,
        error: 'Falha ao capturar screenshot.',
        executionTime,
      });
    }

    return res.json({
      success: true,
      url,
      screenshot: `data:image/png;base64,${screenshot}`,
      stats: {
        executionTime,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor.',
      executionTime: Date.now() - startTime,
    });
  }
});

// Rota para exportar CSV
app.post('/export/csv', (req, res) => {
  const { data, filename = 'webunlock-export' } = req.body || {};

  if (!data) {
    return res.status(400).json({
      success: false,
      error: 'Parâmetro "data" é obrigatório.',
    });
  }

  try {
    let csv = '';
    
    // Se for array de objetos (tabela)
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]);
      csv = headers.join(',') + '\n';
      
      data.forEach(row => {
        const values = headers.map(h => {
          const val = row[h] || '';
          // Escapa vírgulas e aspas
          return `"${String(val).replace(/"/g, '""')}"`;
        });
        csv += values.join(',') + '\n';
      });
    } else if (typeof data === 'object') {
      // Se for objeto com múltiplos seletores
      const selectors = Object.keys(data);
      csv = 'selector,index,text,attributes\n';
      
      selectors.forEach(sel => {
        const elements = data[sel];
        elements.forEach((el, idx) => {
          const text = (el.text || '').replace(/"/g, '""');
          const attrs = el.attributes ? JSON.stringify(el.attributes).replace(/"/g, '""') : '';
          csv += `"${sel}",${idx},"${text}","${attrs}"\n`;
        });
      });
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.send('\ufeff' + csv); // BOM para Excel
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao gerar CSV.',
    });
  }
});

// Rota para exportar JSON
app.post('/export/json', (req, res) => {
  const { data, filename = 'webunlock-export' } = req.body || {};

  if (!data) {
    return res.status(400).json({
      success: false,
      error: 'Parâmetro "data" é obrigatório.',
    });
  }

  try {
    const json = JSON.stringify(data, null, 2);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    res.send(json);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao gerar JSON.',
    });
  }
});

app.listen(PORT, () => {
  console.log(`WebUnlock rodando em http://localhost:${PORT}`);
});

