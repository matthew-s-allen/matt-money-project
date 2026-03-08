/* ============================================================
   APP CORE — Routing, init, global state, events
   ============================================================ */

const App = (() => {
  const VERSION = 'v2026.03.08';

  // ── State ─────────────────────────────────────────────────
  const state = {
    activeView: 'dashboard',
    activeMonth: Fmt.currentMonthKey(),
    isOnline: navigator.onLine,
    isLoading: false,
    theme: 'claude' // 'claude' or 'dark'
  };

  // ── HTML escaping for user data in innerHTML ─────────────
  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g, '&#39;');
  }

  // ── Category definitions ──────────────────────────────────
  const CATEGORIES = [
    { id: 'food',          emoji: '🛒', label: 'Food',          color: '#f97316' },
    { id: 'transport',     emoji: '🚗', label: 'Transport',     color: '#00a8e8' },
    { id: 'housing',       emoji: '🏠', label: 'Housing',       color: '#a855f7' },
    { id: 'health',        emoji: '❤️', label: 'Health',        color: '#e8002d' },
    { id: 'education',     emoji: '📚', label: 'Education',     color: '#ffd600' },
    { id: 'subscriptions', emoji: '📱', label: 'Subs',          color: '#39d353' },
    { id: 'clothing',      emoji: '👕', label: 'Clothing',      color: '#ec4899' },
    { id: 'entertainment', emoji: '🎬', label: 'Fun',           color: '#8b5cf6' },
    { id: 'debt',          emoji: '💳', label: 'Debt',          color: '#ef4444' },
    { id: 'savings',       emoji: '🏦', label: 'Savings',       color: '#39d353' },
    { id: 'restaurant',    emoji: '🍽️', label: 'Dining',        color: '#f59e0b' },
    { id: 'other',         emoji: '📦', label: 'Other',         color: '#6b7280' }
  ];

  function getCat(id) {
    return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
  }

  // ── Theme ─────────────────────────────────────────────────
  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    Store.ui.set({ theme });
  }

  function toggleTheme() {
    setTheme(state.theme === 'dark' ? 'claude' : 'dark');
  }

  // ── Navigation ─────────────────────────────────────────────
  function navigate(view) {
    const isSameView = state.activeView === view;
    state.activeView = view;

    if (!isSameView) {
      Store.ui.set({ activeView: view });

      // Hide all views
      document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
      // Show target
      const target = document.getElementById(`view-${view}`);
      if (target) target.classList.remove('hidden');

      // Update nav items
      document.querySelectorAll('.nav-item, .nav-fab').forEach(el => {
        el.classList.toggle('active', el.dataset.view === view);
      });

      // Update header month display
      const monthDisplay = document.getElementById('header-month-display');
      if (monthDisplay) monthDisplay.textContent = Fmt.monthYearFull(state.activeMonth + '-01');
    }

    // Always render the view (allows refresh on same view)
    renderView(view);
  }

  function renderView(view) {
    const views = {
      dashboard: Dashboard,
      add: AddTransaction,
      transactions: Transactions,
      accounts: Accounts,
      simulator: Simulator,
      patrimonio: Patrimonio
    };
    if (views[view] && views[view].render) {
      views[view].render();
    }
  }

  // ── Toast notifications ───────────────────────────────────
  function toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="toast-msg">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    container.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  // ── Month navigation ──────────────────────────────────────
  function setMonth(key) {
    state.activeMonth = key;
    Store.ui.set({ activeMonth: key });
    Store.cache.invalidateAll();

    const monthDisplay = document.getElementById('header-month-display');
    if (monthDisplay) monthDisplay.textContent = Fmt.monthYearFull(key + '-01');

    renderView(state.activeView);
  }

  function prevMonth() {
    const [y, m] = state.activeMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setMonth(Fmt.monthKey(d));
  }

  function nextMonth() {
    const [y, m] = state.activeMonth.split('-').map(Number);
    const now = new Date();
    if (y === now.getFullYear() && m === now.getMonth() + 1) return;
    const d = new Date(y, m, 1);
    setMonth(Fmt.monthKey(d));
  }

  // ── Settings ──────────────────────────────────────────────
  function openSettings() {
    const cfg     = Store.config.get();
    const profile = Store.profile.get();

    document.getElementById('settings-gemini-key').value  = cfg.geminiKey || '';
    document.getElementById('settings-name').value        = profile.name || '';
    document.getElementById('settings-salary').value      = profile.salary || '';
    document.getElementById('settings-fgts').value        = profile.fgts || '';
    document.getElementById('settings-car-value').value   = profile.carValue || '';
    document.getElementById('settings-theme').value       = state.theme;

    document.getElementById('app-version').textContent = `Matt Money ${VERSION}`;
    document.getElementById('settings-modal').classList.remove('hidden');
  }

  function closeSettings() {
    document.getElementById('settings-modal').classList.add('hidden');
  }

  function saveSettings() {
    const geminiKey = document.getElementById('settings-gemini-key').value.trim();
    const theme = document.getElementById('settings-theme').value;

    Store.config.set({ geminiKey: geminiKey || '' });

    Store.profile.set({
      name:      document.getElementById('settings-name').value.trim() || 'Matthew',
      salary:    Number(document.getElementById('settings-salary').value) || 7500,
      fgts:      Number(document.getElementById('settings-fgts').value) || 68000,
      carValue:  Number(document.getElementById('settings-car-value').value) || 50000
    });

    setTheme(theme);
    Store.cache.invalidateAll();
    closeSettings();
    toast('Settings saved', 'success');
    setTimeout(() => renderView(state.activeView), 300);
  }

  // ── Transaction lookup by ID ─────────────────────────────
  function getTxById(id) {
    return Store.data.getTransactions().find(t => t.id === id);
  }

  // ── Transaction detail modal ──────────────────────────────
  function openTxDetail(txOrId) {
    const tx = typeof txOrId === 'string' ? getTxById(txOrId) : txOrId;
    if (!tx) return;
    const modal = document.getElementById('tx-detail-modal');
    const content = document.getElementById('tx-detail-content');
    const cat = getCat(tx.category);

    // Get account/card name
    let paymentSource = '';
    if (tx.accountId) {
      const accounts = Store.data.getAccounts();
      const cards = Store.data.getCreditCards();
      const acct = accounts.find(a => a.id === tx.accountId);
      const card = cards.find(c => c.id === tx.accountId);
      if (acct) paymentSource = acct.name;
      else if (card) paymentSource = card.name;
    }

    content.innerHTML = `
      <div class="modal-handle"></div>
      <div style="display:flex;align-items:center;gap:var(--space-md);margin-bottom:var(--space-lg)">
        <div class="tx-icon" style="width:52px;height:52px;font-size:24px">${cat.emoji}</div>
        <div>
          <div style="font-size:20px;font-weight:700">${esc(tx.description || tx.merchant)}</div>
          <div style="font-size:12px;color:var(--text-muted)">${Fmt.dateShort(tx.date)} · ${esc(cat.label)}</div>
        </div>
      </div>

      <div class="hero-card" style="margin-bottom:var(--space-lg);text-align:center">
        <div class="hero-label">Amount</div>
        <div class="hero-value" style="color:${tx.type==='income'?'var(--green)':'var(--red)'}">${Fmt.currency(tx.amount)}</div>
      </div>

      ${paymentSource ? `<div class="tx-item"><div class="tx-info"><div class="tx-meta">Payment source</div><div class="tx-name">${esc(paymentSource)}</div></div></div>` : ''}
      ${tx.merchant ? `<div class="tx-item"><div class="tx-info"><div class="tx-meta">Merchant</div><div class="tx-name">${esc(tx.merchant)}</div></div></div>` : ''}
      ${tx.notes ? `<div class="tx-item"><div class="tx-info"><div class="tx-meta">Notes</div><div class="tx-name">${esc(tx.notes)}</div></div></div>` : ''}
      ${tx.items && tx.items.length ? `
        <div style="margin-top:var(--space-md)">
          <div class="t-label" style="margin-bottom:var(--space-sm)">Items</div>
          ${tx.items.map(i => `<div class="tx-item"><div class="tx-info"><div class="tx-name">${esc(i.name)}</div><div class="tx-meta">Qty: ${i.qty}</div></div><div class="tx-amount expense">${Fmt.currency(i.price)}</div></div>`).join('')}
        </div>
      ` : ''}

      <div style="display:flex;gap:var(--space-md);margin-top:var(--space-xl)">
        <button class="btn btn-secondary" style="flex:1" onclick="document.getElementById('tx-detail-modal').classList.add('hidden')">Close</button>
        <button class="btn btn-primary" style="flex:1" onclick="App.openEditTx('${esc(tx.id)}')">Edit</button>
        <button class="btn" style="flex:0;background:var(--red-glow);color:var(--red);border:1px solid var(--border-accent)" onclick="App.confirmDeleteTx('${esc(tx.id)}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
    `;

    modal.classList.remove('hidden');
  }

  function openEditTx(txOrId) {
    const tx = typeof txOrId === 'string' ? getTxById(txOrId) : txOrId;
    if (!tx) return;
    const content = document.getElementById('tx-detail-content');

    // Build account/card options
    const accounts = Store.data.getAccounts();
    const cards = Store.data.getCreditCards();
    const allSources = [
      { id: '', label: 'No account linked' },
      ...accounts.map(a => ({ id: a.id, label: `🏦 ${esc(a.name)}` })),
      ...cards.map(c => ({ id: c.id, label: `💳 ${esc(c.name)}` }))
    ];

    content.innerHTML = `
      <div class="modal-handle"></div>
      <h2 class="modal-title">Edit Transaction</h2>

      <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-md)">
        <button id="edit-btn-expense" class="type-toggle-btn ${tx.type!=='income'?'active-expense':''}" onclick="document.getElementById('edit-btn-expense').className='type-toggle-btn active-expense';document.getElementById('edit-btn-income').className='type-toggle-btn';">Expense</button>
        <button id="edit-btn-income" class="type-toggle-btn ${tx.type==='income'?'active-income':''}" onclick="document.getElementById('edit-btn-income').className='type-toggle-btn active-income';document.getElementById('edit-btn-expense').className='type-toggle-btn';">Income</button>
      </div>

      <div class="form-group">
        <label class="form-label">Amount (R$)</label>
        <input type="number" id="edit-amount" class="form-input" value="${tx.amount}" min="0" step="0.01" inputmode="decimal" />
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <input type="text" id="edit-description" class="form-input" value="${esc(tx.description || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">Merchant</label>
        <input type="text" id="edit-merchant" class="form-input" value="${esc(tx.merchant || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">Date</label>
        <input type="date" id="edit-date" class="form-input" value="${tx.date || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Account / Card</label>
        <select id="edit-account" class="form-input">
          ${allSources.map(s => `<option value="${esc(s.id)}" ${s.id === (tx.accountId || '') ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea id="edit-notes" class="form-textarea">${esc(tx.notes || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <div class="cat-grid">
          ${CATEGORIES.map(cat => `
            <button class="cat-btn ${cat.id === tx.category ? 'selected' : ''}"
              data-cat="${cat.id}"
              onclick="document.querySelectorAll('#tx-detail-content .cat-btn').forEach(b=>b.classList.remove('selected'));this.classList.add('selected')">
              <span class="cat-emoji">${cat.emoji}</span>${cat.label}
            </button>
          `).join('')}
        </div>
      </div>

      <div style="display:flex;gap:var(--space-md);margin-top:var(--space-xl)">
        <button class="btn btn-secondary" style="flex:1" onclick="App.openTxDetail('${esc(tx.id)}')">Back</button>
        <button class="btn btn-primary" style="flex:1" id="edit-save-btn" onclick="App.saveEditTx('${esc(tx.id)}')">Save</button>
      </div>
    `;
  }

  async function saveEditTx(id) {
    const amount      = parseFloat(document.getElementById('edit-amount').value);
    const description = document.getElementById('edit-description').value.trim();
    const merchant    = document.getElementById('edit-merchant').value.trim();
    const date        = document.getElementById('edit-date').value;
    const notes       = document.getElementById('edit-notes').value.trim();
    const accountId   = document.getElementById('edit-account').value || undefined;
    const selectedCat = document.querySelector('#tx-detail-content .cat-btn.selected');
    const category    = selectedCat ? selectedCat.dataset.cat : 'other';
    const type        = document.getElementById('edit-btn-income').className.includes('active-income') ? 'income' : 'expense';

    if (!amount || amount <= 0) { toast('Please enter an amount', 'error'); return; }

    const btn = document.getElementById('edit-save-btn');
    btn.disabled = true; btn.textContent = 'Saving...';

    try {
      await API.updateTransaction(id, { type, amount, description: description || merchant, merchant, category, date, notes, accountId });
      document.getElementById('tx-detail-modal').classList.add('hidden');
      toast('Transaction updated', 'success');
      renderView(state.activeView);
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Save';
      toast(e.message, 'error');
    }
  }

  async function confirmDeleteTx(id) {
    if (!confirm('Delete this transaction?')) return;
    try {
      await API.deleteTransaction(id);
      document.getElementById('tx-detail-modal').classList.add('hidden');
      toast('Transaction deleted', 'success');
      renderView(state.activeView);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ── Online / Offline handling ─────────────────────────────
  function handleOnline() {
    state.isOnline = true;
    toast('Back online!', 'success', 2000);
  }

  function handleOffline() {
    state.isOnline = false;
    toast('You\'re offline. Changes are saved locally.', 'info', 5000);
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    // Restore state
    const savedState  = Store.ui.get();
    state.activeMonth = savedState.activeMonth || Fmt.currentMonthKey();
    state.theme = savedState.theme || 'claude';

    // Apply theme
    setTheme(state.theme);

    // Check if setup needed
    if (!Store.data.isSetupDone()) {
      showSetupWizard();
      return;
    }

    showApp();
  }

  function showSetupWizard() {
    document.getElementById('setup-wizard').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
    SetupWizard.init();
  }

  function showApp() {
    document.getElementById('setup-wizard').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');

    // Update header month
    const monthDisplay = document.getElementById('header-month-display');
    if (monthDisplay) monthDisplay.textContent = Fmt.monthYearFull(state.activeMonth + '-01');

    // Nav events
    document.querySelectorAll('[data-view]').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.view));
    });

    // Settings events
    document.getElementById('settings-btn').addEventListener('click', openSettings);
    document.getElementById('settings-cancel-btn').addEventListener('click', closeSettings);
    document.getElementById('settings-save-btn').addEventListener('click', saveSettings);
    document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);

    // Re-run setup
    document.getElementById('settings-rerun-setup').addEventListener('click', () => {
      closeSettings();
      showSetupWizard();
    });

    // Export / Import
    document.getElementById('settings-export-btn').addEventListener('click', () => {
      try { API.exportData(); toast('Backup downloaded', 'success'); }
      catch(e) { toast('Export failed: ' + e.message, 'error'); }
    });
    document.getElementById('settings-import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm('This will overwrite all existing data. Are you sure you want to import this backup?')) {
        e.target.value = '';
        return;
      }
      try {
        await API.importData(file);
        toast('Data imported successfully', 'success');
        closeSettings();
        renderView(state.activeView);
      } catch(err) {
        toast('Import failed: ' + err.message, 'error');
      }
      e.target.value = '';
    });

    // Modal close on overlay click
    document.getElementById('settings-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeSettings();
    });
    document.getElementById('tx-detail-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
    });

    // PWA install prompt
    let deferredInstallPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      document.getElementById('pwa-install-section').style.display = 'block';
    });
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      document.getElementById('pwa-install-section').style.display = 'none';
      document.getElementById('pwa-installed-msg').style.display = 'block';
    });
    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') deferredInstallPrompt = null;
    });

    // Online/offline
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Service worker update
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        toast('App updated! Refresh for the latest version.', 'info', 8000);
      });
    }

    // Navigate to saved or default view
    const savedView = Store.ui.get().activeView || 'dashboard';
    navigate(savedView);

    // Flush any queued offline items
    if (navigator.onLine) API.flushQueue().catch(() => {});
  }

  return {
    init,
    state,
    navigate,
    toast,
    esc,
    setMonth,
    prevMonth,
    nextMonth,
    openTxDetail,
    openEditTx,
    saveEditTx,
    confirmDeleteTx,
    openSettings,
    showApp,
    showSetupWizard,
    setTheme,
    toggleTheme,
    CATEGORIES,
    getCat,
    VERSION
  };
})();

/* ============================================================
   SETUP WIZARD — First-time onboarding
   ============================================================ */

const SetupWizard = (() => {
  let currentStep = 1;
  let accounts = [];
  let cards = [];

  function init() {
    currentStep = 1;

    // Pre-populate with existing data if re-running
    accounts = Store.data.getAccounts();
    cards = Store.data.getCreditCards();

    if (accounts.length === 0) {
      accounts.push({ name: '', bank: '', type: 'checking', balance: 0 });
    }
    if (cards.length === 0) {
      cards.push({ name: '', brand: '', limit: 0, currentBalance: 0 });
    }

    // Pre-fill profile
    const profile = Store.profile.get();
    document.getElementById('setup-name').value = profile.name || '';
    document.getElementById('setup-salary').value = profile.salary || '';

    renderAccounts();
    renderCards();
    showStep(1);
  }

  function showStep(step) {
    currentStep = step;
    for (let i = 1; i <= 3; i++) {
      document.getElementById(`setup-step-${i}`).classList.toggle('hidden', i !== step);
      const dot = document.querySelector(`.setup-step-dot[data-step="${i}"]`);
      if (dot) {
        dot.classList.toggle('active', i <= step);
        dot.classList.toggle('done', i < step);
      }
    }
  }

  function next(fromStep) {
    if (fromStep === 1) {
      const name = document.getElementById('setup-name').value.trim();
      const salary = Number(document.getElementById('setup-salary').value) || 0;
      Store.profile.set({ name: name || 'Matthew', salary: salary || 7500 });
    }
    if (fromStep === 2) {
      saveAccountsFromDOM();
    }
    showStep(fromStep + 1);
  }

  function back(fromStep) {
    if (fromStep === 3) saveCardsFromDOM();
    if (fromStep === 2) saveAccountsFromDOM();
    showStep(fromStep - 1);
  }

  // ── Accounts management ────────────────────────────────────
  function renderAccounts() {
    const el = document.getElementById('setup-accounts-list');
    el.innerHTML = accounts.map((a, i) => `
      <div class="setup-account-row" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-sm)">
        <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm)">
          <input type="text" class="form-input setup-acct-name" value="${a.name || ''}" placeholder="Account name" style="flex:1" />
          <select class="form-input setup-acct-type" style="width:auto">
            <option value="checking" ${a.type === 'checking' ? 'selected' : ''}>Checking</option>
            <option value="savings" ${a.type === 'savings' ? 'selected' : ''}>Savings</option>
            <option value="investment" ${a.type === 'investment' ? 'selected' : ''}>Investment</option>
          </select>
        </div>
        <div style="display:flex;gap:var(--space-sm);align-items:center">
          <input type="text" class="form-input setup-acct-bank" value="${a.bank || ''}" placeholder="Bank name" style="flex:1" />
          <div style="position:relative;flex:1">
            <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px">R$</span>
            <input type="number" class="form-input setup-acct-balance" value="${a.balance || ''}" placeholder="0.00" step="0.01" inputmode="decimal" style="padding-left:32px" />
          </div>
          ${accounts.length > 1 ? `<button class="btn btn-ghost btn-sm" onclick="SetupWizard.removeAccount(${i})" style="color:var(--red);padding:8px">✕</button>` : ''}
        </div>
      </div>
    `).join('');
  }

  function addAccount() {
    saveAccountsFromDOM();
    accounts.push({ name: '', bank: '', type: 'checking', balance: 0 });
    renderAccounts();
  }

  function removeAccount(idx) {
    saveAccountsFromDOM();
    accounts.splice(idx, 1);
    renderAccounts();
  }

  function saveAccountsFromDOM() {
    const rows = document.querySelectorAll('.setup-account-row');
    accounts = Array.from(rows).map((row, i) => ({
      ...(accounts[i]?.id ? { id: accounts[i].id } : {}),
      name: row.querySelector('.setup-acct-name').value.trim(),
      bank: row.querySelector('.setup-acct-bank').value.trim(),
      type: row.querySelector('.setup-acct-type').value,
      balance: parseFloat(row.querySelector('.setup-acct-balance').value) || 0
    }));
  }

  // ── Cards management ──────────────────────────────────────
  function renderCards() {
    const el = document.getElementById('setup-cards-list');
    el.innerHTML = cards.map((c, i) => `
      <div class="setup-card-row" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-sm)">
        <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm)">
          <input type="text" class="form-input setup-card-name" value="${c.name || ''}" placeholder="Card name (e.g. Nubank)" style="flex:1" />
          <input type="text" class="form-input setup-card-brand" value="${c.brand || ''}" placeholder="Brand" style="width:100px" />
        </div>
        <div style="display:flex;gap:var(--space-sm);align-items:center">
          <div style="position:relative;flex:1">
            <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:11px">Limit</span>
            <input type="number" class="form-input setup-card-limit" value="${c.limit || ''}" placeholder="5000" inputmode="decimal" style="padding-left:42px" />
          </div>
          <div style="position:relative;flex:1">
            <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:11px">Bill</span>
            <input type="number" class="form-input setup-card-balance" value="${c.currentBalance || ''}" placeholder="0.00" step="0.01" inputmode="decimal" style="padding-left:30px" />
          </div>
          ${cards.length > 1 ? `<button class="btn btn-ghost btn-sm" onclick="SetupWizard.removeCard(${i})" style="color:var(--red);padding:8px">✕</button>` : ''}
        </div>
      </div>
    `).join('');
  }

  function addCard() {
    saveCardsFromDOM();
    cards.push({ name: '', brand: '', limit: 0, currentBalance: 0 });
    renderCards();
  }

  function removeCard(idx) {
    saveCardsFromDOM();
    cards.splice(idx, 1);
    renderCards();
  }

  function saveCardsFromDOM() {
    const rows = document.querySelectorAll('.setup-card-row');
    cards = Array.from(rows).map((row, i) => ({
      ...(cards[i]?.id ? { id: cards[i].id } : {}),
      name: row.querySelector('.setup-card-name').value.trim(),
      brand: row.querySelector('.setup-card-brand').value.trim(),
      limit: parseFloat(row.querySelector('.setup-card-limit').value) || 0,
      currentBalance: parseFloat(row.querySelector('.setup-card-balance').value) || 0
    }));
  }

  // ── Finish ─────────────────────────────────────────────────
  async function finish() {
    saveCardsFromDOM();

    // Save valid accounts
    const validAccounts = accounts.filter(a => a.name);
    for (const a of validAccounts) {
      await API.upsertAccount(a);
    }

    // Save valid cards and calculate total debt
    const validCards = cards.filter(c => c.name);
    let totalDebt = 0;
    for (const c of validCards) {
      await API.upsertCreditCard(c);
      totalDebt += c.currentBalance || 0;
    }

    // Update profile debt total from cards
    if (totalDebt > 0) {
      Store.profile.set({ debtTotal: totalDebt });
    }

    Store.data.setSetupDone(true);
    App.showApp();
    App.toast('Setup complete! Start tracking your finances.', 'success');
  }

  return { init, next, back, addAccount, removeAccount, addCard, removeCard, finish };
})();

// ── Start ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', App.init);
