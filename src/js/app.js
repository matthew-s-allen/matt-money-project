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
  const TOTAL_STEPS = 6;
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
      cards.push({ name: '', brand: '', lastFourDigits: '', limit: 0, currentBalance: 0, closingDay: '', dueDay: '', interestRate: '', annualFee: 0, paymentAccountId: '' });
    }

    // Pre-fill step 1: profile
    const profile = Store.profile.get();
    document.getElementById('setup-name').value = profile.name || '';
    document.getElementById('setup-employer').value = profile.employerName || '';
    document.getElementById('setup-salary').value = profile.salary || '';
    document.getElementById('setup-work-start').value = profile.workStartDate || '';

    // Pre-fill step 2: income schedule + employment & salary
    document.getElementById('setup-adiantamento').value      = profile.adiantamentoAmount || '';
    document.getElementById('setup-adiantamento-day').value  = profile.adiantamentoDay || 15;
    document.getElementById('setup-salary-day').value        = profile.salaryDay || 30;
    document.getElementById('setup-vacation-days').value     = profile.vacationDaysTotal || 30;
    document.getElementById('setup-vacation-periods').value  = profile.vacationPeriods || 3;
    document.getElementById('setup-vacation-sell').value     = profile.vacationDaysToSell || 0;
    document.getElementById('setup-deduct-health').value     = profile.deductHealthPlan || '';
    document.getElementById('setup-deduct-dental').value     = profile.deductDental || '';
    document.getElementById('setup-deduct-vt').value         = profile.deductValeTransporte || '';
    document.getElementById('setup-deduct-other').value      = profile.deductOther || '';
    document.getElementById('setup-benefit-va').value        = profile.benefitVA || '';
    document.getElementById('setup-benefit-vr').value        = profile.benefitVR || '';
    document.getElementById('setup-benefit-other').value     = profile.benefitOther || '';

    // Pre-fill step 3: goals & assets
    document.getElementById('setup-savings-goal').value = profile.savingsGoal || '';
    document.getElementById('setup-target-years').value = profile.targetYears || '';
    document.getElementById('setup-fgts').value = profile.fgts || '';
    document.getElementById('setup-car-value').value = profile.carValue || '';

    const patrimonio = Store.data.getPatrimonio();
    document.getElementById('setup-savings').value = patrimonio.savings || '';
    document.getElementById('setup-investments').value = patrimonio.investments || '';

    // Setup import handler
    document.getElementById('setup-import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await API.importData(file);
        App.toast('Backup imported! Completing setup...', 'success');
        Store.data.setSetupDone(true);
        App.showApp();
      } catch(err) {
        App.toast('Import failed: ' + err.message, 'error');
      }
      e.target.value = '';
    });

    // Live salary preview - attach listeners to step 2 inputs
    const salaryInputs = ['setup-deduct-health','setup-deduct-dental','setup-deduct-vt','setup-deduct-other',
      'setup-benefit-va','setup-benefit-vr','setup-benefit-other','setup-vacation-sell'];
    salaryInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updateSalaryPreview);
    });

    // Live goal projection hint
    ['setup-savings-goal','setup-target-years'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updateGoalHint);
    });

    renderAccounts();
    renderCards();
    renderCategories();
    showStep(1);
  }

  function updateSalaryPreview() {
    const preview = document.getElementById('setup-salary-preview');
    if (!preview) return;
    const profile = Store.profile.get();
    const gross = profile.salary || 0;
    if (!gross) { preview.innerHTML = ''; return; }

    const tempProfile = {
      ...profile,
      deductHealthPlan: Number(document.getElementById('setup-deduct-health').value) || 0,
      deductDental: Number(document.getElementById('setup-deduct-dental').value) || 0,
      deductValeTransporte: Number(document.getElementById('setup-deduct-vt').value) || 0,
      deductOther: Number(document.getElementById('setup-deduct-other').value) || 0,
      benefitVA: Number(document.getElementById('setup-benefit-va').value) || 0,
      benefitVR: Number(document.getElementById('setup-benefit-vr').value) || 0,
      benefitOther: Number(document.getElementById('setup-benefit-other').value) || 0,
      vacationDaysToSell: Number(document.getElementById('setup-vacation-sell').value) || 0
    };

    const b = API.calcSalaryBreakdown(tempProfile);
    preview.innerHTML = `
      <div style="font-size:12px;font-weight:600;margin-bottom:var(--space-sm)">Salary Preview</div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">
        <span>Gross salary</span><span>${Fmt.currency(b.gross)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--red);margin-bottom:2px">
        <span>INSS</span><span>-${Fmt.currency(b.inss)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--red);margin-bottom:2px">
        <span>IRRF</span><span>-${Fmt.currency(b.irrf)}</span>
      </div>
      ${b.healthPlan ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--red);margin-bottom:2px"><span>Health plan</span><span>-${Fmt.currency(b.healthPlan)}</span></div>` : ''}
      ${b.dental ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--red);margin-bottom:2px"><span>Dental</span><span>-${Fmt.currency(b.dental)}</span></div>` : ''}
      ${b.vt ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--red);margin-bottom:2px"><span>Vale Transporte</span><span>-${Fmt.currency(b.vt)}</span></div>` : ''}
      ${b.otherDeduct ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--red);margin-bottom:2px"><span>Other deductions</span><span>-${Fmt.currency(b.otherDeduct)}</span></div>` : ''}
      <div style="border-top:1px solid var(--border);margin:var(--space-sm) 0;padding-top:var(--space-sm);display:flex;justify-content:space-between;font-size:13px;font-weight:600">
        <span>Net salary</span><span style="color:var(--green)">${Fmt.currency(b.netSalary)}</span>
      </div>
      ${b.totalBenefits > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--blue);margin-bottom:2px">
          <span>+ Benefits (VA/VR/other)</span><span>+${Fmt.currency(b.totalBenefits)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-top:4px">
          <span>Total take-home</span><span style="color:var(--green)">${Fmt.currency(b.totalTakeHome)}</span>
        </div>
      ` : ''}
      <div style="border-top:1px solid var(--border);margin-top:var(--space-sm);padding-top:var(--space-sm);font-size:11px;color:var(--text-muted)">
        FGTS: ${Fmt.currency(b.fgtsMonthly)}/mo · 13th: ${Fmt.currency(b.decimoTerceiroNet)} net ·
        Vacation bonus: ${Fmt.currency(b.vacationBonus)}
        ${b.daysToSell > 0 ? ` · Sold ${b.daysToSell} days: ${Fmt.currency(b.abonoPecuniario)}` : ''}
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
        Annual total: <strong style="color:var(--green)">${Fmt.currency(b.annualTotal)}</strong>
      </div>
    `;
  }

  function showStep(step) {
    currentStep = step;
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      document.getElementById(`setup-step-${i}`).classList.toggle('hidden', i !== step);
      const dot = document.querySelector(`.setup-step-dot[data-step="${i}"]`);
      if (dot) {
        dot.classList.toggle('active', i <= step);
        dot.classList.toggle('done', i < step);
      }
    }
    // Hide intro subtitle + import on steps 2+
    const subtitle = document.getElementById('setup-intro-subtitle');
    const importSec = document.getElementById('setup-import-section');
    if (subtitle) subtitle.classList.toggle('hidden', step > 1);
    if (importSec) importSec.classList.toggle('hidden', step > 1);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (step === 2) updateSalaryPreview();
    if (step === 3) updateGoalHint();
  }

  function updateGoalHint() {
    const hint = document.getElementById('setup-goal-hint');
    if (!hint) return;
    const profile = Store.profile.get();
    const gross = profile.salary || 0;
    if (!gross) { hint.textContent = ''; return; }
    const goal = Number(document.getElementById('setup-savings-goal')?.value) || 0;
    const years = Number(document.getElementById('setup-target-years')?.value) || 0;
    if (goal && years) {
      const months = years * 12;
      const needed = goal / months;
      const pct = ((needed / gross) * 100).toFixed(0);
      hint.textContent = `To reach ${Fmt.currency(goal)} in ${years} years you need to save ~${Fmt.currency(needed)}/mo (${pct}% of gross).`;
    } else {
      hint.textContent = '';
    }
  }

  function next(fromStep) {
    if (fromStep === 1) {
      const name = document.getElementById('setup-name').value.trim();
      const employerName = document.getElementById('setup-employer').value.trim();
      const salary = Number(document.getElementById('setup-salary').value) || 0;
      const workStartDate = document.getElementById('setup-work-start').value || '';
      Store.profile.set({ name: name || 'Matthew', employerName, salary: salary || 7500, workStartDate });
    }
    if (fromStep === 2) {
      // Save income schedule + employment & salary details
      Store.profile.set({
        adiantamentoAmount:    Number(document.getElementById('setup-adiantamento').value) || 0,
        adiantamentoDay:       Number(document.getElementById('setup-adiantamento-day').value) || 15,
        salaryDay:             Number(document.getElementById('setup-salary-day').value) || 30,
        vacationDaysTotal:     Number(document.getElementById('setup-vacation-days').value) || 30,
        vacationPeriods:       Number(document.getElementById('setup-vacation-periods').value) || 3,
        vacationDaysToSell:    Number(document.getElementById('setup-vacation-sell').value) || 0,
        deductHealthPlan:      Number(document.getElementById('setup-deduct-health').value) || 0,
        deductDental:          Number(document.getElementById('setup-deduct-dental').value) || 0,
        deductValeTransporte:  Number(document.getElementById('setup-deduct-vt').value) || 0,
        deductOther:           Number(document.getElementById('setup-deduct-other').value) || 0,
        benefitVA:             Number(document.getElementById('setup-benefit-va').value) || 0,
        benefitVR:             Number(document.getElementById('setup-benefit-vr').value) || 0,
        benefitOther:          Number(document.getElementById('setup-benefit-other').value) || 0
      });
    }
    if (fromStep === 3) {
      // Save goals & assets
      Store.profile.set({
        savingsGoal: Number(document.getElementById('setup-savings-goal').value) || 500000,
        targetYears: Number(document.getElementById('setup-target-years').value) || 15,
        fgts:        Number(document.getElementById('setup-fgts').value) || 0,
        carValue:    Number(document.getElementById('setup-car-value').value) || 0
      });
      const pat = Store.data.getPatrimonio();
      Store.data.setPatrimonio({
        ...pat,
        savings:     Number(document.getElementById('setup-savings').value) || 0,
        investments: Number(document.getElementById('setup-investments').value) || 0,
        fgts:        Number(document.getElementById('setup-fgts').value) || 0,
        carValue:    Number(document.getElementById('setup-car-value').value) || 0
      });
    }
    if (fromStep === 4) {
      saveAccountsFromDOM();
    }
    if (fromStep === 5) {
      saveCardsFromDOM();
      saveSetupFaturas();
    }
    showStep(fromStep + 1);
  }

  function back(fromStep) {
    if (fromStep === 6) saveCategoriesFromDOM();
    if (fromStep === 5) { saveCardsFromDOM(); saveSetupFaturas(); }
    if (fromStep === 4) saveAccountsFromDOM();
    showStep(fromStep - 1);
  }

  // ── Accounts management ────────────────────────────────────
  function renderAccounts() {
    const el = document.getElementById('setup-accounts-list');
    el.innerHTML = accounts.map((a, i) => `
      <div class="setup-account-row" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-sm)">
        <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm);align-items:center">
          <input type="text" class="form-input setup-acct-name" value="${a.name || ''}" placeholder="e.g. Nubank" style="flex:1;min-width:0" />
          <select class="form-input setup-acct-type" style="width:110px;flex-shrink:0">
            <option value="checking" ${a.type === 'checking' ? 'selected' : ''}>Checking</option>
            <option value="savings" ${a.type === 'savings' ? 'selected' : ''}>Savings</option>
            <option value="investment" ${a.type === 'investment' ? 'selected' : ''}>Investment</option>
          </select>
        </div>
        <div style="display:flex;gap:var(--space-sm);align-items:center">
          <input type="text" class="form-input setup-acct-bank" value="${a.bank || ''}" placeholder="Bank" style="flex:1;min-width:0" />
          <div style="position:relative;width:120px;flex-shrink:0">
            <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:12px">R$</span>
            <input type="number" class="form-input setup-acct-balance" value="${a.balance || ''}" placeholder="0" step="0.01" inputmode="decimal" style="padding-left:32px" />
          </div>
          ${accounts.length > 1 ? `<button class="btn btn-ghost btn-sm" onclick="SetupWizard.removeAccount(${i})" style="color:var(--red);padding:6px 10px;flex-shrink:0" aria-label="Remove">✕</button>` : ''}
        </div>
        <div style="margin-top:var(--space-sm);display:flex;align-items:center;gap:var(--space-sm)">
          <input type="checkbox" class="setup-acct-primary" id="acct-primary-${i}" ${a.isPrimary ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--primary);cursor:pointer" />
          <label for="acct-primary-${i}" style="font-size:12px;color:var(--text-secondary);cursor:pointer">Primary account (salary lands here)</label>
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
      balance: parseFloat(row.querySelector('.setup-acct-balance').value) || 0,
      isPrimary: row.querySelector('.setup-acct-primary')?.checked || false
    }));
  }

  // ── Cards management ──────────────────────────────────────
  function renderCards() {
    const accounts = Store.data.getAccounts();
    const el = document.getElementById('setup-cards-list');
    el.innerHTML = cards.map((c, i) => `
      <div class="setup-card-row" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-sm)">
        <!-- Row 1: Name + Brand -->
        <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm);align-items:center">
          <input type="text" class="form-input setup-card-name" value="${c.name || ''}" placeholder="Card name (e.g. Nubank)" style="flex:1;min-width:0" oninput="SetupWizard.renderSetupFaturas()" />
          <input type="text" class="form-input setup-card-brand" value="${c.brand || ''}" placeholder="Visa/MC/Elo" style="width:90px;flex-shrink:0" />
        </div>
        <!-- Row 2: Last4 + Limit + Current balance -->
        <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm)">
          <input type="text" class="form-input setup-card-last4" value="${c.lastFourDigits || ''}" placeholder="**** 1234" maxlength="4" style="width:80px;flex-shrink:0" inputmode="numeric" />
          <div style="position:relative;flex:1;min-width:0">
            <span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:10px;font-weight:600;white-space:nowrap">LIMIT</span>
            <input type="number" class="form-input setup-card-limit" value="${c.limit || ''}" placeholder="5000" inputmode="decimal" style="padding-left:46px" />
          </div>
          <div style="position:relative;flex:1;min-width:0">
            <span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:10px;font-weight:600;white-space:nowrap">BAL</span>
            <input type="number" class="form-input setup-card-balance" value="${c.currentBalance || ''}" placeholder="0" step="0.01" inputmode="decimal" style="padding-left:36px" />
          </div>
        </div>
        <!-- Row 3: Closing day + Due day + Interest rate -->
        <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm)">
          <div style="position:relative;flex:1;min-width:0">
            <span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:10px;font-weight:600;white-space:nowrap">CLOSES</span>
            <input type="number" class="form-input setup-card-closing" value="${c.closingDay || ''}" placeholder="15" min="1" max="31" style="padding-left:52px" inputmode="numeric" />
          </div>
          <div style="position:relative;flex:1;min-width:0">
            <span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:10px;font-weight:600;white-space:nowrap">DUE</span>
            <input type="number" class="form-input setup-card-due" value="${c.dueDay || ''}" placeholder="25" min="1" max="31" style="padding-left:38px" inputmode="numeric" />
          </div>
          <div style="position:relative;flex:1;min-width:0">
            <span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:10px;font-weight:600;white-space:nowrap">RATE%</span>
            <input type="number" class="form-input setup-card-interest" value="${c.interestRate || ''}" placeholder="14.5" step="0.1" style="padding-left:46px" inputmode="decimal" />
          </div>
        </div>
        <!-- Row 4: Annual fee + Payment account + Remove -->
        <div style="display:flex;gap:var(--space-sm);align-items:center">
          <div style="position:relative;flex:1;min-width:0">
            <span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:10px;font-weight:600;white-space:nowrap">ANUIDADE</span>
            <input type="number" class="form-input setup-card-annual-fee" value="${c.annualFee || ''}" placeholder="0" inputmode="decimal" style="padding-left:68px" />
          </div>
          <select class="form-input setup-card-payment-account" style="flex:1;min-width:0">
            <option value="">Pays from…</option>
            ${accounts.map(a => `<option value="${a.id}" ${c.paymentAccountId === a.id ? 'selected' : ''}>${App.esc(a.name || a.bank || 'Account')}</option>`).join('')}
          </select>
          ${cards.length > 1 ? `<button class="btn btn-ghost btn-sm" onclick="SetupWizard.removeCard(${i})" style="color:var(--red);padding:6px 10px;flex-shrink:0" aria-label="Remove">✕</button>` : ''}
        </div>
      </div>
    `).join('');
  }

  function addCard() {
    saveCardsFromDOM();
    // Generate ID immediately so faturas can reference this card before finish()
    cards.push({ id: crypto.randomUUID(), name: '', brand: '', lastFourDigits: '', limit: 0, currentBalance: 0, closingDay: '', dueDay: '', interestRate: '', annualFee: 0, paymentAccountId: '' });
    renderCards();
    renderSetupFaturas();
  }

  function removeCard(idx) {
    saveCardsFromDOM();
    cards.splice(idx, 1);
    renderCards();
    renderSetupFaturas();
  }

  function saveCardsFromDOM() {
    const rows = document.querySelectorAll('.setup-card-row');
    cards = Array.from(rows).map((row, i) => ({
      // Always preserve the ID (generated in addCard or from existing data)
      ...(cards[i]?.id ? { id: cards[i].id } : { id: crypto.randomUUID() }),
      name:             row.querySelector('.setup-card-name').value.trim(),
      brand:            row.querySelector('.setup-card-brand').value.trim(),
      lastFourDigits:   row.querySelector('.setup-card-last4').value.trim(),
      limit:            parseFloat(row.querySelector('.setup-card-limit').value) || 0,
      currentBalance:   parseFloat(row.querySelector('.setup-card-balance').value) || 0,
      closingDay:       parseInt(row.querySelector('.setup-card-closing').value) || '',
      dueDay:           parseInt(row.querySelector('.setup-card-due').value) || '',
      interestRate:     parseFloat(row.querySelector('.setup-card-interest').value) || '',
      annualFee:        parseFloat(row.querySelector('.setup-card-annual-fee').value) || 0,
      paymentAccountId: row.querySelector('.setup-card-payment-account').value || ''
    }));
    renderSetupFaturas();
  }

  // ── Setup fatura entry ────────────────────────────────────

  function renderSetupFaturas() {
    const section = document.getElementById('setup-faturas-section');
    const tableEl = document.getElementById('setup-faturas-table');
    if (!section || !tableEl) return;

    const namedCards = cards.filter(c => c.name);
    if (namedCards.length === 0) {
      section.classList.add('hidden');
      return;
    }
    section.classList.remove('hidden');

    const now = new Date();
    const months = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const allFaturas = Store.data.getFaturas();

    tableEl.innerHTML = namedCards.map(card => {
      const cardFaturas = allFaturas.filter(f => f.cardId === card.id);
      return `
        <div style="margin-bottom:var(--space-md);background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--space-md)">
          <div style="font-weight:600;font-size:13px;margin-bottom:var(--space-sm)">
            💳 ${App.esc(card.name)}${card.lastFourDigits ? ' *' + App.esc(card.lastFourDigits) : ''}
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-sm)">
            ${months.map(mo => {
              const existing = cardFaturas.find(f => f.month === mo);
              return `
                <div>
                  <div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:0.04em">${Fmt.monthYear(mo + '-01')}</div>
                  <input type="number" class="form-input setup-fatura-input"
                    data-card-id="${card.id}" data-month="${mo}"
                    value="${existing ? existing.amount : ''}"
                    placeholder="0"
                    style="height:36px;font-size:13px;padding:6px 10px;text-align:right"
                    inputmode="decimal" step="0.01" />
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  function saveSetupFaturas() {
    const inputs = document.querySelectorAll('.setup-fatura-input');
    inputs.forEach(input => {
      const cardId = input.dataset.cardId;
      const month  = input.dataset.month;
      const val    = input.value;
      if (cardId && month) {
        API.setFatura(cardId, month, val === '' ? null : val);
      }
    });
  }

  // ── Categories / Budgets management ────────────────────────
  function renderCategories() {
    const el = document.getElementById('setup-categories-list');
    if (!el) return;
    const categories = Store.data.getCategories();
    el.innerHTML = categories.map(c => `
      <div class="setup-cat-row" data-id="${c.id}" style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-sm);padding:var(--space-sm);background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md)">
        <span style="font-size:18px;width:28px;text-align:center">${c.emoji}</span>
        <span style="flex:1;font-size:13px;font-weight:500">${c.label}</span>
        <div style="position:relative;width:120px">
          <span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:11px">R$</span>
          <input type="number" class="form-input setup-cat-budget" value="${c.budget || ''}" placeholder="0" inputmode="decimal" style="padding-left:28px;font-size:13px;height:36px" />
        </div>
      </div>
    `).join('');
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

  // ── Finish ─────────────────────────────────────────────────
  async function finish() {
    saveCategoriesFromDOM();

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

  return { init, next, back, addAccount, removeAccount, addCard, removeCard, finish, renderSetupFaturas };
})();

// ── Start ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', App.init);
