/* ============================================================
   TRANSACTIONS VIEW — "Race History" — Full transaction log
   + Products tab — price history for every scanned item
   ============================================================ */

const Transactions = (() => {
  let allTx        = [];
  let filtered     = [];
  let activeFilter = 'all';
  let searchQuery  = '';
  let activeTab    = 'transactions';

  // Populated when Products tab renders; keyed by array index for onclick safety
  let productCache = [];
  let productSearchQuery = '';

  async function render() {
    const container = document.getElementById('view-transactions');
    container.innerHTML = renderSkeleton();

    try {
      allTx    = await API.getTransactions({ month: App.state.activeMonth });
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
          <div class="section-title">Transactions</div>
          <div class="section-subtitle">History & product tracker</div>
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

      <!-- Tab bar -->
      <div style="display:flex;border-bottom:2px solid var(--border);margin-bottom:var(--space-md)">
        <button id="tab-btn-transactions" onclick="Transactions.setTab('transactions')"
          style="flex:1;background:none;border:none;border-bottom:2px solid ${activeTab==='transactions'?'var(--primary)':'transparent'};margin-bottom:-2px;padding:var(--space-sm) var(--space-md);color:${activeTab==='transactions'?'var(--primary)':'var(--text-muted)'};cursor:pointer;font-size:13px;font-weight:600;transition:all .15s">
          Transactions
        </button>
        <button id="tab-btn-products" onclick="Transactions.setTab('products')"
          style="flex:1;background:none;border:none;border-bottom:2px solid ${activeTab==='products'?'var(--primary)':'transparent'};margin-bottom:-2px;padding:var(--space-sm) var(--space-md);color:${activeTab==='products'?'var(--primary)':'var(--text-muted)'};cursor:pointer;font-size:13px;font-weight:600;transition:all .15s">
          🏷️ Products
        </button>
      </div>

      <!-- Tab content -->
      <div id="tab-content">
        ${activeTab === 'transactions' ? renderTransactionsContent() : renderProductsContent()}
      </div>
    `;

    if (activeTab === 'transactions') applyFilter();
  }

  // ── Transactions tab ───────────────────────────────────────
  function renderTransactionsContent() {
    return `
      <div class="search-bar" style="margin-bottom:var(--space-sm)">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="tx-search" placeholder="Search transactions..." oninput="Transactions.search(this.value)" />
      </div>

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

      <div class="card" id="tx-list-container">
        <div id="tx-list"></div>
      </div>
    `;
  }

  function applyFilter() {
    const q = searchQuery.toLowerCase();
    filtered = allTx.filter(tx => {
      const matchFilter = activeFilter === 'all' || tx.type === activeFilter || tx.category === activeFilter;
      const matchSearch = !q ||
        (tx.description || '').toLowerCase().includes(q) ||
        (tx.merchant    || '').toLowerCase().includes(q) ||
        (tx.notes       || '').toLowerCase().includes(q);
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

    const groups = {};
    filtered.forEach(tx => {
      if (!groups[tx.date]) groups[tx.date] = [];
      groups[tx.date].push(tx);
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
    const cat    = App.getCat(tx.category);
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
    document.querySelectorAll('.filter-row .chip').forEach(chip => {
      chip.classList.toggle('active', chip.textContent.startsWith(
        value === 'all'     ? 'All' :
        value === 'expense' ? 'Expenses' :
        value === 'income'  ? 'Income' :
        App.getCat(value).emoji
      ));
    });
    applyFilter();
  }

  function search(query) {
    searchQuery = query;
    applyFilter();
  }

  // ── Products tab ───────────────────────────────────────────
  function renderProductsContent() {
    // Query ALL transactions (not just current month) for cross-time price tracking
    const allTimeTx = Store.data.getTransactions();
    const productMap = new Map();

    allTimeTx.forEach(tx => {
      if (!tx.items?.length) return;
      tx.items.forEach(item => {
        if (!item.name) return;
        // Group by barcode when available, otherwise by normalised name
        const key = item.barcode || item.name.toUpperCase().trim();
        if (!productMap.has(key)) {
          productMap.set(key, {
            key,
            name:     item.name,
            barcode:  item.barcode || null,
            unit:     item.unit    || null,
            purchases: [],
          });
        }
        productMap.get(key).purchases.push({
          date:       tx.date        || '',
          merchant:   tx.merchant    || tx.description || '',
          qty:        item.qty       || 1,
          unit:       item.unit      || null,
          unit_price: item.unit_price || (item.price / (item.qty || 1)),
          price:      item.price     || 0,
          discount:   item.discount  || 0,
        });
      });
    });

    // Enrich and sort each product's purchases
    productCache = [...productMap.values()].map(p => {
      p.purchases.sort((a,b) => (b.date||'').localeCompare(a.date||''));
      p.lastDate  = p.purchases[0]?.date  || '';
      p.lastPrice = p.purchases[0]?.price || 0;
      p.count     = p.purchases.length;

      // Price trend (first vs latest purchase)
      if (p.count >= 2) {
        const oldest = p.purchases[p.count - 1].price;
        const latest = p.purchases[0].price;
        p.trend      = latest > oldest ? '↑' : latest < oldest ? '↓' : '→';
        p.trendColor = latest > oldest ? 'var(--red)' : latest < oldest ? 'var(--green)' : 'var(--text-muted)';
      } else {
        p.trend      = '';
        p.trendColor = 'var(--text-muted)';
      }
      return p;
    }).sort((a,b) => (b.lastDate||'').localeCompare(a.lastDate||''));

    if (!productCache.length) {
      return `
        <div class="empty-state" style="padding:var(--space-xl) 0">
          <div style="font-size:48px;margin-bottom:var(--space-md)">🏷️</div>
          <h3>No products tracked yet</h3>
          <p>Scan a supermarket receipt with AI to start tracking individual item prices over time.</p>
        </div>
      `;
    }

    return `
      <div class="search-bar" style="margin-bottom:var(--space-sm)">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="product-search" placeholder="Search products or barcode…" oninput="Transactions.searchProducts(this.value)" value="${productSearchQuery}" />
      </div>
      <div class="card" id="products-list">
        ${renderProductList(productCache)}
      </div>
      <div style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:var(--space-sm)">
        ${productCache.length} unique products tracked across all time
      </div>
    `;
  }

  function renderProductList(products) {
    if (!products.length) {
      return `<div class="t-muted" style="padding:var(--space-md);text-align:center">No products match your search</div>`;
    }
    return products.map((p, localIdx) => {
      // Use the index in productCache (not localIdx from filtered results)
      const cacheIdx = productCache.indexOf(p);
      return renderProductRow(p, cacheIdx);
    }).join('');
  }

  function renderProductRow(p, cacheIdx) {
    const totalSpent = p.purchases.reduce((s, pur) => s + pur.price, 0);
    return `
      <div class="tx-item" onclick="Transactions.openProductDetail(${cacheIdx})" style="cursor:pointer">
        <div class="tx-icon" style="font-size:22px;background:var(--surface-3)">🏷️</div>
        <div class="tx-info" style="min-width:0">
          <div class="tx-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
          <div class="tx-meta">
            ${p.count} purchase${p.count > 1 ? 's' : ''}
            · ${Fmt.relativeDate(p.lastDate)}
            ${p.barcode ? `<span style="font-family:var(--font-mono);font-size:10px;margin-left:4px;color:var(--text-muted)">${p.barcode}</span>` : ''}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:var(--font-mono);font-size:13px;font-weight:600">${Fmt.currency(p.lastPrice)}</div>
          ${p.trend
            ? `<div style="font-size:12px;color:${p.trendColor};font-weight:700">${p.trend}</div>`
            : `<div style="font-size:10px;color:var(--text-muted)">${Fmt.currency(totalSpent)} total</div>`
          }
        </div>
      </div>
    `;
  }

  function searchProducts(query) {
    productSearchQuery = query.toLowerCase().trim();
    const list = document.getElementById('products-list');
    if (!list) return;
    const result = productSearchQuery
      ? productCache.filter(p =>
          p.name.toLowerCase().includes(productSearchQuery) ||
          (p.barcode || '').toLowerCase().includes(productSearchQuery)
        )
      : productCache;
    list.innerHTML = renderProductList(result);
  }

  function openProductDetail(cacheIdx) {
    const p = productCache[cacheIdx];
    if (!p) return;

    const modal   = document.getElementById('tx-detail-modal');
    const content = document.getElementById('tx-detail-content');
    const prices  = p.purchases.map(pur => pur.price);
    const minP    = Math.min(...prices);
    const maxP    = Math.max(...prices);
    const avgP    = prices.reduce((s,v) => s + v, 0) / prices.length;
    const totalSpent = prices.reduce((s,v) => s + v, 0);

    content.innerHTML = `
      <div class="modal-handle"></div>

      <div style="display:flex;align-items:flex-start;gap:var(--space-md);margin-bottom:var(--space-lg)">
        <div class="tx-icon" style="width:52px;height:52px;font-size:28px;flex-shrink:0">🏷️</div>
        <div style="min-width:0">
          <div style="font-family:var(--font-display);font-size:17px;font-weight:700;line-height:1.3">${p.name}</div>
          ${p.barcode ? `<div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px">${p.barcode}</div>` : ''}
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${p.count} purchase${p.count > 1 ? 's' : ''} · ${Fmt.currency(totalSpent)} total</div>
        </div>
      </div>

      ${prices.length >= 2 ? `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-sm);margin-bottom:var(--space-lg)">
          <div class="card" style="text-align:center;padding:var(--space-sm)">
            <div class="stat-label">Lowest</div>
            <div style="font-family:var(--font-mono);font-size:14px;color:var(--green);font-weight:700;margin-top:4px">${Fmt.currency(minP)}</div>
          </div>
          <div class="card" style="text-align:center;padding:var(--space-sm)">
            <div class="stat-label">Average</div>
            <div style="font-family:var(--font-mono);font-size:14px;font-weight:700;margin-top:4px">${Fmt.currency(avgP)}</div>
          </div>
          <div class="card" style="text-align:center;padding:var(--space-sm)">
            <div class="stat-label">Highest</div>
            <div style="font-family:var(--font-mono);font-size:14px;color:var(--red);font-weight:700;margin-top:4px">${Fmt.currency(maxP)}</div>
          </div>
        </div>
      ` : ''}

      <div class="t-label" style="margin-bottom:var(--space-sm)">Purchase history</div>
      ${p.purchases.map((pur, i) => {
        const prevPur   = p.purchases[i + 1];
        const trend     = prevPur != null
          ? (pur.price > prevPur.price ? '↑' : pur.price < prevPur.price ? '↓' : '→')
          : '';
        const trendClr  = trend === '↑' ? 'var(--red)' : trend === '↓' ? 'var(--green)' : 'var(--text-muted)';
        const unitLabel = pur.unit ? `${pur.qty} ${pur.unit}` : `× ${pur.qty}`;
        const upLabel   = pur.unit_price && pur.unit ? `${Fmt.currency(pur.unit_price)}/${pur.unit}` : '';
        return `
          <div style="display:flex;align-items:center;gap:var(--space-sm);padding:var(--space-sm) 0;border-bottom:1px solid var(--border)">
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:500">${Fmt.dateShort(pur.date)}</div>
              <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${pur.merchant}</div>
            </div>
            <div style="font-size:11px;color:var(--text-muted);text-align:right;white-space:nowrap">
              <div>${unitLabel}</div>
              ${upLabel ? `<div style="font-size:10px">${upLabel}</div>` : ''}
            </div>
            <div style="text-align:right;flex-shrink:0;min-width:56px">
              <div style="font-family:var(--font-mono);font-size:14px;font-weight:600">${Fmt.currency(pur.price)}</div>
              ${trend ? `<div style="font-size:11px;color:${trendClr};font-weight:700">${trend}</div>` : ''}
            </div>
          </div>
        `;
      }).join('')}

      <button class="btn btn-secondary" style="width:100%;margin-top:var(--space-lg)"
        onclick="document.getElementById('tx-detail-modal').classList.add('hidden')">Close</button>
    `;

    modal.classList.remove('hidden');
  }

  function setTab(tab) {
    activeTab = tab;
    const content = document.getElementById('tab-content');
    if (!content) return;

    // Update tab button styles
    ['transactions','products'].forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      if (!btn) return;
      const active = t === tab;
      btn.style.borderBottomColor = active ? 'var(--primary)' : 'transparent';
      btn.style.color = active ? 'var(--primary)' : 'var(--text-muted)';
    });

    content.innerHTML = tab === 'transactions' ? renderTransactionsContent() : renderProductsContent();
    if (tab === 'transactions') applyFilter();
  }

  return { render, filter, search, setTab, searchProducts, openProductDetail };
})();
