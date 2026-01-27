const form = document.getElementById('scrape-form');
const resultEl = document.getElementById('result');
const submitBtn = document.getElementById('submit-btn');
const copyBtn = document.getElementById('copy-btn');

function setResult(data, isError = false) {
  const json =
    typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  resultEl.textContent = json;
  resultEl.classList.toggle('error', isError);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const url = form.url.value.trim();
  const selector = form.selector.value.trim();

  if (!url || !selector) {
    setResult(
      {
        success: false,
        error: 'Preencha URL e seletor antes de enviar.',
      },
      true
    );
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Processando...';
  setResult({ loading: true, message: 'Executando scrape...' });

  try {
    const response = await fetch('/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, selector }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setResult(
        data || {
          success: false,
          status: response.status,
          error: 'Erro ao processar o scrape.',
        },
        true
      );
      return;
    }

    setResult(data, !data?.success);
  } catch (error) {
    setResult(
      {
        success: false,
        error: 'Falha ao comunicar com o servidor.',
        detail: error?.message,
      },
      true
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Executar scrape';
  }
});

copyBtn.addEventListener('click', async () => {
  const text = resultEl.textContent;
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = 'Copiado!';
    setTimeout(() => {
      copyBtn.textContent = 'Copiar';
    }, 1500);
  } catch {
    copyBtn.textContent = 'Erro ao copiar';
    setTimeout(() => {
      copyBtn.textContent = 'Copiar';
    }, 1500);
  }
});

