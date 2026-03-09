/* ============================================================
   CASH FLOW VIEW — Monthly income/expense planning
   Rendered as a tab inside the Accounts view.
   ============================================================ */

const CashFlow = (() => {

  function render(container) {
    const month = App.state.activeMonth;
    const profile = Store.profile.get();
    const accounts = Store.data.getAccounts();
    const cards = Store.data.getCreditCards();
    const loans = Store.data.getLoans();
    const cfData = API.getCashFlowMonth(month);
    const allTx = Store.data.getTransactions().filter(t => t.date?.startsWith(month));

    // Income for this month (overrides take priority over profile)
    const adiantamentoDay = profile.adiantamentoDay || 15;
    const salaryDay = profile.salaryDay || 30;
    const adiantamento = cfData.adiantamentoOverride != null
      ? cfData.adiantamentoOverride
      : (profile.adiantamentoAmount || 0);
    const salary = cfData.salaryOverride != null
      ? cfData.salaryOverride
      : (profile.salary || 0);

    // Split actual transactions by period
    const earlyTx = allTx.filter(t => parseInt((t.date || '').slice(8)) < adiantamentoDay);
    const lateTx  = allTx.filter(t => parseInt((t.date || '').slice(8)) >= adiantamentoDay);

    const earlyExpActual  = earlyTx.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
    const earlyIncActual  = earlyTx.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
    const lateExpActual   = lateTx.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
    const lateIncActual   = lateTx.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);

    // Planned expenses
    const earlyPlanned = (cfData.plannedExpenses || []).filter(e => e.period === 'early');
    const latePlanned  = (cfData.plannedExpenses || []).filter(e => e.period === 'late');
    const earlyPlannedTotal = earlyPlanned.reduce((s, e) => s + e.amount, 0);
    const latePlannedTotal  = latePlanned.reduce((s, e) => s + e.amount, 0);

    // Card faturas due this month
    const faturas = API.getFaturas().filter(f => f.month === month);
    const faturaTotal = faturas.reduce((s, f) => s + f.amount, 0);

    // Loan payments
    const loanPaymentTotal = (loans || []).reduce((s, l) => s + (l.monthlyPayment || 0), 0);

    // Account totals
    const bankTotal = accounts.reduce((s, a) => s + (a.balance || 0), 0);

    // Checkpoint calculations
    const totalEarlyExp = earlyPlannedTotal + earlyExpActual;
    const balanceAfterAdiantamento = bankTotal + adiantamento + earlyIncActual - totalEarlyExp;
    const totalLateExp  = latePlannedTotal + lateExpActual + faturaTotal + loanPaymentTotal;
    const endBalance    = balanceAfterAdiantamento + salary + lateIncActual - totalLateExp;
    const totalIncome   = adiantamento + salary + earlyIncActual + lateIncActual;
    const totalExpenses = totalEarlyExp + totalLateExp;
    const overflow      = totalIncome - totalExpenses;

    const hasIncomePlan = adiantamento > 0 || salary > 0;

    container.innerHTML = `

      ${!hasIncomePlan ? `
        <div class="card" style="margin-bottom:var(--space-md);border-color:var(--yellow);background:var(--yellow-glow)">
          <div style="display:flex;gap:var(--space-sm);align-items:flex-start">
            <span style="font-size:20px;flex-shrink:0">💡</span>
            <div style="font-size:13px;color:var(--text-secondary);line-height:1.5">
              Set your <strong>adiantamento amount</strong> and confirm your salary in
              <strong>Settings → Employment</strong> to enable cash flow planning.
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Income Card -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Income</span>
          <button class="btn btn-ghost btn-sm" onclick="CashFlow.editIncome('${month}')">Edit</button>
        </div>

        <div class="cf-income-row">
          <div class="asset-icon green" style="width:36px;height:36px;font-size:16px;flex-shrink:0">💰</div>
          <div class="asset-info">
            <div class="asset-name">Adiantamento — day ${adiantamentoDay}</div>
            <div class="asset-sub">${cfData.adiantamentoOverride != null ? 'Manual override for this month' : 'From profile settings'}</div>
          </div>
          <span class="tx-amount income">${adiantamento > 0 ? '+' + Fmt.currency(adiantamento) : Fmt.currency(0)}</span>
        </div>

        <div class="cf-income-row">
          <div class="asset-icon green" style="width:36px;height:36px;font-size:16px;flex-shrink:0">💼</div>
          <div class="asset-info">
            <div class="asset-name">Salary — day ${salaryDay}</div>
            <div class="asset-sub">${cfData.salaryOverride != null ? 'Manual override for this month' : 'From profile settings'}</div>
          </div>
          <span class="tx-amount income">${salary > 0 ? '+' + Fmt.currency(salary) : Fmt.currency(0)}</span>
        </div>

        ${earlyIncActual + lateIncActual > 0 ? `
          <div class="cf-income-row">
            <div class="asset-icon blue" style="width:36px;height:36px;font-size:16px;flex-shrink:0">📥</div>
            <div class="asset-info">
              <div class="asset-name">Other income (transactions)</div>
              <div class="asset-sub">${earlyTx.filter(t=>t.type==='income').length + lateTx.filter(t=>t.type==='income').length} recorded this month</div>
            </div>
            <span class="tx-amount income">+${Fmt.currency(earlyIncActual + lateIncActual)}</span>
          </div>
        ` : ''}

        <div class="cf-total-row">
          <span class="card-title">Total Income</span>
          <span style="font-family:var(--font-mono);font-size:16px;font-weight:700;color:var(--green)">${Fmt.currency(totalIncome)}</span>
        </div>
      </div>

      <!-- Early Period (Days 1 to adiantamentoDay-1) -->
      <div class="card" style="margin-bottom:var(--space-sm)">
        <div class="card-header">
          <div>
            <span class="card-title">Early Expenses</span>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Days 1–${adiantamentoDay - 1} (before advance)</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="CashFlow.addExpense('${month}','early')">+ Add</button>
        </div>

        ${earlyPlanned.map(e => renderPlannedExpense(month, e)).join('')}

        ${earlyExpActual > 0 ? `
          <div class="tx-item" style="opacity:0.75">
            <div class="tx-icon" style="width:36px;height:36px;font-size:14px;background:var(--bg-input)">📋</div>
            <div class="tx-info">
              <div class="tx-name">Actual transactions</div>
              <div class="tx-meta">${earlyTx.filter(t=>t.type==='expense').length} recorded in this period</div>
            </div>
            <span class="tx-amount expense">-${Fmt.currency(earlyExpActual)}</span>
          </div>
        ` : ''}

        ${earlyPlanned.length === 0 && earlyExpActual === 0 ? `
          <div style="padding:var(--space-sm) 0;text-align:center;font-size:12px;color:var(--text-muted)">
            No expenses yet.
          </div>
        ` : `
          <div class="cf-total-row" style="margin-top:var(--space-sm)">
            <span style="font-size:12px;color:var(--text-muted)">Early total</span>
            <span class="tx-amount expense">-${Fmt.currency(totalEarlyExp)}</span>
          </div>
        `}
      </div>

      <!-- Checkpoint 1: After Adiantamento -->
      <div class="cf-checkpoint" style="margin-bottom:var(--space-sm)">
        <div>
          <div style="font-size:10px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:var(--primary)">After Adiantamento · Day ${adiantamentoDay}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Accounts + advance − early expenses</div>
        </div>
        <div style="font-family:var(--font-mono);font-size:20px;font-weight:700;color:${balanceAfterAdiantamento >= 0 ? 'var(--green)' : 'var(--red)'}">${Fmt.currency(balanceAfterAdiantamento)}</div>
      </div>

      <!-- Late Period (adiantamentoDay to salaryDay) -->
      <div class="card" style="margin-bottom:var(--space-sm)">
        <div class="card-header">
          <div>
            <span class="card-title">Late Expenses</span>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Days ${adiantamentoDay}–${salaryDay} (before salary)</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="CashFlow.addExpense('${month}','late')">+ Add</button>
        </div>

        ${faturas.map(f => {
          const card = cards.find(c => c.id === f.cardId);
          return `
            <div class="tx-item">
              <div class="tx-icon" style="width:36px;height:36px;font-size:14px;background:var(--red-glow)">💳</div>
              <div class="tx-info">
                <div class="tx-name">${App.esc(card ? card.name : 'Card')} fatura</div>
                <div class="tx-meta">Due day ${card && card.dueDay ? card.dueDay : '?'} · Card bill</div>
              </div>
              <span class="tx-amount expense">-${Fmt.currency(f.amount)}</span>
            </div>
          `;
        }).join('')}

        ${(loans || []).filter(l => (l.monthlyPayment || 0) > 0).map(l => `
          <div class="tx-item">
            <div class="tx-icon" style="width:36px;height:36px;font-size:14px;background:var(--red-glow)">🏛️</div>
            <div class="tx-info">
              <div class="tx-name">${App.esc(l.name || 'Loan')} payment</div>
              <div class="tx-meta">Monthly loan payment</div>
            </div>
            <span class="tx-amount expense">-${Fmt.currency(l.monthlyPayment)}</span>
          </div>
        `).join('')}

        ${latePlanned.map(e => renderPlannedExpense(month, e)).join('')}

        ${lateExpActual > 0 ? `
          <div class="tx-item" style="opacity:0.75">
            <div class="tx-icon" style="width:36px;height:36px;font-size:14px;background:var(--bg-input)">📋</div>
            <div class="tx-info">
              <div class="tx-name">Actual transactions</div>
              <div class="tx-meta">${lateTx.filter(t=>t.type==='expense').length} recorded in this period</div>
            </div>
            <span class="tx-amount expense">-${Fmt.currency(lateExpActual)}</span>
          </div>
        ` : ''}

        ${latePlanned.length === 0 && lateExpActual === 0 && faturas.length === 0 && loanPaymentTotal === 0 ? `
          <div style="padding:var(--space-sm) 0;text-align:center;font-size:12px;color:var(--text-muted)">
            No expenses yet. Card faturas appear here automatically.
          </div>
        ` : `
          <div class="cf-total-row" style="margin-top:var(--space-sm)">
            <span style="font-size:12px;color:var(--text-muted)">Late total</span>
            <span class="tx-amount expense">-${Fmt.currency(totalLateExp)}</span>
          </div>
        `}
      </div>

      <!-- Checkpoint 2: End of Month -->
      <div class="cf-checkpoint" style="margin-bottom:var(--space-md)">
        <div>
          <div style="font-size:10px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:var(--primary)">End of Month · Day ${salaryDay}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">After advance + salary − all expenses</div>
        </div>
        <div style="font-family:var(--font-mono);font-size:20px;font-weight:700;color:${endBalance >= 0 ? 'var(--green)' : 'var(--red)'}">${Fmt.currency(endBalance)}</div>
      </div>

      <!-- Month Summary -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header" style="margin-bottom:var(--space-sm)">
          <span class="card-title">Month Summary</span>
        </div>

        <div class="cf-summary-row">
          <span style="color:var(--text-secondary)">Account balances (now)</span>
          <span style="font-family:var(--font-mono)">${Fmt.currency(bankTotal)}</span>
        </div>
        <div class="cf-summary-row">
          <span style="color:var(--green)">+ Total income planned</span>
          <span style="font-family:var(--font-mono);color:var(--green)">+${Fmt.currency(totalIncome)}</span>
        </div>
        <div class="cf-summary-row">
          <span style="color:var(--red)">− Total expenses planned</span>
          <span style="font-family:var(--font-mono);color:var(--red)">-${Fmt.currency(totalExpenses)}</span>
        </div>

        <div style="border-top:1px solid var(--border);margin-top:var(--space-md);padding-top:var(--space-md)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-sm)">
            <div>
              <div class="card-title">Overflow</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Income minus expenses</div>
            </div>
            <div style="font-family:var(--font-mono);font-size:24px;font-weight:700;color:${overflow >= 0 ? 'var(--green)' : 'var(--red)'}">${overflow >= 0 ? '+' : ''}${Fmt.currency(overflow)}</div>
          </div>
          ${overflow >= 0 ? `
            <div style="font-size:12px;color:var(--text-muted);margin-top:var(--space-xs)">
              🎯 On track — ${Fmt.currency(overflow)} available to save or invest
            </div>
          ` : `
            <div style="font-size:12px;color:var(--red);margin-top:var(--space-xs)">
              ⚠️ Deficit — expenses exceed income by ${Fmt.currency(Math.abs(overflow))}
            </div>
          `}
        </div>
      </div>
    `;
  }

  function renderPlannedExpense(month, e) {
    return `
      <div class="tx-item" style="cursor:pointer" onclick="CashFlow.editExpense('${month}','${e.id}')">
        <div class="tx-icon" style="width:36px;height:36px;font-size:14px;background:var(--bg-input)">📌</div>
        <div class="tx-info">
          <div class="tx-name">${App.esc(e.description)}</div>
          <div class="tx-meta">Planned · ${e.period === 'early' ? 'Early' : 'Late'} period</div>
        </div>
        <span class="tx-amount expense">-${Fmt.currency(e.amount)}</span>
      </div>
    `;
  }

  // ── Edit Income Modal ─────────────────────────────────────

  function editIncome(month) {
    const profile = Store.profile.get();
    const cfData  = API.getCashFlowMonth(month);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <h2 class="modal-title">Income — ${Fmt.monthYear(month + '-01')}</h2>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--space-lg);line-height:1.5">
          Override income for this specific month. Leave blank to use your profile values.
        </p>

        <div class="form-group">
          <label class="form-label">Adiantamento (R$) — day ${profile.adiantamentoDay || 15}</label>
          <input type="number" id="cf-adiantamento" class="form-input"
            value="${cfData.adiantamentoOverride != null ? cfData.adiantamentoOverride : ''}"
            placeholder="${profile.adiantamentoAmount ? Fmt.currency(profile.adiantamentoAmount) : 'Not set in profile'}"
            inputmode="decimal" step="0.01" />
        </div>
        <div class="form-group">
          <label class="form-label">Salary (R$) — day ${profile.salaryDay || 30}</label>
          <input type="number" id="cf-salary" class="form-input"
            value="${cfData.salaryOverride != null ? cfData.salaryOverride : ''}"
            placeholder="${profile.salary ? Fmt.currency(profile.salary) : 'Not set in profile'}"
            inputmode="decimal" step="0.01" />
        </div>

        <div style="display:flex;gap:var(--space-md);margin-top:var(--space-xl)">
          <button class="btn btn-secondary" style="flex:1" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <button class="btn btn-primary" style="flex:1" onclick="CashFlow.saveIncome('${month}',this)">Save</button>
        </div>
      </div>
    `;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  function saveIncome(month, btn) {
    const aVal = document.getElementById('cf-adiantamento').value;
    const sVal = document.getElementById('cf-salary').value;
    API.saveCashFlowMonth(month, {
      adiantamentoOverride: aVal !== '' ? parseFloat(aVal) : null,
      salaryOverride:       sVal !== '' ? parseFloat(sVal) : null
    });
    btn.closest('.modal-overlay').remove();
    const container = document.getElementById('cashflow-tab-content');
    if (container) render(container);
  }

  // ── Add/Edit Expense Modal ────────────────────────────────

  function addExpense(month, period) {
    openExpenseModal(month, { period, description: '', amount: 0, accountId: '' });
  }

  function editExpense(month, id) {
    const cfData = API.getCashFlowMonth(month);
    const expense = (cfData.plannedExpenses || []).find(e => e.id === id);
    if (expense) openExpenseModal(month, expense);
  }

  function openExpenseModal(month, expense) {
    const isNew   = !expense.id;
    const accts   = Store.data.getAccounts();
    const cardArr = Store.data.getCreditCards();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <h2 class="modal-title">${isNew ? 'Add' : 'Edit'} Planned Expense</h2>

        <div class="type-toggle" style="margin-bottom:var(--space-md)">
          <button id="cf-btn-early" class="type-toggle-btn ${expense.period !== 'late' ? 'active-expense' : ''}"
            onclick="document.getElementById('cf-btn-early').className='type-toggle-btn active-expense';document.getElementById('cf-btn-late').className='type-toggle-btn'">
            Days 1–14 · Early
          </button>
          <button id="cf-btn-late" class="type-toggle-btn ${expense.period === 'late' ? 'active-expense' : ''}"
            onclick="document.getElementById('cf-btn-late').className='type-toggle-btn active-expense';document.getElementById('cf-btn-early').className='type-toggle-btn'">
            Days 15–30 · Late
          </button>
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <input type="text" id="cf-expense-desc" class="form-input" value="${App.esc(expense.description || '')}" placeholder="e.g. Internet, Loan payment" />
        </div>
        <div class="form-group">
          <label class="form-label">Amount (R$)</label>
          <input type="number" id="cf-expense-amount" class="form-input" value="${expense.amount || ''}" placeholder="0.00" step="0.01" inputmode="decimal" />
        </div>
        <div class="form-group">
          <label class="form-label">Account / Card (optional)</label>
          <select id="cf-expense-account" class="form-input">
            <option value="">None</option>
            ${accts.map(a => `<option value="${a.id}" ${expense.accountId === a.id ? 'selected' : ''}>🏦 ${App.esc(a.name)}</option>`).join('')}
            ${cardArr.map(c => `<option value="${c.id}" ${expense.accountId === c.id ? 'selected' : ''}>💳 ${App.esc(c.name)}</option>`).join('')}
          </select>
        </div>

        <div style="display:flex;gap:var(--space-md);margin-top:var(--space-xl)">
          <button class="btn btn-secondary" style="flex:1" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          ${!isNew ? `<button class="btn" style="background:var(--red-glow);color:var(--red);border:1px solid var(--border-accent)" onclick="CashFlow.deleteExpense('${month}','${expense.id}',this)">Delete</button>` : ''}
          <button class="btn btn-primary" style="flex:1" onclick="CashFlow.saveExpense('${month}','${expense.id || ''}',this)">Save</button>
        </div>
      </div>
    `;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  function saveExpense(month, existingId, btn) {
    const desc      = document.getElementById('cf-expense-desc').value.trim();
    const amount    = parseFloat(document.getElementById('cf-expense-amount').value) || 0;
    const accountId = document.getElementById('cf-expense-account').value || '';
    const period    = document.getElementById('cf-btn-early').className.includes('active-expense') ? 'early' : 'late';

    if (!desc)   { App.toast('Please enter a description', 'error'); return; }
    if (!amount) { App.toast('Please enter an amount', 'error'); return; }

    if (existingId) {
      API.updateCashFlowExpense(month, existingId, { description: desc, amount, period, accountId });
    } else {
      API.addCashFlowExpense(month, { description: desc, amount, period, accountId });
    }

    btn.closest('.modal-overlay').remove();
    const container = document.getElementById('cashflow-tab-content');
    if (container) render(container);
  }

  function deleteExpense(month, id, btn) {
    if (!confirm('Delete this planned expense?')) return;
    API.deleteCashFlowExpense(month, id);
    btn.closest('.modal-overlay').remove();
    const container = document.getElementById('cashflow-tab-content');
    if (container) render(container);
  }

  return { render, editIncome, saveIncome, addExpense, editExpense, saveExpense, deleteExpense };
})();
