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
    waitUntil = 'load', // Mudado de 'domcontentloaded' para 'load' para garantir que recursos carregaram
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

      await page.goto(url, { waitUntil, timeout: timeout + 5000 });

      // Aguarda um pouco para garantir que JavaScript tenha executado e elementos dinâmicos carregaram
      await new Promise(resolve => setTimeout(resolve, 2000));

      const results = {};

      for (const sel of selectors) {
        try {
          // Tenta aguardar o seletor aparecer
          await page.waitForSelector(sel, { timeout: Math.min(timeout, 5000) }).catch(() => {
            // Se não encontrar em 5s, continua mesmo assim (pode estar vazio ou carregar depois)
            console.warn(`[WebUnlock] Seletor "${sel}" não encontrado após timeout, tentando mesmo assim...`);
          });
        } catch (e) {
          // Ignora erros de waitForSelector
        }

        const data = await page.evaluate((sel) => {
          try {
            const elements = document.querySelectorAll(sel);
            
            if (elements.length === 0) {
              return [];
            }

            return Array.from(elements).map((el) => {
              // Tenta múltiplas formas de extrair texto
              let text = '';
              
              // Primeiro tenta innerText (mais confiável para texto visível)
              if (el.innerText) {
                text = el.innerText.trim();
              }
              
              // Se vazio, tenta textContent
              if (!text && el.textContent) {
                text = el.textContent.trim();
              }
              
              // Se ainda vazio, tenta value (para inputs)
              if (!text && el.value) {
                text = el.value.trim();
              }
              
              // Remove espaços múltiplos e quebras de linha excessivas
              text = text.replace(/\s+/g, ' ').trim();
              
              const attrs = {};
              const commonAttrs = ['href', 'src', 'alt', 'class', 'id', 'title'];
              commonAttrs.forEach(attr => {
                const val = el.getAttribute(attr);
                if (val !== null && val !== '') attrs[attr] = val;
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
          } catch (error) {
            return [];
          }
        }, sel);

        results[sel] = Array.isArray(data) ? data : [];
        
        // Log para debug no servidor
        const count = results[sel].length;
        console.log(`[WebUnlock] Seletor "${sel}": ${count} elemento(s) encontrado(s)`);
        
        if (count === 0) {
          // Verifica se o elemento existe na página (para debug)
          const exists = await page.evaluate((sel) => {
            return document.querySelector(sel) !== null;
          }, sel);
          
          if (!exists) {
            console.warn(`[WebUnlock] ⚠️ Seletor "${sel}" não existe na página. Verifique se o seletor está correto ou se a página carregou completamente.`);
          } else {
            console.warn(`[WebUnlock] ⚠️ Seletor "${sel}" existe mas não retornou dados (pode estar vazio ou oculto)`);
          }
        } else {
          // Log do primeiro elemento encontrado para debug
          const firstElement = results[sel][0];
          if (firstElement && firstElement.text) {
            console.log(`[WebUnlock] ✓ Primeiro elemento: "${firstElement.text.substring(0, 50)}${firstElement.text.length > 50 ? '...' : ''}"`);
          }
        }
      }

      // Fecha o browser antes de retornar (sucesso)
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('[WebUnlock:scraper] Erro ao fechar o browser', {
            message: closeError?.message,
          });
        }
      }

      return results;
    } catch (error) {
      attempt++;
      
      // Fecha o browser em caso de erro antes de tentar novamente
      if (browser) {
        try {
          await browser.close();
          browser = null;
        } catch (closeError) {
          console.error('[WebUnlock:scraper] Erro ao fechar o browser', {
            message: closeError?.message,
          });
        }
      }
      
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

