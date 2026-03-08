/* ============================================================
   PATRIMÔNIO VIEW — "Garage" — Full net worth dashboard
   ============================================================ */

const Patrimonio = (() => {
  let charts = {};

  async function render() {
    const container = document.getElementById('view-patrimonio');
    container.innerHTML = renderSkeleton();

    try {
      const [data, debts, creditCards] = await Promise.all([
        API.getPatrimonio(),
        API.getDebts(),
        API.getCreditCards()
      ]);
      renderFull(container, data, debts, creditCards);
    } catch (e) {
      container.innerHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/></svg>
          <h3>Connection Error</h3>
          <p>${e.message}</p>
          <button class="btn btn-primary btn-sm" onclick="Patrimonio.render()">Retry</button>
        </div>
      `;
    }
  }

  function renderSkeleton() {
    return `
      <div class="skeleton" style="height:160px;border-radius:var(--radius-xl);margin-bottom:var(--space-md)"></div>
      <div class="skeleton" style="height:120px;border-radius:var(--radius-lg);margin-bottom:var(--space-md)"></div>
      <div class="skeleton" style="height:200px;border-radius:var(--radius-lg)"></div>
    `;
  }

  function renderFull(container, data, debts, creditCards) {
    Object.values(charts).forEach(c => c?.destroy());
    charts = {};

    const profile = Store.profile.get();

    // Use Sheet data or fall back to profile defaults
    const fgts      = data?.fgts      ?? profile.fgts     ?? 68000;
    const carValue  = data?.carValue   ?? profile.carValue ?? 50000;
    const savings   = data?.savings    ?? 0;
    const investments = data?.investments ?? 0;
    const debtFromDebts = debts?.reduce((s, d) => s + (d.balance || 0), 0) || 0;
    const debtFromCards = creditCards?.reduce((s, c) => s + (c.currentBalance || 0), 0) || 0;
    const totalDebt = debtFromDebts + debtFromCards || profile.debtTotal || 0;

    const totalAssets      = fgts + carValue + savings + investments;
    const netWorth         = totalAssets - totalDebt;
    const netWorthPositive = netWorth >= 0;

    // FGTS projection (1 year)
    const fgtsIn1Year = fgts * 1.06 + (profile.salary * 0.08 * 12);
    const fgtsWithMulta = fgts * 1.40;

    container.innerHTML = `
      <!-- Net Worth Hero -->
      <div class="section-header">
        <div>
          <div class="section-title">Net Worth</div>
          <div class="section-subtitle">Total patrimônio</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="Patrimonio.edit()">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Update
        </button>
      </div>

      <div class="hero-card" style="margin-bottom:var(--space-md)">
        <div class="hero-label">Net Worth (Patrimônio Líquido)</div>
        <div class="hero-value" style="color:${netWorthPositive ? 'var(--green)' : 'var(--red)'}">${Fmt.currency(netWorth)}</div>
        <div style="color:var(--text-secondary);font-size:13px;margin-top:var(--space-sm)">
          Assets ${Fmt.currency(totalAssets)} — Liabilities ${Fmt.currency(totalDebt)}
        </div>

        <div style="margin-top:var(--space-md)">
          <div class="seg-bar" style="height:12px">
            <div class="seg-bar-piece" style="background:var(--green);width:${totalAssets > 0 ? Math.min(100, (Math.max(0,netWorth)/totalAssets)*100) : 0}%"></div>
            <div class="seg-bar-piece" style="background:var(--red);width:${totalAssets > 0 ? Math.min(100,(totalDebt/totalAssets)*100) : 100}%"></div>
          </div>
        </div>

        <div class="hero-grid" style="margin-top:var(--space-md)">
          <div class="stat-block">
            <div class="stat-label">Assets</div>
            <div class="stat-value positive" style="font-size:18px">${Fmt.compact(totalAssets)}</div>
          </div>
          <div class="stat-block" style="text-align:center">
            <div class="stat-label">Debt</div>
            <div class="stat-value negative" style="font-size:18px">${Fmt.compact(totalDebt)}</div>
          </div>
          <div class="stat-block" style="text-align:right">
            <div class="stat-label">Debt ratio</div>
            <div class="stat-value" style="font-size:18px;color:${totalAssets>0&&totalDebt/totalAssets<0.3?'var(--green)':'var(--red)'}">${totalAssets > 0 ? Fmt.percent(totalDebt/totalAssets*100) : '—'}</div>
          </div>
        </div>
      </div>

      <!-- Assets -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-title" style="margin-bottom:var(--space-md)">Assets</div>
        <div class="asset-list">
          <div class="asset-item">
            <div class="asset-icon green">🏦</div>
            <div class="asset-info">
              <div class="asset-name">FGTS</div>
              <div class="asset-sub">Fundo de Garantia · in 1 yr: ${Fmt.compact(fgtsIn1Year)}</div>
            </div>
            <div>
              <div class="asset-value positive">${Fmt.currency(fgts)}</div>
              <div style="font-size:11px;color:var(--text-muted);text-align:right">+multa: ${Fmt.compact(fgtsWithMulta)}</div>
            </div>
          </div>

          <div class="asset-item">
            <div class="asset-icon blue">🚗</div>
            <div class="asset-info">
              <div class="asset-name">VW Up TSI 2018/19</div>
              <div class="asset-sub">Depreciates ~10%/yr</div>
            </div>
            <div>
              <div class="asset-value positive">${Fmt.currency(carValue)}</div>
              <div style="font-size:11px;color:var(--text-muted);text-align:right">2026: ${Fmt.compact(carValue*0.9)}</div>
            </div>
          </div>

          ${savings > 0 ? `
          <div class="asset-item">
            <div class="asset-icon green">💰</div>
            <div class="asset-info">
              <div class="asset-name">Liquid Savings</div>
              <div class="asset-sub">Emergency fund, savings accounts</div>
            </div>
            <div class="asset-value positive">${Fmt.currency(savings)}</div>
          </div>` : ''}

          ${investments > 0 ? `
          <div class="asset-item">
            <div class="asset-icon purple">📈</div>
            <div class="asset-info">
              <div class="asset-name">Investments</div>
              <div class="asset-sub">Tesouro Direto, CDB, FIIs, Stocks</div>
            </div>
            <div class="asset-value positive">${Fmt.currency(investments)}</div>
          </div>` : ''}

          ${savings === 0 && investments === 0 ? `
          <div class="asset-item" style="opacity:0.5">
            <div class="asset-icon" style="background:var(--bg-primary);border:1px dashed var(--border)">📈</div>
            <div class="asset-info">
              <div class="asset-name">Investments</div>
              <div class="asset-sub">Not started yet — use Simulator to project growth</div>
            </div>
            <div class="asset-value" style="color:var(--text-muted)">R$ 0</div>
          </div>` : ''}
        </div>
      </div>

      <!-- Liabilities -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Liabilities</span>
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('accounts')">Manage</button>
        </div>
        <div class="asset-list" id="debts-list">
          ${renderDebts(debts, creditCards, totalDebt, profile)}
        </div>
      </div>

      <!-- Patrimônio donut chart -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Asset Distribution</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);align-items:center">
          <div class="chart-wrap" style="height:160px">
            <canvas id="patrimonio-donut"></canvas>
          </div>
          <div class="donut-legend">
            ${[
              { label: 'FGTS',       val: fgts,        color: '#39d353' },
              { label: 'Car',        val: carValue,     color: '#00a8e8' },
              { label: 'Savings',    val: savings,      color: '#a855f7' },
              { label: 'Investments',val: investments,  color: '#ffd600' },
              { label: 'Debt',       val: -totalDebt,   color: '#e8002d' }
            ].filter(i => i.val !== 0).map(i => `
              <div class="legend-item">
                <div class="legend-dot" style="background:${i.color}"></div>
                <span class="legend-name">${i.label}</span>
                <span class="legend-val" style="color:${i.val<0?'var(--red)':'var(--green)'}">${Fmt.compact(Math.abs(i.val))}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Debt payoff impact on net worth -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Net Worth Milestone Plan</span>
          <span class="pill pill-red">Targets</span>
        </div>
        ${[100000, 250000, 500000, 1000000].map(target => {
          const diff = target - Math.max(0, netWorth);
          const reachable = diff > 0;
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-sm) 0;border-bottom:1px solid var(--border)">
              <div>
                <div style="font-family:var(--font-display);font-size:14px;font-weight:600">${Fmt.compact(target)}</div>
                ${reachable ? `<div style="font-size:11px;color:var(--text-muted)">Need ${Fmt.compact(diff)} more</div>` : ''}
              </div>
              ${reachable
                ? `<span class="pill pill-yellow">${Fmt.compact(diff)} to go</span>`
                : `<span class="pill pill-green">✅ Reached</span>`
              }
            </div>
          `;
        }).join('')}
      </div>

      <!-- Financial Simulator link -->
      <div class="card" style="margin-bottom:var(--space-md);cursor:pointer" onclick="App.navigate('simulator')">
        <div style="display:flex;align-items:center;gap:var(--space-md)">
          <div class="asset-icon blue">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:15px">Financial Simulator</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Retirement, debt payoff, salary & emergency projections</div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
    `;

    drawPatrimonioDonut(fgts, carValue, savings, investments, totalDebt);
  }

  function renderDebts(debts, creditCards, totalDebt, profile) {
    let html = '';

    // Show credit cards from the accounts system
    if (creditCards && creditCards.length > 0) {
      html += creditCards.filter(c => c.currentBalance > 0).map(c => `
        <div class="asset-item">
          <div class="asset-icon red">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
          <div class="asset-info">
            <div class="asset-name">${c.name || 'Credit Card'}</div>
            <div class="asset-sub">${c.interestRate ? c.interestRate + '% a.m.' : ''}${c.minPayment ? ' · Min: ' + Fmt.currency(c.minPayment) : ''}${c.limit ? ' · Limit: ' + Fmt.compact(c.limit) : ''}</div>
          </div>
          <div class="asset-value negative">${Fmt.currency(c.currentBalance)}</div>
        </div>
      `).join('');
    }

    // Show legacy debts
    if (debts && debts.length > 0) {
      html += debts.map(d => `
        <div class="asset-item">
          <div class="asset-icon red">💳</div>
          <div class="asset-info">
            <div class="asset-name">${d.name || 'Debt'}</div>
            <div class="asset-sub">${d.interestRate ? d.interestRate + '% a.m.' : ''}</div>
          </div>
          <div class="asset-value negative">${Fmt.currency(d.balance)}</div>
        </div>
      `).join('');
    }

    if (!html) {
      return `
        <div class="asset-item" style="opacity:0.5">
          <div class="asset-icon red">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
          <div class="asset-info">
            <div class="asset-name">No debt tracked</div>
            <div class="asset-sub">Add credit cards in Accounts tab</div>
          </div>
          <div class="asset-value" style="color:var(--text-muted)">R$ 0</div>
        </div>
      `;
    }

    return html;
  }

  function drawPatrimonioDonut(fgts, carValue, savings, investments, totalDebt) {
    const canvas = document.getElementById('patrimonio-donut');
    if (!canvas) return;

    const items = [
      { label: 'FGTS',       val: fgts,        color: '#39d353' },
      { label: 'Car',        val: carValue,     color: '#00a8e8' },
      { label: 'Savings',    val: savings,      color: '#a855f7' },
      { label: 'Investments',val: investments,  color: '#ffd600' },
      { label: 'Debt',       val: totalDebt,    color: '#e8002d' }
    ].filter(i => i.val > 0);

    if (charts.donut) charts.donut.destroy();
    charts.donut = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: items.map(i => i.label),
        datasets: [{
          data: items.map(i => i.val),
          backgroundColor: items.map(i => i.color),
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#141414', borderColor: '#333', borderWidth: 1, titleColor: '#fff', bodyColor: '#a0a0a0', padding: 12, cornerRadius: 8,
            callbacks: { label: ctx => ` ${ctx.label}: ${Fmt.currency(ctx.raw)}` }
          }
        }
      }
    });
  }

  function edit() {
    const profile = Store.profile.get();
    const patrimonio = Store.data.getPatrimonio();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <h2 class="modal-title">Update Patrimônio</h2>

        <div class="form-group">
          <label class="form-label">FGTS Balance (R$)</label>
          <input type="number" id="edit-fgts" class="form-input" value="${profile.fgts || 68000}" />
        </div>
        <div class="form-group">
          <label class="form-label">Car current value (R$)</label>
          <input type="number" id="edit-car" class="form-input" value="${profile.carValue || 50000}" />
        </div>
        <div class="form-group">
          <label class="form-label">Liquid savings (R$)</label>
          <input type="number" id="edit-savings" class="form-input" value="${patrimonio.savings || ''}" placeholder="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Investments (R$)</label>
          <input type="number" id="edit-investments" class="form-input" value="${patrimonio.investments || ''}" placeholder="0" />
        </div>

        <div style="display:flex;gap:var(--space-md);margin-top:var(--space-xl)">
          <button class="btn btn-secondary" style="flex:1" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <button class="btn btn-primary" style="flex:1" onclick="Patrimonio.saveEdit(this)">Save</button>
        </div>
      </div>
    `;

    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  async function saveEdit(btn) {
    const fgts       = parseFloat(document.getElementById('edit-fgts').value) || 0;
    const carValue   = parseFloat(document.getElementById('edit-car').value) || 0;
    const savings    = parseFloat(document.getElementById('edit-savings').value) || 0;
    const investments= parseFloat(document.getElementById('edit-investments').value) || 0;

    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      await API.updatePatrimonio({ fgts, carValue, savings, investments, updatedAt: new Date().toISOString() });
      Store.profile.set({ fgts, carValue });
      btn.closest('.modal-overlay').remove();
      App.toast('Patrimônio updated!', 'success');
      render();
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Save';
      App.toast('Error: ' + e.message, 'error');
    }
  }

  function editDebts() {
    App.navigate('accounts');
  }

  return { render, edit, saveEdit, editDebts };
})();
