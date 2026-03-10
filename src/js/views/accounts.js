/* ============================================================
   ACCOUNTS VIEW — Bank accounts, credit cards, faturas, installments
   Includes a Cash Flow tab via CashFlow module.
   ============================================================ */

const Accounts = (() => {
  let charts = {};

  async function render() {
    const container = document.getElementById('view-accounts');
    const [accounts, cards, allTx] = await Promise.all([
      API.getAccounts(),
      API.getCreditCards(),
      API.getTransactions({ month: App.state.activeMonth })
    ]);
    const loans = API.getLoans();
    const activeTab = container.dataset.activeTab || 'accounts';
    renderFull(container, accounts, cards, allTx, activeTab, loans);
  }

  function renderFull(container, accounts, cards, allTx, activeTab, loans) {
    Object.values(charts).forEach(c => c?.destroy());
    charts = {};
    const now = new Date();
    const [y, m] = App.state.activeMonth.split('-').map(Number);
    const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1;

    const totalBankBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const creditCards      = cards.filter(c => c.cardType !== 'voucher');
    const totalCardBalance = creditCards.reduce((s, c) => s + (c.currentBalance || 0), 0);
    const totalCardLimit   = creditCards.reduce((s, c) => s + (c.limit || 0), 0);
    const totalLoanBalance = (loans || []).reduce((s, l) => s + (l.remainingBalance || l.amount || 0), 0);
    const totalLoanPayment = (loans || []).reduce((s, l) => s + (l.monthlyPayment || 0), 0);

    container.innerHTML = `
      <!-- Header -->
      <div class="section-header" style="margin-bottom:var(--space-md)">
        <div>
          <div class="section-title">${activeTab === 'cashflow' ? 'Cash Flow' : 'Accounts'}</div>
          <div class="section-subtitle">${activeTab === 'cashflow' ? 'Monthly income & expense plan' : 'Bank accounts & credit cards'}</div>
        </div>
        <div class="month-nav">
          <button onclick="App.prevMonth()" aria-label="Previous month">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="month-display">${Fmt.monthYear(App.state.activeMonth + '-01')}</span>
          <button onclick="App.nextMonth()" aria-label="Next month" ${isCurrentMonth ? 'disabled style="opacity:.3"' : ''}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      <!-- Tab bar -->
      <div class="sim-tabs" style="margin-bottom:var(--space-md)">
        <button class="sim-tab ${activeTab === 'accounts' ? 'active' : ''}" onclick="Accounts.switchTab('accounts')" style="flex:1">Accounts</button>
        <button class="sim-tab ${activeTab === 'cashflow' ? 'active' : ''}" onclick="Accounts.switchTab('cashflow')" style="flex:1">Cash Flow</button>
      </div>

      <!-- Accounts tab content -->
      <div id="accounts-tab-content" ${activeTab !== 'accounts' ? 'class="hidden"' : ''}>

        <!-- Summary cards -->
        <div class="grid-${totalLoanBalance > 0 ? '3' : '2'}" style="margin-bottom:var(--space-md)">
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
          ${totalLoanBalance > 0 ? `
          <div class="card" style="text-align:center">
            <div class="stat-label">Loan Balance</div>
            <div class="stat-value negative" style="font-size:20px;margin-top:4px">${Fmt.currency(totalLoanBalance)}</div>
            <div class="t-muted" style="margin-top:4px">${Fmt.currency(totalLoanPayment)}/mo</div>
          </div>` : ''}
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

        <!-- Personal Loans / Debt -->
        <div class="card" style="margin-bottom:var(--space-md)">
          <div class="card-header">
            <span class="card-title">Loans & Debt</span>
            <button class="btn btn-ghost btn-sm" onclick="Accounts.addLoan()">+ Add</button>
          </div>
          ${!loans || loans.length === 0 ? `
            <div class="empty-state" style="padding:var(--space-lg) 0">
              <p>No loans or personal debt tracked.</p>
            </div>
          ` : `
            <div class="asset-list">
              ${loans.map(l => renderLoanItem(l)).join('')}
            </div>
            <div style="display:flex;justify-content:space-between;padding-top:var(--space-sm);border-top:1px solid var(--border);margin-top:var(--space-sm)">
              <div>
                <div style="font-size:11px;color:var(--text-muted)">Total owed</div>
                <div style="font-size:16px;font-weight:700;color:var(--red);font-family:var(--font-mono)">${Fmt.currency(totalLoanBalance)}</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:11px;color:var(--text-muted)">Monthly payments</div>
                <div style="font-size:16px;font-weight:700;color:var(--red);font-family:var(--font-mono)">${Fmt.currency(totalLoanPayment)}</div>
              </div>
            </div>
          `}
        </div>

        <!-- Debt Trajectory -->
        ${cards.length > 0 || (loans || []).length > 0 ? renderCardDebtOverview(cards, loans) : ''}

        <!-- Future Faturas -->
        ${(cards.length > 0 || (loans || []).length > 0) ? renderFuturasFaturas(cards, loans) : ''}

        <!-- Installments (Parcelas) -->
        ${renderInstallments(cards)}

      </div>

      <!-- Cash Flow tab content -->
      <div id="cashflow-tab-content" ${activeTab !== 'cashflow' ? 'class="hidden"' : ''}>
      </div>
    `;

    if (activeTab === 'cashflow') {
      CashFlow.render(document.getElementById('cashflow-tab-content'));
    }
    setTimeout(() => initDebtChart(cards, loans), 0);
  }

  function switchTab(tab) {
    const container = document.getElementById('view-accounts');
    container.dataset.activeTab = tab;

    // Update tab buttons
    container.querySelectorAll('.sim-tab').forEach((btn, i) => {
      btn.classList.toggle('active', (i === 0 && tab === 'accounts') || (i === 1 && tab === 'cashflow'));
    });

    // Update header text
    const title    = container.querySelector('.section-title');
    const subtitle = container.querySelector('.section-subtitle');
    if (title)    title.textContent    = tab === 'cashflow' ? 'Cash Flow' : 'Accounts';
    if (subtitle) subtitle.textContent = tab === 'cashflow' ? 'Monthly income & expense plan' : 'Bank accounts & credit cards';

    // Show/hide content
    const acctEl = document.getElementById('accounts-tab-content');
    const cfEl   = document.getElementById('cashflow-tab-content');
    if (acctEl) acctEl.classList.toggle('hidden', tab !== 'accounts');
    if (cfEl)   cfEl.classList.toggle('hidden', tab !== 'cashflow');

    if (tab === 'cashflow' && cfEl) {
      CashFlow.render(cfEl);
    }
  }

  // ── Account item ──────────────────────────────────────────

  function renderAccountItem(a, allTx) {
    const txCount = allTx.filter(t => t.accountId === a.id).length;
    const iconColors  = { checking: 'blue', savings: 'green', investment: 'purple' };
    const iconEmojis  = { checking: '🏦', savings: '💰', investment: '📈' };
    const color = iconColors[a.type] || 'blue';
    const emoji = iconEmojis[a.type] || '🏦';

    return `
      <div class="asset-item" style="cursor:pointer" data-account-id="${a.id}" onclick="Accounts.editAccountById('${a.id}')">
        <div class="asset-icon ${color}">${emoji}</div>
        <div class="asset-info">
          <div class="asset-name">${App.esc(a.name || 'Account')}</div>
          <div class="asset-sub">${App.esc(a.bank || '')}${a.type ? ' · ' + a.type : ''}${txCount ? ' · ' + txCount + ' tx' : ''}</div>
        </div>
        <div class="asset-value positive">${Fmt.currency(a.balance || 0)}</div>
      </div>
    `;
  }

  // ── Credit card item ──────────────────────────────────────

  function renderCardItem(c, allTx) {
    const isVoucher   = c.cardType === 'voucher';
    const txCount     = allTx.filter(t => t.accountId === c.id).length;
    const monthTxAmt  = allTx.filter(t => t.accountId === c.id && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const usedPct     = c.limit > 0 ? (c.currentBalance / c.limit * 100) : 0;
    const usedColor   = usedPct > 80 ? 'var(--red)' : usedPct > 50 ? 'var(--yellow)' : 'var(--green)';

    return `
      <div class="asset-item" style="cursor:pointer" data-card-id="${c.id}" onclick="Accounts.editCardById('${c.id}')">
        <div class="asset-icon ${isVoucher ? 'blue' : 'red'}">
          ${isVoucher
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`}
        </div>
        <div class="asset-info" style="flex:1;min-width:0">
          <div class="asset-name">
            ${App.esc(c.name || (isVoucher ? 'Voucher' : 'Credit Card'))}${c.lastFourDigits ? ' *' + App.esc(c.lastFourDigits) : ''}
            ${isVoucher ? '<span style="font-size:10px;background:var(--primary-glow);color:var(--primary);padding:1px 6px;border-radius:8px;margin-left:6px">Voucher</span>' : ''}
          </div>
          <div class="asset-sub">
            ${isVoucher
              ? (c.rechargeDay ? 'Recharges day ' + c.rechargeDay : '') + (c.rechargeAmount ? ' · ' + Fmt.currency(c.rechargeAmount) + '/mo' : '')
              : (c.closingDay ? 'Closes ' + c.closingDay : '') + (c.closingDay && txCount ? ' · ' : '') + (txCount ? txCount + ' charges' : '') + (monthTxAmt > 0 ? ' · ' + Fmt.currency(monthTxAmt) : '')}
          </div>
          ${!isVoucher && c.limit > 0 ? `
            <div style="margin-top:6px">
              <div class="progress-bar-wrap" style="height:4px">
                <div class="progress-bar-fill" style="width:${Math.min(100, usedPct)}%;background:${usedColor}"></div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:3px">
                <span style="font-size:10px;color:var(--text-muted)">${Fmt.percent(usedPct)} used</span>
                <span style="font-size:10px;color:var(--text-muted)">Limit: ${Fmt.compact(c.limit)}</span>
              </div>
            </div>
          ` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:var(--space-sm)">
          <div class="asset-value ${isVoucher ? 'positive' : 'negative'}">${Fmt.currency(c.currentBalance || 0)}</div>
          ${!isVoucher && c.minPayment ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px">Min: ${Fmt.currency(c.minPayment)}</div>` : ''}
        </div>
      </div>
    `;
  }

  // ── Account modal ─────────────────────────────────────────

  function addAccount() {
    openAccountModal({ name: '', bank: '', type: 'checking', balance: 0 });
  }

  function editAccount(a) { openAccountModal(a); }

  function editAccountById(id) {
    const a = Store.data.getAccounts().find(x => x.id === id);
    if (a) openAccountModal(a);
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
          <input type="text" id="acct-name" class="form-input" value="${App.esc(a.name || '')}" placeholder="e.g. Nubank Checking" />
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Bank</label>
            <input type="text" id="acct-bank" class="form-input" value="${App.esc(a.bank || '')}" placeholder="Nubank, Itaú…" />
          </div>
          <div class="form-group">
            <label class="form-label">Type</label>
            <select id="acct-type" class="form-input">
              <option value="checking"   ${a.type === 'checking'   ? 'selected' : ''}>Checking</option>
              <option value="savings"    ${a.type === 'savings'    ? 'selected' : ''}>Savings</option>
              <option value="investment" ${a.type === 'investment' ? 'selected' : ''}>Investment</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Current balance (R$)</label>
          <input type="number" id="acct-balance" class="form-input" value="${a.balance || ''}" placeholder="0.00" step="0.01" inputmode="decimal" />
        </div>

        <div style="display:flex;gap:var(--space-md);margin-top:var(--space-xl)">
          <button class="btn btn-secondary" style="flex:1" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          ${!isNew ? `<button class="btn" style="background:var(--red-glow);color:var(--red);border:1px solid var(--border-accent);padding:11px 14px" onclick="Accounts.deleteAccount('${a.id}',this)">Delete</button>` : ''}
          <button class="btn btn-primary" style="flex:1" onclick="Accounts.saveAccount('${a.id || ''}',this)">Save</button>
        </div>
      </div>
    `;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  async function saveAccount(existingId, btn) {
    const name    = document.getElementById('acct-name').value.trim();
    const bank    = document.getElementById('acct-bank').value.trim();
    const type    = document.getElementById('acct-type').value;
    const balance = parseFloat(document.getElementById('acct-balance').value) || 0;
    if (!name) { App.toast('Please enter an account name', 'error'); return; }
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await API.upsertAccount({ id: existingId || undefined, name, bank, type, balance });
      btn.closest('.modal-overlay').remove();
      App.toast('Account saved', 'success');
      render();
    } catch (e) { btn.disabled = false; btn.textContent = 'Save'; App.toast(e.message, 'error'); }
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

  // ── Credit card modal ─────────────────────────────────────

  function addCard() {
    openCardModal({ name: '', brand: '', lastFourDigits: '', limit: 0, currentBalance: 0, closingDay: '', dueDay: '', interestRate: '', minPayment: '', annualFee: 0, paymentAccountId: '', cardType: 'credit', rechargeDay: '', rechargeAmount: 0 });
  }

  function editCard(c) { openCardModal(c); }

  function editCardById(id) {
    const c = Store.data.getCreditCards().find(x => x.id === id);
    if (c) openCardModal(c);
  }

  function openCardModal(c) {
    const isNew    = !c.id;
    const accounts = Store.data.getAccounts();
    const modal    = document.createElement('div');
    modal.className = 'modal-overlay';
    const isVoucher = c.cardType === 'voucher';
    modal.innerHTML = `
      <div class="modal-sheet" style="max-height:85dvh;overflow-y:auto">
        <div class="modal-handle"></div>
        <h2 class="modal-title">${isNew ? 'Add Credit Card' : 'Edit Credit Card'}</h2>

        <div class="form-group">
          <label class="form-label">Card type</label>
          <select id="card-type" class="form-input" onchange="document.querySelectorAll('.credit-only').forEach(el=>el.style.display=this.value==='voucher'?'none':'');document.querySelectorAll('.voucher-only').forEach(el=>el.style.display=this.value==='voucher'?'':'none')">
            <option value="credit" ${!isVoucher ? 'selected' : ''}>Credit Card</option>
            <option value="voucher" ${isVoucher ? 'selected' : ''}>Voucher Card (VA/VR)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Card name</label>
          <input type="text" id="card-name" class="form-input" value="${App.esc(c.name || '')}" placeholder="e.g. Nubank Visa" />
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Brand / Issuer</label>
            <input type="text" id="card-brand" class="form-input" value="${App.esc(c.brand || '')}" placeholder="Visa, Mastercard…" />
          </div>
          <div class="form-group">
            <label class="form-label">Last 4 digits</label>
            <input type="text" id="card-last4" class="form-input" value="${App.esc(c.lastFourDigits || '')}" placeholder="1234" maxlength="4" inputmode="numeric" />
          </div>
        </div>
        <div class="grid-2 credit-only" style="${isVoucher ? 'display:none' : ''}">
          <div class="form-group">
            <label class="form-label">Credit limit (R$)</label>
            <input type="number" id="card-limit" class="form-input" value="${c.limit || ''}" placeholder="5000" inputmode="decimal" />
          </div>
          <div class="form-group">
            <label class="form-label">Current bill (R$)</label>
            <input type="number" id="card-balance" class="form-input" value="${c.currentBalance || ''}" placeholder="0.00" step="0.01" inputmode="decimal" />
          </div>
        </div>
        <div class="grid-2 voucher-only" style="${isVoucher ? '' : 'display:none'}">
          <div class="form-group">
            <label class="form-label">Recharge day</label>
            <input type="number" id="card-recharge-day" class="form-input" value="${c.rechargeDay || ''}" placeholder="1" min="1" max="31" inputmode="numeric" />
          </div>
          <div class="form-group">
            <label class="form-label">Recharge amount (R$)</label>
            <input type="number" id="card-recharge-amount" class="form-input" value="${c.rechargeAmount || ''}" placeholder="800" step="0.01" inputmode="decimal" />
          </div>
        </div>
        <div class="form-group voucher-only" style="${isVoucher ? '' : 'display:none'}">
          <label class="form-label">Current balance (R$)</label>
          <input type="number" id="card-voucher-balance" class="form-input" value="${isVoucher ? (c.currentBalance || '') : ''}" placeholder="500" step="0.01" inputmode="decimal" />
        </div>
        <div class="grid-2 credit-only" style="${isVoucher ? 'display:none' : ''}">
          <div class="form-group">
            <label class="form-label">Closing day</label>
            <input type="number" id="card-closing" class="form-input" value="${c.closingDay || ''}" placeholder="15" min="1" max="31" inputmode="numeric" />
          </div>
          <div class="form-group">
            <label class="form-label">Due day</label>
            <input type="number" id="card-due" class="form-input" value="${c.dueDay || ''}" placeholder="25" min="1" max="31" inputmode="numeric" />
          </div>
        </div>
        <div class="grid-2 credit-only" style="${isVoucher ? 'display:none' : ''}">
          <div class="form-group">
            <label class="form-label">Interest rate (%/mo)</label>
            <input type="number" id="card-interest" class="form-input" value="${c.interestRate || ''}" placeholder="14.5" step="0.1" inputmode="decimal" />
          </div>
          <div class="form-group">
            <label class="form-label">Min. payment (R$)</label>
            <input type="number" id="card-min-payment" class="form-input" value="${c.minPayment || ''}" placeholder="50" inputmode="decimal" />
          </div>
        </div>
        <div class="grid-2 credit-only" style="${isVoucher ? 'display:none' : ''}">
          <div class="form-group">
            <label class="form-label">Annual fee (R$)</label>
            <input type="number" id="card-annual-fee" class="form-input" value="${c.annualFee || ''}" placeholder="0" inputmode="decimal" />
          </div>
          <div class="form-group">
            <label class="form-label">Pays from account</label>
            <select id="card-payment-account" class="form-input">
              <option value="">None</option>
              ${accounts.map(a => `<option value="${a.id}" ${c.paymentAccountId === a.id ? 'selected' : ''}>${App.esc(a.name || a.bank || 'Account')}</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="display:flex;gap:var(--space-md);margin-top:var(--space-xl)">
          <button class="btn btn-secondary" style="flex:1" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          ${!isNew ? `<button class="btn" style="background:var(--red-glow);color:var(--red);border:1px solid var(--border-accent);padding:11px 14px" onclick="Accounts.deleteCard('${c.id}',this)">Delete</button>` : ''}
          <button class="btn btn-primary" style="flex:1" onclick="Accounts.saveCard('${c.id || ''}',this)">Save</button>
        </div>
      </div>
    `;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  async function saveCard(existingId, btn) {
    const cardType         = document.getElementById('card-type').value;
    const isVoucher        = cardType === 'voucher';
    const name             = document.getElementById('card-name').value.trim();
    const brand            = document.getElementById('card-brand').value.trim();
    const lastFourDigits   = document.getElementById('card-last4').value.trim();
    const limit            = isVoucher ? 0 : (parseFloat(document.getElementById('card-limit').value) || 0);
    const currentBalance   = isVoucher
      ? (parseFloat(document.getElementById('card-voucher-balance').value) || 0)
      : (parseFloat(document.getElementById('card-balance').value) || 0);
    const closingDay       = isVoucher ? '' : (parseInt(document.getElementById('card-closing').value) || '');
    const dueDay           = isVoucher ? '' : (parseInt(document.getElementById('card-due').value) || '');
    const interestRate     = isVoucher ? '' : (parseFloat(document.getElementById('card-interest').value) || '');
    const minPayment       = isVoucher ? '' : (parseFloat(document.getElementById('card-min-payment').value) || '');
    const annualFee        = isVoucher ? 0 : (parseFloat(document.getElementById('card-annual-fee').value) || 0);
    const paymentAccountId = isVoucher ? '' : (document.getElementById('card-payment-account').value || '');
    const rechargeDay      = isVoucher ? (parseInt(document.getElementById('card-recharge-day').value) || '') : '';
    const rechargeAmount   = isVoucher ? (parseFloat(document.getElementById('card-recharge-amount').value) || 0) : 0;
    if (!name) { App.toast('Please enter a card name', 'error'); return; }
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await API.upsertCreditCard({ id: existingId || undefined, cardType, name, brand, lastFourDigits, limit, currentBalance, closingDay, dueDay, interestRate, minPayment, annualFee, paymentAccountId, rechargeDay, rechargeAmount });
      btn.closest('.modal-overlay').remove();
      App.toast('Credit card saved', 'success');
      render();
    } catch (e) { btn.disabled = false; btn.textContent = 'Save'; App.toast(e.message, 'error'); }
  }

  async function deleteCard(id, btn) {
    if (!confirm('Delete this credit card?')) return;
    try {
      await API.deleteCreditCard(id);
      btn.closest('.modal-overlay').remove();
      App.toast('Card deleted', 'success');
      render();
    } catch (e) { App.toast(e.message, 'error'); }
  }

  // ── Future Faturas — dynamic timeline ────────────────────

  function renderFuturasFaturas(cards, loans) {
    const now = new Date();
    const installments    = API.getInstallments();
    const allManualFaturas = API.getFaturas();
    // Only show credit cards (not vouchers) in faturas table
    const creditCards = cards.filter(c => c.cardType !== 'voucher');
    const activeLoans = (loans || []).filter(l => (l.remainingBalance || l.amount || 0) > 0);

    // Compute how many months to show: cover all active installments, min 12
    let maxMonths = 12;
    for (const inst of installments) {
      const [sY, sM] = (inst.startMonth || '').split('-').map(Number);
      if (!sY) continue;
      const monthsUntilEnd = (sY - now.getFullYear()) * 12 + (sM - (now.getMonth() + 1)) + (inst.totalInstallments || 0);
      if (monthsUntilEnd > maxMonths) maxMonths = monthsUntilEnd;
    }
    // Also extend if there are manual faturas beyond 12 months
    for (const f of allManualFaturas) {
      const [fY, fM] = (f.month || '').split('-').map(Number);
      if (!fY) continue;
      const diff = (fY - now.getFullYear()) * 12 + (fM - (now.getMonth() + 1)) + 1;
      if (diff > maxMonths) maxMonths = diff;
    }
    // Extend for loan durations
    for (const loan of activeLoans) {
      if (loan.remainingMonths && loan.remainingMonths > maxMonths) maxMonths = loan.remainingMonths;
    }

    // Build month keys
    const months = [];
    for (let i = 0; i < maxMonths; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    return `
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Future Faturas</span>
          <span class="pill pill-yellow" style="font-size:10px">${maxMonths} months</span>
        </div>
        <p style="font-size:11px;color:var(--text-muted);margin-bottom:var(--space-md)">
          Enter expected fatura for each card per month. Open your card app to check upcoming bills.
          Installments (parcelas) shown as reference below each cell.
        </p>

        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
          <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:${80 + months.length * 90}px">
            <thead>
              <tr>
                <th style="text-align:left;padding:6px 8px;font-weight:600;border-bottom:1px solid var(--border);position:sticky;left:0;z-index:2;background:var(--bg-card);min-width:90px;white-space:nowrap">Card / Loan</th>
                ${months.map(mo => `
                  <th style="text-align:center;padding:6px 4px;font-weight:600;border-bottom:1px solid var(--border);min-width:90px;white-space:nowrap;${mo === Fmt.currentMonthKey() ? 'color:var(--primary)' : ''}">${Fmt.monthYear(mo + '-01')}</th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${creditCards.map(card => {
                const cardFaturas = allManualFaturas.filter(f => f.cardId === card.id);
                const cardInst    = installments.filter(i => i.cardId === card.id);
                return `
                  <tr>
                    <td style="padding:8px;border-bottom:1px solid var(--border);position:sticky;left:0;z-index:1;background:var(--bg-card)">
                      <div style="font-weight:500;white-space:nowrap">${App.esc(card.name)}</div>
                      ${card.lastFourDigits ? `<div style="font-size:10px;color:var(--text-muted)">*${App.esc(card.lastFourDigits)}</div>` : ''}
                    </td>
                    ${months.map(mo => {
                      const manual = cardFaturas.find(f => f.month === mo);
                      let instTotal = 0;
                      for (const inst of cardInst) {
                        const [sY, sM] = (inst.startMonth || '').split('-').map(Number);
                        const [moY, moM] = mo.split('-').map(Number);
                        if (!sY) continue;
                        const diff = (moY - sY) * 12 + (moM - sM);
                        if (diff >= 0 && diff < inst.totalInstallments) instTotal += inst.monthlyAmount;
                      }
                      const val = manual ? manual.amount : '';
                      const isCurrent = mo === Fmt.currentMonthKey();
                      return `
                        <td style="padding:4px;border-bottom:1px solid var(--border);text-align:center${isCurrent ? ';background:var(--primary-glow)' : ''}">
                          <input type="number" class="form-input fatura-input"
                            data-card-id="${card.id}" data-month="${mo}"
                            value="${val}"
                            placeholder="${instTotal > 0 ? Fmt.compact(instTotal) : '0'}"
                            style="width:82px;text-align:center;font-size:12px;padding:4px 6px;height:34px"
                            inputmode="decimal" step="0.01"
                            onchange="Accounts.saveFatura('${card.id}','${mo}',this.value)" />
                          ${instTotal > 0 ? `<div style="font-size:9px;color:var(--text-muted);margin-top:2px">${Fmt.compact(instTotal)}</div>` : ''}
                        </td>
                      `;
                    }).join('')}
                  </tr>
                `;
              }).join('')}
              ${activeLoans.length > 0 ? `
              <tr><td colspan="${months.length + 1}" style="padding:4px 8px;font-size:10px;font-weight:600;color:var(--text-muted);border-bottom:1px solid var(--border);background:var(--bg-input)">LOANS</td></tr>
              ${activeLoans.map(loan => {
                return `
                  <tr>
                    <td style="padding:8px;border-bottom:1px solid var(--border);position:sticky;left:0;z-index:1;background:var(--bg-card)">
                      <div style="font-weight:500;white-space:nowrap">${App.esc(loan.name || loan.description || 'Loan')}</div>
                      <div style="font-size:10px;color:var(--text-muted)">${Fmt.compact(loan.monthlyPayment || 0)}/mo</div>
                    </td>
                    ${months.map(mo => {
                      const manualLoan = allManualFaturas.find(f => f.loanId === loan.id && f.month === mo);
                      const val = manualLoan ? manualLoan.amount : '';
                      const fallback = loan.monthlyPayment || 0;
                      const isCurrent = mo === Fmt.currentMonthKey();
                      return `
                        <td style="padding:4px;border-bottom:1px solid var(--border);text-align:center${isCurrent ? ';background:var(--primary-glow)' : ''}">
                          <input type="number" class="form-input fatura-input"
                            data-loan-id="${loan.id}" data-month="${mo}"
                            value="${val}"
                            placeholder="${fallback > 0 ? Fmt.compact(fallback) : '0'}"
                            style="width:82px;text-align:center;font-size:12px;padding:4px 6px;height:34px"
                            inputmode="decimal" step="0.01"
                            onchange="Accounts.saveLoanFatura('${loan.id}','${mo}',this.value)" />
                        </td>
                      `;
                    }).join('')}
                  </tr>
                `;
              }).join('')}` : ''}
              <!-- Totals row -->
              <tr style="font-weight:600;background:var(--bg-input)">
                <td style="padding:8px;position:sticky;left:0;z-index:1;background:var(--bg-input)">Total</td>
                ${months.map(mo => {
                  let moTotal = 0;
                  for (const card of creditCards) {
                    const manual = allManualFaturas.find(f => f.cardId === card.id && f.month === mo);
                    if (manual) {
                      moTotal += manual.amount;
                    } else {
                      for (const inst of installments.filter(i => i.cardId === card.id)) {
                        const [sY, sM] = (inst.startMonth || '').split('-').map(Number);
                        const [moY, moM] = mo.split('-').map(Number);
                        if (!sY) continue;
                        const diff = (moY - sY) * 12 + (moM - sM);
                        if (diff >= 0 && diff < inst.totalInstallments) moTotal += inst.monthlyAmount;
                      }
                    }
                  }
                  // Add loan payments
                  for (const loan of activeLoans) {
                    moTotal += API.getLoanFaturaAmount(loan.id, mo, loan.monthlyPayment);
                  }
                  return `<td style="padding:8px 4px;text-align:center;font-family:var(--font-mono);font-size:12px;color:${moTotal > 0 ? 'var(--red)' : 'var(--text-muted)'}">${moTotal > 0 ? Fmt.compact(moTotal) : '—'}</td>`;
                }).join('')}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function saveFatura(cardId, month, value) {
    API.setFatura(cardId, month, value);
  }

  function saveLoanFatura(loanId, month, value) {
    API.setLoanFatura(loanId, month, value);
  }

  // ── Installments (Parcelas) ───────────────────────────────

  function renderInstallments(cards) {
    const installments = API.getInstallments();
    return `
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Installments (Parcelas)</span>
          <button class="btn btn-ghost btn-sm" onclick="Accounts.addInstallment()">+ Add</button>
        </div>
        ${installments.length === 0 ? `
          <div class="empty-state" style="padding:var(--space-md) 0">
            <p style="font-size:12px">No installments tracked. Add a parcela to project future card bills.</p>
          </div>
        ` : `
          <div class="asset-list">
            ${installments.map(inst => {
              const card = cards.find(c => c.id === inst.cardId);
              const now = new Date();
              const [sY, sM] = (inst.startMonth || '2026-01').split('-').map(Number);
              const monthsElapsed = (now.getFullYear() - sY) * 12 + (now.getMonth() + 1 - sM);
              const paidCount = Math.max(0, Math.min(inst.totalInstallments, monthsElapsed));
              const remaining = inst.totalInstallments - paidCount;
              const pct = paidCount / inst.totalInstallments * 100;
              return `
                <div class="asset-item" style="cursor:pointer" onclick="Accounts.editInstallment('${App.esc(inst.id)}')">
                  <div class="asset-icon yellow">📦</div>
                  <div class="asset-info" style="flex:1;min-width:0">
                    <div class="asset-name">${App.esc(inst.description)}</div>
                    <div class="asset-sub">
                      ${card ? '💳 ' + App.esc(card.name) : 'No card'} · ${paidCount}/${inst.totalInstallments} paid · ${remaining} left
                    </div>
                    <div class="progress-bar-wrap" style="height:3px;margin-top:5px">
                      <div class="progress-bar-fill green" style="width:${pct}%"></div>
                    </div>
                  </div>
                  <div style="text-align:right;flex-shrink:0;margin-left:var(--space-sm)">
                    <div class="asset-value negative" style="font-size:15px">${Fmt.currency(inst.monthlyAmount)}/mo</div>
                    <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${Fmt.currency(inst.totalAmount)} total</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  }

  function addInstallment() {
    openInstallmentModal({
      description: '', cardId: '', totalAmount: 0, totalInstallments: 12,
      monthlyAmount: 0, startMonth: new Date().toISOString().slice(0, 7)
    });
  }

  function editInstallment(id) {
    const inst = API.getInstallments().find(i => i.id === id);
    if (inst) openInstallmentModal(inst);
  }

  function openInstallmentModal(inst) {
    const isNew  = !inst.id;
    const cards  = Store.data.getCreditCards();
    const modal  = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet" style="max-height:85dvh;overflow-y:auto">
        <div class="modal-handle"></div>
        <h2 class="modal-title">${isNew ? 'Add Installment' : 'Edit Installment'}</h2>

        <div class="form-group">
          <label class="form-label">Description</label>
          <input type="text" id="inst-desc" class="form-input" value="${App.esc(inst.description || '')}" placeholder="e.g. iPhone 15, Sofa, Notebook" />
        </div>
        <div class="form-group">
          <label class="form-label">Credit Card</label>
          <select id="inst-card" class="form-input">
            <option value="">Select a card</option>
            ${cards.map(c => `<option value="${c.id}" ${c.id === inst.cardId ? 'selected' : ''}>💳 ${App.esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Total amount (R$)</label>
            <input type="number" id="inst-total" class="form-input" value="${inst.totalAmount || ''}" placeholder="5000" inputmode="decimal"
              oninput="var t=parseFloat(this.value)||0,n=parseInt(document.getElementById('inst-count').value)||1;document.getElementById('inst-monthly').value=(t/n).toFixed(2)" />
          </div>
          <div class="form-group">
            <label class="form-label">Installments (e.g. 48x)</label>
            <input type="number" id="inst-count" class="form-input" value="${inst.totalInstallments || 12}" placeholder="12" min="1"
              inputmode="numeric"
              oninput="var t=parseFloat(document.getElementById('inst-total').value)||0,n=parseInt(this.value)||1;document.getElementById('inst-monthly').value=(t/n).toFixed(2)" />
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Monthly amount (R$)</label>
            <input type="number" id="inst-monthly" class="form-input" value="${inst.monthlyAmount || ''}" placeholder="416.67" step="0.01" inputmode="decimal" />
          </div>
          <div class="form-group">
            <label class="form-label">Start month</label>
            <input type="month" id="inst-start" class="form-input" value="${inst.startMonth || new Date().toISOString().slice(0, 7)}" />
          </div>
        </div>
        ${inst.totalInstallments > 24 ? `
          <div style="font-size:12px;color:var(--text-muted);margin-top:var(--space-xs)">
            This installment will appear in the fatura table for ${inst.totalInstallments} months.
          </div>
        ` : ''}

        <div style="display:flex;gap:var(--space-md);margin-top:var(--space-xl)">
          <button class="btn btn-secondary" style="flex:1" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          ${!isNew ? `<button class="btn" style="background:var(--red-glow);color:var(--red);border:1px solid var(--border-accent);padding:11px 14px" onclick="Accounts.deleteInstallment('${inst.id}',this)">Delete</button>` : ''}
          <button class="btn btn-primary" style="flex:1" onclick="Accounts.saveInstallment('${inst.id || ''}',this)">Save</button>
        </div>
      </div>
    `;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  async function saveInstallment(existingId, btn) {
    const description    = document.getElementById('inst-desc').value.trim();
    const cardId         = document.getElementById('inst-card').value;
    const totalAmount    = parseFloat(document.getElementById('inst-total').value) || 0;
    const totalInstallments = parseInt(document.getElementById('inst-count').value) || 12;
    const monthlyAmount  = parseFloat(document.getElementById('inst-monthly').value) || (totalAmount / totalInstallments);
    const startMonth     = document.getElementById('inst-start').value || new Date().toISOString().slice(0, 7);
    if (!description) { App.toast('Please enter a description', 'error'); return; }
    if (!cardId)      { App.toast('Please select a credit card', 'error'); return; }
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await API.upsertInstallment({ id: existingId || undefined, description, cardId, totalAmount, totalInstallments, monthlyAmount, startMonth });
      btn.closest('.modal-overlay').remove();
      App.toast('Installment saved', 'success');
      render();
    } catch (e) { btn.disabled = false; btn.textContent = 'Save'; App.toast(e.message, 'error'); }
  }

  async function deleteInstallment(id, btn) {
    if (!confirm('Delete this installment?')) return;
    try {
      await API.deleteInstallment(id);
      btn.closest('.modal-overlay').remove();
      App.toast('Installment deleted', 'success');
      render();
    } catch (e) { App.toast(e.message, 'error'); }
  }

  // ── Debt Trajectory ───────────────────────────────────────

  function getMonthlyTotals(cards, months, loans) {
    const now          = new Date();
    const installments = API.getInstallments();
    const faturas      = API.getFaturas();
    const PT_MONTHS    = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const result       = [];

    for (let i = 0; i < months; i++) {
      const d  = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const mo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      let total = 0;

      for (const card of cards) {
        const manual = faturas.find(f => f.cardId === card.id && f.month === mo);
        if (manual) {
          total += manual.amount;
        } else {
          for (const inst of installments.filter(i => i.cardId === card.id)) {
            const [sY, sM] = (inst.startMonth || '').split('-').map(Number);
            if (!sY) continue;
            const diff = (d.getFullYear() - sY) * 12 + (d.getMonth() + 1 - sM);
            if (diff >= 0 && diff < inst.totalInstallments) total += inst.monthlyAmount;
          }
        }
      }

      // Include loan monthly payments
      for (const loan of (loans || [])) {
        if ((loan.remainingBalance || loan.amount || 0) > 0) {
          total += loan.monthlyPayment || 0;
        }
      }

      result.push({ month: mo, label: `${PT_MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, total });
    }

    return result;
  }

  function renderCardDebtOverview(cards, loans) {
    const now          = new Date();
    const installments = API.getInstallments();
    const profile      = Store.profile.get();

    // Total current debt (cards + loans)
    const totalCurrentDebt = cards.reduce((s, c) => s + (c.currentBalance || 0), 0)
      + (loans || []).reduce((s, l) => s + (l.remainingBalance || l.amount || 0), 0);

    // Total remaining installment commitment
    let totalCommitted = 0;
    let latestEndMonth = null;
    for (const inst of installments) {
      const [sY, sM] = (inst.startMonth || '').split('-').map(Number);
      if (!sY) continue;
      const elapsed   = (now.getFullYear() - sY) * 12 + (now.getMonth() + 1 - sM);
      const remaining = Math.max(0, inst.totalInstallments - elapsed);
      totalCommitted += remaining * inst.monthlyAmount;

      const endMoAbs  = (sY * 12 + sM - 1) + inst.totalInstallments - 1;
      const endYear   = Math.floor(endMoAbs / 12);
      const endMonth  = (endMoAbs % 12) + 1;
      const endKey    = `${endYear}-${String(endMonth).padStart(2, '0')}`;
      if (!latestEndMonth || endKey > latestEndMonth) latestEndMonth = endKey;
    }

    // Include loan payment commitments
    for (const loan of (loans || [])) {
      if ((loan.remainingBalance || loan.amount || 0) > 0 && loan.monthlyPayment) {
        totalCommitted += loan.remainingBalance || loan.amount || 0;
      }
    }

    const payoffDisplay = latestEndMonth ? Fmt.monthYear(latestEndMonth + '-01') : 'None';
    const monthlyData   = getMonthlyTotals(cards, 1, loans);
    const thisMonthTotal = monthlyData[0]?.total || 0;

    // "Live on the 15th" — can the adiantamento cover this month's card bills?
    const adiantamento  = profile.adiantamentoAmount > 0
      ? profile.adiantamentoAmount
      : (profile.paymentSchedule || []).find(p => p.label === 'Adiantamento')?.amount
        || (profile.salary * 0.4);
    const liveOn15Pct   = thisMonthTotal > 0 ? Math.min(100, adiantamento / thisMonthTotal * 100) : 0;
    const liveOn15Color = liveOn15Pct >= 100 ? 'var(--green)' : liveOn15Pct >= 70 ? 'var(--yellow)' : 'var(--red)';

    return `
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Debt Trajectory</span>
          <span class="pill ${totalCommitted > 0 ? 'pill-red' : 'pill-green'}" style="font-size:10px">
            ${totalCommitted > 0 ? 'Active parcelas' : 'Debt-free'}
          </span>
        </div>

        <div class="grid-3" style="margin-bottom:var(--space-md)">
          <div style="text-align:center;padding:var(--space-sm);background:var(--bg-input);border-radius:var(--radius-md)">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px">Current Balance</div>
            <div style="font-size:14px;font-weight:700;color:var(--red)">${Fmt.compact(totalCurrentDebt)}</div>
          </div>
          <div style="text-align:center;padding:var(--space-sm);background:var(--bg-input);border-radius:var(--radius-md)">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px">Committed</div>
            <div style="font-size:14px;font-weight:700;color:var(--yellow)">${Fmt.compact(totalCommitted)}</div>
          </div>
          <div style="text-align:center;padding:var(--space-sm);background:var(--bg-input);border-radius:var(--radius-md)">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px">Payoff</div>
            <div style="font-size:13px;font-weight:700;color:${latestEndMonth ? 'var(--green)' : 'var(--text-muted)'}">${payoffDisplay}</div>
          </div>
        </div>

        <!-- 12-month fatura bar chart -->
        <div style="position:relative;height:160px;margin-bottom:var(--space-md)">
          <canvas id="debt-trajectory-chart"></canvas>
        </div>

        <!-- Live on the 15th -->
        <div style="border-top:1px solid var(--border);padding-top:var(--space-md)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:12px;font-weight:500">💡 Live on the 15th</span>
            <span style="font-size:12px;font-weight:600;color:${liveOn15Color}">${Math.round(liveOn15Pct)}%</span>
          </div>
          <div class="progress-bar-wrap" style="height:8px">
            <div class="progress-bar-fill" style="width:${Math.min(100, liveOn15Pct)}%;background:${liveOn15Color};transition:width .4s"></div>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:5px">
            Adiantamento ${Fmt.currency(adiantamento)} vs. this month's card bills ${Fmt.currency(thisMonthTotal)}
            ${liveOn15Pct >= 100 ? ' ✅ You can fully cover this month\'s bills with your advance.' : ''}
          </div>
        </div>
      </div>
    `;
  }

  function initDebtChart(cards, loans) {
    const canvas = document.getElementById('debt-trajectory-chart');
    if (!canvas || (!cards.length && !(loans || []).length)) return;

    const monthlyData  = getMonthlyTotals(cards, 12, loans);
    const currentMoKey = Fmt.currentMonthKey();
    const isDark       = document.documentElement.getAttribute('data-theme') === 'dark';

    const gridColor   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    const tickColor   = isDark ? '#a0a0a0' : '#6b7280';
    const axisColor   = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
    const tooltipOpts = isDark
      ? { backgroundColor: '#141414', borderColor: '#333', borderWidth: 1, titleColor: '#fff', bodyColor: '#a0a0a0' }
      : { backgroundColor: '#fff', borderColor: '#e5e5e7', borderWidth: 1, titleColor: '#1a1a2e', bodyColor: '#6b7280' };

    const bgColors     = monthlyData.map(d => d.month === currentMoKey ? 'rgba(239,68,68,0.75)' : 'rgba(239,68,68,0.28)');
    const borderColors = monthlyData.map(d => d.month === currentMoKey ? 'rgba(239,68,68,1)' : 'rgba(239,68,68,0.55)');

    if (charts.debtTrajectory) charts.debtTrajectory.destroy();
    charts.debtTrajectory = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: monthlyData.map(d => d.label),
        datasets: [{
          label: 'Total Fatura',
          data: monthlyData.map(d => d.total),
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipOpts, padding: 10, cornerRadius: 8,
            callbacks: { label: ctx => ` ${Fmt.currency(ctx.raw)}` }
          }
        },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 10 } }, border: { color: axisColor } },
          y: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 10 }, callback: v => Fmt.compact(v) }, border: { color: axisColor } }
        }
      }
    });
  }

  // ── Loan item ────────────────────────────────────────────

  function renderLoanItem(l) {
    const paidPct = l.amount > 0 ? ((l.amount - (l.remainingBalance || l.amount)) / l.amount * 100) : 0;
    return `
      <div class="asset-item" style="cursor:pointer" onclick="Accounts.editLoan('${l.id}')">
        <div class="asset-icon red">🏦</div>
        <div class="asset-info" style="flex:1;min-width:0">
          <div class="asset-name">${App.esc(l.name || 'Loan')}</div>
          <div class="asset-sub">
            ${l.monthlyPayment ? Fmt.currency(l.monthlyPayment) + '/mo' : ''}
            ${l.interestRate ? ' · ' + l.interestRate + '% rate' : ''}
          </div>
          ${l.amount > 0 ? `
            <div style="margin-top:6px">
              <div class="progress-bar-wrap" style="height:4px">
                <div class="progress-bar-fill" style="width:${Math.min(100, paidPct)}%;background:var(--green)"></div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:3px">
                <span style="font-size:10px;color:var(--text-muted)">${Fmt.percent(paidPct)} paid off</span>
                <span style="font-size:10px;color:var(--text-muted)">Original: ${Fmt.compact(l.amount)}</span>
              </div>
            </div>
          ` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:var(--space-sm)">
          <div class="asset-value negative">${Fmt.currency(l.remainingBalance || l.amount || 0)}</div>
        </div>
      </div>
    `;
  }

  // ── Loan modal ──────────────────────────────────────────

  function addLoan() {
    openLoanModal({ name: '', amount: 0, remainingBalance: 0, monthlyPayment: 0, interestRate: 0 });
  }

  function editLoan(id) {
    const loans = API.getLoans();
    const l = loans.find(x => x.id === id);
    if (l) openLoanModal(l);
  }

  function openLoanModal(l) {
    const isNew = !l.id;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <h2 class="modal-title">${isNew ? 'Add Loan' : 'Edit Loan'}</h2>

        <div class="form-group">
          <label class="form-label">Loan name</label>
          <input type="text" id="loan-name" class="form-input" value="${App.esc(l.name || '')}" placeholder="e.g. Car loan, Personal loan" />
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Original amount</label>
            <input type="number" id="loan-amount" class="form-input" inputmode="decimal" value="${l.amount || ''}" placeholder="0" />
          </div>
          <div class="form-group">
            <label class="form-label">Remaining balance</label>
            <input type="number" id="loan-remaining" class="form-input" inputmode="decimal" value="${l.remainingBalance || ''}" placeholder="0" />
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Monthly payment</label>
            <input type="number" id="loan-payment" class="form-input" inputmode="decimal" value="${l.monthlyPayment || ''}" placeholder="0" />
          </div>
          <div class="form-group">
            <label class="form-label">Interest rate (%)</label>
            <input type="number" id="loan-rate" class="form-input" inputmode="decimal" value="${l.interestRate || ''}" placeholder="0" step="0.1" />
          </div>
        </div>

        <div style="display:flex;gap:var(--space-sm);margin-top:var(--space-lg)">
          ${!isNew ? `<button class="btn btn-secondary" style="color:var(--red)" onclick="Accounts.deleteLoanConfirm('${l.id}')">Delete</button>` : ''}
          <button class="btn btn-secondary" style="flex:1" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <button class="btn btn-primary" style="flex:1" onclick="Accounts.saveLoan('${l.id || ''}')">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  async function saveLoan(existingId) {
    const name = document.getElementById('loan-name')?.value.trim();
    const amount = parseFloat(document.getElementById('loan-amount')?.value) || 0;
    const remainingBalance = parseFloat(document.getElementById('loan-remaining')?.value) || 0;
    const monthlyPayment = parseFloat(document.getElementById('loan-payment')?.value) || 0;
    const interestRate = parseFloat(document.getElementById('loan-rate')?.value) || 0;

    if (!name) { App.toast('Enter a loan name', 'error'); return; }

    const loan = { name, amount, remainingBalance, monthlyPayment, interestRate };
    if (existingId) loan.id = existingId;

    await API.upsertLoan(loan);
    document.querySelector('.modal-overlay')?.remove();
    App.toast(existingId ? 'Loan updated' : 'Loan added', 'success');
    await render();
  }

  async function deleteLoanConfirm(id) {
    if (!confirm('Delete this loan?')) return;
    await API.deleteLoan(id);
    document.querySelector('.modal-overlay')?.remove();
    App.toast('Loan deleted', 'success');
    await render();
  }

  return {
    render, switchTab,
    addAccount, editAccount, editAccountById, saveAccount, deleteAccount,
    addCard, editCard, editCardById, saveCard, deleteCard,
    addInstallment, editInstallment, saveInstallment, deleteInstallment,
    saveFatura, saveLoanFatura,
    addLoan, editLoan, saveLoan, deleteLoanConfirm
  };
})();
