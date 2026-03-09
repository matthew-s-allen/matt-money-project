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
    { id: 'credit_cards',  emoji: '💳', label: 'Card Bills',    color: '#ef4444' },
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
    // Re-render active view so charts pick up new theme colors
    renderView(state.activeView);
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

    document.getElementById('settings-gemini-key').value       = cfg.geminiKey || '';
    document.getElementById('settings-name').value             = profile.name || '';
    document.getElementById('settings-employer').value         = profile.employerName || '';
    document.getElementById('settings-salary').value           = profile.salary || '';
    document.getElementById('settings-savings-goal').value     = profile.savingsGoal || '';
    document.getElementById('settings-target-years').value     = profile.targetYears || '';
    document.getElementById('settings-fgts').value             = profile.fgts || '';
    document.getElementById('settings-car-value').value        = profile.carValue || '';
    document.getElementById('settings-adiantamento').value     = profile.adiantamentoAmount || '';
    document.getElementById('settings-adiantamento-day').value = profile.adiantamentoDay || 15;
    document.getElementById('settings-salary-day').value       = profile.salaryDay || 30;
    document.getElementById('settings-work-start').value       = profile.workStartDate || '';
    document.getElementById('settings-vacation-days').value    = profile.vacationDaysTotal || 30;
    document.getElementById('settings-vacation-sell').value    = profile.vacationDaysToSell || 0;
    document.getElementById('settings-deduct-health').value    = profile.deductHealthPlan || '';
    document.getElementById('settings-deduct-dental').value    = profile.deductDental || '';
    document.getElementById('settings-deduct-vt').value        = profile.deductValeTransporte || '';
    document.getElementById('settings-deduct-other').value     = profile.deductOther || '';
    document.getElementById('settings-benefit-va').value       = profile.benefitVA || '';
    document.getElementById('settings-benefit-vr').value       = profile.benefitVR || '';
    document.getElementById('settings-benefit-other').value    = profile.benefitOther || '';
    document.getElementById('settings-theme').value            = state.theme;

    // Backup account
    const acctName = Store.backup.getActiveAccount();
    document.getElementById('settings-backup-account').value = acctName || '';
    updateLastSyncDisplay();

    // Folder support indicator
    const folderBtn = document.getElementById('settings-folder-btn');
    if (!('showDirectoryPicker' in window)) {
      folderBtn.disabled = true;
      folderBtn.title = 'Not supported on this browser';
    }

    // Share support
    const shareBtn = document.getElementById('settings-share-btn');
    if (!navigator.canShare) {
      shareBtn.disabled = true;
      shareBtn.title = 'Not supported on this browser';
    }

    document.getElementById('app-version').textContent = `Matt Money ${VERSION}`;
    document.getElementById('settings-modal').classList.remove('hidden');
  }

  async function updateLastSyncDisplay() {
    const el = document.getElementById('settings-last-sync');
    const acct = Store.backup.getActiveAccount();
    if (!acct) { el.textContent = ''; return; }
    try {
      const list = await Store.backup.list(acct);
      if (list.length > 0) {
        const last = list[0];
        el.textContent = `Last sync: ${Fmt.dateShort(last.date.slice(0,10))} at ${last.date.slice(11,16)} (${list.length} backups)`;
      } else {
        el.textContent = 'No backups yet — hit Sync Now';
      }
    } catch { el.textContent = ''; }
  }

  function closeSettings() {
    document.getElementById('settings-modal').classList.add('hidden');
  }

  function saveSettings() {
    const geminiKey = document.getElementById('settings-gemini-key').value.trim();
    const theme = document.getElementById('settings-theme').value;

    Store.config.set({ geminiKey: geminiKey || '' });

    Store.profile.set({
      name:                 document.getElementById('settings-name').value.trim() || 'Matthew',
      employerName:         document.getElementById('settings-employer').value.trim(),
      salary:               Number(document.getElementById('settings-salary').value) || 7500,
      savingsGoal:          Number(document.getElementById('settings-savings-goal').value) || 500000,
      targetYears:          Number(document.getElementById('settings-target-years').value) || 15,
      fgts:                 Number(document.getElementById('settings-fgts').value) || 68000,
      carValue:             Number(document.getElementById('settings-car-value').value) || 50000,
      adiantamentoAmount:   Number(document.getElementById('settings-adiantamento').value) || 0,
      adiantamentoDay:      Number(document.getElementById('settings-adiantamento-day').value) || 15,
      salaryDay:            Number(document.getElementById('settings-salary-day').value) || 30,
      workStartDate:        document.getElementById('settings-work-start').value || '',
      vacationDaysTotal:    Number(document.getElementById('settings-vacation-days').value) || 30,
      vacationDaysToSell:   Number(document.getElementById('settings-vacation-sell').value) || 0,
      deductHealthPlan:     Number(document.getElementById('settings-deduct-health').value) || 0,
      deductDental:         Number(document.getElementById('settings-deduct-dental').value) || 0,
      deductValeTransporte: Number(document.getElementById('settings-deduct-vt').value) || 0,
      deductOther:          Number(document.getElementById('settings-deduct-other').value) || 0,
      benefitVA:            Number(document.getElementById('settings-benefit-va').value) || 0,
      benefitVR:            Number(document.getElementById('settings-benefit-vr').value) || 0,
      benefitOther:         Number(document.getElementById('settings-benefit-other').value) || 0
    });

    // Save backup account name
    const backupAcct = document.getElementById('settings-backup-account').value.trim();
    if (backupAcct) Store.backup.setActiveAccount(backupAcct);

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

  // ── Backup History ───────────────────────────────────────
  async function openBackupHistory() {
    const modal = document.getElementById('backup-history-modal');
    const content = document.getElementById('backup-history-content');
    content.innerHTML = '<div class="skeleton" style="height:100px"></div>';
    modal.classList.remove('hidden');

    try {
      const accounts = await Store.backup.getAccounts();
      if (accounts.length === 0) {
        content.innerHTML = '<div class="empty-state" style="padding:var(--space-xl) 0"><p>No backups yet. Use Sync Now to create your first backup.</p></div>';
        return;
      }

      let html = '';
      for (const acct of accounts) {
        const snapshots = await Store.backup.list(acct);
        html += `
          <div style="margin-bottom:var(--space-lg)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-sm)">
              <h3 style="font-size:14px;font-weight:600;margin:0">${esc(acct)}</h3>
              <span class="pill" style="font-size:11px">${snapshots.length} backup${snapshots.length !== 1 ? 's' : ''}</span>
            </div>
            ${snapshots.map(s => {
              const txCount = s.data?.transactions?.length || 0;
              const acctCount = s.data?.accounts?.length || 0;
              return `
                <div class="tx-item" style="margin-bottom:4px">
                  <div class="tx-info">
                    <div class="tx-name">${Fmt.dateShort(s.dateKey)}</div>
                    <div class="tx-meta">${s.date.slice(11,16)} · ${txCount} tx · ${acctCount} accounts</div>
                  </div>
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-ghost btn-sm" onclick="App.downloadBackup('${s.id}')" title="Download" style="padding:6px">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="App.restoreBackup('${s.id}')" title="Restore" style="padding:6px;color:var(--primary)">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="App.deleteBackup('${s.id}','${esc(acct)}')" title="Delete" style="padding:6px;color:var(--red)">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
      content.innerHTML = html;
    } catch(e) {
      content.innerHTML = `<p style="color:var(--red)">Error: ${esc(e.message)}</p>`;
    }
  }

  async function downloadBackup(id) {
    try {
      const snapshot = await Store.backup.get(id);
      if (snapshot) API.downloadSnapshot(snapshot);
    } catch(e) { toast(e.message, 'error'); }
  }

  async function restoreBackup(id) {
    if (!confirm('This will replace all current data with this backup. Continue?')) return;
    try {
      await Store.backup.restore(id);
      document.getElementById('backup-history-modal').classList.add('hidden');
      closeSettings();
      toast('Backup restored!', 'success');
      renderView(state.activeView);
    } catch(e) { toast('Restore failed: ' + e.message, 'error'); }
  }

  async function deleteBackup(id, acct) {
    if (!confirm('Delete this backup?')) return;
    try {
      await Store.backup.remove(id);
      toast('Backup deleted', 'success');
      openBackupHistory(); // refresh
    } catch(e) { toast(e.message, 'error'); }
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

    // ── Backup & Sync handlers ──────────────────────────────
    // Sync Now
    document.getElementById('settings-sync-btn').addEventListener('click', async () => {
      const acctInput = document.getElementById('settings-backup-account');
      const acct = acctInput.value.trim();
      if (!acct) { toast('Enter a backup account name first', 'error'); acctInput.focus(); return; }
      Store.backup.setActiveAccount(acct);
      const btn = document.getElementById('settings-sync-btn');
      btn.disabled = true; btn.textContent = 'Syncing...';
      try {
        const snapshot = await API.syncBackup(acct);
        toast('Backup saved!', 'success');
        updateLastSyncDisplay();
      } catch(e) { toast('Sync failed: ' + e.message, 'error'); }
      btn.disabled = false; btn.textContent = 'Sync Now';
    });

    // Download
    document.getElementById('settings-export-btn').addEventListener('click', () => {
      try { API.exportData(); toast('Backup downloaded', 'success'); }
      catch(e) { toast('Export failed: ' + e.message, 'error'); }
    });

    // Share
    document.getElementById('settings-share-btn').addEventListener('click', async () => {
      try {
        await API.shareBackup(null);
        toast('Backup shared!', 'success');
      } catch(e) { toast(e.message, 'error'); }
    });

    // Set Folder (File System Access API)
    document.getElementById('settings-folder-btn').addEventListener('click', async () => {
      try {
        const folderName = await API.selectBackupFolder();
        document.getElementById('settings-folder-name').textContent = `Folder: ${folderName}`;
        toast('Backup folder selected!', 'success');
      } catch(e) { toast(e.message, 'error'); }
    });

    // Import
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

    // Backup History
    document.getElementById('settings-backup-history-btn').addEventListener('click', openBackupHistory);

    // Start Fresh
    document.getElementById('settings-start-fresh-btn').addEventListener('click', () => {
      if (!confirm('This will erase ALL data and restart the app. Your backup history will be preserved. Continue?')) return;
      API.startFresh();
      closeSettings();
      showSetupWizard();
      toast('Data cleared. Set up your new account.', 'info');
    });

    // Modal close on overlay click
    document.getElementById('settings-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeSettings();
    });
    document.getElementById('tx-detail-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
    });
    document.getElementById('backup-history-modal').addEventListener('click', (e) => {
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
    downloadBackup,
    restoreBackup,
    deleteBackup,
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
  const TOTAL_STEPS = 7;
  let currentStep = 1;
  let accounts = [];
  let cards = [];
  let loans = [];
  let deductionsList = [];
  let benefitsList = [];
  let vacationPlans = [];
  let incomeChart = null;

  const STEP_LABELS = ['Profile', 'Salary', 'Patrimônio', 'Accounts', 'Cards', 'Loans', 'Budgets'];

  function init() {
    currentStep = 1;
    const profile = Store.profile.get();

    accounts = Store.data.getAccounts();
    cards = Store.data.getCreditCards();
    loans = Store.data.getLoans();

    deductionsList = profile.deductionsList && profile.deductionsList.length
      ? JSON.parse(JSON.stringify(profile.deductionsList))
      : [
          { id: 'health', name: 'Plano de Saude', type: 'fixed', amount: profile.deductHealthPlan || 0 },
          { id: 'dental', name: 'Dental', type: 'fixed', amount: profile.deductDental || 0 },
          { id: 'vt', name: 'Vale Transporte', type: 'fixed', amount: profile.deductValeTransporte || 0 }
        ];

    benefitsList = profile.benefitsList && profile.benefitsList.length
      ? JSON.parse(JSON.stringify(profile.benefitsList))
      : [
          { id: 'va', name: 'Vale Alimentacao', type: 'fixed', amount: profile.benefitVA || 0 },
          { id: 'vr', name: 'Vale Refeicao', type: 'fixed', amount: profile.benefitVR || 0 }
        ];

    vacationPlans = profile.vacationPlans ? JSON.parse(JSON.stringify(profile.vacationPlans)) : [];

    if (accounts.length === 0) accounts.push({ id: crypto.randomUUID(), name: '', bank: '', type: 'checking', balance: 0, isPrimary: true });
    if (cards.length === 0) cards.push({ id: crypto.randomUUID(), name: '', brand: '', lastFourDigits: '', limit: 0, availableCredit: 0, currentBalance: 0, closingDay: '', dueDay: '', lastFaturaMonth: '', interestRate: '', annualFee: 0, paymentAccountId: '' });

    document.getElementById('setup-name').value = profile.name || '';
    document.getElementById('setup-employer').value = profile.employerName || '';
    document.getElementById('setup-work-start').value = profile.workStartDate || '';
    setSalaryType(profile.salaryType || 'mensalista', true);
    if (profile.salaryType === 'horista') {
      const hrEl = document.getElementById('setup-hourly-rate');
      const hwEl = document.getElementById('setup-hours-week');
      if (hrEl) hrEl.value = profile.hourlyRate || '';
      if (hwEl) hwEl.value = profile.hoursPerWeek || 44;
    } else {
      const salEl = document.getElementById('setup-salary');
      if (salEl) salEl.value = profile.salary || '';
    }

    const vacDaysEl = document.getElementById('setup-vacation-days');
    const vacPerEl = document.getElementById('setup-vacation-periods');
    const m1El = document.getElementById('setup-13-month1');
    if (vacDaysEl) vacDaysEl.value = profile.vacationDaysTotal || 30;
    if (vacPerEl) vacPerEl.value = profile.vacationPeriods || 3;
    if (m1El) m1El.value = profile.decimo13Month1 || 11;
    setFrequency(profile.paymentFrequency || 'quinzenal', profile.paymentSchedule || null, true);

    const goalEl = document.getElementById('setup-savings-goal');
    const yearsEl = document.getElementById('setup-target-years');
    const fgtsEl = document.getElementById('setup-fgts');
    const carEl = document.getElementById('setup-car-value');
    const savEl = document.getElementById('setup-savings');
    const invEl = document.getElementById('setup-investments');
    if (goalEl) goalEl.value = profile.savingsGoal || '';
    if (yearsEl) yearsEl.value = profile.targetYears || '';
    if (fgtsEl) fgtsEl.value = profile.fgts || '';
    if (carEl) carEl.value = profile.carValue || '';
    const patrimonio = Store.data.getPatrimonio();
    if (savEl) savEl.value = patrimonio.savings || '';
    if (invEl) invEl.value = patrimonio.investments || '';

    const importEl = document.getElementById('setup-import-file');
    if (importEl && !importEl._handlerBound) {
      importEl._handlerBound = true;
      importEl.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          await API.importData(file);
          App.toast('Backup imported!', 'success');
          Store.data.setSetupDone(true);
          App.showApp();
        } catch(err) { App.toast('Import failed: ' + err.message, 'error'); }
        e.target.value = '';
      });
    }

    renderDeductions();
    renderBenefits();
    renderVacationPlans();
    renderAccounts();
    renderCards();
    renderLoans();
    renderSubscriptionsList();
    renderCategories();
    showStep(1);
  }

  function setSalaryType(type, silent) {
    document.querySelectorAll('#setup-salary-type-ctrl .seg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.val === type);
    });
    const mensEl = document.getElementById('setup-mensalista-fields');
    const horaEl = document.getElementById('setup-horista-fields');
    if (mensEl) mensEl.classList.toggle('hidden', type === 'horista');
    if (horaEl) horaEl.classList.toggle('hidden', type !== 'horista');
    if (!silent) onSalaryChange();
  }

  function onHourlyChange() {
    const rate = parseFloat(document.getElementById('setup-hourly-rate')?.value) || 0;
    const hrs = parseFloat(document.getElementById('setup-hours-week')?.value) || 44;
    const monthly = rate * hrs * 4.33333;
    const calcEl = document.getElementById('setup-horista-calc');
    if (calcEl) {
      if (rate > 0) {
        calcEl.style.display = 'block';
        calcEl.innerHTML = '<strong>Estimado/mes:</strong> ' + Fmt.currency(monthly);
      } else { calcEl.style.display = 'none'; }
    }
    const salEl = document.getElementById('setup-salary');
    if (salEl) salEl.value = monthly.toFixed(2);
    onSalaryChange();
  }

  function onSalaryChange() {
    updateSalaryPreview();
    buildIncomeChart();
    updatePaymentScheduleAmounts();
  }

  let paymentSchedule = [
    { label: 'Adiantamento', day: 15, percent: 40, isFixed: false, amount: 0 },
    { label: 'Salario', day: 30, percent: 60, isFixed: false, amount: 0 }
  ];

  function setFrequency(freq, existingSchedule, silent) {
    document.querySelectorAll('#setup-freq-ctrl .seg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.val === freq);
    });
    if (freq === 'monthly') {
      paymentSchedule = [{ label: 'Salario', day: 30, percent: 100, isFixed: false, amount: 0 }];
    } else if (freq === 'quinzenal') {
      paymentSchedule = existingSchedule && existingSchedule.length === 2 ? existingSchedule : [
        { label: 'Adiantamento', day: 15, percent: 40, isFixed: false, amount: 0 },
        { label: 'Salario', day: 30, percent: 60, isFixed: false, amount: 0 }
      ];
    } else {
      paymentSchedule = existingSchedule && existingSchedule.length > 0 ? existingSchedule : [
        { label: 'Pagamento 1', day: 15, percent: 50, isFixed: false, amount: 0 },
        { label: 'Pagamento 2', day: 30, percent: 50, isFixed: false, amount: 0 }
      ];
    }
    renderPaymentSchedule(freq);
    if (!silent) { updatePaymentScheduleAmounts(); buildIncomeChart(); }
  }

  function renderPaymentSchedule(freq) {
    const el = document.getElementById('setup-payment-schedule');
    if (!el) return;
    el.innerHTML = paymentSchedule.map((p, i) => {
      const isCustom = freq === 'custom';
      return '<div style="display:flex;gap:var(--space-sm);align-items:flex-start;margin-bottom:var(--space-sm);background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:10px var(--space-md)">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;gap:var(--space-sm);margin-bottom:6px">' +
            '<input type="text" class="form-input sched-label" value="' + App.esc(p.label) + '" placeholder="Nome" style="flex:1;font-size:13px" oninput="SetupWizard.savePaymentSchedule()" />' +
            '<div style="flex-shrink:0">' +
              '<div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:3px">DIA</div>' +
              '<input type="number" class="form-input sched-day" value="' + p.day + '" min="1" max="31" style="width:56px;font-size:13px;text-align:center" inputmode="numeric" oninput="SetupWizard.savePaymentSchedule()" />' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:4px;margin-bottom:6px">' +
            '<button class="seg-btn ' + (!p.isFixed ? 'active' : '') + '" style="flex:1;padding:4px 8px;font-size:11px" onclick="SetupWizard.toggleSchedFixed(' + i + ',false)">% do net</button>' +
            '<button class="seg-btn ' + (p.isFixed ? 'active' : '') + '" style="flex:1;padding:4px 8px;font-size:11px" onclick="SetupWizard.toggleSchedFixed(' + i + ',true)">R$ fixo</button>' +
          '</div>' +
          (p.isFixed
            ? '<input type="number" class="form-input sched-amount" value="' + (p.amount || '') + '" placeholder="0.00" inputmode="decimal" style="font-size:13px" oninput="SetupWizard.savePaymentSchedule()" />'
            : '<div style="display:flex;align-items:center;gap:6px">' +
                '<input type="number" class="form-input sched-percent" value="' + p.percent + '" min="1" max="100" style="width:60px;font-size:13px;text-align:center" inputmode="numeric" oninput="SetupWizard.savePaymentSchedule()" />' +
                '<span style="font-size:12px;color:var(--text-muted)">% net =</span>' +
                '<span id="sched-calc-' + i + '" style="font-size:13px;font-weight:600;color:var(--green)"></span>' +
              '</div>'
          ) +
        '</div>' +
        (isCustom && paymentSchedule.length > 1
          ? '<button onclick="SetupWizard.removePaymentRow(' + i + ')" style="color:var(--red);background:none;border:none;font-size:18px;cursor:pointer;padding:4px;flex-shrink:0;margin-top:20px">x</button>'
          : '') +
        '</div>';
    }).join('');
    if (freq === 'custom') {
      el.insertAdjacentHTML('beforeend', '<button class="btn btn-ghost btn-sm" onclick="SetupWizard.addPaymentRow()" style="width:100%;margin-top:4px">+ Adicionar pagamento</button>');
    }
    updatePaymentScheduleAmounts();
  }

  function savePaymentSchedule() {
    const labelEls = document.querySelectorAll('#setup-payment-schedule .sched-label');
    paymentSchedule = Array.from(labelEls).map((labelEl, i) => {
      const row = labelEl.closest('div[style]');
      return {
        label: labelEl.value || '',
        day: parseInt(row.querySelector('.sched-day')?.value) || 30,
        isFixed: paymentSchedule[i]?.isFixed || false,
        percent: parseFloat(row.querySelector('.sched-percent')?.value) || (paymentSchedule[i]?.percent || 50),
        amount: parseFloat(row.querySelector('.sched-amount')?.value) || 0
      };
    });
    updatePaymentScheduleAmounts();
    buildIncomeChart();
  }

  function toggleSchedFixed(idx, isFixed) {
    if (paymentSchedule[idx]) paymentSchedule[idx].isFixed = isFixed;
    const freq = document.querySelector('#setup-freq-ctrl .seg-btn.active')?.dataset.val || 'quinzenal';
    renderPaymentSchedule(freq);
  }

  function addPaymentRow() {
    savePaymentSchedule();
    paymentSchedule.push({ label: 'Pagamento ' + (paymentSchedule.length + 1), day: 15, percent: 0, isFixed: false, amount: 0 });
    renderPaymentSchedule('custom');
  }

  function removePaymentRow(idx) {
    savePaymentSchedule();
    if (paymentSchedule.length <= 1) return;
    paymentSchedule.splice(idx, 1);
    renderPaymentSchedule('custom');
  }

  function updatePaymentScheduleAmounts() {
    const gross = getCurrentGross();
    const b = gross ? API.calcSalaryBreakdown({ ...Store.profile.get(), salary: gross, ...buildLegacyDeductFields() }) : null;
    const net = b ? b.netSalary : 0;
    paymentSchedule.forEach((p, i) => {
      const el = document.getElementById('sched-calc-' + i);
      if (el) {
        const val = p.isFixed ? p.amount : (net * (p.percent / 100));
        el.textContent = Fmt.currency(val);
      }
    });
  }

  function updateSalaryPreview() {
    const preview = document.getElementById('setup-salary-preview');
    if (!preview) return;
    const gross = getCurrentGross();
    if (!gross) { preview.innerHTML = ''; return; }
    const b = API.calcSalaryBreakdown({ ...Store.profile.get(), salary: gross, ...buildLegacyDeductFields() });
    const rows = deductionsList.filter(d => d.amount > 0).map(d => {
      const amt = d.type === 'percent' ? gross * (d.amount / 100) : d.amount;
      return '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--red);margin-bottom:1px"><span>- ' + App.esc(d.name) + '</span><span>' + Fmt.currency(amt) + '</span></div>';
    }).join('');
    preview.innerHTML =
      '<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--text-secondary)">Holerite estimado</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:2px"><span style="color:var(--text-secondary)">Bruto</span><span>' + Fmt.currency(b.gross) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--red);margin-bottom:1px"><span>- INSS</span><span>' + Fmt.currency(b.inss) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--red);margin-bottom:1px"><span>- IRRF</span><span>' + Fmt.currency(b.irrf) + '</span></div>' +
      rows +
      '<div style="border-top:1px solid var(--border);margin:6px 0;padding-top:6px;display:flex;justify-content:space-between;font-size:14px;font-weight:700"><span>Liquido</span><span style="color:var(--green)">' + Fmt.currency(b.netSalary) + '</span></div>' +
      (b.totalBenefits > 0
        ? '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--blue)"><span>+ Beneficios</span><span>+' + Fmt.currency(b.totalBenefits) + '</span></div>' +
          '<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-top:4px"><span>Total take-home</span><span style="color:var(--green)">' + Fmt.currency(b.totalTakeHome) + '</span></div>'
        : '') +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:6px;border-top:1px solid var(--border);padding-top:6px">FGTS: ' + Fmt.currency(b.fgtsMonthly) + '/mes | 13 deg liquido: ' + Fmt.currency(b.decimoTerceiroNet) + ' | Ferias+1/3: ' + Fmt.currency(b.vacationBonus) + '</div>';
  }

  function getCurrentGross() {
    const typeBtn = document.querySelector('#setup-salary-type-ctrl .seg-btn.active');
    if (typeBtn?.dataset.val === 'horista') {
      const rate = parseFloat(document.getElementById('setup-hourly-rate')?.value) || 0;
      const hrs = parseFloat(document.getElementById('setup-hours-week')?.value) || 44;
      return rate * hrs * 4.33333;
    }
    return parseFloat(document.getElementById('setup-salary')?.value) || Store.profile.get().salary || 0;
  }

  function buildLegacyDeductFields() {
    let deductHealthPlan = 0, deductDental = 0, deductValeTransporte = 0, deductOther = 0;
    let benefitVA = 0, benefitVR = 0, benefitOther = 0;
    const gross = getCurrentGross();
    deductionsList.forEach(d => {
      const amt = d.type === 'percent' ? gross * (d.amount / 100) : (d.amount || 0);
      if (d.id === 'health') deductHealthPlan = amt;
      else if (d.id === 'dental') deductDental = amt;
      else if (d.id === 'vt') deductValeTransporte = amt;
      else deductOther += amt;
    });
    benefitsList.forEach(b => {
      const amt = b.amount || 0;
      if (b.id === 'va') benefitVA = amt;
      else if (b.id === 'vr') benefitVR = amt;
      else benefitOther += amt;
    });
    return { deductHealthPlan, deductDental, deductValeTransporte, deductOther, benefitVA, benefitVR, benefitOther };
  }

  function buildIncomeChart() {
    const canvas = document.getElementById('setup-income-chart');
    if (!canvas || !window.Chart) return;
    const gross = getCurrentGross();
    if (!gross) { if (incomeChart) { incomeChart.destroy(); incomeChart = null; } return; }
    const profile = Store.profile.get();
    const b = API.calcSalaryBreakdown({ ...profile, salary: gross, ...buildLegacyDeductFields() });
    const baseNet = b.netSalary + b.totalBenefits;
    const decimo13m1 = parseInt(document.getElementById('setup-13-month1')?.value) || 11;
    const now = new Date();
    const labels = [], baseData = [], extraData = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const mo = d.getMonth() + 1;
      const moStr = d.getFullYear() + '-' + String(mo).padStart(2,'0');
      labels.push(Fmt.monthYear(moStr + '-01').split(' ')[0]);
      baseData.push(parseFloat(baseNet.toFixed(2)));
      let extra = 0;
      const vac = vacationPlans.find(v => v.month === moStr);
      if (vac) extra += b.vacationBonus;
      if (mo === decimo13m1) extra += gross / 2;
      if (mo === 12) extra += b.decimoTerceiroNet / 2;
      extraData.push(parseFloat(extra.toFixed(2)));
    }
    if (incomeChart) incomeChart.destroy();
    incomeChart = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Salario liquido', data: baseData, backgroundColor: 'rgba(99,102,241,0.75)', borderRadius: 4, stack: 'a' },
          { label: 'Extras (13/Ferias)', data: extraData, backgroundColor: 'rgba(52,211,153,0.8)', borderRadius: 4, stack: 'a' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { font: { size: 11 }, color: '#9ca3af', boxWidth: 12, padding: 8 } } },
        scales: {
          x: { stacked: true, ticks: { font: { size: 10 }, color: '#9ca3af' }, grid: { display: false } },
          y: { stacked: true, ticks: { font: { size: 10 }, color: '#9ca3af', callback: v => 'R$' + (v/1000).toFixed(0) + 'k' }, grid: { color: 'rgba(128,128,128,0.1)' } }
        }
      }
    });
  }

  function renderDeductions() {
    const el = document.getElementById('setup-deductions-list');
    if (!el) return;
    el.innerHTML = deductionsList.map((d, i) =>
      '<div style="display:flex;gap:var(--space-sm);align-items:center;margin-bottom:8px">' +
        '<input type="text" class="form-input" value="' + App.esc(d.name) + '" placeholder="Desconto" style="flex:1;min-width:0;font-size:13px" oninput="SetupWizard.saveDeduction(' + i + ',\'name\',this.value)" />' +
        '<div style="display:flex;gap:2px;flex-shrink:0">' +
          '<button class="seg-btn ' + (d.type==='fixed'?'active':'') + '" style="padding:5px 9px;font-size:11px" onclick="SetupWizard.saveDeduction(' + i + ',\'type\',\'fixed\')">R$</button>' +
          '<button class="seg-btn ' + (d.type==='percent'?'active':'') + '" style="padding:5px 9px;font-size:11px" onclick="SetupWizard.saveDeduction(' + i + ',\'type\',\'percent\')">%</button>' +
        '</div>' +
        '<div style="position:relative;width:90px;flex-shrink:0">' +
          (d.type==='percent'
            ? '<span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:11px;pointer-events:none">%</span><input type="number" class="form-input" value="' + (d.amount||'') + '" placeholder="0" style="font-size:13px;padding-right:24px" inputmode="decimal" oninput="SetupWizard.saveDeduction(' + i + ',\'amount\',this.value)" />'
            : '<span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:11px;pointer-events:none">R$</span><input type="number" class="form-input" value="' + (d.amount||'') + '" placeholder="0" style="font-size:13px;padding-left:24px" inputmode="decimal" oninput="SetupWizard.saveDeduction(' + i + ',\'amount\',this.value)" />'
          ) +
        '</div>' +
        '<button onclick="SetupWizard.removeDeduction(' + i + ')" style="color:var(--red);background:none;border:none;font-size:18px;cursor:pointer;flex-shrink:0;padding:2px 4px">x</button>' +
      '</div>'
    ).join('');
    updateSalaryPreview();
    buildIncomeChart();
  }

  function saveDeduction(idx, field, val) {
    if (!deductionsList[idx]) return;
    if (field === 'amount') val = parseFloat(val) || 0;
    deductionsList[idx][field] = val;
    if (field === 'type') renderDeductions(); else { updateSalaryPreview(); buildIncomeChart(); }
  }

  function addDeduction() {
    deductionsList.push({ id: 'custom_' + crypto.randomUUID(), name: '', type: 'fixed', amount: 0 });
    renderDeductions();
  }

  function removeDeduction(idx) {
    deductionsList.splice(idx, 1);
    renderDeductions();
  }

  function renderBenefits() {
    const el = document.getElementById('setup-benefits-list');
    if (!el) return;
    el.innerHTML = benefitsList.map((b, i) =>
      '<div style="display:flex;gap:var(--space-sm);align-items:center;margin-bottom:8px">' +
        '<input type="text" class="form-input" value="' + App.esc(b.name) + '" placeholder="Beneficio" style="flex:1;min-width:0;font-size:13px" oninput="SetupWizard.saveBenefit(' + i + ',\'name\',this.value)" />' +
        '<div style="position:relative;width:100px;flex-shrink:0">' +
          '<span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:11px;pointer-events:none">R$</span>' +
          '<input type="number" class="form-input" value="' + (b.amount||'') + '" placeholder="0" style="font-size:13px;padding-left:24px" inputmode="decimal" oninput="SetupWizard.saveBenefit(' + i + ',\'amount\',this.value)" />' +
        '</div>' +
        '<button onclick="SetupWizard.removeBenefit(' + i + ')" style="color:var(--red);background:none;border:none;font-size:18px;cursor:pointer;flex-shrink:0;padding:2px 4px">x</button>' +
      '</div>'
    ).join('');
    updateSalaryPreview();
  }

  function saveBenefit(idx, field, val) {
    if (!benefitsList[idx]) return;
    if (field === 'amount') val = parseFloat(val) || 0;
    benefitsList[idx][field] = val;
    updateSalaryPreview(); buildIncomeChart();
  }

  function addBenefit() {
    benefitsList.push({ id: 'custom_' + crypto.randomUUID(), name: '', type: 'fixed', amount: 0 });
    renderBenefits();
  }

  function removeBenefit(idx) {
    benefitsList.splice(idx, 1);
    renderBenefits();
  }

  function renderVacationPlans() {
    const el = document.getElementById('setup-vacation-plans-list');
    if (!el) return;
    const periods = parseInt(document.getElementById('setup-vacation-periods')?.value) || 3;
    el.innerHTML = vacationPlans.map((v, i) =>
      '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--space-sm) var(--space-md);margin-bottom:8px">' +
        '<div style="display:flex;gap:var(--space-sm);align-items:center;flex-wrap:wrap;margin-bottom:6px">' +
          '<select class="form-input" style="width:90px;flex-shrink:0;font-size:13px" onchange="SetupWizard.saveVacPlan(' + i + ',\'period\',this.value)">' +
            [1,2,3].filter(p => p <= periods).map(p => '<option value="' + p + '"' + (v.period==p?' selected':'') + '>Periodo ' + p + '</option>').join('') +
          '</select>' +
          '<input type="month" class="form-input" value="' + (v.month||'') + '" style="flex:1;min-width:110px;font-size:13px" onchange="SetupWizard.saveVacPlan(' + i + ',\'month\',this.value)" />' +
          '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0">' +
            '<input type="number" class="form-input" value="' + (v.daysToSell||0) + '" min="0" max="10" style="width:50px;font-size:13px;text-align:center" inputmode="numeric" onchange="SetupWizard.saveVacPlan(' + i + ',\'daysToSell\',this.value)" />' +
            '<span style="font-size:11px;color:var(--text-muted);white-space:nowrap">dias vender</span>' +
          '</div>' +
          '<button onclick="SetupWizard.removeVacPlan(' + i + ')" style="color:var(--red);background:none;border:none;font-size:18px;cursor:pointer;flex-shrink:0">x</button>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<input type="checkbox" id="vac-13-' + i + '" ' + (v.take13Advance?'checked':'') + ' style="width:15px;height:15px;accent-color:var(--primary);cursor:pointer" onchange="SetupWizard.saveVacPlan(' + i + ',\'take13Advance\',this.checked)" />' +
          '<label for="vac-13-' + i + '" style="font-size:12px;color:var(--text-secondary);cursor:pointer">Receber adiantamento do 13 junto com as ferias</label>' +
        '</div>' +
      '</div>'
    ).join('');
    buildIncomeChart();
  }

  function saveVacPlan(idx, field, val) {
    if (!vacationPlans[idx]) return;
    if (field === 'take13Advance') vacationPlans[idx][field] = val;
    else if (field === 'daysToSell') vacationPlans[idx][field] = parseInt(val) || 0;
    else if (field === 'period') vacationPlans[idx][field] = parseInt(val) || 1;
    else vacationPlans[idx][field] = val;
    buildIncomeChart();
  }

  function addVacationPlan() {
    const periods = parseInt(document.getElementById('setup-vacation-periods')?.value) || 3;
    const used = vacationPlans.map(v => v.period);
    const nextPeriod = [1,2,3].find(p => !used.includes(p) && p <= periods) || 1;
    vacationPlans.push({ period: nextPeriod, month: '', daysToSell: 0, take13Advance: false });
    renderVacationPlans();
  }

  function removeVacPlan(idx) {
    vacationPlans.splice(idx, 1);
    renderVacationPlans();
  }

  function updateGoalHint() {
    const hint = document.getElementById('setup-goal-hint');
    if (!hint) return;
    const goal = Number(document.getElementById('setup-savings-goal')?.value) || 0;
    const years = Number(document.getElementById('setup-target-years')?.value) || 0;
    const gross = getCurrentGross();
    if (goal && years && gross) {
      const needed = goal / (years * 12);
      const pct = ((needed / gross) * 100).toFixed(0);
      hint.style.display = 'block';
      hint.textContent = 'Para chegar a ' + Fmt.currency(goal) + ' em ' + years + ' anos, voce precisa guardar ' + Fmt.currency(needed) + '/mes (' + pct + '% do bruto).';
    } else { hint.style.display = 'none'; }
  }

  function showStep(step) {
    currentStep = step;
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const el = document.getElementById('setup-step-' + i);
      if (el) el.classList.toggle('hidden', i !== step);
      const dot = document.querySelector('.setup-step-dot[data-step="' + i + '"]');
      if (dot) {
        dot.classList.toggle('active', i <= step);
        dot.classList.toggle('done', i < step);
      }
    }
    const labelEl = document.getElementById('setup-step-label');
    if (labelEl) labelEl.textContent = 'Step ' + step + ' of ' + TOTAL_STEPS + ' — ' + STEP_LABELS[step-1];
    const subtitle = document.getElementById('setup-intro-subtitle');
    const importSec = document.getElementById('setup-import-section');
    if (subtitle) subtitle.classList.toggle('hidden', step > 1);
    if (importSec) importSec.classList.toggle('hidden', step > 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (step === 2) { updateSalaryPreview(); buildIncomeChart(); }
    if (step === 3) updateGoalHint();
    if (step === 5) renderCards();
    if (step === 7) { renderSubscriptionsList(); renderCategories(); updateCashFlowPreview(); }
  }

  function next(fromStep) {
    if (fromStep === 1) {
      const name = document.getElementById('setup-name').value.trim();
      const employerName = document.getElementById('setup-employer').value.trim();
      const workStartDate = document.getElementById('setup-work-start').value || '';
      const typeBtn = document.querySelector('#setup-salary-type-ctrl .seg-btn.active');
      const salaryType = typeBtn?.dataset.val || 'mensalista';
      const gross = getCurrentGross();
      const hourlyRate = parseFloat(document.getElementById('setup-hourly-rate')?.value) || 0;
      const hoursPerWeek = parseFloat(document.getElementById('setup-hours-week')?.value) || 44;
      Store.profile.set({ name: name || 'Matthew', employerName, salary: gross || 7500, salaryType, hourlyRate, hoursPerWeek, workStartDate });
    }
    if (fromStep === 2) saveStep2();
    if (fromStep === 3) {
      Store.profile.set({
        savingsGoal: Number(document.getElementById('setup-savings-goal').value) || 500000,
        targetYears: Number(document.getElementById('setup-target-years').value) || 15,
        fgts: Number(document.getElementById('setup-fgts').value) || 0,
        carValue: Number(document.getElementById('setup-car-value').value) || 0
      });
      const pat = Store.data.getPatrimonio();
      Store.data.setPatrimonio({ ...pat,
        savings: Number(document.getElementById('setup-savings').value) || 0,
        investments: Number(document.getElementById('setup-investments').value) || 0,
        fgts: Number(document.getElementById('setup-fgts').value) || 0,
        carValue: Number(document.getElementById('setup-car-value').value) || 0
      });
    }
    if (fromStep === 4) saveAccountsFromDOM();
    if (fromStep === 5) { saveCardsFromDOM(); saveSetupFaturas(); }
    if (fromStep === 6) saveLoansFromDOM();
    if (fromStep === 7) saveCategoriesFromDOM();
    showStep(fromStep + 1);
  }

  function back(fromStep) {
    if (fromStep === 7) saveCategoriesFromDOM();
    if (fromStep === 6) saveLoansFromDOM();
    if (fromStep === 5) { saveCardsFromDOM(); saveSetupFaturas(); }
    if (fromStep === 4) saveAccountsFromDOM();
    if (fromStep === 2) saveStep2();
    showStep(fromStep - 1);
  }

  function saveStep2() {
    const freqBtn = document.querySelector('#setup-freq-ctrl .seg-btn.active');
    const freq = freqBtn?.dataset.val || 'quinzenal';
    const gross = getCurrentGross();
    const legacyFields = buildLegacyDeductFields();
    const firstPay = paymentSchedule[0];
    const adi = firstPay
      ? (firstPay.isFixed ? firstPay.amount : (API.calcSalaryBreakdown({ ...Store.profile.get(), salary: gross, ...legacyFields }).netSalary * (firstPay.percent / 100)))
      : 0;
    Store.profile.set({
      paymentFrequency: freq,
      paymentSchedule,
      deductionsList,
      benefitsList,
      vacationPlans,
      vacationDaysTotal: Number(document.getElementById('setup-vacation-days').value) || 30,
      vacationPeriods: Number(document.getElementById('setup-vacation-periods').value) || 3,
      decimo13Month1: Number(document.getElementById('setup-13-month1')?.value) || 11,
      adiantamentoAmount: adi,
      adiantamentoDay: paymentSchedule[0]?.day || 15,
      salaryDay: paymentSchedule[paymentSchedule.length - 1]?.day || 30,
      ...legacyFields
    });
  }

  function renderAccounts() {
    const el = document.getElementById('setup-accounts-list');
    if (!el) return;
    el.innerHTML = accounts.map((a, i) =>
      '<div class="setup-account-row" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-sm)">' +
        '<div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm);align-items:center">' +
          '<input type="text" class="form-input setup-acct-name" value="' + App.esc(a.name||'') + '" placeholder="e.g. Nubank" style="flex:1;min-width:0;font-size:13px" />' +
          '<select class="form-input setup-acct-type" style="width:110px;flex-shrink:0;font-size:13px">' +
            '<option value="checking"' + (a.type==='checking'?' selected':'') + '>Corrente</option>' +
            '<option value="savings"' + (a.type==='savings'?' selected':'') + '>Poupanca</option>' +
            '<option value="investment"' + (a.type==='investment'?' selected':'') + '>Investimento</option>' +
          '</select>' +
        '</div>' +
        '<div style="display:flex;gap:var(--space-sm);align-items:center">' +
          '<input type="text" class="form-input setup-acct-bank" value="' + App.esc(a.bank||'') + '" placeholder="Banco" style="flex:1;min-width:0;font-size:13px" />' +
          '<div style="position:relative;width:120px;flex-shrink:0">' +
            '<span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:12px">R$</span>' +
            '<input type="number" class="form-input setup-acct-balance" value="' + (a.balance||'') + '" placeholder="0" step="0.01" inputmode="decimal" style="padding-left:28px;font-size:13px" />' +
          '</div>' +
          (accounts.length > 1 ? '<button onclick="SetupWizard.removeAccount(' + i + ')" style="color:var(--red);background:none;border:none;font-size:20px;cursor:pointer;flex-shrink:0;padding:4px" aria-label="Remove">x</button>' : '') +
        '</div>' +
        '<div style="margin-top:var(--space-sm);display:flex;align-items:center;gap:8px">' +
          '<input type="checkbox" class="setup-acct-primary" id="acct-p-' + i + '" ' + (a.isPrimary?'checked':'') + ' style="width:15px;height:15px;accent-color:var(--primary);cursor:pointer" />' +
          '<label for="acct-p-' + i + '" style="font-size:12px;color:var(--text-secondary);cursor:pointer">Conta principal (salario cai aqui)</label>' +
        '</div>' +
      '</div>'
    ).join('');
  }

  function addAccount() {
    saveAccountsFromDOM();
    accounts.push({ id: crypto.randomUUID(), name: '', bank: '', type: 'checking', balance: 0, isPrimary: false });
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
      ...(accounts[i]?.id ? { id: accounts[i].id } : { id: crypto.randomUUID() }),
      name: row.querySelector('.setup-acct-name').value.trim(),
      bank: row.querySelector('.setup-acct-bank').value.trim(),
      type: row.querySelector('.setup-acct-type').value,
      balance: parseFloat(row.querySelector('.setup-acct-balance').value) || 0,
      isPrimary: row.querySelector('.setup-acct-primary')?.checked || false
    }));
    accounts.filter(a => a.name).forEach(a => API.upsertAccount(a));
  }

  function renderCards() {
    const savedAccounts = Store.data.getAccounts();
    const el = document.getElementById('setup-cards-list');
    if (!el) return;
    el.innerHTML = cards.map((c, i) => {
      const used = Math.max(0, (c.limit || 0) - (c.availableCredit || 0));
      const usedColor = used > 0 ? 'var(--red)' : 'var(--green)';
      const acctOptions = savedAccounts.map(a =>
        '<option value="' + a.id + '"' + (c.paymentAccountId===a.id?' selected':'') + '>' + App.esc(a.name||a.bank||'Account') + '</option>'
      ).join('');
      return '<div class="setup-card-row" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md)">' +
        '<div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm);align-items:center">' +
          '<input type="text" class="form-input setup-card-name" value="' + App.esc(c.name||'') + '" placeholder="e.g. Nubank Ultravioleta" style="flex:1;min-width:0;font-size:13px" oninput="SetupWizard.onCardNameChange(' + i + ')" />' +
          '<input type="text" class="form-input setup-card-brand" value="' + App.esc(c.brand||'') + '" placeholder="Visa/Mastercard/Elo" style="width:80px;flex-shrink:0;font-size:12px" />' +
        '</div>' +
        '<div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm)">' +
          '<input type="text" class="form-input setup-card-last4" value="' + App.esc(c.lastFourDigits||'') + '" placeholder="*1234" maxlength="4" style="width:64px;flex-shrink:0;font-size:13px;text-align:center" inputmode="numeric" />' +
          '<div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:3px">LIMITE</div><input type="number" class="form-input setup-card-limit" value="' + (c.limit||'') + '" placeholder="5000" inputmode="decimal" style="font-size:13px" oninput="SetupWizard.updateCardBalance(' + i + ')" /></div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:3px">DISPONIVEL</div><input type="number" class="form-input setup-card-available" value="' + (c.availableCredit||'') + '" placeholder="0" inputmode="decimal" style="font-size:13px" oninput="SetupWizard.updateCardBalance(' + i + ')" /></div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:3px">USADO</div><div class="form-input" id="card-used-' + i + '" style="font-size:13px;font-weight:700;color:' + usedColor + ';background:var(--bg-secondary);display:flex;align-items:center">' + (used > 0 ? Fmt.currency(used) : '—') + '</div></div>' +
        '</div>' +
        '<div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm)">' +
          '<div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:3px">FECHA DIA</div><input type="number" class="form-input setup-card-closing" value="' + (c.closingDay||'') + '" placeholder="15" min="1" max="31" style="font-size:13px;text-align:center" inputmode="numeric" /></div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:3px">VENCE DIA</div><input type="number" class="form-input setup-card-due" value="' + (c.dueDay||'') + '" placeholder="25" min="1" max="31" style="font-size:13px;text-align:center" inputmode="numeric" /></div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:3px">JUROS %/mes</div><input type="number" class="form-input setup-card-interest" value="' + (c.interestRate||'') + '" placeholder="14.5" step="0.1" style="font-size:13px" inputmode="decimal" /></div>' +
        '</div>' +
        '<div style="display:flex;gap:var(--space-sm);align-items:flex-end;margin-bottom:var(--space-md)">' +
          '<div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:3px">ANUIDADE/ANO</div><input type="number" class="form-input setup-card-annual-fee" value="' + (c.annualFee||'') + '" placeholder="0" inputmode="decimal" style="font-size:13px" /></div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:3px">PAGA COM</div><select class="form-input setup-card-payment-account" style="font-size:13px"><option value="">Escolher conta...</option>' + acctOptions + '</select></div>' +
          (cards.length > 1 ? '<button onclick="SetupWizard.removeCard(' + i + ')" style="color:var(--red);background:none;border:none;font-size:20px;cursor:pointer;flex-shrink:0;padding:4px 6px;margin-bottom:2px" aria-label="Remove">x</button>' : '') +
        '</div>' +
        '<div style="border-top:1px solid var(--border);padding-top:var(--space-sm)">' +
          '<div style="display:flex;gap:var(--space-sm);align-items:center;margin-bottom:var(--space-sm)">' +
            '<div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:3px">ULTIMO MES COM FATURA</div><input type="month" class="form-input setup-card-last-fatura" value="' + (c.lastFaturaMonth||'') + '" style="font-size:13px" onchange="SetupWizard.renderCardFaturas(' + i + ')" /></div>' +
            '<div style="flex-shrink:0;font-size:12px;color:var(--text-muted);padding-top:16px">← abre a grade de faturas</div>' +
          '</div>' +
          '<div id="card-fatura-grid-' + i + '"></div>' +
        '</div>' +
      '</div>';
    }).join('');
    cards.forEach((_, i) => renderCardFaturas(i));
  }

  function onCardNameChange(idx) {
    const rows = document.querySelectorAll('.setup-card-row');
    if (rows[idx] && cards[idx]) cards[idx].name = rows[idx].querySelector('.setup-card-name')?.value.trim() || '';
  }

  function updateCardBalance(idx) {
    const rows = document.querySelectorAll('.setup-card-row');
    if (!rows[idx]) return;
    const limit = parseFloat(rows[idx].querySelector('.setup-card-limit')?.value) || 0;
    const available = parseFloat(rows[idx].querySelector('.setup-card-available')?.value) || 0;
    const used = Math.max(0, limit - available);
    const displayEl = document.getElementById('card-used-' + idx);
    if (displayEl) {
      displayEl.textContent = used > 0 ? Fmt.currency(used) : '—';
      displayEl.style.color = used > 0 ? 'var(--red)' : 'var(--green)';
    }
    renderCardFaturas(idx);
  }

  function renderCardFaturas(idx) {
    const grid = document.getElementById('card-fatura-grid-' + idx);
    if (!grid) return;
    const rows = document.querySelectorAll('.setup-card-row');
    const row = rows[idx];
    if (!row) return;
    const limit = parseFloat(row.querySelector('.setup-card-limit')?.value) || 0;
    const available = parseFloat(row.querySelector('.setup-card-available')?.value) || 0;
    const used = Math.max(0, limit - available);
    const lastFaturaMonth = row.querySelector('.setup-card-last-fatura')?.value || '';
    const cardId = cards[idx]?.id;

    if (!lastFaturaMonth || !cardId) {
      grid.innerHTML = !lastFaturaMonth
        ? '<div style="font-size:12px;color:var(--text-muted);padding:8px 0">Informe o ultimo mes com fatura para ver a grade de valores.</div>'
        : '';
      return;
    }

    const now = new Date();
    const last = new Date(lastFaturaMonth + '-02');
    const allFaturas = Store.data.getFaturas();
    const months = [];
    let d = new Date(now.getFullYear(), now.getMonth(), 1);
    while (d <= last && months.length < 24) {
      months.push(d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'));
      d.setMonth(d.getMonth() + 1);
    }
    if (months.length === 0) months.push(lastFaturaMonth);

    let totalFaturas = 0;
    const cells = months.map(mo => {
      const existing = allFaturas.find(f => f.cardId === cardId && f.month === mo);
      const val = existing?.amount || 0;
      if (val) totalFaturas += val;
      return '<div>' +
        '<div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:3px;text-transform:uppercase">' + Fmt.monthYear(mo+'-01').split(' ')[0] + '</div>' +
        '<input type="number" class="form-input setup-fatura-input" data-card-id="' + cardId + '" data-card-idx="' + idx + '" data-month="' + mo + '" value="' + (val||'') + '" placeholder="0" inputmode="decimal" step="0.01" style="height:38px;font-size:13px;padding:6px 8px;text-align:right" oninput="SetupWizard.updateFaturaSum(' + idx + ')" />' +
      '</div>';
    }).join('');

    const diff = used - totalFaturas;
    const matchOk = used === 0 || Math.abs(diff) < 1;
    const sumColor = matchOk ? 'var(--green)' : (diff > 0 ? '#fbbf24' : 'var(--red)');
    const sumMsg = used === 0 ? '' : matchOk ? 'Bate com o saldo usado' : diff > 0 ? 'Falta ' + Fmt.currency(diff) : 'Excede em ' + Fmt.currency(Math.abs(diff));

    grid.innerHTML = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px">' + cells + '</div>' +
      (used > 0 ? '<div id="fatura-sum-' + idx + '" style="font-size:12px;color:' + sumColor + ';padding:4px 0;font-weight:500">Faturas: ' + Fmt.currency(totalFaturas) + ' / Usado: ' + Fmt.currency(used) + (sumMsg ? ' — ' + sumMsg : '') + '</div>' : '');
  }

  function updateFaturaSum(idx) {
    const grid = document.getElementById('card-fatura-grid-' + idx);
    if (!grid) return;
    const inputs = grid.querySelectorAll('.setup-fatura-input');
    let total = 0;
    inputs.forEach(input => {
      total += parseFloat(input.value) || 0;
      const cardId = input.dataset.cardId;
      const month = input.dataset.month;
      if (cardId && month) API.setFatura(cardId, month, input.value === '' ? null : input.value);
    });
    const rows = document.querySelectorAll('.setup-card-row');
    const row = rows[idx];
    const limit = parseFloat(row?.querySelector('.setup-card-limit')?.value) || 0;
    const available = parseFloat(row?.querySelector('.setup-card-available')?.value) || 0;
    const used = Math.max(0, limit - available);
    const sumEl = document.getElementById('fatura-sum-' + idx);
    if (sumEl && used > 0) {
      const diff = used - total;
      const matchOk = Math.abs(diff) < 1;
      sumEl.style.color = matchOk ? 'var(--green)' : (diff > 0 ? '#fbbf24' : 'var(--red)');
      sumEl.textContent = 'Faturas: ' + Fmt.currency(total) + ' / Usado: ' + Fmt.currency(used) + ' — ' + (matchOk ? 'Bate com o saldo usado' : diff > 0 ? 'Falta ' + Fmt.currency(diff) : 'Excede em ' + Fmt.currency(Math.abs(diff)));
    }
  }

  function addCard() {
    saveCardsFromDOM();
    cards.push({ id: crypto.randomUUID(), name: '', brand: '', lastFourDigits: '', limit: 0, availableCredit: 0, currentBalance: 0, closingDay: '', dueDay: '', lastFaturaMonth: '', interestRate: '', annualFee: 0, paymentAccountId: '' });
    renderCards();
  }

  function removeCard(idx) {
    saveCardsFromDOM();
    cards.splice(idx, 1);
    renderCards();
  }

  function saveCardsFromDOM() {
    const rows = document.querySelectorAll('.setup-card-row');
    cards = Array.from(rows).map((row, i) => {
      const limit = parseFloat(row.querySelector('.setup-card-limit')?.value) || 0;
      const availableCredit = parseFloat(row.querySelector('.setup-card-available')?.value) || 0;
      const currentBalance = Math.max(0, limit - availableCredit);
      return {
        ...(cards[i]?.id ? { id: cards[i].id } : { id: crypto.randomUUID() }),
        name: row.querySelector('.setup-card-name')?.value.trim() || '',
        brand: row.querySelector('.setup-card-brand')?.value.trim() || '',
        lastFourDigits: row.querySelector('.setup-card-last4')?.value.trim() || '',
        limit, availableCredit, currentBalance,
        lastFaturaMonth: row.querySelector('.setup-card-last-fatura')?.value || '',
        closingDay: parseInt(row.querySelector('.setup-card-closing')?.value) || '',
        dueDay: parseInt(row.querySelector('.setup-card-due')?.value) || '',
        interestRate: parseFloat(row.querySelector('.setup-card-interest')?.value) || '',
        annualFee: parseFloat(row.querySelector('.setup-card-annual-fee')?.value) || 0,
        paymentAccountId: row.querySelector('.setup-card-payment-account')?.value || ''
      };
    });
  }

  function saveSetupFaturas() {
    document.querySelectorAll('.setup-fatura-input').forEach(input => {
      const cardId = input.dataset.cardId;
      const month = input.dataset.month;
      if (cardId && month) API.setFatura(cardId, month, input.value === '' ? null : input.value);
    });
  }

  function renderLoans() {
    const el = document.getElementById('setup-loans-list');
    if (!el) return;
    if (loans.length === 0) {
      el.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:var(--space-lg) 0;background:var(--bg-card);border:1px dashed var(--border);border-radius:var(--radius-md)">Nenhum emprestimo cadastrado.</div>';
      return;
    }
    el.innerHTML = loans.map((l, i) => {
      const total = (l.monthlyPayment || 0) * (l.remainingMonths || 0);
      return '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-sm)">' +
        '<div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm);align-items:center">' +
          '<input type="text" class="form-input setup-loan-name" value="' + App.esc(l.name||'') + '" placeholder="Ex: Emprestimo pessoal, financiamento" style="flex:1;min-width:0;font-size:13px" />' +
          '<button onclick="SetupWizard.removeLoan(' + i + ')" style="color:var(--red);background:none;border:none;font-size:20px;cursor:pointer;flex-shrink:0;padding:4px">x</button>' +
        '</div>' +
        '<div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm)">' +
          '<div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:3px">PARCELA MENSAL</div><input type="number" class="form-input setup-loan-payment" value="' + (l.monthlyPayment||'') + '" placeholder="500" inputmode="decimal" style="font-size:13px" /></div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:3px">PARCELAS RESTANTES</div><input type="number" class="form-input setup-loan-months" value="' + (l.remainingMonths||'') + '" placeholder="24" min="1" inputmode="numeric" style="font-size:13px" /></div>' +
        '</div>' +
        '<div style="display:flex;gap:var(--space-sm)">' +
          '<div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:3px">DIA PAGAMENTO</div><input type="number" class="form-input setup-loan-day" value="' + (l.paymentDay||'') + '" placeholder="10" min="1" max="31" inputmode="numeric" style="font-size:13px;text-align:center" /></div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:3px">MES DE INICIO</div><input type="month" class="form-input setup-loan-start" value="' + (l.startMonth||'') + '" style="font-size:13px" /></div>' +
        '</div>' +
        (total > 0 ? '<div style="margin-top:8px;font-size:12px;color:var(--text-muted)">Total restante estimado: <strong style="color:var(--text-primary)">' + Fmt.currency(total) + '</strong></div>' : '') +
      '</div>';
    }).join('');
  }

  function addLoan() {
    saveLoansFromDOM();
    loans.push({ id: crypto.randomUUID(), name: '', monthlyPayment: 0, remainingMonths: 0, paymentDay: 10, startMonth: '' });
    renderLoans();
  }

  function removeLoan(idx) {
    saveLoansFromDOM();
    loans.splice(idx, 1);
    renderLoans();
  }

  function saveLoansFromDOM() {
    const rows = document.querySelectorAll('#setup-loans-list > div[style]');
    if (!rows.length) { loans = []; return; }
    loans = Array.from(rows).map((row, i) => ({
      ...(loans[i]?.id ? { id: loans[i].id } : { id: crypto.randomUUID() }),
      name: row.querySelector('.setup-loan-name')?.value.trim() || '',
      monthlyPayment: parseFloat(row.querySelector('.setup-loan-payment')?.value) || 0,
      remainingMonths: parseInt(row.querySelector('.setup-loan-months')?.value) || 0,
      paymentDay: parseInt(row.querySelector('.setup-loan-day')?.value) || 10,
      startMonth: row.querySelector('.setup-loan-start')?.value || ''
    })).filter(l => l.name || l.monthlyPayment > 0);
  }

  function renderCategories() {
    const el = document.getElementById('setup-categories-list');
    if (!el) return;
    const categories = Store.data.getCategories();
    el.innerHTML = categories.map(c =>
      '<div class="setup-cat-row" data-id="' + c.id + '" style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:8px;padding:10px var(--space-md);background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md)">' +
        '<span style="font-size:20px;width:28px;text-align:center;flex-shrink:0">' + c.emoji + '</span>' +
        '<span style="flex:1;font-size:13px;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + App.esc(c.label) + '</span>' +
        '<div style="position:relative;width:110px;flex-shrink:0">' +
          '<span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:11px;pointer-events:none">R$</span>' +
          '<input type="number" class="form-input setup-cat-budget" value="' + (c.budget||'') + '" placeholder="0" inputmode="decimal" style="padding-left:24px;font-size:13px;height:36px" oninput="SetupWizard.updateCashFlowPreview()" />' +
        '</div>' +
        (c.custom ? '<button onclick="SetupWizard.removeCustomCategory(\'' + c.id + '\')" style="color:var(--red);background:none;border:none;font-size:16px;cursor:pointer;flex-shrink:0;padding:4px">x</button>' : '<div style="width:20px;flex-shrink:0"></div>') +
      '</div>'
    ).join('');
  }

  function addCustomCategory() {
    const emojiEl = document.getElementById('setup-new-cat-emoji');
    const labelEl = document.getElementById('setup-new-cat-label');
    const emoji = emojiEl?.value.trim() || '\uD83C\uDFF7';
    const label = labelEl?.value.trim();
    if (!label) { App.toast('Enter a category name', 'error'); return; }
    const cats = Store.data.getCategories();
    const COLORS = ['#6366f1','#f97316','#ec4899','#8b5cf6','#14b8a6','#f59e0b','#10b981','#3b82f6','#ef4444','#84cc16'];
    cats.push({ id: 'custom_' + Date.now(), emoji, label, color: COLORS[cats.length % COLORS.length], budget: 0, active: true, custom: true });
    Store.data.setCategories(cats);
    if (emojiEl) emojiEl.value = '';
    if (labelEl) labelEl.value = '';
    renderCategories();
  }

  function removeCustomCategory(id) {
    Store.data.setCategories(Store.data.getCategories().filter(c => c.id !== id));
    renderCategories();
  }

  function saveCategoriesFromDOM() {
    const rows = document.querySelectorAll('.setup-cat-row');
    if (!rows.length) return;
    const categories = Store.data.getCategories();
    rows.forEach(row => {
      const id = row.dataset.id;
      const budget = parseFloat(row.querySelector('.setup-cat-budget').value) || 0;
      const cat = categories.find(c => c.id === id);
      if (cat) cat.budget = budget;
    });
    Store.data.setCategories(categories);
  }

  function updateCashFlowPreview() {
    const el = document.getElementById('setup-cashflow-preview');
    if (!el) return;
    const profile = Store.profile.get();
    const gross = profile.salary || 0;
    if (!gross) { el.innerHTML = ''; return; }
    const b = API.calcSalaryBreakdown(profile);
    const monthlyIncome = b.totalTakeHome;
    const allLoans = Store.data.getLoans();
    const loansTotal = allLoans.reduce((s, l) => s + (l.monthlyPayment || 0), 0);
    const subsTotal = Store.data.getSubscriptions().filter(s => s.active !== false).reduce((s, sub) => s + (sub.amount || 0), 0);
    let budgetTotal = 0;
    document.querySelectorAll('.setup-cat-budget').forEach(inp => { budgetTotal += parseFloat(inp.value) || 0; });
    const now = new Date();
    const months = [0,1,2].map(i => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    });
    const allFaturas = Store.data.getFaturas();
    const ccAmounts = months.map(mo => allFaturas.filter(f => f.month === mo && f.amount > 0).reduce((s,f) => s+(f.amount||0), 0));
    const ccAvg = ccAmounts.reduce((s,v)=>s+v,0) / 3 || 0;
    const remaining = monthlyIncome - ccAvg - loansTotal - subsTotal - budgetTotal;
    const over = remaining < 0;
    el.innerHTML = '<div style="background:' + (over?'rgba(239,68,68,0.1)':'var(--bg-card)') + ';border:1px solid ' + (over?'var(--red)':'var(--border)') + ';border-radius:var(--radius-md);padding:var(--space-md)">' +
      '<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--text-secondary)">Previsao mensal</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>Take-home</span><span style="color:var(--green)">' + Fmt.currency(monthlyIncome) + '</span></div>' +
      (ccAvg > 0 ? '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--red);margin-bottom:2px"><span>- Faturas CC (media)</span><span>' + Fmt.currency(ccAvg) + '</span></div>' : '') +
      (loansTotal > 0 ? '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--red);margin-bottom:2px"><span>- Emprestimos</span><span>' + Fmt.currency(loansTotal) + '</span></div>' : '') +
      (subsTotal > 0 ? '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--red);margin-bottom:2px"><span>- Assinaturas mensais</span><span>' + Fmt.currency(subsTotal) + '</span></div>' : '') +
      (budgetTotal > 0 ? '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);margin-bottom:2px"><span>- Orcamento categorias</span><span>' + Fmt.currency(budgetTotal) + '</span></div>' : '') +
      '<div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px;display:flex;justify-content:space-between;font-size:13px;font-weight:700"><span>Sobra</span><span style="color:' + (over?'var(--red)':'var(--green)') + '">' + Fmt.currency(remaining) + (over?' — acima do orcamento!':'') + '</span></div>' +
    '</div>';
  }

  // ── Subscriptions management (step 7) ─────────────────────

  function renderSubscriptionsList() {
    const el = document.getElementById('setup-subscriptions-list');
    if (!el) return;
    const subs = Store.data.getSubscriptions();
    if (!subs.length) {
      el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0">No subscriptions added yet.</div>';
      return;
    }
    el.innerHTML = subs.map(s => `
      <div class="setup-cat-row" data-sub-id="${s.id}" style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:6px;padding:8px var(--space-md);background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md)">
        <span style="font-size:18px;width:24px;text-align:center;flex-shrink:0">${App.esc(s.emoji || '📱')}</span>
        <span style="flex:1;font-size:13px;font-weight:500">${App.esc(s.name)}</span>
        ${s.billingDay ? `<span style="font-size:10px;color:var(--text-muted)">day ${s.billingDay}</span>` : ''}
        <span style="font-size:13px;font-weight:600;font-family:var(--font-mono);color:var(--red)">${Fmt.compact(s.amount)}</span>
        <button onclick="SetupWizard.removeSubscription('${s.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:2px 4px;line-height:1;flex-shrink:0">×</button>
      </div>
    `).join('');
    updateCashFlowPreview();
  }

  function addSubscription() {
    const row = document.getElementById('setup-sub-add-row');
    if (row) row.style.display = 'block';
    document.getElementById('setup-sub-name')?.focus();
  }

  function cancelAddSubscription() {
    const row = document.getElementById('setup-sub-add-row');
    if (row) row.style.display = 'none';
    ['setup-sub-emoji','setup-sub-name','setup-sub-amount','setup-sub-day'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }

  function confirmAddSubscription() {
    const emoji  = document.getElementById('setup-sub-emoji')?.value.trim()  || '📱';
    const name   = document.getElementById('setup-sub-name')?.value.trim();
    const amount = parseFloat(document.getElementById('setup-sub-amount')?.value) || 0;
    const day    = parseInt(document.getElementById('setup-sub-day')?.value)   || 1;
    if (!name) { App.toast('Enter a subscription name', 'error'); return; }
    if (amount <= 0) { App.toast('Enter the monthly amount', 'error'); return; }
    const subs = Store.data.getSubscriptions();
    subs.push({ id: crypto.randomUUID(), name, amount, emoji, billingDay: day, active: true });
    Store.data.setSubscriptions(subs);
    cancelAddSubscription();
    renderSubscriptionsList();
  }

  function removeSubscription(id) {
    Store.data.setSubscriptions(Store.data.getSubscriptions().filter(s => s.id !== id));
    renderSubscriptionsList();
  }

  async function finish() {
    saveCategoriesFromDOM();
    saveLoansFromDOM();
    saveCardsFromDOM();
    saveSetupFaturas();

    const validAccounts = accounts.filter(a => a.name);
    for (const a of validAccounts) await API.upsertAccount(a);

    const validCards = cards.filter(c => c.name);
    let totalDebt = 0;
    for (const c of validCards) {
      await API.upsertCreditCard(c);
      totalDebt += c.currentBalance || 0;
    }

    const validLoans = loans.filter(l => l.name || l.monthlyPayment > 0);
    for (const l of validLoans) await API.upsertLoan(l);

    if (totalDebt > 0) Store.profile.set({ debtTotal: totalDebt });
    Store.cache.invalidateAll();
    Store.data.setSetupDone(true);
    App.showApp();
    App.toast('Setup completo! Comece a rastrear suas financas.', 'success');
  }

  return {
    init, next, back,
    setSalaryType, onHourlyChange, onSalaryChange,
    setFrequency, savePaymentSchedule, toggleSchedFixed, addPaymentRow, removePaymentRow,
    addDeduction, removeDeduction, saveDeduction,
    addBenefit, removeBenefit, saveBenefit,
    addVacationPlan, removeVacPlan, saveVacPlan,
    updateGoalHint,
    addAccount, removeAccount,
    addCard, removeCard, onCardNameChange, updateCardBalance, renderCardFaturas, updateFaturaSum,
    addLoan, removeLoan,
    addCustomCategory, removeCustomCategory, updateCashFlowPreview,
    addSubscription, cancelAddSubscription, confirmAddSubscription, removeSubscription,
    finish
  };

})();

// ── Start ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', App.init);
