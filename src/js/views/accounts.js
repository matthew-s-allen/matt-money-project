/* ============================================================
   ACCOUNTS VIEW — Bank accounts, credit cards, faturas, installments
   Includes a Cash Flow tab via CashFlow module.
   ============================================================ */

const Accounts = (() => {

  async function render() {
    const container = document.getElementById('view-accounts');
    const [accounts, cards, allTx] = await Promise.all([
      API.getAccounts(),
      API.getCreditCards(),
      API.getTransactions({ month: App.state.activeMonth })
    ]);
    const activeTab = container.dataset.activeTab || 'accounts';
    renderFull(container, accounts, cards, allTx, activeTab);
  }

  function renderFull(container, accounts, cards, allTx, activeTab) {
    const now = new Date();
    const [y, m] = App.state.activeMonth.split('-').map(Number);
    const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1;

    const totalBankBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const totalCardBalance = cards.reduce((s, c) => s + (c.currentBalance || 0), 0);
    const totalCardLimit   = cards.reduce((s, c) => s + (c.limit || 0), 0);

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

        <!-- Future Faturas -->
        ${cards.length > 0 ? renderFuturasFaturas(cards) : ''}

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
    const txCount     = allTx.filter(t => t.accountId === c.id).length;
    const monthTxAmt  = allTx.filter(t => t.accountId === c.id && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const usedPct     = c.limit > 0 ? (c.currentBalance / c.limit * 100) : 0;
    const usedColor   = usedPct > 80 ? 'var(--red)' : usedPct > 50 ? 'var(--yellow)' : 'var(--green)';

    return `
      <div class="asset-item" style="cursor:pointer" data-card-id="${c.id}" onclick="Accounts.editCardById('${c.id}')">
        <div class="asset-icon red">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        </div>
        <div class="asset-info" style="flex:1;min-width:0">
          <div class="asset-name">${App.esc(c.name || 'Credit Card')}${c.lastFourDigits ? ' *' + App.esc(c.lastFourDigits) : ''}</div>
          <div class="asset-sub">
            ${c.closingDay ? 'Closes ' + c.closingDay : ''}${c.closingDay && txCount ? ' · ' : ''}${txCount ? txCount + ' charges' : ''}${monthTxAmt > 0 ? ' · ' + Fmt.currency(monthTxAmt) : ''}
          </div>
          ${c.limit > 0 ? `
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
          <div class="asset-value negative">${Fmt.currency(c.currentBalance || 0)}</div>
          ${c.minPayment ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px">Min: ${Fmt.currency(c.minPayment)}</div>` : ''}
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
    openCardModal({ name: '', brand: '', lastFourDigits: '', limit: 0, currentBalance: 0, closingDay: '', dueDay: '', interestRate: '', minPayment: '', annualFee: 0, paymentAccountId: '' });
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
    modal.innerHTML = `
      <div class="modal-sheet" style="max-height:85dvh;overflow-y:auto">
        <div class="modal-handle"></div>
        <h2 class="modal-title">${isNew ? 'Add Credit Card' : 'Edit Credit Card'}</h2>

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
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Credit limit (R$)</label>
            <input type="number" id="card-limit" class="form-input" value="${c.limit || ''}" placeholder="5000" inputmode="decimal" />
          </div>
          <div class="form-group">
            <label class="form-label">Current bill (R$)</label>
            <input type="number" id="card-balance" class="form-input" value="${c.currentBalance || ''}" placeholder="0.00" step="0.01" inputmode="decimal" />
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Closing day</label>
            <input type="number" id="card-closing" class="form-input" value="${c.closingDay || ''}" placeholder="15" min="1" max="31" inputmode="numeric" />
          </div>
          <div class="form-group">
            <label class="form-label">Due day</label>
            <input type="number" id="card-due" class="form-input" value="${c.dueDay || ''}" placeholder="25" min="1" max="31" inputmode="numeric" />
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Interest rate (%/mo)</label>
            <input type="number" id="card-interest" class="form-input" value="${c.interestRate || ''}" placeholder="14.5" step="0.1" inputmode="decimal" />
          </div>
          <div class="form-group">
            <label class="form-label">Min. payment (R$)</label>
            <input type="number" id="card-min-payment" class="form-input" value="${c.minPayment || ''}" placeholder="50" inputmode="decimal" />
          </div>
        </div>
        <div class="grid-2">
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
    const name             = document.getElementById('card-name').value.trim();
    const brand            = document.getElementById('card-brand').value.trim();
    const lastFourDigits   = document.getElementById('card-last4').value.trim();
    const limit            = parseFloat(document.getElementById('card-limit').value) || 0;
    const currentBalance   = parseFloat(document.getElementById('card-balance').value) || 0;
    const closingDay       = parseInt(document.getElementById('card-closing').value) || '';
    const dueDay           = parseInt(document.getElementById('card-due').value) || '';
    const interestRate     = parseFloat(document.getElementById('card-interest').value) || '';
    const minPayment       = parseFloat(document.getElementById('card-min-payment').value) || '';
    const annualFee        = parseFloat(document.getElementById('card-annual-fee').value) || 0;
    const paymentAccountId = document.getElementById('card-payment-account').value || '';
    if (!name) { App.toast('Please enter a card name', 'error'); return; }
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await API.upsertCreditCard({ id: existingId || undefined, name, brand, lastFourDigits, limit, currentBalance, closingDay, dueDay, interestRate, minPayment, annualFee, paymentAccountId });
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

  function renderFuturasFaturas(cards) {
    const now = new Date();
    const installments    = API.getInstallments();
    const allManualFaturas = API.getFaturas();

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
                <th style="text-align:left;padding:6px 8px;font-weight:600;border-bottom:1px solid var(--border);position:sticky;left:0;z-index:2;background:var(--bg-card);min-width:90px;white-space:nowrap">Card</th>
                ${months.map(mo => `
                  <th style="text-align:center;padding:6px 4px;font-weight:600;border-bottom:1px solid var(--border);min-width:90px;white-space:nowrap;${mo === Fmt.currentMonthKey() ? 'color:var(--primary)' : ''}">${Fmt.monthYear(mo + '-01')}</th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${cards.map(card => {
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
              <!-- Totals row -->
              <tr style="font-weight:600;background:var(--bg-input)">
                <td style="padding:8px;position:sticky;left:0;z-index:1;background:var(--bg-input)">Total</td>
                ${months.map(mo => {
                  let moTotal = 0;
                  for (const card of cards) {
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

  return {
    render, switchTab,
    addAccount, editAccount, editAccountById, saveAccount, deleteAccount,
    addCard, editCard, editCardById, saveCard, deleteCard,
    addInstallment, editInstallment, saveInstallment, deleteInstallment,
    saveFatura
  };
})();
