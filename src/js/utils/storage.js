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

    // ── Accounts (bank accounts) ───────────────────────────────
    getAccounts()         { return raw.get('data_accounts', []); },
    setAccounts(v)        { raw.set('data_accounts', v); },

    // ── Credit Cards ───────────────────────────────────────────
    getCreditCards()      { return raw.get('data_credit_cards', []); },
    setCreditCards(v)     { raw.set('data_credit_cards', v); },

    // ── Setup completed flag ───────────────────────────────────
    isSetupDone()         { return raw.get('setup_done', false); },
    setSetupDone(v)       { raw.set('setup_done', v); },

    // ── Installments ────────────────────────────────────────────
    getInstallments()      { return raw.get('data_installments', []); },
    setInstallments(v)     { raw.set('data_installments', v); },

    // ── Manual Faturas (per card per month) ───────────────────
    getFaturas()           { return raw.get('data_faturas', []); },
    setFaturas(v)          { raw.set('data_faturas', v); },

    // ── Cash Flow (per month planned income/expenses) ─────────
    getCashFlow()          { return raw.get('data_cash_flow', []); },
    setCashFlow(v)         { raw.set('data_cash_flow', v); },

    // ── Personal Loans & Debts ────────────────────────────────
    getLoans()             { return raw.get('data_loans', []); },
    setLoans(v)            { raw.set('data_loans', v); },

    // ── Monthly Subscriptions (fixed recurring costs) ──────────
    getSubscriptions()     { return raw.get('data_subscriptions', []); },
    setSubscriptions(v)    { raw.set('data_subscriptions', v); },

    // Export everything as a single JSON blob
    exportAll() {
      return {
        version: 3,
        exportedAt: new Date().toISOString(),
        transactions:  data.getTransactions(),
        debts:         data.getDebts(),
        patrimonio:    data.getPatrimonio(),
        categories:    data.getCategories(),
        milestones:    data.getMilestones(),
        accounts:      data.getAccounts(),
        creditCards:   data.getCreditCards(),
        installments:  data.getInstallments(),
        faturas:       data.getFaturas(),
        cashFlow:      data.getCashFlow(),
        subscriptions: data.getSubscriptions(),
        loans:         data.getLoans(),
        setupDone:     data.isSetupDone(),
        profile:       profile.get(),
        config:        config.get()
      };
    },

    // Import from a JSON blob (merges or replaces)
    importAll(blob) {
      if (!blob || blob.version < 2) throw new Error('Unrecognised backup format');
      if (blob.transactions)  data.setTransactions(blob.transactions);
      if (blob.debts)         data.setDebts(blob.debts);
      if (blob.patrimonio)    data.setPatrimonio(blob.patrimonio);
      if (blob.categories)    data.setCategories(blob.categories);
      if (blob.milestones)    data.setMilestones(blob.milestones);
      if (blob.accounts)      data.setAccounts(blob.accounts);
      if (blob.creditCards)   data.setCreditCards(blob.creditCards);
      if (blob.installments)  data.setInstallments(blob.installments);
      if (blob.faturas)       data.setFaturas(blob.faturas);
      if (blob.cashFlow)      data.setCashFlow(blob.cashFlow);
      if (blob.loans)         data.setLoans(blob.loans);
      if (blob.subscriptions) data.setSubscriptions(blob.subscriptions);
      if (blob.setupDone != null) data.setSetupDone(blob.setupDone);
      if (blob.profile)  profile.set(blob.profile);
      if (blob.config)   config.set(blob.config);
    }
  };

  // ── Short-lived in-memory cache (computed summaries) ───────
  const _memCache = {};
  const cache = {
    get(key) { return _memCache[key] || null; },
    set(key, val) { _memCache[key] = { data: val, ts: Date.now() }; },
    fresh(key, maxAgeMs = 5000) {
      const c = _memCache[key];
      return c && (Date.now() - c.ts < maxAgeMs) ? c.data : null;
    },
    invalidate(key) { delete _memCache[key]; },
    invalidateAll() {
      Object.keys(_memCache).forEach(k => delete _memCache[k]);
      // Clean up any legacy cache keys from localStorage
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
        name: 'Matthew', employerName: '', salary: 7500, fgts: 68000,
        carValue: 50000, debtTotal: 14000,
        savingsGoal: 500000, targetYears: 15,
        // Employment
        salaryType: 'mensalista', // 'mensalista' | 'horista'
        hourlyRate: 0,
        hoursPerWeek: 44,
        workStartDate: '',
        vacationDaysTotal: 30,
        vacationPeriods: 3,
        vacationDaysToSell: 0,
        // Income schedule
        paymentFrequency: 'quinzenal', // 'monthly' | 'quinzenal' | 'custom'
        paymentSchedule: [
          { label: 'Adiantamento', day: 15, percent: 40, isFixed: false, amount: 0 },
          { label: 'Salário', day: 30, percent: 60, isFixed: false, amount: 0 }
        ],
        // Vacation plans (one entry per vacation period taken in the year)
        vacationPlans: [],
        // 13th salary installment months (1-12)
        decimo13Month1: 11, // November
        decimo13Month2: 12, // December
        // Dynamic deductions list (non-INSS/IRRF items)
        deductionsList: [
          { id: 'health', name: 'Plano de Saúde', type: 'fixed', amount: 0 },
          { id: 'dental', name: 'Dental', type: 'fixed', amount: 0 },
          { id: 'vt', name: 'Vale Transporte', type: 'fixed', amount: 0 }
        ],
        benefitsList: [
          { id: 'va', name: 'Vale Alimentação', type: 'fixed', amount: 0 },
          { id: 'vr', name: 'Vale Refeição', type: 'fixed', amount: 0 }
        ],
        // Legacy scalar fields — kept for backward compat with calcSalaryBreakdown
        deductHealthPlan: 0,
        deductDental: 0,
        deductValeTransporte: 0,
        deductOther: 0,
        benefitVA: 0,
        benefitVR: 0,
        benefitOther: 0,
        // Legacy income schedule fields
        adiantamentoAmount: 0,
        adiantamentoDay: 15,
        salaryDay: 30
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

  // ── Backup system (IndexedDB) ──────────────────────────────
  const DB_NAME = 'mm_backups';
  const DB_VERSION = 1;
  const DB_STORE = 'snapshots';

  function openBackupDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          const store = db.createObjectStore(DB_STORE, { keyPath: 'id' });
          store.createIndex('account', 'account', { unique: false });
          store.createIndex('date', 'date', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  const backup = {
    // Save a snapshot for the given account
    async save(accountName) {
      const db = await openBackupDB();
      const snapshot = {
        id: crypto.randomUUID(),
        account: accountName,
        date: new Date().toISOString(),
        dateKey: new Date().toISOString().slice(0, 10),
        data: data.exportAll()
      };
      return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(snapshot);
        tx.oncomplete = () => { db.close(); resolve(snapshot); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    },

    // List all snapshots for an account (newest first)
    async list(accountName) {
      const db = await openBackupDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const idx = tx.objectStore(DB_STORE).index('account');
        const req = idx.getAll(accountName);
        req.onsuccess = () => {
          db.close();
          resolve(req.result.sort((a, b) => b.date.localeCompare(a.date)));
        };
        req.onerror = () => { db.close(); reject(req.error); };
      });
    },

    // List all unique account names
    async getAccounts() {
      const db = await openBackupDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const req = tx.objectStore(DB_STORE).getAll();
        req.onsuccess = () => {
          db.close();
          const names = [...new Set(req.result.map(s => s.account))];
          resolve(names.sort());
        };
        req.onerror = () => { db.close(); reject(req.error); };
      });
    },

    // Get a specific snapshot
    async get(id) {
      const db = await openBackupDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const req = tx.objectStore(DB_STORE).get(id);
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => { db.close(); reject(req.error); };
      });
    },

    // Restore from a snapshot
    async restore(id) {
      const snapshot = await backup.get(id);
      if (!snapshot) throw new Error('Backup not found');
      data.importAll(snapshot.data);
      cache.invalidateAll();
      return snapshot;
    },

    // Delete a specific snapshot
    async remove(id) {
      const db = await openBackupDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).delete(id);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    },

    // Remove backups older than maxDays for an account
    async cleanup(accountName, maxDays = 30) {
      const all = await backup.list(accountName);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - maxDays);
      const old = all.filter(s => new Date(s.date) < cutoff);
      for (const s of old) {
        await backup.remove(s.id);
      }
      return old.length;
    },

    // Delete ALL snapshots for an account
    async deleteAccount(accountName) {
      const all = await backup.list(accountName);
      for (const s of all) {
        await backup.remove(s.id);
      }
      return all.length;
    },

    // Get the active account name
    getActiveAccount() {
      return raw.get('backup_account', '');
    },

    // Set the active account name
    setActiveAccount(name) {
      raw.set('backup_account', name);
    },

    // Get the stored directory handle (if File System Access API was used)
    async getDirectoryHandle() {
      try {
        const db = await openBackupDB();
        // Store handle separately in a simple key-value pattern
        return new Promise((resolve) => {
          const tx = db.transaction(DB_STORE, 'readonly');
          const req = tx.objectStore(DB_STORE).get('__dir_handle__');
          req.onsuccess = () => { db.close(); resolve(req.result?.handle || null); };
          req.onerror = () => { db.close(); resolve(null); };
        });
      } catch { return null; }
    },

    // Store directory handle
    async setDirectoryHandle(handle) {
      const db = await openBackupDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put({ id: '__dir_handle__', handle });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    }
  };

  return { raw, config, data, cache, queue, profile, ui, backup };
})();
