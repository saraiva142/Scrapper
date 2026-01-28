// Estado global
let currentData = null;
let currentStats = null;

// Elementos DOM
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const loadingOverlay = document.getElementById('loading-overlay');
const resultEl = document.getElementById('result');
const statsEl = document.getElementById('stats');
const copyBtn = document.getElementById('copy-btn');
const exportCsvBtn = document.getElementById('export-csv-btn');
const exportJsonBtn = document.getElementById('export-json-btn');
const screenshotPreview = document.getElementById('screenshot-preview');
const screenshotImg = document.getElementById('screenshot-img');

// Sistema de abas
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.dataset.tab;
    
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    tab.classList.add('active');
    document.getElementById(`tab-${targetTab}`).classList.add('active');
    
    // Limpa resultado ao trocar de aba
    clearResult();
  });
});

function showLoading() {
  loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  loadingOverlay.style.display = 'none';
}

function setResult(data, isError = false) {
  const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  resultEl.textContent = json;
  resultEl.classList.toggle('error', isError);
  currentData = data;
  
  // Mostra/esconde screenshot
  if (data?.screenshot) {
    screenshotImg.src = data.screenshot;
    screenshotPreview.style.display = 'block';
  } else {
    screenshotPreview.style.display = 'none';
  }
}

function setStats(stats) {
  if (!stats) {
    statsEl.innerHTML = '';
    currentStats = null;
    return;
  }
  
  currentStats = stats;
  const items = [];
  
  if (stats.totalSelectors !== undefined) {
    items.push(`<span>Seletores: <strong>${stats.totalSelectors}</strong></span>`);
  }
  if (stats.totalElements !== undefined) {
    items.push(`<span>Elementos: <strong>${stats.totalElements}</strong></span>`);
  }
  if (stats.totalRows !== undefined) {
    items.push(`<span>Linhas: <strong>${stats.totalRows}</strong></span>`);
  }
  if (stats.executionTime !== undefined) {
    items.push(`<span>Tempo: <strong>${stats.executionTime}ms</strong></span>`);
  }
  
  statsEl.innerHTML = items.join('');
}

function clearResult() {
  setResult({ aguardando: true });
  setStats(null);
  currentData = null;
}

// Formulário Simples
const simpleForm = document.getElementById('scrape-form');
if (simpleForm) {
  simpleForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const url = simpleForm.url.value.trim();
    const selector = simpleForm.selector.value.trim();
    
    if (!url || !selector) {
      setResult({ success: false, error: 'Preencha URL e seletor.' }, true);
      return;
    }
    
    const selectors = selector.split(',').map(s => s.trim()).filter(s => s);
    
    showLoading();
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processando...';
    
    try {
      const response = await fetch('/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url, 
          selectors: selectors.length > 1 ? selectors : selectors[0]
        }),
      });
      
      const data = await response.json().catch(() => null);
      
      if (!response.ok) {
        setResult(data || { success: false, error: 'Erro ao processar.' }, true);
        return;
      }
      
      setResult(data, !data?.success);
      setStats(data?.stats);
    } catch (error) {
      setResult({ success: false, error: 'Falha ao comunicar com o servidor.', detail: error?.message }, true);
    } finally {
      hideLoading();
      submitBtn.disabled = false;
      submitBtn.textContent = 'Executar scrape';
    }
  });
}

// Formulário Tabela
const tableForm = document.getElementById('table-form');
if (tableForm) {
  tableForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const url = tableForm.url.value.trim();
    const tableSelector = tableForm.tableSelector.value.trim();
    
    if (!url || !tableSelector) {
      setResult({ success: false, error: 'Preencha URL e seletor da tabela.' }, true);
      return;
    }
    
    showLoading();
    const submitBtn = document.getElementById('table-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processando...';
    
    try {
      const response = await fetch('/scrape/table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, tableSelector }),
      });
      
      const data = await response.json().catch(() => null);
      
      if (!response.ok) {
        setResult(data || { success: false, error: 'Erro ao processar tabela.' }, true);
        return;
      }
      
      setResult(data, !data?.success);
      setStats(data?.stats);
    } catch (error) {
      setResult({ success: false, error: 'Falha ao comunicar com o servidor.', detail: error?.message }, true);
    } finally {
      hideLoading();
      submitBtn.disabled = false;
      submitBtn.textContent = 'Executar scrape de tabela';
    }
  });
}

// Formulário Avançado
const advancedForm = document.getElementById('advanced-form');
if (advancedForm) {
  advancedForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const url = advancedForm.url.value.trim();
    const selectorsText = advancedForm.selectors.value.trim();
    
    if (!url || !selectorsText) {
      setResult({ success: false, error: 'Preencha URL e seletores.' }, true);
      return;
    }
    
    const selectors = selectorsText.split(/[,\n]/).map(s => s.trim()).filter(s => s);
    
    const options = {};
    if (advancedForm.timeout.value) options.timeout = parseInt(advancedForm.timeout.value);
    if (advancedForm.waitUntil.value) options.waitUntil = advancedForm.waitUntil.value;
    if (advancedForm.userAgent.value.trim()) options.userAgent = advancedForm.userAgent.value.trim();
    if (advancedForm.viewportWidth.value && advancedForm.viewportHeight.value) {
      options.viewport = {
        width: parseInt(advancedForm.viewportWidth.value),
        height: parseInt(advancedForm.viewportHeight.value),
      };
    }
    if (advancedForm.retries.value) options.retries = parseInt(advancedForm.retries.value);
    
    showLoading();
    const submitBtn = document.getElementById('advanced-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processando...';
    
    try {
      const response = await fetch('/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, selectors, options }),
      });
      
      const data = await response.json().catch(() => null);
      
      if (!response.ok) {
        setResult(data || { success: false, error: 'Erro ao processar.' }, true);
        return;
      }
      
      setResult(data, !data?.success);
      setStats(data?.stats);
    } catch (error) {
      setResult({ success: false, error: 'Falha ao comunicar com o servidor.', detail: error?.message }, true);
    } finally {
      hideLoading();
      submitBtn.disabled = false;
      submitBtn.textContent = 'Executar scrape avançado';
    }
  });
}

// Formulário Screenshot
const screenshotForm = document.getElementById('screenshot-form');
if (screenshotForm) {
  screenshotForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const url = screenshotForm.url.value.trim();
    
    if (!url) {
      setResult({ success: false, error: 'Preencha a URL.' }, true);
      return;
    }
    
    const options = {};
    if (screenshotForm.width.value && screenshotForm.height.value) {
      options.viewport = {
        width: parseInt(screenshotForm.width.value),
        height: parseInt(screenshotForm.height.value),
      };
    }
    if (screenshotForm.fullPage.checked) {
      options.fullPage = true;
    }
    
    showLoading();
    const submitBtn = document.getElementById('screenshot-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Capturando...';
    
    try {
      const response = await fetch('/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, options }),
      });
      
      const data = await response.json().catch(() => null);
      
      if (!response.ok) {
        setResult(data || { success: false, error: 'Erro ao capturar screenshot.' }, true);
        return;
      }
      
      setResult(data, !data?.success);
      setStats(data?.stats);
    } catch (error) {
      setResult({ success: false, error: 'Falha ao comunicar com o servidor.', detail: error?.message }, true);
    } finally {
      hideLoading();
      submitBtn.disabled = false;
      submitBtn.textContent = 'Capturar screenshot';
    }
  });
}

// Botão Copiar
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

// Exportar CSV
exportCsvBtn.addEventListener('click', async () => {
  if (!currentData || !currentData.data) {
    alert('Nenhum dado para exportar. Execute um scrape primeiro.');
    return;
  }
  
  try {
    const response = await fetch('/export/csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        data: currentData.data,
        filename: `webunlock-${Date.now()}`,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro ao gerar CSV.' }));
      alert(error.error || 'Erro ao gerar CSV.');
      return;
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webunlock-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    exportCsvBtn.textContent = 'CSV ✓';
    setTimeout(() => {
      exportCsvBtn.textContent = 'CSV';
    }, 1500);
  } catch (error) {
    alert('Erro ao exportar CSV: ' + error.message);
  }
});

// Exportar JSON
exportJsonBtn.addEventListener('click', async () => {
  if (!currentData || !currentData.data) {
    alert('Nenhum dado para exportar. Execute um scrape primeiro.');
    return;
  }
  
  try {
    const response = await fetch('/export/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        data: currentData.data,
        filename: `webunlock-${Date.now()}`,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro ao gerar JSON.' }));
      alert(error.error || 'Erro ao gerar JSON.');
      return;
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webunlock-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    exportJsonBtn.textContent = 'JSON ✓';
    setTimeout(() => {
      exportJsonBtn.textContent = 'JSON';
    }, 1500);
  } catch (error) {
    alert('Erro ao exportar JSON: ' + error.message);
  }
});
