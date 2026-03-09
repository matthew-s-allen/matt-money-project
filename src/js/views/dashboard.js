/* ============================================================
   DASHBOARD VIEW — Financial overview
   ============================================================ */

const Dashboard = (() => {
  let charts = {};
  let summary = null;
  let history = null;

  const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        padding: 12,
        cornerRadius: 10
      }
    }
  };

  function getChartColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      tooltip: isDark
        ? { backgroundColor: '#141414', borderColor: '#333', borderWidth: 1, titleColor: '#fff', bodyColor: '#a0a0a0' }
        : { backgroundColor: '#fff', borderColor: '#e5e5e7', borderWidth: 1, titleColor: '#1a1a2e', bodyColor: '#6b7280' },
      grid: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      tick: isDark ? '#666' : '#9ca3af',
      axis: isDark ? '#222' : '#e5e5e7',
      line: isDark ? '#fff' : '#1a1a2e'
    };
  }

  function renderSkeleton() {
    return `
      <div class="skeleton" style="height:28px;width:60%;margin-bottom:var(--space-md)"></div>
      <div class="skeleton" style="height:160px;border-radius:var(--radius-xl);margin-bottom:var(--space-md)"></div>
      <div class="skeleton" style="height:100px;border-radius:var(--radius-lg);margin-bottom:var(--space-md)"></div>
      <div class="grid-2">
        <div class="skeleton" style="height:90px;border-radius:var(--radius-lg)"></div>
        <div class="skeleton" style="height:90px;border-radius:var(--radius-lg)"></div>
      </div>
      <div class="skeleton" style="height:200px;border-radius:var(--radius-lg);margin-top:var(--space-md)"></div>
    `;
  }

  async function render() {
    const container = document.getElementById('view-dashboard');
    container.innerHTML = renderSkeleton();

    try {
      const [s, h, accounts, cards, categories, patrimonio] = await Promise.all([
        API.getSummary(App.state.activeMonth),
        API.getMonthlyHistory(6),
        API.getAccounts(),
        API.getCreditCards(),
        API.getCategories(),
        API.getPatrimonio()
      ]);
      summary = s;
      history = h;
      // Subscriptions and installments are synchronous — no need to parallel fetch
      const subscriptions = API.getSubscriptions().filter(s => s.active !== false);
      const installmentItems = API.getMonthlyInstallmentItems(App.state.activeMonth);
      const loans = API.getLoans();
      renderFull(container, s, h, accounts, cards, categories, patrimonio, subscriptions, installmentItems, loans);
    } catch (e) {
      container.innerHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h3>Error</h3>
          <p>${e.message}</p>
          <button class="btn btn-primary btn-sm" onclick="Dashboard.render()">Retry</button>
        </div>
      `;
    }
  }

  // ── Compute adiantamento and 30th salary from profile ──────
  function computeIncomeSchedule(profile) {
    const b = API.calcSalaryBreakdown(profile);
    const ps = profile.paymentSchedule || [];

    // Find the advance (15th) entry
    const advanceEntry = ps.find(p => p.label?.toLowerCase().includes('adiant') || p.day <= 15) || ps[0];
    const salaryEntry  = ps.find(p => p.label?.toLowerCase().includes('salár') || p.day >= 25) || ps[1];

    let adiantamento;
    if (advanceEntry?.isFixed && advanceEntry?.amount > 0) {
      adiantamento = advanceEntry.amount;
    } else if (profile.adiantamentoAmount > 0) {
      adiantamento = profile.adiantamentoAmount;
    } else {
      const pct = advanceEntry?.percent || 40;
      adiantamento = b.totalTakeHome * pct / 100;
    }

    let salario30;
    if (salaryEntry?.isFixed && salaryEntry?.amount > 0) {
      salario30 = salaryEntry.amount;
    } else {
      salario30 = b.totalTakeHome - adiantamento;
    }

    const advanceDay = advanceEntry?.day || 15;
    const salaryDay  = salaryEntry?.day  || 30;

    return { adiantamento, salario30, totalTakeHome: b.totalTakeHome, advanceDay, salaryDay, breakdown: b };
  }

  // ── "Live on the 15th" hero card ───────────────────────────
  function renderLive15Card(expenses, income, profile, isCurrentMonth, h, subscriptions, installmentItems, loans) {
    const subsTotal = (subscriptions || []).reduce((s, sub) => s + (sub.amount || 0), 0);
    const instTotal = (installmentItems || []).reduce((s, i) => s + (i.amount || 0), 0);
    const loanTotal = (loans || []).reduce((s, l) => s + (l.monthlyPayment || 0), 0);
    const totalCommitted = subsTotal + instTotal + loanTotal;
    const totalOutflows = expenses + totalCommitted;

    if (!profile.salary || profile.salary === 0) {
      // No salary configured — show a basic summary + setup nudge
      const balance  = income - totalOutflows;
      const savingsRate = income > 0 ? ((income - totalOutflows) / income * 100) : 0;
      const getStatus = r => r >= 30
        ? { label: 'Great', class: 'pill-green' }
        : r >= 15 ? { label: 'OK', class: 'pill-yellow' }
        : { label: 'Over budget', class: 'pill-red' };
      const status = getStatus(savingsRate);
      return `
        <div class="hero-card" style="margin-bottom:var(--space-md)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-sm)">
            <div class="hero-label">Monthly Balance</div>
            <span class="pill ${status.class}">${status.label} · ${Fmt.percent(savingsRate)}</span>
          </div>
          <div class="hero-value" style="color:${balance >= 0 ? 'var(--green)' : 'var(--red)'}">${Fmt.currency(balance)}</div>
          <div class="hero-grid" style="margin-top:var(--space-md)">
            <div class="stat-block">
              <div class="stat-label">Income</div>
              <div class="stat-value positive" style="font-size:18px">${Fmt.compact(income)}</div>
            </div>
            <div class="stat-block" style="text-align:center">
              <div class="stat-label">All outflows</div>
              <div class="stat-value negative" style="font-size:18px">${Fmt.compact(totalOutflows)}</div>
            </div>
            <div class="stat-block" style="text-align:right">
              <div class="stat-label">Save rate</div>
              <div class="stat-value" style="font-size:18px;color:var(--text-secondary)">${Fmt.percent(savingsRate)}</div>
            </div>
          </div>
          ${totalCommitted > 0 ? `
          <div style="margin-top:var(--space-sm);font-size:11px;color:var(--text-muted);display:flex;gap:8px;flex-wrap:wrap">
            <span>Tracked: ${Fmt.compact(expenses)}</span>
            ${subsTotal > 0 ? `<span>· Subs: ${Fmt.compact(subsTotal)}</span>` : ''}
            ${instTotal > 0 ? `<span>· Parcelas: ${Fmt.compact(instTotal)}</span>` : ''}
            ${loanTotal > 0 ? `<span>· Loans: ${Fmt.compact(loanTotal)}</span>` : ''}
          </div>
          ` : ''}
          <div style="margin-top:var(--space-md);padding-top:var(--space-md);border-top:1px solid var(--border);font-size:12px;color:var(--text-muted)">
            Set your salary in Settings to unlock the "Live on the 15th" tracker.
          </div>
        </div>
      `;
    }

    const sched = computeIncomeSchedule(profile);
    const { adiantamento, salario30, totalTakeHome, advanceDay, salaryDay } = sched;

    // Coverage: can the advance alone cover all expenses (tracked + committed)?
    const coverage = adiantamento > 0 ? (totalOutflows / adiantamento * 100) : 0;
    const advanceRemaining = adiantamento - totalOutflows;
    // What goes to savings on the 30th: full salary if outflows covered by advance; else salary minus shortfall
    const shortfall = Math.max(0, totalOutflows - adiantamento);
    const overflowToSavings = salario30 - shortfall;

    // Period context
    const now = new Date();
    const dayOfMonth = isCurrentMonth ? now.getDate() : null;
    const inAdvancePeriod = dayOfMonth !== null && dayOfMonth <= advanceDay;
    const periodLabel = dayOfMonth !== null
      ? (inAdvancePeriod ? `Day ${dayOfMonth} · advance period` : `Day ${dayOfMonth} · salary period`)
      : null;

    // Status
    let statusLabel, statusClass;
    if (coverage <= 100) {
      if (expenses === 0) { statusLabel = 'No expenses yet'; statusClass = 'pill-blue'; }
      else if (coverage <= 80) { statusLabel = 'Living on the 15th ✓'; statusClass = 'pill-green'; }
      else { statusLabel = 'On track'; statusClass = 'pill-green'; }
    } else if (coverage <= 130) {
      statusLabel = 'Over advance'; statusClass = 'pill-yellow';
    } else {
      statusLabel = 'Way over budget'; statusClass = 'pill-red';
    }

    const barColor = coverage <= 80 ? 'var(--green)' : coverage <= 100 ? 'var(--yellow)' : 'var(--red)';
    const barPct   = Math.min(100, coverage);

    // MoM delta from history
    let momHtml = '';
    if (h && h.length >= 2) {
      const prev = h[h.length - 2];
      const prevExp = prev?.expenses || 0;
      if (prevExp > 0) {
        const delta = expenses - prevExp;
        const deltaColor = delta <= 0 ? 'var(--green)' : 'var(--red)';
        const deltaSign  = delta >= 0 ? '+' : '';
        momHtml = `<span style="font-size:11px;color:${deltaColor};font-weight:500">${deltaSign}${Fmt.compact(delta)} vs last month</span>`;
      }
    }

    return `
      <div class="hero-card" style="margin-bottom:var(--space-md)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
          <div>
            <div class="hero-label">Live on the 15th</div>
            ${periodLabel ? `<div style="font-size:10px;color:var(--text-muted);margin-top:1px">${periodLabel}</div>` : ''}
          </div>
          <span class="pill ${statusClass}">${statusLabel}</span>
        </div>

        <!-- Coverage bar -->
        <div style="margin:var(--space-md) 0">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
            <span style="font-size:12px;color:var(--text-secondary)">Advance coverage ${momHtml}</span>
            <span style="font-size:22px;font-weight:700;font-family:var(--font-mono);color:${barColor}">${Fmt.percent(Math.min(coverage, 999))}</span>
          </div>
          <div class="seg-bar">
            <div style="width:${barPct}%;background:${barColor};transition:width 0.5s ease"></div>
            <div style="flex:1;background:var(--bg-input)"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;color:var(--text-muted)">
            <span>R$ 0</span>
            <span>Advance: ${Fmt.compact(adiantamento)}</span>
          </div>
        </div>

        <!-- 3-col stats -->
        <div class="hero-grid">
          <div class="stat-block">
            <div class="stat-label">Advance (${advanceDay}th)</div>
            <div class="stat-value positive" style="font-size:16px">${Fmt.compact(adiantamento)}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${Math.round((advanceDay > 0 ? advanceDay : 15) / totalTakeHome * (adiantamento))}% planned</div>
          </div>
          <div class="stat-block" style="text-align:center">
            <div class="stat-label">All outflows</div>
            <div class="stat-value negative" style="font-size:16px">${Fmt.compact(totalOutflows)}</div>
            <div style="font-size:10px;margin-top:2px;color:${advanceRemaining >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:500">
              ${advanceRemaining >= 0 ? Fmt.compact(advanceRemaining) + ' left' : Fmt.compact(-advanceRemaining) + ' over'}
            </div>
          </div>
          <div class="stat-block" style="text-align:right">
            <div class="stat-label">→ Savings (${salaryDay}th)</div>
            <div class="stat-value" style="font-size:16px;color:${overflowToSavings >= 0 ? 'var(--green)' : 'var(--red)'}">${Fmt.compact(Math.abs(overflowToSavings))}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${overflowToSavings >= 0 ? 'overflow' : 'deficit'}</div>
          </div>
        </div>
        ${totalCommitted > 0 ? `
        <div style="margin-top:var(--space-sm);padding-top:var(--space-sm);border-top:1px solid var(--border);font-size:11px;color:var(--text-muted);display:flex;gap:8px;flex-wrap:wrap">
          <span>Tracked: ${Fmt.compact(expenses)}</span>
          ${subsTotal > 0 ? `<span>· Subs: ${Fmt.compact(subsTotal)}</span>` : ''}
          ${instTotal > 0 ? `<span>· Parcelas: ${Fmt.compact(instTotal)}</span>` : ''}
          ${loanTotal > 0 ? `<span>· Loans: ${Fmt.compact(loanTotal)}</span>` : ''}
        </div>
        ` : ''}
      </div>
    `;
  }

  // ── Cash flow checkpoints card ─────────────────────────────
  function renderCashFlowCard(expenses, income, profile, accounts, cards, subscriptions, installmentItems, isCurrentMonth, loans) {
    if (!profile.salary || profile.salary === 0) return '';

    const sched = computeIncomeSchedule(profile);
    const { adiantamento, salario30, advanceDay, salaryDay } = sched;

    const totalBankBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const totalCardBalance = cards.reduce((s, c) => s + (c.currentBalance || 0), 0);
    const subsTotal = (subscriptions || []).reduce((s, sub) => s + (sub.amount || 0), 0);
    const instTotal = (installmentItems || []).reduce((s, i) => s + (i.amount || 0), 0);
    const loanTotal = (loans || []).reduce((s, l) => s + (l.monthlyPayment || 0), 0);

    const now = new Date();
    const dayOfMonth = isCurrentMonth ? now.getDate() : 30;

    const advanceReceived = !isCurrentMonth || dayOfMonth >= advanceDay;

    // Balance after advance checkpoint (bank balance ± projected advance/expenses if not yet received)
    const balanceAfter15 = totalBankBalance
      + (advanceReceived ? 0 : adiantamento)
      - (advanceReceived ? 0 : expenses);

    // Overflow: end of month projection — income minus all outflows including subscriptions/installments/loans
    const projectedOverflow = adiantamento + salario30 - expenses - subsTotal - instTotal - totalCardBalance - loanTotal;
    const overflowColor = projectedOverflow >= 0 ? 'var(--green)' : 'var(--red)';

    // Step indicator
    const step = dayOfMonth < advanceDay ? 0 : dayOfMonth < salaryDay ? 1 : 2;

    const stepDot = (active, done) => {
      const bg = done ? 'var(--green)' : active ? 'var(--primary)' : 'var(--bg-input)';
      const border = done || active ? 'none' : '1px solid var(--border)';
      return `<div style="width:8px;height:8px;border-radius:50%;background:${bg};border:${border};flex-shrink:0"></div>`;
    };

    return `
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header" style="margin-bottom:var(--space-md)">
          <span class="card-title">Cash Flow</span>
          <span style="font-size:11px;color:var(--text-muted)">${isCurrentMonth ? 'This month' : 'Month view'}</span>
        </div>

        <!-- Timeline rows -->
        <div style="display:flex;flex-direction:column;gap:0">

          <!-- Start of month -->
          <div style="display:flex;align-items:center;gap:var(--space-sm);padding:var(--space-xs) 0">
            ${stepDot(step === 0, step > 0)}
            <div style="flex:1;display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:12px;color:var(--text-secondary)">Bank balance</span>
              <span style="font-size:13px;font-weight:600;font-family:var(--font-mono);color:${totalBankBalance >= 0 ? 'var(--green)' : 'var(--red)'}">${Fmt.compact(totalBankBalance)}</span>
            </div>
          </div>

          <!-- Connector -->
          <div style="display:flex;align-items:stretch;gap:var(--space-sm);padding:2px 0">
            <div style="width:8px;display:flex;justify-content:center"><div style="width:1px;background:var(--border);flex:1"></div></div>
            <div style="flex:1;display:flex;justify-content:space-between;align-items:center;padding:4px 0">
              <span style="font-size:11px;color:var(--text-muted)">+ Advance (${advanceDay}th)</span>
              <span style="font-size:11px;color:var(--green);font-family:var(--font-mono)">+${Fmt.compact(adiantamento)}</span>
            </div>
          </div>
          <div style="display:flex;align-items:stretch;gap:var(--space-sm);padding:2px 0">
            <div style="width:8px;display:flex;justify-content:center"><div style="width:1px;background:var(--border);flex:1"></div></div>
            <div style="flex:1;display:flex;justify-content:space-between;align-items:center;padding:4px 0">
              <span style="font-size:11px;color:var(--text-muted)">− Month expenses</span>
              <span style="font-size:11px;color:var(--red);font-family:var(--font-mono)">-${Fmt.compact(expenses)}</span>
            </div>
          </div>

          <!-- After 15th -->
          <div style="display:flex;align-items:center;gap:var(--space-sm);padding:var(--space-xs) 0">
            ${stepDot(step === 1, step > 1)}
            <div style="flex:1;display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:12px;color:var(--text-secondary)">After 15th</span>
              <span style="font-size:13px;font-weight:600;font-family:var(--font-mono);color:${balanceAfter15 >= 0 ? 'var(--green)' : 'var(--red)'}">${Fmt.compact(balanceAfter15)}</span>
            </div>
          </div>

          <!-- Connector -->
          <div style="display:flex;align-items:stretch;gap:var(--space-sm);padding:2px 0">
            <div style="width:8px;display:flex;justify-content:center"><div style="width:1px;background:var(--border);flex:1"></div></div>
            <div style="flex:1;display:flex;justify-content:space-between;align-items:center;padding:4px 0">
              <span style="font-size:11px;color:var(--text-muted)">+ Salary (${salaryDay}th)</span>
              <span style="font-size:11px;color:var(--green);font-family:var(--font-mono)">+${Fmt.compact(salario30)}</span>
            </div>
          </div>
          ${subsTotal > 0 ? `
          <div style="display:flex;align-items:stretch;gap:var(--space-sm);padding:2px 0">
            <div style="width:8px;display:flex;justify-content:center"><div style="width:1px;background:var(--border);flex:1"></div></div>
            <div style="flex:1;display:flex;justify-content:space-between;align-items:center;padding:4px 0">
              <span style="font-size:11px;color:var(--text-muted)">− Subscriptions</span>
              <span style="font-size:11px;color:var(--red);font-family:var(--font-mono)">-${Fmt.compact(subsTotal)}</span>
            </div>
          </div>
          ` : ''}
          ${instTotal > 0 ? `
          <div style="display:flex;align-items:stretch;gap:var(--space-sm);padding:2px 0">
            <div style="width:8px;display:flex;justify-content:center"><div style="width:1px;background:var(--border);flex:1"></div></div>
            <div style="flex:1;display:flex;justify-content:space-between;align-items:center;padding:4px 0">
              <span style="font-size:11px;color:var(--text-muted)">− Installments this month</span>
              <span style="font-size:11px;color:var(--red);font-family:var(--font-mono)">-${Fmt.compact(instTotal)}</span>
            </div>
          </div>
          ` : ''}
          ${totalCardBalance > 0 ? `
          <div style="display:flex;align-items:stretch;gap:var(--space-sm);padding:2px 0">
            <div style="width:8px;display:flex;justify-content:center"><div style="width:1px;background:var(--border);flex:1"></div></div>
            <div style="flex:1;display:flex;justify-content:space-between;align-items:center;padding:4px 0">
              <span style="font-size:11px;color:var(--text-muted)">− Card bill (est.)</span>
              <span style="font-size:11px;color:var(--red);font-family:var(--font-mono)">-${Fmt.compact(totalCardBalance)}</span>
            </div>
          </div>
          ` : ''}
          ${loanTotal > 0 ? `
          <div style="display:flex;align-items:stretch;gap:var(--space-sm);padding:2px 0">
            <div style="width:8px;display:flex;justify-content:center"><div style="width:1px;background:var(--border);flex:1"></div></div>
            <div style="flex:1;display:flex;justify-content:space-between;align-items:center;padding:4px 0">
              <span style="font-size:11px;color:var(--text-muted)">− Loan payments</span>
              <span style="font-size:11px;color:var(--red);font-family:var(--font-mono)">-${Fmt.compact(loanTotal)}</span>
            </div>
          </div>
          ` : ''}

          <!-- End / Overflow -->
          <div style="display:flex;align-items:center;gap:var(--space-sm);padding:var(--space-xs) 0;border-top:1px solid var(--border);margin-top:var(--space-xs)">
            ${stepDot(step === 2, false)}
            <div style="flex:1;display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:12px;font-weight:600">Overflow → savings</span>
              <span style="font-size:15px;font-weight:700;font-family:var(--font-mono);color:${overflowColor}">${Fmt.compact(projectedOverflow)}</span>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  // ── Net worth teaser ───────────────────────────────────────
  function renderNetWorthTeaser(patrimonio, accounts, cards) {
    const pat = patrimonio || {};
    const fgts        = pat.fgts        || 0;
    const savings     = pat.savings     || 0;
    const investments = pat.investments || 0;
    const carValue    = pat.carValue    || 0;

    const bankTotal = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const cardTotal = cards.reduce((s, c) => s + (c.currentBalance || 0), 0);

    const loans = Store.data.getLoans ? Store.data.getLoans() : [];
    const loanTotal = loans.reduce((s, l) => s + (l.remainingBalance || l.amount || 0), 0);

    const totalAssets = fgts + savings + investments + carValue + Math.max(0, bankTotal);
    const totalLiabilities = cardTotal + loanTotal;
    const netWorth = totalAssets - totalLiabilities;

    if (totalAssets === 0 && totalLiabilities === 0) return '';

    const nwColor = netWorth >= 0 ? 'var(--green)' : 'var(--red)';

    return `
      <div class="card" style="margin-bottom:var(--space-md);cursor:pointer" onclick="App.navigate('patrimonio')">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div class="card-title">Net Worth</div>
            <div style="font-size:22px;font-weight:700;margin-top:4px;font-family:var(--font-mono);color:${nwColor}">${Fmt.currency(netWorth)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--text-muted)">Assets</div>
            <div style="font-size:13px;font-weight:600;color:var(--text-secondary)">${Fmt.compact(totalAssets)}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Liabilities</div>
            <div style="font-size:13px;font-weight:600;color:var(--red)">${Fmt.compact(totalLiabilities)}</div>
          </div>
        </div>
        <div style="margin-top:var(--space-sm)">
          <div class="progress-bar-wrap" style="height:4px">
            ${totalAssets > 0 ? `<div class="progress-bar-fill" style="width:${Math.min(100, (1 - totalLiabilities/totalAssets)*100)}%;background:var(--green)"></div>` : ''}
          </div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px;display:flex;justify-content:space-between">
            <span>${totalAssets > 0 ? Fmt.percent(Math.max(0,(1 - totalLiabilities/totalAssets)*100)) + ' equity' : ''}</span>
            <span style="color:var(--primary)">See patrimônio →</span>
          </div>
        </div>
      </div>
    `;
  }

  // ── Account + card balances row (with credit utilization) ──
  function renderAccountsRow(accounts, cards) {
    if (accounts.length === 0 && cards.length === 0) return '';

    const totalBankBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const totalCardBalance = cards.reduce((s, c) => s + (c.currentBalance || 0), 0);
    const totalCardLimit   = cards.reduce((s, c) => s + (c.limit || 0), 0);
    const creditUtil = totalCardLimit > 0 ? (totalCardBalance / totalCardLimit * 100) : 0;
    const utilColor = creditUtil > 80 ? 'var(--red)' : creditUtil > 50 ? 'var(--yellow)' : 'var(--green)';

    return `
      <div class="grid-2" style="margin-bottom:var(--space-md)">
        <div class="card" style="cursor:pointer" onclick="App.navigate('accounts')">
          <div class="card-title">Bank Balance</div>
          <div class="stat-value positive" style="font-size:20px;margin-top:var(--space-sm)">${Fmt.compact(totalBankBalance)}</div>
          <div class="t-muted" style="margin-top:4px">${accounts.length} account${accounts.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="card" style="cursor:pointer" onclick="App.navigate('accounts')">
          <div class="card-title">Card Debt</div>
          <div class="stat-value negative" style="font-size:20px;margin-top:var(--space-sm)">${Fmt.compact(totalCardBalance)}</div>
          ${totalCardLimit > 0 ? `
            <div class="progress-bar-wrap" style="height:3px;margin-top:6px">
              <div class="progress-bar-fill" style="width:${Math.min(100, creditUtil)}%;background:${utilColor}"></div>
            </div>
            <div style="font-size:10px;color:${utilColor};margin-top:3px;font-weight:500">${Fmt.percent(creditUtil)} utilization</div>
          ` : `<div class="t-muted" style="margin-top:4px">${cards.length} card${cards.length !== 1 ? 's' : ''}</div>`}
        </div>
      </div>
    `;
  }

  function renderFull(container, s, h, accounts, cards, categories, patrimonio, subscriptions, installmentItems, loans) {
    Object.values(charts).forEach(c => c?.destroy());
    charts = {};

    const income   = s.totalIncome   || 0;
    const expenses = s.totalExpenses || 0;
    const cats     = s.byCategory    || {};

    const now = new Date();
    const [y, m] = App.state.activeMonth.split('-').map(Number);
    const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1;

    const profile = Store.profile.get();

    // Pre-compute annual data so template helpers can use it
    annualData = API.getAnnualOverview(annualYear);

    container.innerHTML = `
      <!-- Month Nav -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md)">
        <div class="section-header" style="margin-bottom:0">
          <div>
            <div class="section-title">Dashboard</div>
            <div class="section-subtitle">Monthly overview</div>
          </div>
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

      <!-- 1. Live on the 15th hero -->
      ${renderLive15Card(expenses, income, profile, isCurrentMonth, h, subscriptions, installmentItems, loans)}

      <!-- 2. Cash flow checkpoints -->
      ${renderCashFlowCard(expenses, income, profile, accounts, cards, subscriptions, installmentItems, isCurrentMonth, loans)}

      <!-- 3. Account balances -->
      ${renderAccountsRow(accounts, cards)}

      <!-- 4. Net worth teaser -->
      ${renderNetWorthTeaser(patrimonio, accounts, cards)}

      <!-- 5. Monthly commitments (subscriptions + installments + loans) -->
      ${renderMonthlyCommitmentsCard(subscriptions, installmentItems, loans)}

      <!-- 6. Budget progress -->
      ${renderBudgetSection(cats, categories, subscriptions, installmentItems)}

      <!-- 7. Category breakdown -->
      ${Object.keys(cats).length > 0 ? `
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Category Breakdown</span>
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('transactions')">See all</button>
        </div>
        <div class="telemetry-list" id="cat-telemetry"></div>
      </div>
      ` : ''}

      <!-- 8. Quick stats -->
      <div class="grid-2" style="margin-bottom:var(--space-md)">
        <div class="card" style="cursor:pointer" onclick="App.navigate('transactions')">
          <div class="card-title">Transactions</div>
          <div class="stat-value" style="font-size:32px;margin-top:var(--space-sm)">${s.txCount || 0}</div>
          <div class="t-muted" style="margin-top:4px">this month</div>
        </div>
        <div class="card" style="cursor:pointer" onclick="App.navigate('transactions')">
          <div class="card-title">Avg / day</div>
          <div class="stat-value negative" style="font-size:22px;margin-top:var(--space-sm)">${Fmt.compact(s.avgPerDay || 0)}</div>
          <div class="t-muted" style="margin-top:4px">spending</div>
        </div>
      </div>

      <!-- 8. Annual Overview (Income vs Outflows) -->
      ${renderAnnualOverviewSection()}

      <!-- 8b. Year Projection Table -->
      ${renderYearProjectionSection()}

      <!-- 9. Spend distribution donut -->
      ${Object.keys(cats).length > 0 ? `
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Spend Distribution</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);align-items:center">
          <div class="chart-wrap" style="height:160px">
            <canvas id="donut-chart"></canvas>
          </div>
          <div class="donut-legend" id="donut-legend"></div>
        </div>
      </div>
      ` : ''}

      <!-- 10. Salary breakdown (secondary) -->
      ${renderSalaryCard()}

      <!-- 11. Recent activity -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Recent Activity</span>
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('transactions')">View all</button>
        </div>
        <div id="recent-tx-list">
          ${(s.recentTx || []).length === 0 ? `
            <div class="empty-state" style="padding:var(--space-xl) 0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              <p>No transactions yet. Hit <strong>+</strong> to add your first one!</p>
            </div>
          ` : (s.recentTx || []).slice(0, 5).map(tx => renderTxItem(tx)).join('')}
        </div>
      </div>
    `;

    if (Object.keys(cats).length > 0) {
      renderTelemetry(cats, expenses);
      renderDonut(cats);
    }
    // Annual overview chart (annualData already computed above)
    renderAnnualChart(document.getElementById('annual-chart-inner'));
  }

  // ── Monthly Commitments card ───────────────────────────────
  // Shows fixed monthly subscriptions + installment items for this month.
  // These are "committed" costs before any tracked transaction.
  function renderMonthlyCommitmentsCard(subscriptions, installmentItems, loans) {
    const hasSubs   = subscriptions && subscriptions.length > 0;
    const hasInsts  = installmentItems && installmentItems.length > 0;
    const hasLoans  = loans && loans.length > 0;
    if (!hasSubs && !hasInsts && !hasLoans) return '';

    const subsTotal = (subscriptions || []).reduce((s, sub) => s + (sub.amount || 0), 0);
    const instTotal = (installmentItems || []).reduce((s, i) => s + (i.amount || 0), 0);
    const loanTotal = (loans || []).reduce((s, l) => s + (l.monthlyPayment || 0), 0);
    const totalCommitted = subsTotal + instTotal + loanTotal;

    return `
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Monthly Commitments</span>
          <span class="pill pill-blue" style="font-size:10px">${Fmt.compact(totalCommitted)}/mo</span>
        </div>

        ${hasSubs ? `
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Subscriptions</div>
          ${(subscriptions || []).map(sub => `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:18px;width:24px;text-align:center;flex-shrink:0">${sub.emoji || '📱'}</span>
              <span style="flex:1;font-size:13px">${App.esc(sub.name)}</span>
              ${sub.billingDay ? `<span style="font-size:10px;color:var(--text-muted)">day ${sub.billingDay}</span>` : ''}
              <span style="font-size:13px;font-weight:600;font-family:var(--font-mono);color:var(--red)">-${Fmt.compact(sub.amount)}</span>
              <button onclick="Dashboard.deleteSubscription('${sub.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:14px;padding:2px 4px;line-height:1">×</button>
            </div>
          `).join('')}
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;padding-top:6px;margin-bottom:${hasInsts ? 'var(--space-md)' : '0'}">
            <span style="color:var(--text-secondary)">Subscriptions total</span>
            <span style="color:var(--red);font-family:var(--font-mono)">${Fmt.compact(subsTotal)}</span>
          </div>
        ` : ''}

        ${hasInsts ? `
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Installments this month</div>
          ${(installmentItems || []).map(item => `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:11px;color:var(--text-muted);background:var(--bg-input);border-radius:4px;padding:1px 5px;flex-shrink:0">${item.installment}</span>
              <span style="flex:1;font-size:13px">${App.esc(item.description)}</span>
              <span style="font-size:13px;font-weight:600;font-family:var(--font-mono);color:var(--red)">-${Fmt.compact(item.amount)}</span>
            </div>
          `).join('')}
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;padding-top:6px">
            <span style="color:var(--text-secondary)">Installments total</span>
            <span style="color:var(--red);font-family:var(--font-mono)">${Fmt.compact(instTotal)}</span>
          </div>
        ` : ''}

        ${hasLoans ? `
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;${hasSubs || hasInsts ? 'margin-top:var(--space-md)' : ''}">Loan Payments</div>
          ${(loans || []).map(loan => `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:18px;width:24px;text-align:center;flex-shrink:0">🏦</span>
              <span style="flex:1;font-size:13px">${App.esc(loan.name || 'Loan')}</span>
              ${loan.remainingBalance ? `<span style="font-size:10px;color:var(--text-muted)">bal: ${Fmt.compact(loan.remainingBalance)}</span>` : ''}
              <span style="font-size:13px;font-weight:600;font-family:var(--font-mono);color:var(--red)">-${Fmt.compact(loan.monthlyPayment || 0)}</span>
            </div>
          `).join('')}
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;padding-top:6px">
            <span style="color:var(--text-secondary)">Loans total</span>
            <span style="color:var(--red);font-family:var(--font-mono)">${Fmt.compact(loanTotal)}</span>
          </div>
        ` : ''}

        <!-- Add subscription inline form -->
        <div id="add-sub-form" style="display:none;margin-top:var(--space-md);padding-top:var(--space-md);border-top:1px solid var(--border)">
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <input id="sub-emoji" class="form-input" placeholder="📱" style="width:46px;text-align:center;font-size:16px;padding:4px" maxlength="2" />
            <input id="sub-name" class="form-input" placeholder="Netflix" style="flex:1;min-width:80px" />
            <input id="sub-amount" class="form-input" type="number" placeholder="R$ 0" inputmode="decimal" style="width:80px" />
            <input id="sub-day" class="form-input" type="number" placeholder="Dia" min="1" max="31" inputmode="numeric" style="width:54px" />
            <button class="btn btn-primary btn-sm" onclick="Dashboard.saveNewSubscription()" style="flex-shrink:0">Add</button>
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('add-sub-form').style.display='none'" style="flex-shrink:0">Cancel</button>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-top:var(--space-sm);width:100%" onclick="document.getElementById('add-sub-form').style.display='block'">+ Add subscription</button>
      </div>
    `;
  }

  // Called from inline button — saves a new subscription and re-renders
  async function saveNewSubscription() {
    const emoji  = document.getElementById('sub-emoji')?.value.trim()  || '📱';
    const name   = document.getElementById('sub-name')?.value.trim();
    const amount = parseFloat(document.getElementById('sub-amount')?.value) || 0;
    const day    = parseInt(document.getElementById('sub-day')?.value)   || 1;
    if (!name || amount <= 0) { App.toast('Enter name and amount', 'error'); return; }
    await API.upsertSubscription({ name, amount, emoji, billingDay: day, active: true });
    App.toast(`${emoji} ${name} added`, 'success');
    await render();
  }

  async function deleteSubscription(id) {
    await API.deleteSubscription(id);
    await render();
  }

  function renderBudgetSection(cats, categories, subscriptions, installmentItems) {
    if (!categories || !categories.length) return '';
    const budgetItems = categories
      .filter(c => c.budget > 0 && c.active !== false)
      .map(c => {
        const spent = cats[c.id] || 0;
        const pct = c.budget > 0 ? (spent / c.budget * 100) : 0;
        return { ...c, spent, pct };
      })
      .sort((a, b) => b.pct - a.pct);

    if (!budgetItems.length) return '';

    const totalBudget = budgetItems.reduce((s, b) => s + b.budget, 0);
    const totalSpent  = budgetItems.reduce((s, b) => s + b.spent, 0);

    // Committed costs (subscriptions + installments this month) reduce effective budget headroom
    const subsTotal  = (subscriptions || []).reduce((s, sub) => s + (sub.amount || 0), 0);
    const instTotal  = (installmentItems || []).reduce((s, i) => s + (i.amount || 0), 0);
    const committed  = subsTotal + instTotal;

    // "Effective spent" = tracked expenses + known committed costs
    const effectiveSpent = totalSpent + committed;
    const overallPct = totalBudget > 0 ? (effectiveSpent / totalBudget * 100) : 0;
    const trackedPct = totalBudget > 0 ? (totalSpent / totalBudget * 100) : 0;
    const overBudgetCount = budgetItems.filter(b => b.pct > 100).length;

    return `
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Budget Progress</span>
          <span class="pill ${overallPct > 100 ? 'pill-red' : overallPct > 75 ? 'pill-yellow' : 'pill-green'}">${Fmt.percent(overallPct)} used</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:var(--space-sm)">
          <span style="font-size:12px;color:var(--text-muted)">${Fmt.currency(effectiveSpent)} of ${Fmt.currency(totalBudget)}</span>
          ${overBudgetCount > 0 ? `<span style="font-size:11px;color:var(--red);font-weight:600">${overBudgetCount} over budget</span>` : ''}
        </div>

        <!-- Stacked progress bar: tracked (solid) + committed (hatched/lighter) -->
        <div class="progress-bar-wrap" style="margin-bottom:${committed > 0 ? 'var(--space-xs)' : 'var(--space-md)'}">
          <div style="display:flex;height:100%;border-radius:var(--radius-sm);overflow:hidden;width:100%">
            <div style="width:${Math.min(100, trackedPct)}%;background:${overallPct > 100 ? 'var(--red)' : overallPct > 75 ? 'var(--yellow)' : 'var(--green)'}"></div>
            ${committed > 0 ? `<div style="width:${Math.min(100 - Math.min(100,trackedPct), totalBudget > 0 ? committed/totalBudget*100 : 0)}%;background:${overallPct > 100 ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.35)'}"></div>` : ''}
            <div style="flex:1;background:var(--bg-input)"></div>
          </div>
        </div>
        ${committed > 0 ? `
          <div style="display:flex;gap:12px;margin-bottom:var(--space-md)">
            <div style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text-muted)">
              <div style="width:10px;height:10px;border-radius:2px;background:var(--green);flex-shrink:0"></div>Tracked: ${Fmt.compact(totalSpent)}
            </div>
            <div style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text-muted)">
              <div style="width:10px;height:10px;border-radius:2px;background:rgba(234,179,8,0.5);flex-shrink:0"></div>Committed: ${Fmt.compact(committed)}
            </div>
          </div>
        ` : ''}

        ${budgetItems.map(b => {
          const barColor = b.pct > 100 ? 'var(--red)' : b.pct > 75 ? 'var(--yellow)' : b.color;
          const remaining = Math.max(0, b.budget - b.spent);
          return `
            <div style="margin-bottom:var(--space-sm)">
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px">
                <span style="font-size:12px;font-weight:500">${b.emoji} ${b.label}</span>
                <span style="font-size:11px;font-family:var(--font-mono);color:${b.pct > 100 ? 'var(--red)' : 'var(--text-secondary)'}">${Fmt.currency(b.spent)} / ${Fmt.currency(b.budget)}</span>
              </div>
              <div class="progress-bar-wrap" style="height:4px">
                <div class="progress-bar-fill" style="width:${Math.min(100, b.pct)}%;background:${barColor}"></div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:1px">
                <span style="font-size:10px;color:var(--text-muted)">${Fmt.percent(b.pct)}</span>
                <span style="font-size:10px;color:${b.pct > 100 ? 'var(--red)' : 'var(--text-muted)'}">${b.pct > 100 ? 'Over by ' + Fmt.currency(b.spent - b.budget) : Fmt.currency(remaining) + ' left'}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderTxItem(tx) {
    const cat = App.getCat(tx.category);
    return `
      <div class="tx-item" onclick="App.openTxDetail('${App.esc(tx.id)}')">
        <div class="tx-icon">${cat.emoji}</div>
        <div class="tx-info">
          <div class="tx-name">${App.esc(tx.description || tx.merchant || 'Transaction')}</div>
          <div class="tx-meta">${Fmt.relativeDate(tx.date)} · ${cat.label}</div>
        </div>
        <div class="tx-amount ${tx.type === 'income' ? 'income' : 'expense'}">${tx.type === 'income' ? '+' : '-'}${Fmt.currency(tx.amount)}</div>
      </div>
    `;
  }

  function renderTelemetry(cats, totalExpenses) {
    const el = document.getElementById('cat-telemetry');
    if (!el) return;

    const sorted = Object.entries(cats).sort(([,a],[,b]) => b - a).slice(0, 6);
    el.innerHTML = sorted.map(([catId, amount]) => {
      const cat = App.getCat(catId);
      const pct = totalExpenses > 0 ? (amount / totalExpenses * 100) : 0;
      return `
        <div class="telemetry-item">
          <div class="telemetry-header">
            <div class="telemetry-name"><span>${cat.emoji}</span><span>${cat.label}</span></div>
            <div class="telemetry-amounts">
              <span class="telemetry-spent">${Fmt.currency(amount)}</span>
              <span>${Fmt.percent(pct)}</span>
            </div>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" style="width:${pct}%;background:${cat.color}"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderDonut(cats) {
    const canvas = document.getElementById('donut-chart');
    const legend = document.getElementById('donut-legend');
    if (!canvas || !legend) return;

    const sorted = Object.entries(cats).sort(([,a],[,b]) => b - a).slice(0, 6);
    const labels = sorted.map(([id]) => App.getCat(id).label);
    const data   = sorted.map(([,v]) => v);
    const colors = sorted.map(([id]) => App.getCat(id).color);
    const total  = data.reduce((a,b) => a+b, 0);
    const cc = getChartColors();

    if (charts.donut) charts.donut.destroy();
    charts.donut = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }]
      },
      options: {
        ...CHART_DEFAULTS,
        cutout: '72%',
        plugins: { ...CHART_DEFAULTS.plugins, tooltip: { ...cc.tooltip, padding: 12, cornerRadius: 10,
          callbacks: { label: ctx => ` ${Fmt.currency(ctx.raw)} (${(ctx.raw/total*100).toFixed(0)}%)` }
        }}
      }
    });

    legend.innerHTML = sorted.map(([id, amount]) => {
      const cat = App.getCat(id);
      return `
        <div class="legend-item">
          <div class="legend-dot" style="background:${cat.color}"></div>
          <span class="legend-name">${cat.emoji} ${cat.label}</span>
          <span class="legend-val">${Fmt.currency(amount)}</span>
        </div>
      `;
    }).join('');
  }

  // ── Annual Overview state ──────────────────────────────────
  let annualYear = new Date().getFullYear();
  let showPredicted = true;
  let annualData = null;

  function setAnnualYear(y) {
    annualYear = y;
    annualData = API.getAnnualOverview(annualYear);
    renderAnnualChartOnly();
    renderYearProjectionOnly();
  }

  function togglePredicted() {
    showPredicted = !showPredicted;
    renderAnnualChartOnly();
    renderYearProjectionOnly();
  }

  function savePredictedIncome() {
    const input = document.getElementById('predicted-income-input');
    if (!input) return;
    const val = parseFloat(input.value) || 0;
    Store.profile.set({ predictedMonthlyIncome: val });
    annualData = API.getAnnualOverview(annualYear);
    renderAnnualChartOnly();
    renderYearProjectionOnly();
    App.toast('Predicted income updated', 'success');
  }

  function renderAnnualChartOnly() {
    if (!annualData) return;
    const wrap = document.getElementById('annual-chart-inner');
    if (!wrap) return;
    renderAnnualChart(wrap);
    // Update summary
    const sumEl = document.getElementById('annual-summary');
    if (sumEl) sumEl.innerHTML = buildAnnualSummary();
    // Update year label
    const yearLabel = document.getElementById('annual-year-label');
    if (yearLabel) yearLabel.textContent = annualYear;
    // Update toggle state
    const toggleEl = document.getElementById('predicted-toggle');
    if (toggleEl) toggleEl.checked = showPredicted;
  }

  function renderAnnualChart(container) {
    if (!annualData) return;
    const cc = getChartColors();
    const now = new Date();
    const currentMonthIdx = (annualYear === now.getFullYear()) ? now.getMonth() : -1;

    const labels = annualData.map(m => {
      const [, mo] = m.month.split('-');
      return Fmt.monthShort(m.month + '-01');
    });

    // Income bars: actual for past, predicted for future (if toggle on)
    const incomeData = annualData.map(m => {
      if (m.actualIncome > 0) return m.actualIncome;
      if (showPredicted && (m.isFuture || m.isCurrent)) return m.predictedIncome;
      return m.actualIncome;
    });
    const incomeAlpha = annualData.map(m => m.isFuture ? 0.25 : m.isCurrent ? 0.5 : 0.6);

    // Expense bar (actual tracked spending)
    const expenseData = annualData.map(m => m.actualExpenses);
    // Committed costs stacked on top
    const committedData = annualData.map(m => m.committed);
    // Surplus line
    const surplusData = annualData.map(m => {
      const inc = incomeData[annualData.indexOf(m)];
      return inc - m.actualExpenses - m.committed;
    });

    if (charts.annual) charts.annual.destroy();

    const canvas = document.getElementById('annual-chart-canvas');
    if (!canvas) return;

    charts.annual = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Income',
            data: incomeData,
            backgroundColor: annualData.map((m, i) => `rgba(34,197,94,${incomeAlpha[i]})`),
            borderColor: 'rgba(34,197,94,0.7)',
            borderWidth: 1,
            borderRadius: 4,
            stack: 'income',
            order: 3
          },
          {
            label: 'Expenses',
            data: expenseData,
            backgroundColor: annualData.map(m => m.isFuture ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.5)'),
            borderColor: 'rgba(239,68,68,0.6)',
            borderWidth: 1,
            borderRadius: 4,
            stack: 'outflows',
            order: 4
          },
          {
            label: 'Committed',
            data: committedData,
            backgroundColor: annualData.map(m => m.isFuture ? 'rgba(251,146,60,0.15)' : 'rgba(251,146,60,0.45)'),
            borderColor: 'rgba(251,146,60,0.5)',
            borderWidth: 1,
            borderRadius: 4,
            stack: 'outflows',
            order: 5
          },
          {
            label: 'Surplus',
            data: surplusData,
            type: 'line',
            borderColor: cc.line,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [4, 3],
            pointBackgroundColor: surplusData.map(v => v >= 0 ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)'),
            pointBorderColor: surplusData.map(v => v >= 0 ? 'rgba(34,197,94,1)' : 'rgba(239,68,68,1)'),
            pointRadius: 3,
            tension: 0.3,
            order: 1,
            stack: false
          }
        ]
      },
      options: {
        ...CHART_DEFAULTS,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            stacked: true,
            grid: { color: cc.grid },
            ticks: { color: cc.tick, font: { family: 'Inter', size: 10 } },
            border: { color: cc.axis }
          },
          y: {
            stacked: true,
            grid: { color: cc.grid },
            ticks: { color: cc.tick, font: { family: 'Inter', size: 10 }, callback: v => Fmt.compact(v) },
            border: { color: cc.axis }
          }
        },
        plugins: {
          ...CHART_DEFAULTS.plugins,
          legend: {
            display: true, position: 'top', align: 'end',
            labels: { color: cc.tick, font: { size: 10 }, boxWidth: 10, padding: 8 }
          },
          tooltip: {
            ...cc.tooltip, padding: 12, cornerRadius: 10, mode: 'index',
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${Fmt.currency(ctx.raw)}`,
              afterBody: (items) => {
                const idx = items[0]?.dataIndex;
                if (idx == null || !annualData[idx]) return '';
                const m = annualData[idx];
                return `\n  Net surplus: ${Fmt.currency(surplusData[idx])}`;
              }
            }
          }
        }
      }
    });
  }

  function buildAnnualSummary() {
    if (!annualData) return '';
    const now = new Date();
    const currentMonthIdx = (annualYear === now.getFullYear()) ? now.getMonth() : 11;

    const ytdMonths = annualData.filter(m => m.isPast || m.isCurrent);
    const ytdIncome = ytdMonths.reduce((s, m) => s + m.actualIncome, 0);
    const ytdExpenses = ytdMonths.reduce((s, m) => s + m.actualExpenses, 0);
    const ytdCommitted = ytdMonths.reduce((s, m) => s + m.committed, 0);
    const ytdSurplus = ytdIncome - ytdExpenses - ytdCommitted;

    // Full year projection
    const fullIncome = annualData.reduce((s, m) => {
      if (m.actualIncome > 0) return s + m.actualIncome;
      return showPredicted ? s + m.predictedIncome : s;
    }, 0);
    const fullExpenses = annualData.reduce((s, m) => s + m.actualExpenses, 0);
    const fullCommitted = annualData.reduce((s, m) => s + m.committed, 0);
    const fullSurplus = fullIncome - fullExpenses - fullCommitted;

    const remainingMonths = annualData.filter(m => m.isFuture).length;
    const monthlyAvailable = remainingMonths > 0 ? (fullSurplus / 12) : ytdSurplus / (currentMonthIdx + 1);

    return `
      <div class="grid-2" style="gap:var(--space-sm);margin-top:var(--space-md)">
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">YTD Income</div>
          <div style="font-size:16px;font-weight:700;color:var(--green);font-family:var(--font-mono)">${Fmt.compact(ytdIncome)}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">YTD Outflows</div>
          <div style="font-size:16px;font-weight:700;color:var(--red);font-family:var(--font-mono)">${Fmt.compact(ytdExpenses + ytdCommitted)}</div>
        </div>
      </div>
      ${showPredicted ? `
        <div style="margin-top:var(--space-sm);padding:var(--space-sm);background:var(--bg-input);border-radius:var(--radius-md);text-align:center">
          <div style="font-size:10px;color:var(--text-muted)">Projected Year-End Surplus</div>
          <div style="font-size:20px;font-weight:700;color:${fullSurplus >= 0 ? 'var(--green)' : 'var(--red)'};font-family:var(--font-mono)">${Fmt.currency(fullSurplus)}</div>
          ${monthlyAvailable > 0 ? `<div style="font-size:11px;color:var(--text-secondary);margin-top:2px">~${Fmt.compact(monthlyAvailable)}/mo available for debt or savings</div>` : ''}
        </div>
      ` : `
        <div style="margin-top:var(--space-sm);padding:var(--space-sm);background:var(--bg-input);border-radius:var(--radius-md);text-align:center">
          <div style="font-size:10px;color:var(--text-muted)">YTD Net Surplus</div>
          <div style="font-size:20px;font-weight:700;color:${ytdSurplus >= 0 ? 'var(--green)' : 'var(--red)'};font-family:var(--font-mono)">${Fmt.currency(ytdSurplus)}</div>
        </div>
      `}
    `;
  }

  function renderAnnualOverviewSection() {
    const profile = Store.profile.get();
    const b = API.calcSalaryBreakdown(profile);
    const currentPredicted = profile.predictedMonthlyIncome > 0 ? profile.predictedMonthlyIncome : b.totalTakeHome;

    return `
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header" style="margin-bottom:var(--space-sm)">
          <div style="display:flex;align-items:center;gap:var(--space-sm)">
            <span class="card-title">Annual Overview</span>
          </div>
          <div class="month-nav" id="annual-year-nav">
            <button onclick="Dashboard.setAnnualYear(Dashboard.getAnnualYear() - 1)">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span id="annual-year-label" style="font-size:14px;font-weight:600;min-width:40px;text-align:center">${annualYear}</span>
            <button onclick="Dashboard.setAnnualYear(Dashboard.getAnnualYear() + 1)">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>

        <!-- Toggle row -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-sm);gap:var(--space-sm)">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-secondary)">
            <input type="checkbox" id="predicted-toggle" ${showPredicted ? 'checked' : ''} onchange="Dashboard.togglePredicted()" class="toggle-switch" />
            <span>Predicted income</span>
          </label>
          <div id="predicted-edit-wrap" style="display:flex;align-items:center;gap:4px;${showPredicted ? '' : 'opacity:0.4;pointer-events:none'}">
            <span style="font-size:11px;color:var(--text-muted)">R$</span>
            <input id="predicted-income-input" type="number" inputmode="decimal" class="form-input" value="${Math.round(currentPredicted)}" style="width:90px;padding:3px 6px;font-size:12px;text-align:right" />
            <button class="btn btn-ghost btn-sm" onclick="Dashboard.savePredictedIncome()" style="padding:2px 8px;font-size:11px">Set</button>
          </div>
        </div>

        <!-- Chart -->
        <div id="annual-chart-inner" class="chart-wrap" style="height:220px">
          <canvas id="annual-chart-canvas"></canvas>
        </div>

        <!-- Summary -->
        <div id="annual-summary">${buildAnnualSummary()}</div>
      </div>
    `;
  }

  // ── Year Projection Table (Expandable) ──────────────────────
  let expandedSections = {};

  function toggleSection(section) {
    expandedSections[section] = !expandedSections[section];
    renderYearProjectionOnly();
  }

  function renderYearProjectionOnly() {
    const el = document.getElementById('year-projection-card');
    if (!el || !annualData) return;
    el.innerHTML = buildYearProjectionContent();
  }

  function buildYearProjectionContent() {
    if (!annualData) return '';
    const now = new Date();
    const currentMonthIdx = (annualYear === now.getFullYear()) ? now.getMonth() : -1;

    const monthLabels = annualData.map(m => {
      const [, mo] = m.month.split('-');
      return Fmt.monthShort(m.month + '-01');
    });

    const arrow = (section) => expandedSections[section]
      ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>'
      : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 6 15 12 9 18"/></svg>';

    // Totals
    const totalIncome = annualData.reduce((s, m) => {
      if (m.actualIncome > 0) return s + m.actualIncome;
      return showPredicted ? s + m.predictedIncome : s;
    }, 0);
    const totalExpenses = annualData.reduce((s, m) => s + m.actualExpenses, 0);
    const totalCommitted = annualData.reduce((s, m) => s + m.committed, 0);
    const totalOutflows = totalExpenses + totalCommitted;
    const totalSurplus = totalIncome - totalOutflows;

    // Build table header
    let html = `<div class="year-proj-table-wrap"><table class="year-proj-table"><thead><tr>
      <th class="year-proj-label-col"></th>`;
    monthLabels.forEach((lbl, i) => {
      const isCurrent = i === currentMonthIdx;
      html += `<th class="${isCurrent ? 'year-proj-current' : ''}">${lbl}</th>`;
    });
    html += `<th class="year-proj-total-col">Total</th></tr></thead><tbody>`;

    // ── Income row (expandable)
    html += `<tr class="year-proj-row year-proj-clickable" onclick="Dashboard.toggleSection('income')">
      <td class="year-proj-label-col">${arrow('income')} Income</td>`;
    annualData.forEach((m, i) => {
      const val = m.actualIncome > 0 ? m.actualIncome : (showPredicted ? m.predictedIncome : 0);
      const cls = m.isFuture ? 'year-proj-future' : '';
      const cur = i === currentMonthIdx ? 'year-proj-current' : '';
      html += `<td class="${cls} ${cur}" style="color:var(--green)">${Fmt.compact(val)}</td>`;
    });
    html += `<td class="year-proj-total-col" style="color:var(--green)">${Fmt.compact(totalIncome)}</td></tr>`;

    // Income expanded details
    if (expandedSections.income) {
      const profile = Store.profile.get();
      const b = API.calcSalaryBreakdown(profile);
      // Base salary row
      html += `<tr class="year-proj-subrow"><td class="year-proj-label-col year-proj-sub-label">Net salary</td>`;
      annualData.forEach((m, i) => {
        const cur = i === currentMonthIdx ? 'year-proj-current' : '';
        html += `<td class="${m.isFuture ? 'year-proj-future' : ''} ${cur}">${Fmt.compact(b.netSalary)}</td>`;
      });
      html += `<td class="year-proj-total-col">${Fmt.compact(b.netSalary * 12)}</td></tr>`;

      // Benefits row
      if (b.totalBenefits > 0) {
        html += `<tr class="year-proj-subrow"><td class="year-proj-label-col year-proj-sub-label">Benefits</td>`;
        annualData.forEach((m, i) => {
          const cur = i === currentMonthIdx ? 'year-proj-current' : '';
          html += `<td class="${m.isFuture ? 'year-proj-future' : ''} ${cur}">${Fmt.compact(b.totalBenefits)}</td>`;
        });
        html += `<td class="year-proj-total-col">${Fmt.compact(b.totalBenefits * 12)}</td></tr>`;
      }

      // 13th salary row
      const m1 = profile.decimo13Month1 || 11;
      const m2 = profile.decimo13Month2 || 12;
      html += `<tr class="year-proj-subrow"><td class="year-proj-label-col year-proj-sub-label">13th salary</td>`;
      annualData.forEach((m, i) => {
        const mo = i + 1;
        const val = (mo === m1 || mo === m2) ? b.decimoTerceiroNet / 2 : 0;
        const cur = i === currentMonthIdx ? 'year-proj-current' : '';
        html += `<td class="${m.isFuture ? 'year-proj-future' : ''} ${cur}">${val > 0 ? Fmt.compact(val) : '—'}</td>`;
      });
      html += `<td class="year-proj-total-col">${Fmt.compact(b.decimoTerceiroNet)}</td></tr>`;
    }

    // ── Expenses row
    html += `<tr class="year-proj-row"><td class="year-proj-label-col">Expenses</td>`;
    annualData.forEach((m, i) => {
      const cur = i === currentMonthIdx ? 'year-proj-current' : '';
      html += `<td class="${m.isFuture ? 'year-proj-future' : ''} ${cur}" style="color:var(--red)">${m.actualExpenses > 0 ? Fmt.compact(m.actualExpenses) : '—'}</td>`;
    });
    html += `<td class="year-proj-total-col" style="color:var(--red)">${Fmt.compact(totalExpenses)}</td></tr>`;

    // ── Committed row (expandable)
    html += `<tr class="year-proj-row year-proj-clickable" onclick="Dashboard.toggleSection('committed')">
      <td class="year-proj-label-col">${arrow('committed')} Committed</td>`;
    annualData.forEach((m, i) => {
      const cur = i === currentMonthIdx ? 'year-proj-current' : '';
      html += `<td class="${m.isFuture ? 'year-proj-future' : ''} ${cur}" style="color:var(--orange)">${Fmt.compact(m.committed)}</td>`;
    });
    html += `<td class="year-proj-total-col" style="color:var(--orange)">${Fmt.compact(totalCommitted)}</td></tr>`;

    // Committed expanded details
    if (expandedSections.committed) {
      // Subscriptions
      if (annualData[0].subscriptions > 0) {
        html += `<tr class="year-proj-subrow"><td class="year-proj-label-col year-proj-sub-label">Subscriptions</td>`;
        annualData.forEach((m, i) => {
          const cur = i === currentMonthIdx ? 'year-proj-current' : '';
          html += `<td class="${m.isFuture ? 'year-proj-future' : ''} ${cur}">${Fmt.compact(m.subscriptions)}</td>`;
        });
        html += `<td class="year-proj-total-col">${Fmt.compact(annualData.reduce((s, m) => s + m.subscriptions, 0))}</td></tr>`;

        // Individual subscription items
        (annualData[0].subscriptionItems || []).forEach(sub => {
          html += `<tr class="year-proj-subrow year-proj-detail"><td class="year-proj-label-col year-proj-detail-label">${sub.emoji || '📱'} ${App.esc(sub.name)}</td>`;
          annualData.forEach((m, i) => {
            const cur = i === currentMonthIdx ? 'year-proj-current' : '';
            html += `<td class="${m.isFuture ? 'year-proj-future' : ''} ${cur}">${Fmt.compact(sub.amount)}</td>`;
          });
          html += `<td class="year-proj-total-col">${Fmt.compact(sub.amount * 12)}</td></tr>`;
        });
      }

      // Installments
      html += `<tr class="year-proj-subrow"><td class="year-proj-label-col year-proj-sub-label">Installments</td>`;
      annualData.forEach((m, i) => {
        const cur = i === currentMonthIdx ? 'year-proj-current' : '';
        html += `<td class="${m.isFuture ? 'year-proj-future' : ''} ${cur}">${m.installments > 0 ? Fmt.compact(m.installments) : '—'}</td>`;
      });
      html += `<td class="year-proj-total-col">${Fmt.compact(annualData.reduce((s, m) => s + m.installments, 0))}</td></tr>`;

      // Loan payments
      if (annualData[0].loanPayments > 0) {
        html += `<tr class="year-proj-subrow"><td class="year-proj-label-col year-proj-sub-label">Loan payments</td>`;
        annualData.forEach((m, i) => {
          const cur = i === currentMonthIdx ? 'year-proj-current' : '';
          html += `<td class="${m.isFuture ? 'year-proj-future' : ''} ${cur}">${Fmt.compact(m.loanPayments)}</td>`;
        });
        html += `<td class="year-proj-total-col">${Fmt.compact(annualData.reduce((s, m) => s + m.loanPayments, 0))}</td></tr>`;

        // Individual loan items
        (annualData[0].loanItems || []).forEach(loan => {
          html += `<tr class="year-proj-subrow year-proj-detail"><td class="year-proj-label-col year-proj-detail-label">${App.esc(loan.name || 'Loan')}</td>`;
          annualData.forEach((m, i) => {
            const cur = i === currentMonthIdx ? 'year-proj-current' : '';
            html += `<td class="${m.isFuture ? 'year-proj-future' : ''} ${cur}">${Fmt.compact(loan.monthlyPayment || 0)}</td>`;
          });
          html += `<td class="year-proj-total-col">${Fmt.compact((loan.monthlyPayment || 0) * 12)}</td></tr>`;
        });
      }
    }

    // ── Total Outflows row
    html += `<tr class="year-proj-row year-proj-divider"><td class="year-proj-label-col" style="font-weight:600">Total Outflows</td>`;
    annualData.forEach((m, i) => {
      const total = m.actualExpenses + m.committed;
      const cur = i === currentMonthIdx ? 'year-proj-current' : '';
      html += `<td class="${m.isFuture ? 'year-proj-future' : ''} ${cur}" style="font-weight:600;color:var(--red)">${Fmt.compact(total)}</td>`;
    });
    html += `<td class="year-proj-total-col" style="font-weight:600;color:var(--red)">${Fmt.compact(totalOutflows)}</td></tr>`;

    // ── Net Surplus row
    html += `<tr class="year-proj-row year-proj-surplus"><td class="year-proj-label-col" style="font-weight:700">Net Surplus</td>`;
    annualData.forEach((m, i) => {
      const inc = m.actualIncome > 0 ? m.actualIncome : (showPredicted ? m.predictedIncome : 0);
      const surplus = inc - m.actualExpenses - m.committed;
      const cur = i === currentMonthIdx ? 'year-proj-current' : '';
      html += `<td class="${m.isFuture ? 'year-proj-future' : ''} ${cur}" style="font-weight:700;color:${surplus >= 0 ? 'var(--green)' : 'var(--red)'}">${Fmt.compact(surplus)}</td>`;
    });
    html += `<td class="year-proj-total-col" style="font-weight:700;color:${totalSurplus >= 0 ? 'var(--green)' : 'var(--red)'}">${Fmt.compact(totalSurplus)}</td></tr>`;

    html += `</tbody></table></div>`;
    return html;
  }

  function renderYearProjectionSection() {
    return `
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header" style="margin-bottom:var(--space-sm)">
          <span class="card-title">Year Projection</span>
          <span class="pill pill-blue" style="font-size:10px">${annualYear}</span>
        </div>
        <div id="year-projection-card">${buildYearProjectionContent()}</div>
      </div>
    `;
  }

  function renderSalaryCard() {
    const profile = Store.profile.get();
    if (!profile.salary) return '';
    const b = API.calcSalaryBreakdown(profile);

    const row = (label, val, color) => `
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">
        <span style="color:var(--text-secondary)">${label}</span>
        <span style="color:${color || 'var(--text)'};font-family:var(--font-mono)">${val}</span>
      </div>`;

    return `
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header" style="margin-bottom:var(--space-sm)">
          <span class="card-title">Salary Breakdown</span>
          <span class="pill pill-blue" style="font-size:10px">CLT</span>
        </div>
        ${row('Gross salary', Fmt.currency(b.gross))}
        ${row('INSS', '-' + Fmt.currency(b.inss), 'var(--red)')}
        ${row('IRRF', '-' + Fmt.currency(b.irrf), 'var(--red)')}
        ${b.healthPlan ? row('Health plan', '-' + Fmt.currency(b.healthPlan), 'var(--red)') : ''}
        ${b.dental ? row('Dental', '-' + Fmt.currency(b.dental), 'var(--red)') : ''}
        ${b.vt ? row('Vale Transporte', '-' + Fmt.currency(b.vt), 'var(--red)') : ''}
        ${b.otherDeduct ? row('Other deductions', '-' + Fmt.currency(b.otherDeduct), 'var(--red)') : ''}

        <div style="border-top:1px solid var(--border);margin:var(--space-sm) 0;padding-top:var(--space-sm)">
          ${row('<strong>Net salary</strong>', '<strong>' + Fmt.currency(b.netSalary) + '</strong>', 'var(--green)')}
        </div>

        ${b.totalBenefits > 0 ? `
          ${row('+ VA/VR/Benefits', '+' + Fmt.currency(b.totalBenefits), 'var(--blue)')}
          ${row('<strong>Total take-home</strong>', '<strong>' + Fmt.currency(b.totalTakeHome) + '</strong>', 'var(--green)')}
        ` : ''}

        <div style="border-top:1px solid var(--border);margin-top:var(--space-sm);padding-top:var(--space-sm)">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-sm);text-align:center">
            <div>
              <div style="font-size:10px;color:var(--text-muted)">FGTS/mo</div>
              <div style="font-size:13px;font-weight:600;color:var(--blue)">${Fmt.compact(b.fgtsMonthly)}</div>
            </div>
            <div>
              <div style="font-size:10px;color:var(--text-muted)">13th (net)</div>
              <div style="font-size:13px;font-weight:600;color:var(--green)">${Fmt.compact(b.decimoTerceiroNet)}</div>
            </div>
            <div>
              <div style="font-size:10px;color:var(--text-muted)">Vacation $</div>
              <div style="font-size:13px;font-weight:600;color:var(--green)">${Fmt.compact(b.vacationBonus + b.abonoPecuniario)}</div>
            </div>
          </div>
          ${b.daysToSell > 0 ? `<div style="font-size:10px;color:var(--text-muted);text-align:center;margin-top:4px">Selling ${b.daysToSell} vacation days = ${Fmt.currency(b.abonoPecuniario)}</div>` : ''}
          <div style="font-size:11px;text-align:center;margin-top:var(--space-sm);color:var(--text-muted)">
            Annual total: <strong style="color:var(--green)">${Fmt.currency(b.annualTotal)}</strong>
          </div>
        </div>
      </div>
    `;
  }

  return { render, saveNewSubscription, deleteSubscription, setAnnualYear, getAnnualYear: () => annualYear, togglePredicted, savePredictedIncome, toggleSection };
})();
