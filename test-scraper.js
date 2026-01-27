const { scrapeElement } = require('./src/scraper');

(async () => {
  const url = 'https://g1.globo.com/';
  const selector = 'p';

  const text = await scrapeElement(url, selector);
  console.log('Resultado do scrape:', text);
  process.exit(0);
})();

