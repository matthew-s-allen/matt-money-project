/* ============================================================
   ACCOUNTS VIEW — Bank accounts & credit cards management
   ============================================================ */

const Accounts = (() => {

  async function render() {
    const container = document.getElementById('view-accounts');
    const [accounts, cards, allTx] = await Promise.all([
      API.getAccounts(),
      API.getCreditCards(),
      API.getTransactions({ month: App.state.activeMonth })
    ]);
    renderFull(container, accounts, cards, allTx);
  }

  function renderFull(container, accounts, cards, allTx) {
    const now = new Date();
    const [y, m] = App.state.activeMonth.split('-').map(Number);
    const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1;

    // Calculate totals
    const totalBankBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const totalCardBalance = cards.reduce((s, c) => s + (c.currentBalance || 0), 0);
    const totalCardLimit = cards.reduce((s, c) => s + (c.limit || 0), 0);

    container.innerHTML = `
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md)">
        <div>
          <div class="section-title">Accounts</div>
          <div class="section-subtitle">Bank accounts & credit cards</div>
        </div>
        <div class="month-nav">
          <button onclick="App.prevMonth()">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="month-display">${Fmt.monthYear(App.state.activeMonth + '-01')}</span>
          <button onclick="App.nextMonth()" ${isCurrentMonth ? 'disabled style="opacity:.3"' : ''}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      <!-- Summary cards -->
      <div class="grid-2" style="margin-bottom:var(--space-md)">
        <div class="card" style="text-align:center">
          <div class="stat-label">Bank Balance</div>
          <div class="stat-value positive" style="font-size:20px;margin-top:4px">${Fmt.currency(totalBankBalance)}</div>
          <div class="t-muted" style="margin-top:4px">${accounts.length} account${accounts.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="card" style="text-align:center">
          <div class="stat-label">Card Balance</div>
          <div class="stat-value negative" style="font-size:20px;margin-top:4px">${Fmt.currency(totalCardBalance)}</div>
          <div class="t-muted" style="margin-top:4px">${totalCardLimit > 0 ? Fmt.percent(totalCardBalance / totalCardLimit * 100) + ' used' : cards.length + ' card' + (cards.length !== 1 ? 's' : '')}</div>
        </div>
      </div>

      <!-- Bank Accounts -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Bank Accounts</span>
          <button class="btn btn-ghost btn-sm" onclick="Accounts.addAccount()">+ Add</button>
        </div>
        ${accounts.length === 0 ? `
          <div class="empty-state" style="padding:var(--space-lg) 0">
            <p>No bank accounts added yet.</p>
          </div>
        ` : `
          <div class="asset-list">
            ${accounts.map(a => renderAccountItem(a, allTx)).join('')}
          </div>
        `}
      </div>

      <!-- Credit Cards -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Credit Cards</span>
          <button class="btn btn-ghost btn-sm" onclick="Accounts.addCard()">+ Add</button>
        </div>
        ${cards.length === 0 ? `
          <div class="empty-state" style="padding:var(--space-lg) 0">
            <p>No credit cards added yet.</p>
          </div>
        ` : `
          <div class="asset-list">
            ${cards.map(c => renderCardItem(c, allTx)).join('')}
          </div>
        `}
      </div>
    `;
  }

  function renderAccountItem(a, allTx) {
    const txCount = allTx.filter(t => t.accountId === a.id).length;
    const iconColors = { checking: 'blue', savings: 'green', investment: 'purple' };
    const iconEmojis = { checking: '🏦', savings: '💰', investment: '📈' };
    const color = iconColors[a.type] || 'blue';
    const emoji = iconEmojis[a.type] || '🏦';
    const aJson = JSON.stringify(a).replace(/"/g, '&quot;');

    return `
      <div class="asset-item" style="cursor:pointer" onclick="Accounts.editAccount(${aJson})">
        <div class="asset-icon ${color}">${emoji}</div>
        <div class="asset-info">
          <div class="asset-name">${a.name || 'Account'}</div>
          <div class="asset-sub">${a.bank || ''} ${a.type ? '· ' + a.type : ''}${txCount ? ' · ' + txCount + ' tx this month' : ''}</div>
        </div>
        <div class="asset-value positive">${Fmt.currency(a.balance || 0)}</div>
      </div>
    `;
  }

  function renderCardItem(c, allTx) {
    const txCount = allTx.filter(t => t.accountId === c.id).length;
    const monthTxTotal = allTx.filter(t => t.accountId === c.id && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const usedPct = c.limit > 0 ? (c.currentBalance / c.limit * 100) : 0;
    const usedColor = usedPct > 80 ? 'var(--red)' : usedPct > 50 ? 'var(--yellow)' : 'var(--green)';
    const cJson = JSON.stringify(c).replace(/"/g, '&quot;');

    return `
      <div class="asset-item" style="cursor:pointer" onclick="Accounts.editCard(${cJson})">
        <div class="asset-icon red">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        </div>
        <div class="asset-info" style="flex:1;min-width:0">
          <div class="asset-name">${c.name || 'Credit Card'}</div>
          <div class="asset-sub">
            ${c.closingDay ? 'Closes day ' + c.closingDay : ''}
            ${txCount ? ' · ' + txCount + ' charges' : ''}
            ${monthTxTotal > 0 ? ' · ' + Fmt.currency(monthTxTotal) + ' this month' : ''}
          </div>
          ${c.limit > 0 ? `
            <div style="margin-top:6px">
              <div class="progress-bar-wrap" style="height:4px">
                <div class="progress-bar-fill" style="width:${Math.min(100, usedPct)}%;background:${usedColor}"></div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:2px">
                <span style="font-size:10px;color:var(--text-muted)">${Fmt.percent(usedPct)} used</span>
                <span style="font-size:10px;color:var(--text-muted)">Limit: ${Fmt.compact(c.limit)}</span>
              </div>
            </div>
          ` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div class="asset-value negative">${Fmt.currency(c.currentBalance || 0)}</div>
          ${c.minPayment ? `<div style="font-size:10px;color:var(--text-muted)">Min: ${Fmt.currency(c.minPayment)}</div>` : ''}
        </div>
      </div>
    `;
  }

  // ── Add/Edit Account Modal ──────────────────────────────────
  function addAccount() {
    openAccountModal({ name: '', bank: '', type: 'checking', balance: 0 });
  }

  function editAccount(a) {
    openAccountModal(a);
  }

  function openAccountModal(a) {
    const isNew = !a.id;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <h2 class="modal-title">${isNew ? 'Add Account' : 'Edit Account'}</h2>

        <div class="form-group">
          <label class="form-label">Account name</label>
          <input type="text" id="acct-name" class="form-input" value="${a.name || ''}" placeholder="e.g. Nubank Checking" />
        </div>
        <div class="form-group">
          <label class="form-label">Bank</label>
          <input type="text" id="acct-bank" class="form-input" value="${a.bank || ''}" placeholder="e.g. Nubank, Itau, BB" />
        </div>
        <div class="form-group">
          <label class="form-label">Type</label>
          <select id="acct-type" class="form-input">
            <option value="checking" ${a.type === 'checking' ? 'selected' : ''}>Checking</option>
            <option value="savings" ${a.type === 'savings' ? 'selected' : ''}>Savings</option>
            <option value="investment" ${a.type === 'investment' ? 'selected' : ''}>Investment</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Current balance (R$)</label>
          <input type="number" id="acct-balance" class="form-input" value="${a.balance || ''}" placeholder="0.00" step="0.01" inputmode="decimal" />
        </div>

        <div style="display:flex;gap:var(--space-md);margin-top:var(--space-xl)">
          <button class="btn btn-secondary" style="flex:1" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          ${!isNew ? `<button class="btn" style="background:var(--red-glow);color:var(--red);border:1px solid var(--border-accent)" onclick="Accounts.deleteAccount('${a.id}',this)">Delete</button>` : ''}
          <button class="btn btn-primary" style="flex:1" onclick="Accounts.saveAccount('${a.id || ''}',this)">Save</button>
        </div>
      </div>
    `;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  async function saveAccount(existingId, btn) {
    const name = document.getElementById('acct-name').value.trim();
    const bank = document.getElementById('acct-bank').value.trim();
    const type = document.getElementById('acct-type').value;
    const balance = parseFloat(document.getElementById('acct-balance').value) || 0;

    if (!name) { App.toast('Please enter an account name', 'error'); return; }

    btn.disabled = true; btn.textContent = 'Saving...';
    try {
      await API.upsertAccount({ id: existingId || undefined, name, bank, type, balance });
      btn.closest('.modal-overlay').remove();
      App.toast('Account saved', 'success');
      render();
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Save';
      App.toast(e.message, 'error');
    }
  }

  async function deleteAccount(id, btn) {
    if (!confirm('Delete this account?')) return;
    try {
      await API.deleteAccount(id);
      btn.closest('.modal-overlay').remove();
      App.toast('Account deleted', 'success');
      render();
    } catch (e) { App.toast(e.message, 'error'); }
  }

  // ── Add/Edit Card Modal ─────────────────────────────────────
  function addCard() {
    openCardModal({ name: '', brand: '', limit: 0, currentBalance: 0, closingDay: '', dueDay: '', interestRate: '' });
  }

  function editCard(c) {
    openCardModal(c);
  }

  function openCardModal(c) {
    const isNew = !c.id;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet" style="max-height:85dvh;overflow-y:auto">
        <div class="modal-handle"></div>
        <h2 class="modal-title">${isNew ? 'Add Credit Card' : 'Edit Credit Card'}</h2>

        <div class="form-group">
          <label class="form-label">Card name</label>
          <input type="text" id="card-name" class="form-input" value="${c.name || ''}" placeholder="e.g. Nubank Visa" />
        </div>
        <div class="form-group">
          <label class="form-label">Brand / Issuer</label>
          <input type="text" id="card-brand" class="form-input" value="${c.brand || ''}" placeholder="e.g. Visa, Mastercard" />
        </div>
        <div class="form-group">
          <label class="form-label">Credit limit (R$)</label>
          <input type="number" id="card-limit" class="form-input" value="${c.limit || ''}" placeholder="5000" inputmode="decimal" />
        </div>
        <div class="form-group">
          <label class="form-label">Current balance / bill (R$)</label>
          <input type="number" id="card-balance" class="form-input" value="${c.currentBalance || ''}" placeholder="0.00" step="0.01" inputmode="decimal" />
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Closing day</label>
            <input type="number" id="card-closing" class="form-input" value="${c.closingDay || ''}" placeholder="15" min="1" max="31" />
          </div>
          <div class="form-group">
            <label class="form-label">Due day</label>
            <input type="number" id="card-due" class="form-input" value="${c.dueDay || ''}" placeholder="25" min="1" max="31" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Interest rate (% per month)</label>
          <input type="number" id="card-interest" class="form-input" value="${c.interestRate || ''}" placeholder="14.5" step="0.1" inputmode="decimal" />
        </div>
        <div class="form-group">
          <label class="form-label">Minimum payment (R$)</label>
          <input type="number" id="card-min-payment" class="form-input" value="${c.minPayment || ''}" placeholder="50" inputmode="decimal" />
        </div>

        <div style="display:flex;gap:var(--space-md);margin-top:var(--space-xl)">
          <button class="btn btn-secondary" style="flex:1" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          ${!isNew ? `<button class="btn" style="background:var(--red-glow);color:var(--red);border:1px solid var(--border-accent)" onclick="Accounts.deleteCard('${c.id}',this)">Delete</button>` : ''}
          <button class="btn btn-primary" style="flex:1" onclick="Accounts.saveCard('${c.id || ''}',this)">Save</button>
        </div>
      </div>
    `;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  async function saveCard(existingId, btn) {
    const name = document.getElementById('card-name').value.trim();
    const brand = document.getElementById('card-brand').value.trim();
    const limit = parseFloat(document.getElementById('card-limit').value) || 0;
    const currentBalance = parseFloat(document.getElementById('card-balance').value) || 0;
    const closingDay = parseInt(document.getElementById('card-closing').value) || '';
    const dueDay = parseInt(document.getElementById('card-due').value) || '';
    const interestRate = parseFloat(document.getElementById('card-interest').value) || '';
    const minPayment = parseFloat(document.getElementById('card-min-payment').value) || '';

    if (!name) { App.toast('Please enter a card name', 'error'); return; }

    btn.disabled = true; btn.textContent = 'Saving...';
    try {
      await API.upsertCreditCard({ id: existingId || undefined, name, brand, limit, currentBalance, closingDay, dueDay, interestRate, minPayment });
      btn.closest('.modal-overlay').remove();
      App.toast('Credit card saved', 'success');
      render();
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Save';
      App.toast(e.message, 'error');
    }
  }

  async function deleteCard(id, btn) {
    if (!confirm('Delete this credit card?')) return;
    try {
      await API.deleteCreditCard(id);
      btn.closest('.modal-overlay').remove();
      App.toast('Credit card deleted', 'success');
      render();
    } catch (e) { App.toast(e.message, 'error'); }
  }

  return { render, addAccount, editAccount, saveAccount, deleteAccount, addCard, editCard, saveCard, deleteCard };
})();
