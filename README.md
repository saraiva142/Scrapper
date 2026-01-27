# WebUnlock 1.0 – MVP

Transforme elementos de páginas web em **APIs JSON** usando **Puppeteer** e uma interface web simples, moderna e auto‑hosteada.

Este repositório contém:

- **Módulo de scraping** (`src/scraper.js`) usando Puppeteer.
- **API HTTP** (`server.js`) em Express expondo a rota `/scrape`.
- **Interface Web** (`public/`) para testar o scraping visualmente.

---

## Requisitos

- **Node.js** 18+ (recomendado 18 ou 20).
- Acesso à internet (para fazer o scraping das páginas de destino).

---

## Instalação

1. **Clonar ou copiar o projeto** para sua máquina.
2. No terminal, navegar até a pasta do projeto:

```bash
cd "C:\Users\Elisio da Silva\Desktop\Coisas do João\WebUnlock1.0"
```

3. **Instalar dependências**:

```bash
npm install
```

Isso instalará, entre outros:

- `express` – servidor HTTP.
- `puppeteer` – controle do Chromium para fazer o scraping.

> Observação: o Puppeteer pode baixar automaticamente uma versão do Chromium na primeira instalação. Esse passo pode demorar alguns minutos.

---

## Como startar o projeto

1. Certifique‑se de estar na pasta raiz do projeto:

```bash
cd "C:\Users\....\WebUnlock1.0"
```

2. Inicie o servidor em modo desenvolvimento/local:

```bash
npm start
```

3. Se tudo estiver correto, o terminal deve exibir algo como:

```text
WebUnlock rodando em http://localhost:3000
```

4. Abra o navegador e acesse:

```text
http://localhost:3000
```

---

## Interface Web (Frontend)

Arquivos principais na pasta `public/`:

- `index.html` – página principal com o formulário.
- `styles.css` – estilos da interface (tema escuro, layout responsivo).
- `app.js` – lógica de front para chamar a API `/scrape` e exibir o resultado.

### Como usar a interface

1. Com o servidor rodando (`npm start`), abra `http://localhost:3000` no navegador.
2. No formulário, preencha:
   - **URL da página** – ex.: `https://g1.globo.com/`
   - **Seletor CSS do elemento** – ex.: `h1`, `.classe`, `#id`.
3. Clique em **“Executar scrape”**.
4. O painel de resultado à direita mostrará um JSON semelhante a:

```json
{
  "success": true,
  "url": "https://g1.globo.com/",
  "selector": "h1",
  "data": "Título principal da página..."
}
```

5. Use o botão **“Copiar”** para copiar o JSON exibido para a área de transferência.

---

## API HTTP (Backend)

O backend principal está em `server.js`, usando Express.

### Rotas disponíveis

- **GET `/health`**

  - Verifica se o serviço está de pé.
  - Exemplo de resposta:

  ```json
  {
    "status": "ok",
    "service": "WebUnlock",
    "timestamp": "2026-01-27T12:34:56.789Z"
  }
  ```

- **POST `/scrape`**

  - Corpo esperado (JSON):

  ```json
  {
    "url": "https://exemplo.com",
    "selector": "h1"
  }
  ```

  - Resposta de sucesso:

  ```json
  {
    "success": true,
    "url": "https://exemplo.com",
    "selector": "h1",
    "data": "Texto encontrado no elemento"
  }
  ```

  - Em caso de erro de parâmetros (faltando `url` ou `selector`):

  ```json
  {
    "success": false,
    "error": "Parâmetros inválidos. Envie \"url\" e \"selector\"."
  }
  ```

> Importante: Mesmo em caso de falha de scraping interna, o contrato da função `scrapeElement` retorna `null` em `data`, e o Express responde com `success: true` + `data: null`. Os detalhes do erro são logados no console do servidor.

---

## Módulo de Scraping (`src/scraper.js`)

O módulo usa **Puppeteer** para abrir a página e extrair o texto de um único elemento CSS.

### Função principal

- **Assinatura**:

```js
async function scrapeElement(url, selector): Promise<string | null>
```

- **Comportamento**:
  - Abre um navegador headless (`headless: 'new'`) com flags otimizadas para ambiente de servidor.
  - Faz `page.goto(url, { waitUntil: 'domcontentloaded' })`.
  - Aguarda o seletor (`page.waitForSelector(selector, { timeout: 10000 })`).
  - Dentro de `page.evaluate`:
    - Tenta `element.innerText.trim()`.
    - Se vazio, tenta `element.textContent.trim()`.
    - Se não encontrar o elemento ou não houver texto, retorna `null`.
  - Usa `try/catch/finally`:
    - Loga erros no console incluindo `url` e `selector`.
    - Garante `browser.close()` no bloco `finally`.

### Uso direto em Node (sem Express)

Você pode usar o módulo diretamente em qualquer script Node:

```js
const { scrapeElement } = require('./src/scraper');

(async () => {
  const url = 'https://example.com';
  const selector = 'h1';

  const text = await scrapeElement(url, selector);
  console.log('Resultado do scrape:', text);
})();
```

---

## Script de teste rápido (`test-scraper.js`)

Além da interface web, há um script simples para testar o scraper via terminal:

```js
const { scrapeElement } = require('./src/scraper');

(async () => {
  const url = 'https://g1.globo.com/';
  const selector = 'p';

  const text = await scrapeElement(url, selector);
  console.log('Resultado do scrape:', text);
  process.exit(0);
})();
```

### Como rodar o teste

```bash
cd "C:\Users\Elisio da Silva\Desktop\Coisas do João\WebUnlock1.0"
node test-scraper.js
```

---

## Próximos passos possíveis (idéias de evolução)

- Aceitar **vários seletores** e retornar um objeto JSON com vários campos.
- Suporte a **templates de scraping** salvos (para reusar “APIs” por site).
- Autenticação básica (token simples) para expor isso como um **SaaS** real.
- Filas/queue para lidar com alto volume de requisições.

Este MVP já é suficiente para brincar com o conceito de **“sites como APIs JSON”** localmente. Sinta‑se à vontade para adaptar, refatorar e evoluir para o produto final. 😉

