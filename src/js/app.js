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
    isLoading: false
  };

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

  // ── Navigation ─────────────────────────────────────────────
  function navigate(view) {
    if (state.activeView === view) return;
    state.activeView = view;
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

    // Render the view
    renderView(view);
  }

  function renderView(view) {
    const views = { dashboard: Dashboard, add: AddTransaction, transactions: Transactions, simulator: Simulator, patrimonio: Patrimonio };
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
    if (y === now.getFullYear() && m === now.getMonth() + 1) return; // don't go future
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
    document.getElementById('settings-debt-total').value  = profile.debtTotal || '';

    document.getElementById('app-version').textContent = `Matt Money ${VERSION}`;
    document.getElementById('settings-modal').classList.remove('hidden');
  }

  function closeSettings() {
    document.getElementById('settings-modal').classList.add('hidden');
  }

  function saveSettings() {
    const geminiKey = document.getElementById('settings-gemini-key').value.trim();

    if (geminiKey) Store.config.set({ geminiKey });

    Store.profile.set({
      name:      document.getElementById('settings-name').value.trim() || 'Matthew',
      salary:    Number(document.getElementById('settings-salary').value) || 7500,
      fgts:      Number(document.getElementById('settings-fgts').value) || 68000,
      carValue:  Number(document.getElementById('settings-car-value').value) || 50000,
      debtTotal: Number(document.getElementById('settings-debt-total').value) || 14000
    });

    Store.cache.invalidateAll();
    closeSettings();
    toast('Settings saved', 'success');
    setTimeout(() => renderView(state.activeView), 300);
  }

  // ── Transaction detail modal ──────────────────────────────
  function openTxDetail(tx) {
    const modal = document.getElementById('tx-detail-modal');
    const content = document.getElementById('tx-detail-content');
    const cat = getCat(tx.category);

    content.innerHTML = `
      <div class="modal-handle"></div>
      <div style="display:flex;align-items:center;gap:var(--space-md);margin-bottom:var(--space-lg)">
        <div class="tx-icon" style="width:52px;height:52px;font-size:24px">${cat.emoji}</div>
        <div>
          <div style="font-family:var(--font-display);font-size:20px;font-weight:700">${tx.description || tx.merchant}</div>
          <div style="font-size:12px;color:var(--text-muted)">${Fmt.dateShort(tx.date)} · ${cat.label}</div>
        </div>
      </div>

      <div class="hero-card" style="margin-bottom:var(--space-lg);text-align:center">
        <div class="hero-label">Amount</div>
        <div class="hero-value" style="color:${tx.type==='income'?'var(--green)':'var(--red)'}">${Fmt.currency(tx.amount)}</div>
      </div>

      ${tx.merchant ? `<div class="tx-item"><div class="tx-info"><div class="tx-meta">Merchant</div><div class="tx-name">${tx.merchant}</div></div></div>` : ''}
      ${tx.notes ? `<div class="tx-item"><div class="tx-info"><div class="tx-meta">Notes</div><div class="tx-name">${tx.notes}</div></div></div>` : ''}
      ${tx.items && tx.items.length ? `
        <div style="margin-top:var(--space-md)">
          <div class="t-label" style="margin-bottom:var(--space-sm)">Items</div>
          ${tx.items.map(i => `<div class="tx-item"><div class="tx-info"><div class="tx-name">${i.name}</div><div class="tx-meta">Qty: ${i.qty}</div></div><div class="tx-amount expense">${Fmt.currency(i.price)}</div></div>`).join('')}
        </div>
      ` : ''}

      <div style="display:flex;gap:var(--space-md);margin-top:var(--space-xl)">
        <button class="btn btn-secondary" style="flex:1" onclick="document.getElementById('tx-detail-modal').classList.add('hidden')">Close</button>
        <button class="btn btn-primary" style="flex:1" onclick="App.openEditTx(${JSON.stringify(tx).replace(/"/g,'&quot;')})">Edit</button>
        <button class="btn" style="flex:0;background:var(--red-glow);color:var(--red);border:1px solid var(--border-accent)" onclick="App.confirmDeleteTx('${tx.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
    `;

    modal.classList.remove('hidden');
  }

  function openEditTx(tx) {
    const content = document.getElementById('tx-detail-content');
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
        <input type="text" id="edit-description" class="form-input" value="${tx.description || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Merchant</label>
        <input type="text" id="edit-merchant" class="form-input" value="${tx.merchant || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Date</label>
        <input type="date" id="edit-date" class="form-input" value="${tx.date || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea id="edit-notes" class="form-textarea">${tx.notes || ''}</textarea>
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
        <button class="btn btn-secondary" style="flex:1" onclick="App.openTxDetail(${JSON.stringify(tx).replace(/"/g,'&quot;')})">Back</button>
        <button class="btn btn-primary" style="flex:1" id="edit-save-btn" onclick="App.saveEditTx('${tx.id}')">Save</button>
      </div>
    `;
  }

  async function saveEditTx(id) {
    const amount      = parseFloat(document.getElementById('edit-amount').value);
    const description = document.getElementById('edit-description').value.trim();
    const merchant    = document.getElementById('edit-merchant').value.trim();
    const date        = document.getElementById('edit-date').value;
    const notes       = document.getElementById('edit-notes').value.trim();
    const selectedCat = document.querySelector('#tx-detail-content .cat-btn.selected');
    const category    = selectedCat ? selectedCat.dataset.cat : 'other';
    const type        = document.getElementById('edit-btn-income').className.includes('active-income') ? 'income' : 'expense';

    if (!amount || amount <= 0) { toast('Please enter an amount', 'error'); return; }

    const btn = document.getElementById('edit-save-btn');
    btn.disabled = true; btn.textContent = 'Saving...';

    try {
      await API.updateTransaction(id, { type, amount, description: description || merchant, merchant, category, date, notes });
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
    toast('Back online! Syncing...', 'success', 2000);
    API.flushQueue().then(() => renderView(state.activeView));
  }

  function handleOffline() {
    state.isOnline = false;
    toast('You\'re offline. Entries will sync when reconnected.', 'info', 5000);
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

    // Export / Import
    document.getElementById('settings-export-btn').addEventListener('click', () => {
      try { API.exportData(); toast('Backup downloaded', 'success'); }
      catch(e) { toast('Export failed: ' + e.message, 'error'); }
    });
    document.getElementById('settings-import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
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

    // Service worker update detection — toast when new version available
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        toast('App updated! Pull down to refresh for the latest version.', 'info', 8000);
      });
    }

    // Navigate to saved or default view
    navigate(savedState.activeView || 'dashboard');

    // Flush any queued offline items
    if (navigator.onLine) API.flushQueue().catch(() => {});
  }

  return {
    init,
    state,
    navigate,
    toast,
    setMonth,
    prevMonth,
    nextMonth,
    openTxDetail,
    openEditTx,
    saveEditTx,
    confirmDeleteTx,
    openSettings,
    CATEGORIES,
    getCat,
    VERSION
  };
})();

// ── Start ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', App.init);
