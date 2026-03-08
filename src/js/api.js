/* ============================================================
   API LAYER — Google Apps Script + Gemini integration
   ============================================================ */

const API = (() => {
  // ── Helpers ───────────────────────────────────────────────

  async function call(action, params = {}, method = 'GET', body = null) {
    const scriptUrl = Store.config.val('scriptUrl');
    if (!scriptUrl) throw new Error('Apps Script URL not configured. Go to Settings.');

    const url = new URL(scriptUrl);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    };

    const res = await fetch(url.toString(), opts);
    if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json;
  }

  // ── Transactions ──────────────────────────────────────────

  async function getTransactions({ month = null, category = null, type = null } = {}) {
    const cacheKey = `tx_${month || 'all'}_${category || 'all'}_${type || 'all'}`;
    const cached = Store.cache.fresh(cacheKey, 30_000);
    if (cached) return cached;

    const params = {};
    if (month)    params.month = month;
    if (category) params.category = category;
    if (type)     params.type = type;

    const result = await call('getTransactions', params);
    Store.cache.set(cacheKey, result.data);
    return result.data;
  }

  async function addTransaction(tx) {
    Store.cache.invalidateAll();
    // If offline, queue it
    if (!navigator.onLine) {
      Store.queue.add({ action: 'addTransaction', data: tx });
      return { queued: true, localId: crypto.randomUUID() };
    }
    return call('addTransaction', {}, 'POST', tx);
  }

  async function updateTransaction(id, updates) {
    Store.cache.invalidateAll();
    return call('updateTransaction', {}, 'POST', { id, ...updates });
  }

  async function deleteTransaction(id) {
    Store.cache.invalidateAll();
    return call('deleteTransaction', { id });
  }

  // ── Summary ───────────────────────────────────────────────

  async function getSummary(month) {
    const cacheKey = `summary_${month}`;
    const cached = Store.cache.fresh(cacheKey, 60_000);
    if (cached) return cached;

    const result = await call('getSummary', { month });
    Store.cache.set(cacheKey, result.data);
    return result.data;
  }

  async function getMonthlyHistory(months = 6) {
    const cacheKey = `history_${months}`;
    const cached = Store.cache.fresh(cacheKey, 120_000);
    if (cached) return cached;

    const result = await call('getMonthlyHistory', { months });
    Store.cache.set(cacheKey, result.data);
    return result.data;
  }

  // ── Debts ─────────────────────────────────────────────────

  async function getDebts() {
    const cached = Store.cache.fresh('debts', 120_000);
    if (cached) return cached;
    const result = await call('getDebts');
    Store.cache.set('debts', result.data);
    return result.data;
  }

  async function upsertDebt(debt) {
    Store.cache.invalidate('debts');
    return call('upsertDebt', {}, 'POST', debt);
  }

  // ── Patrimônio ────────────────────────────────────────────

  async function getPatrimonio() {
    const cached = Store.cache.fresh('patrimonio', 120_000);
    if (cached) return cached;
    const result = await call('getPatrimonio');
    Store.cache.set('patrimonio', result.data);
    return result.data;
  }

  async function updatePatrimonio(data) {
    Store.cache.invalidate('patrimonio');
    return call('updatePatrimonio', {}, 'POST', data);
  }

  // ── Categories ────────────────────────────────────────────

  async function getCategories() {
    const cached = Store.cache.fresh('categories', 300_000);
    if (cached) return cached;
    const result = await call('getCategories');
    Store.cache.set('categories', result.data);
    return result.data;
  }

  // ── Salary milestones ─────────────────────────────────────

  async function getSalaryMilestones() {
    const cached = Store.cache.fresh('salary_milestones', 300_000);
    if (cached) return cached;
    const result = await call('getSalaryMilestones');
    Store.cache.set('salary_milestones', result.data);
    return result.data;
  }

  async function saveSalaryMilestones(milestones) {
    Store.cache.invalidate('salary_milestones');
    return call('saveSalaryMilestones', {}, 'POST', { milestones });
  }

  // ── Gemini AI (receipt / note parsing) ────────────────────

  async function parseReceiptWithGemini(base64Image, mimeType = 'image/jpeg') {
    const geminiKey = Store.config.val('geminiKey');
    if (!geminiKey) throw new Error('Gemini API key not configured. Go to Settings.');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;

    const prompt = `You are a Brazilian financial assistant. Analyze this receipt, note, or financial document image and extract the following information in JSON format.

Return ONLY a valid JSON object with these fields:
{
  "merchant": "store or payee name (string)",
  "date": "YYYY-MM-DD format (string, today if not visible)",
  "total": "total amount in numbers only, no R$ symbol (number)",
  "category": "one of: food, transport, housing, health, education, subscriptions, clothing, entertainment, debt, savings, other (string)",
  "description": "brief description in English (string)",
  "items": [{"name": "item name", "qty": 1, "price": 0.00}],
  "type": "expense or income (string)",
  "currency": "BRL",
  "confidence": "high/medium/low (string)"
}

If this is a handwritten note, extract any financial information present.
If the image is not a receipt or financial document, set confidence to "low" and fill what you can.`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Image } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Gemini error: ${err?.error?.message || res.statusText}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract JSON from response (may be wrapped in ```json blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Gemini returned unexpected format');

    return JSON.parse(jsonMatch[0]);
  }

  // ── Flush offline queue ───────────────────────────────────

  async function flushQueue() {
    const items = Store.queue.get();
    if (!items.length) return;

    for (const item of items) {
      try {
        if (item.action === 'addTransaction') {
          await addTransaction(item.data);
        }
        Store.queue.remove(item.id);
      } catch (e) {
        console.warn('Queue flush failed for', item.id, e);
        break; // stop on first failure, retry next time
      }
    }
  }

  // ── Init backend (first-time sheet setup) ─────────────────

  async function initBackend() {
    return call('initSheets');
  }

  return {
    getTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getSummary,
    getMonthlyHistory,
    getDebts,
    upsertDebt,
    getPatrimonio,
    updatePatrimonio,
    getCategories,
    getSalaryMilestones,
    saveSalaryMilestones,
    parseReceiptWithGemini,
    flushQueue,
    initBackend
  };
})();
