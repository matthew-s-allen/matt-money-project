/* ============================================================
   TRANSACTIONS VIEW — "Race History" — Full transaction log
   ============================================================ */

const Transactions = (() => {
  let allTx = [];
  let filtered = [];
  let activeFilter = 'all';
  let searchQuery = '';

  async function render() {
    const container = document.getElementById('view-transactions');
    container.innerHTML = renderSkeleton();

    try {
      allTx = await API.getTransactions({ month: App.state.activeMonth });
      filtered = allTx;
      renderFull(container);
    } catch (e) {
      container.innerHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/></svg>
          <h3>Connection Error</h3>
          <p>${e.message}</p>
          <button class="btn btn-primary btn-sm" onclick="Transactions.render()">Retry</button>
        </div>
      `;
    }
  }

  function renderSkeleton() {
    return Array(5).fill(0).map(() => `
      <div style="display:flex;align-items:center;gap:var(--space-md);padding:var(--space-sm) 0;border-bottom:1px solid var(--border)">
        <div class="skeleton" style="width:40px;height:40px;border-radius:var(--radius-md);flex-shrink:0"></div>
        <div style="flex:1">
          <div class="skeleton" style="height:14px;width:60%;margin-bottom:6px"></div>
          <div class="skeleton" style="height:11px;width:40%"></div>
        </div>
        <div class="skeleton" style="height:14px;width:60px"></div>
      </div>
    `).join('');
  }

  function renderFull(container) {
    const totalIncome   = allTx.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
    const totalExpenses = allTx.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
    const now = new Date();
    const [y, m] = App.state.activeMonth.split('-').map(Number);
    const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1;

    container.innerHTML = `
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md)">
        <div>
          <div class="section-title">Race History</div>
          <div class="section-subtitle">All transactions</div>
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

      <!-- Monthly summary pills -->
      <div class="grid-2" style="margin-bottom:var(--space-md)">
        <div class="card" style="text-align:center">
          <div class="stat-label">Income</div>
          <div class="stat-value positive" style="font-size:20px;margin-top:4px">${Fmt.currency(totalIncome)}</div>
        </div>
        <div class="card" style="text-align:center">
          <div class="stat-label">Expenses</div>
          <div class="stat-value negative" style="font-size:20px;margin-top:4px">${Fmt.currency(totalExpenses)}</div>
        </div>
      </div>

      <!-- Search -->
      <div class="search-bar" style="margin-bottom:var(--space-sm)">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="tx-search" placeholder="Search transactions..." oninput="Transactions.search(this.value)" />
      </div>

      <!-- Filter chips -->
      <div class="filter-row" style="margin-bottom:var(--space-md)">
        <div class="chip ${activeFilter === 'all' ? 'active' : ''}" onclick="Transactions.filter('all')">All (${allTx.length})</div>
        <div class="chip ${activeFilter === 'expense' ? 'active' : ''}" onclick="Transactions.filter('expense')">Expenses</div>
        <div class="chip ${activeFilter === 'income' ? 'active' : ''}" onclick="Transactions.filter('income')">Income</div>
        ${App.CATEGORIES.map(cat => {
          const count = allTx.filter(t => t.category === cat.id).length;
          if (!count) return '';
          return `<div class="chip ${activeFilter === cat.id ? 'active' : ''}" onclick="Transactions.filter('${cat.id}')">${cat.emoji} ${cat.label} (${count})</div>`;
        }).join('')}
      </div>

      <!-- Transaction list -->
      <div class="card" id="tx-list-container">
        <div id="tx-list"></div>
      </div>
    `;

    applyFilter();
  }

  function applyFilter() {
    const q = searchQuery.toLowerCase();
    filtered = allTx.filter(tx => {
      const matchFilter = activeFilter === 'all' || tx.type === activeFilter || tx.category === activeFilter;
      const matchSearch = !q ||
        (tx.description || '').toLowerCase().includes(q) ||
        (tx.merchant || '').toLowerCase().includes(q) ||
        (tx.notes || '').toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });

    renderList();
  }

  function renderList() {
    const el = document.getElementById('tx-list');
    if (!el) return;

    if (!filtered.length) {
      el.innerHTML = `
        <div class="empty-state" style="padding:var(--space-xl) 0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <h3>No transactions found</h3>
          <p>${searchQuery ? `No results for "${searchQuery}"` : 'No transactions match this filter'}</p>
        </div>
      `;
      return;
    }

    // Group by date
    const groups = {};
    filtered.forEach(tx => {
      const key = tx.date;
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });

    const sortedDates = Object.keys(groups).sort((a,b) => b.localeCompare(a));

    el.innerHTML = sortedDates.map(date => {
      const txs = groups[date];
      const dayTotal = txs.reduce((s,t) => s + (t.type === 'expense' ? -t.amount : t.amount), 0);
      return `
        <div style="margin-bottom:var(--space-sm)">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-sm) 0;border-bottom:1px solid var(--border)">
            <span style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted)">${Fmt.relativeDate(date)}</span>
            <span style="font-family:var(--font-mono);font-size:12px;color:${dayTotal >= 0 ? 'var(--green)' : 'var(--red)'}">${Fmt.delta(dayTotal)}</span>
          </div>
          ${txs.map(tx => renderTxItem(tx)).join('')}
        </div>
      `;
    }).join('');
  }

  function renderTxItem(tx) {
    const cat = App.getCat(tx.category);
    const txJson = JSON.stringify(tx).replace(/"/g, '&quot;');
    return `
      <div class="tx-item" onclick="App.openTxDetail(${txJson})" style="cursor:pointer">
        <div class="tx-icon">${cat.emoji}</div>
        <div class="tx-info">
          <div class="tx-name">${tx.description || tx.merchant || 'Transaction'}</div>
          <div class="tx-meta">${cat.label}${tx.merchant && tx.merchant !== tx.description ? ' · ' + tx.merchant : ''}</div>
        </div>
        <div class="tx-amount ${tx.type === 'income' ? 'income' : 'expense'}">${tx.type === 'income' ? '+' : '-'}${Fmt.currency(tx.amount)}</div>
      </div>
    `;
  }

  function filter(value) {
    activeFilter = value;
    // Update chip states
    document.querySelectorAll('.filter-row .chip').forEach(chip => {
      chip.classList.toggle('active', chip.textContent.startsWith(
        value === 'all' ? 'All' :
        value === 'expense' ? 'Expenses' :
        value === 'income' ? 'Income' :
        App.getCat(value).emoji
      ));
    });
    applyFilter();
  }

  function search(query) {
    searchQuery = query;
    applyFilter();
  }

  return { render, filter, search };
})();
