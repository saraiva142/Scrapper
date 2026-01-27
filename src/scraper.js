// Módulo de scraping do WebUnlock
// Transforma elementos de páginas web em dados de texto simples.
//
// Dependência: puppeteer
// Certifique-se de instalar antes de usar:
//   npm install puppeteer

const puppeteer = require('puppeteer');

/**
 * Faz o scrape do texto de um elemento em uma página.
 *
 * @param {string} url - URL da página a ser acessada.
 * @param {string} selector - CSS selector do elemento a ser extraído.
 * @returns {Promise<string|null>} - Texto do elemento ou null em caso de erro/ausência.
 */
async function scrapeElement(url, selector) {
  let browser;

  try {
    // Inicializa o Puppeteer com foco em performance e uso em ambientes server-side.
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

    // Navega para a URL, esperando apenas o DOM básico carregar.
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
    });

    // Aguarda o elemento específico aparecer até 10 segundos.
    await page.waitForSelector(selector, { timeout: 10000 });

    // Executa no contexto da página para extrair o texto do elemento.
    const text = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;

      const inner = (el.innerText || '').trim();
      if (inner) return inner;

      const content = (el.textContent || '').trim();
      if (content) return content;

      return null;
    }, selector);

    return text;
  } catch (error) {
    // Log detalhado para facilitar debug em produção.
    console.error('[WebUnlock:scraper] Erro ao fazer scrape de elemento', {
      url,
      selector,
      message: error && error.message,
      stack: error && error.stack,
    });

    // Em qualquer falha, exponha um contrato simples: null.
    return null;
  } finally {
    // Garante fechamento do browser para evitar vazamento de recursos.
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('[WebUnlock:scraper] Erro ao fechar o browser', {
          message: closeError && closeError.message,
        });
      }
    }
  }
}

module.exports = {
  scrapeElement,
};

