/* ============================================================
   API LAYER — Local-first. All data in localStorage.
   Gemini (optional) for AI receipt scanning.
   Apps Script URL in Settings = optional Google Sheets sync.
   ============================================================ */

const API = (() => {

  // ── Transactions ──────────────────────────────────────────

  async function getTransactions({ month = null, category = null, type = null } = {}) {
    let txs = Store.data.getTransactions();
    if (month)    txs = txs.filter(t => t.date?.startsWith(month));
    if (category) txs = txs.filter(t => t.category === category);
    if (type)     txs = txs.filter(t => t.type === type);
    return txs.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  }

  async function addTransaction(tx) {
    const txs = Store.data.getTransactions();
    const newTx = {
      ...tx,
      id:        tx.id || crypto.randomUUID(),
      createdAt: tx.createdAt || new Date().toISOString()
    };
    txs.push(newTx);
    Store.data.setTransactions(txs);
    Store.cache.invalidateAll();
    return { data: newTx, success: true };
  }

  async function updateTransaction(id, updates) {
    const txs = Store.data.getTransactions();
    const idx = txs.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Transaction not found: ' + id);
    txs[idx] = { ...txs[idx], ...updates, id };
    Store.data.setTransactions(txs);
    Store.cache.invalidateAll();
    return { data: txs[idx], success: true };
  }

  async function deleteTransaction(id) {
    Store.data.setTransactions(Store.data.getTransactions().filter(t => t.id !== id));
    Store.cache.invalidateAll();
    return { success: true };
  }

  // ── Summary (computed locally) ────────────────────────────

  async function getSummary(month) {
    const cacheKey = `summary_${month}`;
    const cached = Store.cache.fresh(cacheKey, 5000);
    if (cached) return cached;

    const all     = Store.data.getTransactions();
    const monthly = all.filter(t => t.date?.startsWith(month));

    let income = 0, expenses = 0;
    const byCat = {};
    monthly.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') {
        income += amt;
      } else {
        expenses += amt;
        byCat[t.category] = (byCat[t.category] || 0) + amt;
      }
    });

    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const now         = new Date();
    const cutoff      = new Date(year, mon - 1, daysInMonth);
    const daysPassed  = now < cutoff ? now.getDate() : daysInMonth;

    const summary = {
      month,
      totalIncome:  income,
      totalExpenses: expenses,
      balance:      income - expenses,
      byCategory:   byCat,
      txCount:      monthly.length,
      avgPerDay:    daysPassed > 0 ? expenses / daysPassed : 0,
      savingsRate:  income > 0 ? (income - expenses) / income * 100 : 0,
      recentTx:     monthly.slice(0, 10)
    };

    Store.cache.set(cacheKey, summary);
    return summary;
  }

  async function getMonthlyHistory(months = 6) {
    const cacheKey = `history_${months}`;
    const cached   = Store.cache.fresh(cacheKey, 10_000);
    if (cached) return cached;

    const all  = Store.data.getTransactions();
    const hist = {};
    all.forEach(t => {
      if (!t.date) return;
      const mo = t.date.substring(0, 7);
      if (!hist[mo]) hist[mo] = { month: mo, income: 0, expenses: 0 };
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') hist[mo].income += amt;
      else hist[mo].expenses += amt;
    });

    const result = Object.values(hist)
      .sort((a, b) => (a.month > b.month ? 1 : -1))
      .slice(-months);

    Store.cache.set(cacheKey, result);
    return result;
  }

  // ── Debts ─────────────────────────────────────────────────

  async function getDebts() {
    return Store.data.getDebts();
  }

  async function upsertDebt(debt) {
    const debts = Store.data.getDebts();
    const idx   = debts.findIndex(d => d.id === debt.id);
    const entry = { ...debt, id: debt.id || crypto.randomUUID(), updatedAt: new Date().toISOString() };
    if (idx >= 0) debts[idx] = entry; else debts.push(entry);
    Store.data.setDebts(debts);
    Store.cache.invalidate('debts');
    return { data: entry, success: true };
  }

  // ── Patrimônio ────────────────────────────────────────────

  async function getPatrimonio() {
    return Store.data.getPatrimonio();
  }

  async function updatePatrimonio(updates) {
    const current = Store.data.getPatrimonio();
    const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
    Store.data.setPatrimonio(updated);
    Store.cache.invalidate('patrimonio');
    return { data: updated, success: true };
  }

  // ── Categories ────────────────────────────────────────────

  async function getCategories() {
    return Store.data.getCategories();
  }

  // ── Salary milestones ─────────────────────────────────────

  async function getSalaryMilestones() {
    return Store.data.getMilestones();
  }

  async function saveSalaryMilestones(milestones) {
    Store.data.setMilestones(milestones);
    Store.cache.invalidate('salary_milestones');
    return { success: true };
  }

  // ── Gemini AI (receipt / note parsing) ────────────────────

  // Model waterfall: best reasoning first, lightweight safety net last.
  // Falls back automatically on rate-limit (429), unavailability (503),
  // or model-not-found (404) errors — only fails if all models are exhausted.
  const GEMINI_MODELS = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ];

  // Strict JSON schema passed directly to the API — no prompt-engineering guesswork.
  const RECEIPT_SCHEMA = {
    type: 'object',
    properties: {
      merchant:    { type: 'string' },
      date:        { type: 'string', description: 'YYYY-MM-DD' },
      total:       { type: 'number' },
      category:    { type: 'string', enum: ['food','transport','housing','health','education','subscriptions','clothing','entertainment','debt','savings','other'] },
      description: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:  { type: 'string' },
            qty:   { type: 'number' },
            price: { type: 'number' },
          },
          required: ['name', 'qty', 'price'],
        },
      },
      type:       { type: 'string', enum: ['expense', 'income'] },
      currency:   { type: 'string' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    },
    required: ['merchant','date','total','category','description','items','type','currency','confidence'],
  };

  const RECEIPT_PROMPT = `You are a Brazilian financial assistant. Analyze this receipt, note, or financial document image and extract the structured data.
Use today's date if the date is not visible. Default currency to BRL. Set confidence to "low" if the image is not a recognisable financial document.
For handwritten notes, extract any financial information present.`;

  async function parseReceiptWithGemini(base64Image, mimeType = 'image/jpeg') {
    const geminiKey = Store.config.val('geminiKey');
    if (!geminiKey) throw new Error('Gemini API key not set. Add it in Settings ⚙️ (it\'s free from aistudio.google.com).');

    const body = JSON.stringify({
      contents: [{
        parts: [
          { text: RECEIPT_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64Image } },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        response_mime_type: 'application/json',
        response_schema: RECEIPT_SCHEMA,
      },
    });

    const FALLBACK_CODES = new Set([429, 503, 404]);
    let lastError;

    for (const model of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      let res;
      try {
        res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      } catch (networkErr) {
        lastError = networkErr;
        continue;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        lastError = new Error(`Gemini error (${model}): ${err?.error?.message || res.statusText}`);
        if (FALLBACK_CODES.has(res.status)) continue; // try next model
        throw lastError; // hard error (e.g. 400 bad request, 401 invalid key)
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      try {
        return JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) { lastError = new Error('Gemini returned unexpected format'); continue; }
        return JSON.parse(jsonMatch[0]);
      }
    }

    throw lastError || new Error('All Gemini models failed');
  }

  // ── Export / Import ───────────────────────────────────────

  function exportData() {
    const blob  = Store.data.exportAll();
    const json  = JSON.stringify(blob, null, 2);
    const bytes = new Blob([json], { type: 'application/json' });
    const url   = URL.createObjectURL(bytes);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = `matt-money-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const blob = JSON.parse(e.target.result);
          Store.data.importAll(blob);
          Store.cache.invalidateAll();
          resolve(blob);
        } catch(err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsText(file);
    });
  }

  // ── Compatibility stubs (no-ops since data is always local) ──

  async function flushQueue()  { return; }
  async function initBackend() { return { success: true }; }

  return {
    getTransactions, addTransaction, updateTransaction, deleteTransaction,
    getSummary, getMonthlyHistory,
    getDebts, upsertDebt,
    getPatrimonio, updatePatrimonio,
    getCategories,
    getSalaryMilestones, saveSalaryMilestones,
    parseReceiptWithGemini,
    exportData, importData,
    flushQueue, initBackend
  };
})();
