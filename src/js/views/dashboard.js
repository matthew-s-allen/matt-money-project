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
      <div class="skeleton" style="height:140px;border-radius:var(--radius-xl);margin-bottom:var(--space-md)"></div>
      <div class="grid-2">
        <div class="skeleton" style="height:100px;border-radius:var(--radius-lg)"></div>
        <div class="skeleton" style="height:100px;border-radius:var(--radius-lg)"></div>
      </div>
      <div class="skeleton" style="height:200px;border-radius:var(--radius-lg);margin-top:var(--space-md)"></div>
    `;
  }

  async function render() {
    const container = document.getElementById('view-dashboard');
    container.innerHTML = renderSkeleton();

    try {
      const [s, h, accounts, cards] = await Promise.all([
        API.getSummary(App.state.activeMonth),
        API.getMonthlyHistory(6),
        API.getAccounts(),
        API.getCreditCards()
      ]);
      summary = s;
      history = h;
      renderFull(container, s, h, accounts, cards);
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

  function renderFull(container, s, h, accounts, cards) {
    Object.values(charts).forEach(c => c?.destroy());
    charts = {};

    const income   = s.totalIncome   || 0;
    const expenses = s.totalExpenses || 0;
    const balance  = income - expenses;
    const savingsRate = income > 0 ? ((income - expenses) / income * 100) : 0;
    const cats = s.byCategory || {};

    const getStatus = (rate) => {
      if (rate >= 30) return { label: 'Great', color: 'var(--green)', class: 'pill-green' };
      if (rate >= 15) return { label: 'OK', color: 'var(--yellow)', class: 'pill-yellow' };
      return { label: 'Over budget', color: 'var(--red)', class: 'pill-red' };
    };
    const status = getStatus(savingsRate);

    const now = new Date();
    const [y, m] = App.state.activeMonth.split('-').map(Number);
    const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1;

    const totalBankBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const totalCardBalance = cards.reduce((s, c) => s + (c.currentBalance || 0), 0);

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

      <!-- Hero: Balance -->
      <div class="hero-card" style="margin-bottom:var(--space-md)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-sm)">
          <div class="hero-label">Monthly Balance</div>
          <span class="pill ${status.class}">${status.label} · ${Fmt.percent(savingsRate)}</span>
        </div>
        <div class="hero-value" style="color:${balance >= 0 ? 'var(--green)' : 'var(--red)'}">${Fmt.currency(balance)}</div>

        <div style="margin-bottom:var(--space-sm)">
          <div class="seg-bar">
            <div class="seg-bar-piece" style="background:var(--green);width:${income > 0 ? Math.min(100, expenses/income*100) : 100}%"></div>
            <div style="flex:1;background:var(--bg-input)"></div>
          </div>
        </div>

        <div class="hero-grid">
          <div class="stat-block">
            <div class="stat-label">Income</div>
            <div class="stat-value positive" style="font-size:18px">${Fmt.compact(income)}</div>
          </div>
          <div class="stat-block" style="text-align:center">
            <div class="stat-label">Expenses</div>
            <div class="stat-value negative" style="font-size:18px">${Fmt.compact(expenses)}</div>
          </div>
          <div class="stat-block" style="text-align:right">
            <div class="stat-label">Save rate</div>
            <div class="stat-value" style="font-size:18px;color:${status.color}">${Fmt.percent(savingsRate)}</div>
          </div>
        </div>
      </div>

      <!-- Account balances -->
      ${(accounts.length > 0 || cards.length > 0) ? `
      <div class="grid-2" style="margin-bottom:var(--space-md)">
        <div class="card" style="cursor:pointer" onclick="App.navigate('accounts')">
          <div class="card-title">Bank Balance</div>
          <div class="stat-value positive" style="font-size:20px;margin-top:var(--space-sm)">${Fmt.compact(totalBankBalance)}</div>
          <div class="t-muted" style="margin-top:4px">${accounts.length} account${accounts.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="card" style="cursor:pointer" onclick="App.navigate('accounts')">
          <div class="card-title">Card Balance</div>
          <div class="stat-value negative" style="font-size:20px;margin-top:var(--space-sm)">${Fmt.compact(totalCardBalance)}</div>
          <div class="t-muted" style="margin-top:4px">${cards.length} card${cards.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      ` : ''}

      <!-- Quick stats -->
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

      <!-- Spending by category -->
      ${Object.keys(cats).length > 0 ? `
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Category Breakdown</span>
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('transactions')">See all</button>
        </div>
        <div class="telemetry-list" id="cat-telemetry"></div>
      </div>
      ` : ''}

      <!-- 6-month trend -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">6-Month Trend</span>
        </div>
        <div class="chart-wrap" style="height:180px">
          <canvas id="trend-chart"></canvas>
        </div>
      </div>

      <!-- Category donut -->
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

      <!-- Recent transactions -->
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
    renderTrendChart(h);
  }

  function renderTxItem(tx) {
    const cat = App.getCat(tx.category);
    return `
      <div class="tx-item" onclick="App.openTxDetail(${JSON.stringify(tx).replace(/"/g, '&quot;')})">
        <div class="tx-icon">${cat.emoji}</div>
        <div class="tx-info">
          <div class="tx-name">${tx.description || tx.merchant || 'Transaction'}</div>
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

  function renderTrendChart(h) {
    const canvas = document.getElementById('trend-chart');
    if (!canvas || !h || !h.length) return;

    const labels   = h.map(m => Fmt.monthShort(m.month + '-01'));
    const incomes  = h.map(m => m.income || 0);
    const expenses = h.map(m => m.expenses || 0);
    const cc = getChartColors();

    if (charts.trend) charts.trend.destroy();
    charts.trend = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Income',
            data: incomes,
            backgroundColor: 'rgba(34,197,94,0.4)',
            borderColor: 'rgba(34,197,94,0.7)',
            borderWidth: 1,
            borderRadius: 6,
            order: 2
          },
          {
            label: 'Expenses',
            data: expenses,
            backgroundColor: 'rgba(239,68,68,0.4)',
            borderColor: 'rgba(239,68,68,0.7)',
            borderWidth: 1,
            borderRadius: 6,
            order: 3
          },
          {
            label: 'Balance',
            data: h.map(m => (m.income||0) - (m.expenses||0)),
            type: 'line',
            borderColor: cc.line,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointBackgroundColor: cc.line,
            pointRadius: 3,
            tension: 0.3,
            order: 1
          }
        ]
      },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          x: { grid: { color: cc.grid }, ticks: { color: cc.tick, font: { family: 'Inter', size: 11 } }, border: { color: cc.axis } },
          y: { grid: { color: cc.grid }, ticks: { color: cc.tick, font: { family: 'Inter', size: 11 }, callback: v => Fmt.compact(v) }, border: { color: cc.axis } }
        },
        plugins: {
          ...CHART_DEFAULTS.plugins,
          legend: { display: true, position: 'top', align: 'end', labels: { color: cc.tick, font: { size: 11 }, boxWidth: 12, padding: 12 } },
          tooltip: { ...cc.tooltip, padding: 12, cornerRadius: 10,
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${Fmt.currency(ctx.raw)}` }
          }
        }
      }
    });
  }

  return { render };
})();
