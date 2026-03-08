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

      <!-- Future Faturas -->
      ${cards.length > 0 ? renderFuturasFaturas(cards) : ''}

      <!-- Installments (Parcelas) -->
      ${renderInstallments(cards)}
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

  // ── Future Faturas ──────────────────────────────────────────
  function renderFuturasFaturas(cards) {
    const allFaturas = [];
    for (const card of cards) {
      const faturas = API.getFuturasFatura(card.id, 6);
      faturas.forEach(f => {
        f.cardName = card.name;
        f.cardId = card.id;
        // Add current balance for the first month
        if (allFaturas.length === 0 || f.month === faturas[0].month) {
          f.total += card.currentBalance || 0;
          if (card.currentBalance) {
            f.items.unshift({ description: 'Current bill', amount: card.currentBalance, installment: '' });
          }
        }
      });
      allFaturas.push(...faturas);
    }

    // Group by month
    const byMonth = {};
    allFaturas.forEach(f => {
      if (!byMonth[f.month]) byMonth[f.month] = [];
      byMonth[f.month].push(f);
    });

    const months = Object.keys(byMonth).sort().slice(0, 4);
    if (months.length === 0) return '';

    return `
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Upcoming Faturas</span>
          <span class="pill pill-yellow" style="font-size:10px">Next ${months.length} months</span>
        </div>
        ${months.map(month => {
          const faturas = byMonth[month];
          const monthTotal = faturas.reduce((s, f) => s + f.total, 0);
          const monthLabel = Fmt.monthYear(month + '-01');
          return `
            <div style="margin-bottom:var(--space-md)">
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:var(--space-sm)">
                <span style="font-size:13px;font-weight:600">${monthLabel}</span>
                <span style="font-family:var(--font-mono);font-size:13px;font-weight:600;color:var(--red)">${Fmt.currency(monthTotal)}</span>
              </div>
              ${faturas.filter(f => f.total > 0).map(f => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12px">
                  <span style="color:var(--text-secondary)">
                    💳 ${App.esc(f.cardName)}
                    ${f.closingDay ? `<span style="font-size:10px;color:var(--text-muted)">· closes ${f.closingDay} · due ${f.dueDay}</span>` : ''}
                  </span>
                  <span style="font-family:var(--font-mono);color:var(--red)">${Fmt.currency(f.total)}</span>
                </div>
                ${f.items.length > 0 ? f.items.map(item => `
                  <div style="display:flex;justify-content:space-between;padding:2px 0 2px 20px;font-size:11px;color:var(--text-muted)">
                    <span>${App.esc(item.description)} ${item.installment ? `<span style="font-size:10px">(${item.installment})</span>` : ''}</span>
                    <span style="font-family:var(--font-mono)">${Fmt.currency(item.amount)}</span>
                  </div>
                `).join('') : ''}
              `).join('')}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // ── Installments (Parcelas) ─────────────────────────────────
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
            <p style="font-size:12px">No installment purchases tracked. Add one to see future card bills.</p>
          </div>
        ` : `
          <div class="asset-list">
            ${installments.map(inst => {
              const card = cards.find(c => c.id === inst.cardId);
              const now = new Date();
              const [startY, startM] = (inst.startMonth || '2026-01').split('-').map(Number);
              const monthsElapsed = (now.getFullYear() - startY) * 12 + (now.getMonth() + 1 - startM);
              const paidCount = Math.max(0, Math.min(inst.totalInstallments, monthsElapsed));
              const remaining = inst.totalInstallments - paidCount;
              const pct = (paidCount / inst.totalInstallments * 100);
              return `
                <div class="asset-item" style="cursor:pointer" onclick="Accounts.editInstallment('${App.esc(inst.id)}')">
                  <div class="asset-icon yellow">📦</div>
                  <div class="asset-info" style="flex:1;min-width:0">
                    <div class="asset-name">${App.esc(inst.description)}</div>
                    <div class="asset-sub">
                      ${card ? '💳 ' + App.esc(card.name) : 'No card'} ·
                      ${paidCount}/${inst.totalInstallments} paid · ${remaining} left
                    </div>
                    <div class="progress-bar-wrap" style="height:3px;margin-top:4px">
                      <div class="progress-bar-fill green" style="width:${pct}%"></div>
                    </div>
                  </div>
                  <div style="text-align:right;flex-shrink:0">
                    <div class="asset-value negative">${Fmt.currency(inst.monthlyAmount)}/mo</div>
                    <div style="font-size:10px;color:var(--text-muted)">${Fmt.currency(inst.totalAmount)} total</div>
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
    const isNew = !inst.id;
    const cards = Store.data.getCreditCards();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet" style="max-height:85dvh;overflow-y:auto">
        <div class="modal-handle"></div>
        <h2 class="modal-title">${isNew ? 'Add Installment' : 'Edit Installment'}</h2>

        <div class="form-group">
          <label class="form-label">Description</label>
          <input type="text" id="inst-desc" class="form-input" value="${inst.description || ''}" placeholder="e.g. iPhone 15, Sofa" />
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
            <label class="form-label">Installments</label>
            <input type="number" id="inst-count" class="form-input" value="${inst.totalInstallments || 12}" placeholder="12" min="1" max="72" inputmode="numeric"
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

        <div style="display:flex;gap:var(--space-md);margin-top:var(--space-xl)">
          <button class="btn btn-secondary" style="flex:1" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          ${!isNew ? `<button class="btn" style="background:var(--red-glow);color:var(--red);border:1px solid var(--border-accent)" onclick="Accounts.deleteInstallment('${inst.id}',this)">Delete</button>` : ''}
          <button class="btn btn-primary" style="flex:1" onclick="Accounts.saveInstallment('${inst.id || ''}',this)">Save</button>
        </div>
      </div>
    `;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  async function saveInstallment(existingId, btn) {
    const description = document.getElementById('inst-desc').value.trim();
    const cardId = document.getElementById('inst-card').value;
    const totalAmount = parseFloat(document.getElementById('inst-total').value) || 0;
    const totalInstallments = parseInt(document.getElementById('inst-count').value) || 12;
    const monthlyAmount = parseFloat(document.getElementById('inst-monthly').value) || (totalAmount / totalInstallments);
    const startMonth = document.getElementById('inst-start').value || new Date().toISOString().slice(0, 7);

    if (!description) { App.toast('Please enter a description', 'error'); return; }
    if (!cardId) { App.toast('Please select a credit card', 'error'); return; }

    btn.disabled = true; btn.textContent = 'Saving...';
    try {
      await API.upsertInstallment({ id: existingId || undefined, description, cardId, totalAmount, totalInstallments, monthlyAmount, startMonth });
      btn.closest('.modal-overlay').remove();
      App.toast('Installment saved', 'success');
      render();
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Save';
      App.toast(e.message, 'error');
    }
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
    render, addAccount, editAccount, saveAccount, deleteAccount,
    addCard, editCard, saveCard, deleteCard,
    addInstallment, editInstallment, saveInstallment, deleteInstallment
  };
})();
