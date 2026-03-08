/* ============================================================
   LOCAL STORAGE LAYER — All data lives here. No backend needed.
   ============================================================ */

const Store = (() => {
  const PREFIX = 'mm_';

  const raw = {
    get(key, fallback = null) {
      try { const v = localStorage.getItem(PREFIX + key); return v !== null ? JSON.parse(v) : fallback; }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); }
      catch (e) { console.warn('LocalStorage write failed:', e); }
    },
    del(key) { localStorage.removeItem(PREFIX + key); },
    clear() {
      Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
    }
  };

  // ── Config (optional API keys) ─────────────────────────────
  const config = {
    get()  { return raw.get('config', {}); },
    set(updates) { raw.set('config', { ...config.get(), ...updates }); },
    val(key, fallback = null) { return config.get()[key] ?? fallback; },
    // Always ready — no backend setup required
    isSetup() { return true; }
  };

  // ── Primary data store ─────────────────────────────────────
  const DEFAULT_CATEGORIES = [
    { id: 'food',          emoji: '🛒', label: 'Food',          color: '#f97316', budget: 2000, active: true },
    { id: 'transport',     emoji: '🚗', label: 'Transport',     color: '#00a8e8', budget: 800,  active: true },
    { id: 'housing',       emoji: '🏠', label: 'Housing',       color: '#a855f7', budget: 2500, active: true },
    { id: 'health',        emoji: '❤️', label: 'Health',        color: '#e8002d', budget: 500,  active: true },
    { id: 'education',     emoji: '📚', label: 'Education',     color: '#ffd600', budget: 300,  active: true },
    { id: 'subscriptions', emoji: '📱', label: 'Subscriptions', color: '#39d353', budget: 400,  active: true },
    { id: 'clothing',      emoji: '👕', label: 'Clothing',      color: '#ec4899', budget: 300,  active: true },
    { id: 'entertainment', emoji: '🎬', label: 'Entertainment', color: '#8b5cf6', budget: 200,  active: true },
    { id: 'debt',          emoji: '💳', label: 'Debt',          color: '#ef4444', budget: 1500, active: true },
    { id: 'savings',       emoji: '🏦', label: 'Savings',       color: '#39d353', budget: 2000, active: true },
    { id: 'restaurant',   emoji: '🍽️', label: 'Dining',         color: '#f59e0b', budget: 600,  active: true },
    { id: 'other',         emoji: '📦', label: 'Other',         color: '#6b7280', budget: 500,  active: true }
  ];

  const DEFAULT_MILESTONES = [
    { year: 1, salary: 7500,  event: 'Current — Senior Specialist (Procurement)', notes: '' },
    { year: 2, salary: 8500,  event: 'Annual raise (estimated)',                  notes: '' },
    { year: 3, salary: 11000, event: 'Sr Analyst + Big Data Superior diploma',    notes: '' },
    { year: 5, salary: 13000, event: 'Estimated senior growth',                   notes: '' },
    { year: 10,salary: 18000, event: 'Long-term career projection',               notes: '' }
  ];

  const data = {
    getTransactions()     { return raw.get('data_tx', []); },
    setTransactions(v)    { raw.set('data_tx', v); },

    getDebts()            { return raw.get('data_debts', []); },
    setDebts(v)           { raw.set('data_debts', v); },

    getPatrimonio()       { return raw.get('data_patrimonio', {}); },
    setPatrimonio(v)      { raw.set('data_patrimonio', v); },

    getCategories()       { return raw.get('data_categories', DEFAULT_CATEGORIES); },
    setCategories(v)      { raw.set('data_categories', v); },

    getMilestones()       { return raw.get('data_milestones', DEFAULT_MILESTONES); },
    setMilestones(v)      { raw.set('data_milestones', v); },

    // Export everything as a single JSON blob
    exportAll() {
      return {
        version: 2,
        exportedAt: new Date().toISOString(),
        transactions: data.getTransactions(),
        debts:        data.getDebts(),
        patrimonio:   data.getPatrimonio(),
        categories:   data.getCategories(),
        milestones:   data.getMilestones()
      };
    },

    // Import from a JSON blob (merges or replaces)
    importAll(blob) {
      if (!blob || blob.version < 2) throw new Error('Unrecognised backup format');
      if (blob.transactions) data.setTransactions(blob.transactions);
      if (blob.debts)        data.setDebts(blob.debts);
      if (blob.patrimonio)   data.setPatrimonio(blob.patrimonio);
      if (blob.categories)   data.setCategories(blob.categories);
      if (blob.milestones)   data.setMilestones(blob.milestones);
    }
  };

  // ── Short-lived in-memory cache (computed summaries) ───────
  const cache = {
    get(key) { return raw.get(`cache_${key}`, null); },
    set(key, val) { raw.set(`cache_${key}`, { data: val, ts: Date.now() }); },
    fresh(key, maxAgeMs = 5000) {
      const c = raw.get(`cache_${key}`, null);
      return c && (Date.now() - c.ts < maxAgeMs) ? c.data : null;
    },
    invalidate(key) { raw.del(`cache_${key}`); },
    invalidateAll() {
      Object.keys(localStorage)
        .filter(k => k.startsWith(PREFIX + 'cache_'))
        .forEach(k => localStorage.removeItem(k));
    }
  };

  // ── Offline queue (kept for forward-compat, not used locally) ─
  const queue = {
    get()     { return raw.get('offline_queue', []); },
    add(item) {
      const q = queue.get();
      q.push({ ...item, queuedAt: Date.now(), id: crypto.randomUUID() });
      raw.set('offline_queue', q);
    },
    remove(id) { raw.set('offline_queue', queue.get().filter(i => i.id !== id)); },
    clear()    { raw.del('offline_queue'); },
    count()    { return queue.get().length; }
  };

  // ── Profile ────────────────────────────────────────────────
  const profile = {
    get() {
      return raw.get('profile', {
        name: 'Matthew', salary: 7500, fgts: 68000,
        carValue: 50000, debtTotal: 14000,
        savingsGoal: 500000, targetYears: 15
      });
    },
    set(updates) { raw.set('profile', { ...profile.get(), ...updates }); }
  };

  // ── View state ─────────────────────────────────────────────
  const ui = {
    get()  { return raw.get('ui', { activeMonth: Fmt.currentMonthKey(), activeView: 'dashboard' }); },
    set(updates) { raw.set('ui', { ...ui.get(), ...updates }); },
    val(key, fallback = null) { return ui.get()[key] ?? fallback; }
  };

  return { raw, config, data, cache, queue, profile, ui };
})();
