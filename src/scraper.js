// Módulo de scraping do WebUnlock
// Transforma elementos de páginas web em dados estruturados (texto + atributos).
//
// Dependência: puppeteer
// Certifique-se de instalar antes de usar:
//   npm install puppeteer

const puppeteer = require('puppeteer');

/**
 * Extrai atributos comuns de um elemento HTML
 */
function extractAttributes(element) {
  const attrs = {};
  const commonAttrs = ['href', 'src', 'alt', 'class', 'id', 'title', 'data-id', 'data-value'];
  
  commonAttrs.forEach(attr => {
    const value = element.getAttribute(attr);
    if (value !== null) {
      attrs[attr] = value;
    }
  });

  // Captura todos os atributos data-*
  Array.from(element.attributes).forEach(attr => {
    if (attr.name.startsWith('data-')) {
      attrs[attr.name] = attr.value;
    }
  });

  return Object.keys(attrs).length > 0 ? attrs : null;
}

/**
 * Faz o scrape de TODOS os elementos que correspondem ao seletor.
 * Retorna array de objetos com texto e atributos HTML.
 *
 * @param {string} url - URL da página a ser acessada.
 * @param {string|string[]} selector - CSS selector(s) do(s) elemento(s) a ser(em) extraído(s).
 * @param {object} options - Opções de configuração.
 * @param {number} options.timeout - Timeout em ms (padrão: 10000).
 * @param {string} options.waitUntil - waitUntil do Puppeteer (padrão: 'domcontentloaded').
 * @param {string} options.userAgent - User agent customizado.
 * @param {object} options.viewport - { width, height } do viewport.
 * @param {number} options.retries - Número de tentativas em caso de falha (padrão: 0).
 * @returns {Promise<object>} - Objeto com resultados organizados por seletor.
 */
async function scrapeElements(url, selector, options = {}) {
  const {
    timeout = 10000,
    waitUntil = 'domcontentloaded',
    userAgent,
    viewport,
    retries = 0,
  } = options;

  const selectors = Array.isArray(selector) ? selector : [selector];
  let browser;
  let attempt = 0;

  while (attempt <= retries) {
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',
          '--single-process',
        ],
      });

      const page = await browser.newPage();

      if (userAgent) {
        await page.setUserAgent(userAgent);
      }

      if (viewport) {
        await page.setViewport(viewport);
      }

      await page.goto(url, { waitUntil });

      // Aguarda pelo menos um seletor aparecer
      await Promise.race(
        selectors.map(sel => page.waitForSelector(sel, { timeout }).catch(() => null))
      );

      const results = {};

      for (const sel of selectors) {
        const data = await page.evaluate((sel, extractAttrs) => {
          const elements = document.querySelectorAll(sel);
          if (elements.length === 0) return [];

          return Array.from(elements).map(el => {
            const inner = (el.innerText || '').trim();
            const text = inner || (el.textContent || '').trim();
            
            const attrs = {};
            const commonAttrs = ['href', 'src', 'alt', 'class', 'id', 'title'];
            commonAttrs.forEach(attr => {
              const val = el.getAttribute(attr);
              if (val !== null) attrs[attr] = val;
            });
            
            Array.from(el.attributes).forEach(attr => {
              if (attr.name.startsWith('data-')) {
                attrs[attr.name] = attr.value;
              }
            });

            return {
              text: text || null,
              attributes: Object.keys(attrs).length > 0 ? attrs : null,
            };
          });
        }, sel);

        results[sel] = data;
      }

      return results;
    } catch (error) {
      attempt++;
      if (attempt > retries) {
        console.error('[WebUnlock:scraper] Erro ao fazer scrape', {
          url,
          selector: selectors,
          attempt,
          message: error?.message,
        });
        return null;
      }
      // Aguarda um pouco antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('[WebUnlock:scraper] Erro ao fechar o browser', {
            message: closeError?.message,
          });
        }
      }
    }
  }

  return null;
}

/**
 * Faz o scrape de uma tabela HTML e retorna array de objetos.
 *
 * @param {string} url - URL da página.
 * @param {string} tableSelector - Seletor da tabela.
 * @param {object} options - Opções (mesmas de scrapeElements).
 * @returns {Promise<array|null>} - Array de objetos onde cada objeto representa uma linha.
 */
async function scrapeTable(url, tableSelector, options = {}) {
  const {
    timeout = 10000,
    waitUntil = 'domcontentloaded',
    userAgent,
    viewport,
  } = options;

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process',
      ],
    });

    const page = await browser.newPage();

    if (userAgent) await page.setUserAgent(userAgent);
    if (viewport) await page.setViewport(viewport);

    await page.goto(url, { waitUntil });
    await page.waitForSelector(tableSelector, { timeout });

    const tableData = await page.evaluate((sel) => {
      const table = document.querySelector(sel);
      if (!table) return null;

      const headers = Array.from(table.querySelectorAll('th')).map(th => 
        (th.textContent || '').trim()
      );

      if (headers.length === 0) {
        // Tenta pegar headers da primeira linha <tr>
        const firstRow = table.querySelector('tr');
        if (firstRow) {
          Array.from(firstRow.querySelectorAll('td')).forEach(td => {
            headers.push((td.textContent || '').trim());
          });
        }
      }

      const rows = Array.from(table.querySelectorAll('tr')).slice(headers.length > 0 && table.querySelector('th') ? 0 : 1);
      
      return rows.map(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        const obj = {};
        headers.forEach((header, idx) => {
          obj[header || `col_${idx}`] = cells[idx] ? (cells[idx].textContent || '').trim() : null;
        });
        return obj;
      });
    }, tableSelector);

    return tableData;
  } catch (error) {
    console.error('[WebUnlock:scraper] Erro ao fazer scrape de tabela', {
      url,
      tableSelector,
      message: error?.message,
    });
    return null;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('[WebUnlock:scraper] Erro ao fechar o browser', {
          message: closeError?.message,
        });
      }
    }
  }
}

/**
 * Captura screenshot da página e retorna em base64.
 *
 * @param {string} url - URL da página.
 * @param {object} options - Opções.
 * @returns {Promise<string|null>} - Base64 da imagem ou null.
 */
async function takeScreenshot(url, options = {}) {
  const {
    waitUntil = 'domcontentloaded',
    userAgent,
    viewport = { width: 1920, height: 1080 },
    fullPage = false,
  } = options;

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process',
      ],
    });

    const page = await browser.newPage();
    if (userAgent) await page.setUserAgent(userAgent);
    await page.setViewport(viewport);

    await page.goto(url, { waitUntil });
    
    const screenshot = await page.screenshot({
      encoding: 'base64',
      fullPage,
    });

    return screenshot;
  } catch (error) {
    console.error('[WebUnlock:scraper] Erro ao capturar screenshot', {
      url,
      message: error?.message,
    });
    return null;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('[WebUnlock:scraper] Erro ao fechar o browser', {
          message: closeError?.message,
        });
      }
    }
  }
}

module.exports = {
  scrapeElements,
  scrapeTable,
  takeScreenshot,
  // Mantém compatibilidade com código antigo
  scrapeElement: async (url, selector) => {
    const result = await scrapeElements(url, selector);
    if (!result || !result[selector]) return null;
    const first = result[selector][0];
    return first ? first.text : null;
  },
};

