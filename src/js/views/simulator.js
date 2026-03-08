/* ============================================================
   SIMULATOR VIEW — "Grand Prix" — Financial future simulator
   ============================================================ */

const Simulator = (() => {
  let charts = {};
  let activeTab = 'retirement';
  let milestones = [];

  function getChartColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      grid: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      tick: isDark ? '#666' : '#9ca3af',
      axis: isDark ? '#222' : '#e5e5e7',
      tooltip: isDark
        ? { backgroundColor: '#141414', borderColor: '#333', borderWidth: 1, titleColor: '#fff', bodyColor: '#a0a0a0' }
        : { backgroundColor: '#fff', borderColor: '#e5e5e7', borderWidth: 1, titleColor: '#1a1a2e', bodyColor: '#6b7280' },
      legendText: isDark ? '#666' : '#9ca3af'
    };
  }

  // ── Default simulation params ──────────────────────────────
  function getParams() {
    const profile = Store.profile.get();
    return {
      salary:        profile.salary || 7500,
      savingsRate:   30,        // % of salary to save
      debtPayment:   1500,      // monthly toward debt
      debt:          profile.debtTotal || 14000,
      debtInterest:  9.9,       // % per month (typical cartão rotativo min payment)
      fgts:          profile.fgts || 68000,
      fgtsRate:      6,         // % per year (TR + profit sharing)
      carValue:      profile.carValue || 50000,
      carDeprRate:   10,        // % per year
      cdiRate:       14.75,     // % per year (current Brazil)
      ipca:          4.5,       // % per year inflation
      years:         20
    };
  }

  const SCENARIOS = [
    { id: 'conservative', label: 'Conservative',  emoji: '🛡️', rateMultiplier: 0.5,  desc: 'CDI / 2 ≈ 7% a.a. (Poupança)' },
    { id: 'moderate',     label: 'Moderate',      emoji: '📈', rateMultiplier: 1.0,  desc: 'CDI ≈ 14.75% a.a. (Tesouro SELIC)' },
    { id: 'aggressive',   label: 'Aggressive',    emoji: '🚀', rateMultiplier: 1.3,  desc: 'CDI × 1.3 ≈ 19% a.a. (FIIs + Ações)' }
  ];

  // ── Compound growth ────────────────────────────────────────
  function compound(principal, monthlyContrib, annualRate, months) {
    const r = annualRate / 100 / 12;
    if (r === 0) return principal + monthlyContrib * months;
    return principal * Math.pow(1+r, months) + monthlyContrib * ((Math.pow(1+r, months) - 1) / r);
  }

  // ── Debt payoff (avalanche method) ────────────────────────
  function debtPayoff(principal, monthlyPayment, annualRate) {
    const r = annualRate / 100 / 12;
    let balance = principal;
    let months = 0;
    while (balance > 0 && months < 600) {
      balance = balance * (1 + r) - monthlyPayment;
      months++;
      if (balance <= 0) break;
    }
    return { months, totalPaid: monthlyPayment * months };
  }

  // ── FGTS projection ───────────────────────────────────────
  function fgtsProjection(current, salary, annualRate, months) {
    const monthlyDeposit = salary * 0.08;
    return compound(current, monthlyDeposit, annualRate, months);
  }

  // ── Full retirement simulation ─────────────────────────────
  function simulateRetirement(params, rateMultiplier) {
    const investRate = params.cdiRate * rateMultiplier;
    const monthlyInvest = params.salary * (params.savingsRate / 100);
    const years = params.years;

    // Build year-by-year projection
    const data = [];
    let savings = 0;
    let fgts = params.fgts;

    for (let y = 1; y <= years; y++) {
      // Apply salary milestones
      let currentSalary = params.salary;
      if (milestones.length) {
        milestones.forEach(ms => {
          if (ms.year <= y) currentSalary = ms.salary;
        });
      } else {
        // Default: 5% annual raise
        currentSalary = params.salary * Math.pow(1.05, y);
        // Promotion bump at year 2.5
        if (y >= 3) currentSalary = Math.max(currentSalary, 11000 * Math.pow(1.05, y - 3));
      }

      const monthlyContrib = currentSalary * (params.savingsRate / 100);
      savings = compound(savings, monthlyContrib, investRate, 12);

      // FGTS
      const fgtsMonthly = currentSalary * 0.08;
      fgts = compound(fgts, fgtsMonthly, params.fgtsRate, 12);

      // Car depreciation
      const carValue = params.carValue * Math.pow(1 - params.carDeprRate / 100, y);

      data.push({
        year: y,
        savings: Math.round(savings),
        fgts: Math.round(fgts),
        car: Math.round(Math.max(0, carValue)),
        salary: Math.round(currentSalary),
        total: Math.round(savings + fgts + Math.max(0, carValue))
      });
    }

    return data;
  }

  // ── Render ─────────────────────────────────────────────────
  async function render() {
    const container = document.getElementById('view-simulator');
    container.innerHTML = `
      <div class="section-header">
        <div>
          <div class="section-title">Simulator</div>
          <div class="section-subtitle">Financial projections</div>
        </div>
      </div>

      <div class="sim-tabs" id="sim-tabs">
        <button class="sim-tab ${activeTab==='retirement'?'active':''}" onclick="Simulator.setTab('retirement')">Retirement</button>
        <button class="sim-tab ${activeTab==='debt'?'active':''}" onclick="Simulator.setTab('debt')">Debt Payoff</button>
        <button class="sim-tab ${activeTab==='salary'?'active':''}" onclick="Simulator.setTab('salary')">Salary Plan</button>
        <button class="sim-tab ${activeTab==='fired'?'active':''}" onclick="Simulator.setTab('fired')">If Fired</button>
      </div>

      <div id="sim-content"></div>
    `;

    // Load milestones
    try {
      milestones = await API.getSalaryMilestones() || [];
    } catch { milestones = []; }

    renderTab(activeTab);
  }

  function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.sim-tab').forEach(el => {
      el.classList.toggle('active', el.textContent.toLowerCase().includes(tab.replace('fired','fired').replace('salary','salary').replace('debt','debt').replace('retirement','retirement')));
    });
    renderTab(tab);
  }

  function renderTab(tab) {
    const el = document.getElementById('sim-content');
    Object.values(charts).forEach(c => c?.destroy());
    charts = {};

    if (tab === 'retirement') renderRetirement(el);
    else if (tab === 'debt')  renderDebt(el);
    else if (tab === 'salary') renderSalary(el);
    else if (tab === 'fired') renderFired(el);
  }

  // ────────────────────────────────────────────────────────────
  // TAB: RETIREMENT
  // ────────────────────────────────────────────────────────────
  function renderRetirement(el) {
    const p = getParams();

    const results = SCENARIOS.map(s => ({
      ...s,
      data: simulateRetirement(p, s.rateMultiplier),
      rate: (p.cdiRate * s.rateMultiplier).toFixed(1)
    }));

    const target5  = results[1].data[4]?.total  || 0;
    const target10 = results[1].data[9]?.total  || 0;
    const target15 = results[1].data[14]?.total || 0;
    const target20 = results[1].data[19]?.total || 0;

    el.innerHTML = `
      <!-- Controls -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-title" style="margin-bottom:var(--space-md)">Simulation Parameters</div>

        <div class="range-wrap">
          <div class="range-header">
            <span class="range-title">Monthly savings rate</span>
            <span class="range-val" id="sv-rate-val">${p.savingsRate}%</span>
          </div>
          <input type="range" id="sv-rate" min="5" max="60" step="1" value="${p.savingsRate}"
            oninput="document.getElementById('sv-rate-val').textContent=this.value+'%';Simulator.updateRetirement()" />
        </div>

        <div class="range-wrap" style="margin-top:var(--space-md)">
          <div class="range-header">
            <span class="range-title">Years to simulate</span>
            <span class="range-val" id="sv-years-val">${p.years} years</span>
          </div>
          <input type="range" id="sv-years" min="5" max="30" step="1" value="${p.years}"
            oninput="document.getElementById('sv-years-val').textContent=this.value+' years';Simulator.updateRetirement()" />
        </div>

        <div class="range-wrap" style="margin-top:var(--space-md)">
          <div class="range-header">
            <span class="range-title">Current CDI rate (% a.a.)</span>
            <span class="range-val" id="sv-cdi-val">${p.cdiRate}%</span>
          </div>
          <input type="range" id="sv-cdi" min="8" max="25" step="0.25" value="${p.cdiRate}"
            oninput="document.getElementById('sv-cdi-val').textContent=parseFloat(this.value).toFixed(2)+'%';Simulator.updateRetirement()" />
        </div>
      </div>

      <!-- Milestone projections (5/10/15/20 years) -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-title" style="margin-bottom:var(--space-md)">Projected Patrimônio (Moderate)</div>
        <div class="grid-2">
          ${[
            { label: '5 Years', val: target5,  year: 2031 },
            { label: '10 Years', val: target10, year: 2036 },
            { label: '15 Years', val: target15, year: 2041 },
            { label: '20 Years', val: target20, year: 2046 }
          ].map(({ label, val, year }) => `
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--space-md)">
              <div class="stat-label">${label} (${year})</div>
              <div style="font-family:var(--font-display);font-size:22px;font-weight:700;color:var(--green);margin-top:4px">${Fmt.compact(val)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Scenario cards -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-title" style="margin-bottom:var(--space-md)">20-Year Final Value by Scenario</div>
        <div class="scenario-cards">
          ${results.map(s => `
            <div class="scenario-card">
              <div class="scenario-icon ${s.id}">${s.emoji}</div>
              <div>
                <div class="scenario-name">${s.label}</div>
                <div class="scenario-rate">${s.desc}</div>
              </div>
              <div>
                <div class="scenario-value" style="color:${s.id==='aggressive'?'var(--red)':s.id==='moderate'?'var(--green)':'var(--blue)'}">${Fmt.compact(s.data[s.data.length-1]?.total||0)}</div>
                <div style="font-size:11px;color:var(--text-muted);text-align:right">${Fmt.compact(s.data[s.data.length-1]?.savings||0)} liquid</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Chart -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Growth Trajectory</span>
          <span class="pill pill-blue">Projection</span>
        </div>
        <div class="chart-wrap" style="height:240px">
          <canvas id="retirement-chart"></canvas>
        </div>
      </div>

      <!-- Targets to R$500k and R$1.5M -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-title" style="margin-bottom:var(--space-md)">Progress to Targets</div>
        ${[500000, 1000000, 1500000].map(target => {
          const moderate = results[1].data;
          const hitYear = moderate.findIndex(d => d.total >= target);
          const hitData = hitYear >= 0 ? moderate[hitYear] : null;
          return `
            <div class="race-progress" style="margin-bottom:var(--space-md)">
              <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-sm)">
                <span style="font-family:var(--font-display);font-size:15px;font-weight:600">${Fmt.compact(target)}</span>
                <span style="font-size:12px;color:var(--text-muted)">${hitData ? `✅ Year ${hitData.year} (${new Date().getFullYear() + hitData.year})` : '> 20 years'}</span>
              </div>
              <div class="race-track">
                <div class="race-car" style="width:${hitData ? Math.min(100, (hitData.year / 20) * 100) : 100}%"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    drawRetirementChart(results, parseInt(document.getElementById('sv-years')?.value || p.years));
  }

  function updateRetirement() {
    const p = getParams();
    const svRate  = parseInt(document.getElementById('sv-rate')?.value  || p.savingsRate);
    const svYears = parseInt(document.getElementById('sv-years')?.value || p.years);
    const svCdi   = parseFloat(document.getElementById('sv-cdi')?.value  || p.cdiRate);

    const override = { ...p, savingsRate: svRate, years: svYears, cdiRate: svCdi };

    const results = SCENARIOS.map(s => ({
      ...s,
      data: simulateRetirementWith(override, s.rateMultiplier),
      rate: (svCdi * s.rateMultiplier).toFixed(1)
    }));

    // Update scenario values
    const cards = document.querySelectorAll('.scenario-card');
    cards.forEach((card, i) => {
      const vEl = card.querySelector('.scenario-value');
      const subEl = card.querySelector('[style*="text-align:right"]');
      if (vEl) vEl.textContent = Fmt.compact(results[i].data[results[i].data.length-1]?.total||0);
      if (subEl) subEl.textContent = Fmt.compact(results[i].data[results[i].data.length-1]?.savings||0) + ' liquid';
    });

    // Update milestone boxes
    const milestoneEls = document.querySelectorAll('.grid-2 [style*="border-radius"]');
    const targets = [4, 9, 14, 19];
    milestoneEls.forEach((el, i) => {
      const vEl = el.querySelector('[style*="font-size:22px"]');
      if (vEl && results[1].data[targets[i]]) vEl.textContent = Fmt.compact(results[1].data[targets[i]].total);
    });

    drawRetirementChart(results, svYears);
  }

  function simulateRetirementWith(p, rateMultiplier) {
    return simulateRetirement(p, rateMultiplier);
  }

  function drawRetirementChart(results, years) {
    const canvas = document.getElementById('retirement-chart');
    if (!canvas) return;
    const cc = getChartColors();

    const baseYear = new Date().getFullYear();
    const labels = Array.from({length: years}, (_, i) => `${baseYear + i + 1}`);

    if (charts.retirement) charts.retirement.destroy();
    charts.retirement = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: SCENARIOS.map((s, i) => ({
          label: s.label,
          data: results[i].data.map(d => d.total),
          borderColor: [
            'rgba(0,168,232,0.8)',
            'rgba(57,211,83,0.8)',
            'rgba(232,0,45,0.8)'
          ][i],
          backgroundColor: [
            'rgba(0,168,232,0.05)',
            'rgba(57,211,83,0.05)',
            'rgba(232,0,45,0.05)'
          ][i],
          fill: i === 1,
          borderWidth: i === 1 ? 2.5 : 1.5,
          pointRadius: 0,
          tension: 0.4
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: { color: cc.legendText, font: { size: 11 }, boxWidth: 24, padding: 12 }
          },
          tooltip: {
            ...cc.tooltip,
            padding: 12,
            cornerRadius: 8,
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${Fmt.compact(ctx.raw)}` }
          }
        },
        scales: {
          x: { grid: { color: cc.grid }, ticks: { color: cc.tick, font: { size: 11 }, maxTicksLimit: 8 }, border: { color: cc.axis } },
          y: { grid: { color: cc.grid }, ticks: { color: cc.tick, font: { size: 11 }, callback: v => Fmt.compact(v) }, border: { color: cc.axis } }
        }
      }
    });
  }

  // ────────────────────────────────────────────────────────────
  // TAB: DEBT PAYOFF
  // ────────────────────────────────────────────────────────────
  function renderDebt(el) {
    const p = getParams();

    function calcAll(debt, payment, rate) {
      if (payment <= 0) return { months: Infinity, totalPaid: Infinity };
      return debtPayoff(debt, payment, rate);
    }

    const debts = [
      { label: 'R$1,000/mo', payment: 1000 },
      { label: 'R$1,500/mo', payment: 1500 },
      { label: 'R$2,000/mo', payment: 2000 },
      { label: 'R$3,000/mo', payment: 3000 }
    ].map(d => ({
      ...d,
      ...calcAll(p.debt, d.payment, p.debtInterest * 12) // convert monthly to annual for debtPayoff fn
    }));

    el.innerHTML = `
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-title" style="margin-bottom:var(--space-md)">Debt Parameters</div>

        <div class="form-group">
          <label class="form-label">Total debt (R$)</label>
          <input type="number" id="debt-amount" class="form-input" value="${p.debt}" oninput="Simulator.updateDebt()" />
        </div>

        <div class="range-wrap" style="margin-top:var(--space-md)">
          <div class="range-header">
            <span class="range-title">Monthly interest rate (%)</span>
            <span class="range-val" id="debt-rate-val">${p.debtInterest}%</span>
          </div>
          <input type="range" id="debt-rate" min="1" max="20" step="0.1" value="${p.debtInterest}"
            oninput="document.getElementById('debt-rate-val').textContent=parseFloat(this.value).toFixed(1)+'%';Simulator.updateDebt()" />
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Typical cartão rotativo: 9-17% a.m. | Min payment: ~3% a.m.</div>
        </div>

        <div class="range-wrap" style="margin-top:var(--space-md)">
          <div class="range-header">
            <span class="range-title">Your monthly payment</span>
            <span class="range-val" id="debt-payment-val">${Fmt.currency(p.debtPayment)}</span>
          </div>
          <input type="range" id="debt-payment" min="200" max="5000" step="50" value="${p.debtPayment}"
            oninput="document.getElementById('debt-payment-val').textContent=Fmt.currency(this.value);Simulator.updateDebt()" />
        </div>
      </div>

      <!-- Payoff scenarios -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-title" style="margin-bottom:var(--space-md)">Payoff Scenarios</div>
        <div id="debt-scenarios">
          ${renderDebtScenarios(p.debt, p.debtInterest, p.debtPayment)}
        </div>
      </div>

      <!-- Chart -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Debt Paydown Trajectory</span>
        </div>
        <div class="chart-wrap" style="height:220px">
          <canvas id="debt-chart"></canvas>
        </div>
      </div>

      <!-- Opportunity cost -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">💡 Opportunity Cost</span>
        </div>
        <p style="font-size:13px;color:var(--text-secondary);line-height:1.7;margin-bottom:var(--space-md)">
          Every <strong>R$ 1,000</strong> in credit card debt at 10% a.m. costs you
          <strong style="color:var(--red)">R$ 1,200/year</strong> in interest — and prevents that money from compounding.<br><br>
          At 15% CDI, <strong>R$ 14,000 invested for 20 years = ${Fmt.compact(compound(14000, 0, 14.75, 240))}</strong>.
          Pay off debt first — it's your highest-yield "investment".
        </p>
        <div class="pill pill-red">Debt is your #1 obstacle. Prioritize paying it off.</div>
      </div>
    `;

    drawDebtChart(p.debt, p.debtInterest, p.debtPayment);
  }

  function renderDebtScenarios(debt, rate, currentPayment) {
    const scenarios = [
      { label: 'Minimum (3%/month)', payment: debt * 0.03 },
      { label: `Current (${Fmt.currency(currentPayment)}/mo)`, payment: currentPayment },
      { label: `+50% (${Fmt.currency(currentPayment*1.5)}/mo)`, payment: currentPayment * 1.5 },
      { label: `Pay all now`, payment: debt }
    ];

    return scenarios.map(s => {
      const r = debtPayoff(debt, s.payment, rate * 12);
      const isMin = s.payment === debt * 0.03;
      const isAll = s.payment >= debt;
      return `
        <div class="race-progress" style="margin-bottom:var(--space-md)">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:var(--space-sm)">
            <span style="font-family:var(--font-display);font-size:14px;font-weight:600">${s.label}</span>
            <span style="font-size:12px;color:var(--text-muted)">${isAll ? 'Done!' : r.months < 600 ? `${r.months} months` : '∞'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:12px;color:var(--text-secondary)">Total paid</span>
            <span style="font-family:var(--font-mono);font-size:12px;color:${isMin?'var(--red)':'var(--green)'}">${isAll ? Fmt.currency(debt) : r.months < 600 ? Fmt.currency(r.totalPaid) : '∞'}</span>
          </div>
          <div class="race-track">
            <div class="race-car" style="width:${isAll ? 100 : r.months < 600 ? Math.max(5, 100 - (r.months/120)*100) : 5}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function updateDebt() {
    const debt    = parseFloat(document.getElementById('debt-amount')?.value) || 14000;
    const rate    = parseFloat(document.getElementById('debt-rate')?.value) || 9.9;
    const payment = parseFloat(document.getElementById('debt-payment')?.value) || 1500;

    const el = document.getElementById('debt-scenarios');
    if (el) el.innerHTML = renderDebtScenarios(debt, rate, payment);

    drawDebtChart(debt, rate, payment);
  }

  function drawDebtChart(debt, monthlyRate, payment) {
    const canvas = document.getElementById('debt-chart');
    if (!canvas) return;

    const scenarios = [
      { label: 'Minimum', payment: debt * 0.03, color: 'rgba(232,0,45,0.8)' },
      { label: 'Current',  payment, color: 'rgba(255,214,0,0.8)' },
      { label: '+50%',     payment: payment * 1.5, color: 'rgba(57,211,83,0.8)' }
    ];

    const maxMonths = 60;
    const labels = Array.from({length: maxMonths}, (_, i) => `M${i+1}`).filter((_, i) => i % 6 === 0);

    if (charts.debt) charts.debt.destroy();
    charts.debt = new Chart(canvas, {
      type: 'line',
      data: {
        labels: Array.from({length: maxMonths}, (_, i) => `M${i+1}`),
        datasets: scenarios.map(s => {
          const balances = [];
          let bal = debt;
          const r = monthlyRate / 100;
          for (let mo = 0; mo < maxMonths; mo++) {
            balances.push(Math.max(0, bal));
            bal = Math.max(0, bal * (1 + r) - s.payment);
          }
          return { label: s.label, data: balances, borderColor: s.color, backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.3 };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', align: 'end', labels: { color: '#666', font: { size: 11 }, boxWidth: 24 } },
          tooltip: {
            backgroundColor: '#141414', borderColor: '#333', borderWidth: 1, titleColor: '#fff', bodyColor: '#a0a0a0', padding: 12, cornerRadius: 8,
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${Fmt.currency(ctx.raw)}` }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666', font: { size: 11 }, maxTicksLimit: 6 }, border: { color: '#222' } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666', font: { size: 11 }, callback: v => Fmt.compact(v) }, border: { color: '#222' } }
        }
      }
    });
  }

  // ────────────────────────────────────────────────────────────
  // TAB: SALARY PLAN
  // ────────────────────────────────────────────────────────────
  function renderSalary(el) {
    const defaultMilestones = milestones.length ? milestones : [
      { year: 1, salary: 7500, event: 'Current — Senior Specialist' },
      { year: 2, salary: 8500, event: 'Annual decisão (est.)' },
      { year: 3, salary: 11000, event: 'Sr Analyst promotion + Big Data diploma' },
      { year: 5, salary: 13000, event: 'Estimated senior growth' },
      { year: 10, salary: 18000, event: 'Long-term career projection' }
    ];

    el.innerHTML = `
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Your Career Timeline</span>
          <button class="btn btn-ghost btn-sm" onclick="Simulator.addMilestone()">+ Add</button>
        </div>
        <div class="timeline" id="salary-timeline">
          ${defaultMilestones.map((ms, i) => `
            <div class="timeline-item" id="ms-${i}">
              <div class="timeline-dot ${i === 0 ? 'active' : ''}"></div>
              <div class="timeline-label">Year ${ms.year} (${new Date().getFullYear() + ms.year})</div>
              <div class="timeline-title">${ms.event}</div>
              <div class="timeline-value">${Fmt.currency(ms.salary)} / month</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Salary chart -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Salary Progression</span>
        </div>
        <div class="chart-wrap" style="height:200px">
          <canvas id="salary-chart"></canvas>
        </div>
      </div>

      <!-- What this means -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-title" style="margin-bottom:var(--space-md)">Impact on Savings (30% rate)</div>
        <div class="telemetry-list">
          ${defaultMilestones.map(ms => {
            const monthly = ms.salary * 0.30;
            const annual  = monthly * 12;
            return `
              <div class="telemetry-item">
                <div class="telemetry-header">
                  <div class="telemetry-name">Year ${ms.year}: ${Fmt.currency(ms.salary)}/mo</div>
                  <div class="telemetry-amounts">
                    <span class="telemetry-spent" style="color:var(--green)">${Fmt.currency(monthly)}/mo</span>
                    <span>${Fmt.currency(annual)}/yr</span>
                  </div>
                </div>
                <div class="progress-bar-wrap">
                  <div class="progress-bar-fill green" style="width:${Math.min(100,(ms.salary/20000)*100)}%"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <button class="btn btn-primary btn-full" onclick="Simulator.saveMilestones()" style="margin-bottom:var(--space-xl)">
        Save Career Plan
      </button>
    `;

    drawSalaryChart(defaultMilestones);
  }

  function drawSalaryChart(milestones) {
    const canvas = document.getElementById('salary-chart');
    if (!canvas) return;

    const years  = Array.from({length: 15}, (_, i) => 2026 + i);
    const salaries = years.map(yr => {
      const year = yr - new Date().getFullYear();
      let sal = 7500;
      milestones.forEach(ms => { if (ms.year <= year) sal = ms.salary; });
      return sal;
    });

    if (charts.salary) charts.salary.destroy();
    charts.salary = new Chart(canvas, {
      type: 'line',
      data: {
        labels: years.map(String),
        datasets: [{
          label: 'Salary',
          data: salaries,
          borderColor: 'rgba(232,0,45,0.9)',
          backgroundColor: 'rgba(232,0,45,0.1)',
          fill: true,
          borderWidth: 2.5,
          stepped: true,
          pointBackgroundColor: 'rgba(232,0,45,1)',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#141414', borderColor: '#333', borderWidth: 1, titleColor: '#fff', bodyColor: '#a0a0a0', padding: 12, cornerRadius: 8,
            callbacks: { label: ctx => ` ${Fmt.currency(ctx.raw)} / month` }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666', font: { size: 11 } }, border: { color: '#222' } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666', font: { size: 11 }, callback: v => Fmt.compact(v) }, border: { color: '#222' } }
        }
      }
    });
  }

  async function saveMilestones() {
    App.toast('Saving career plan...', 'info', 2000);
    try {
      await API.saveSalaryMilestones(milestones);
      App.toast('Career plan saved!', 'success');
    } catch (e) {
      App.toast('Error saving: ' + e.message, 'error');
    }
  }

  // ────────────────────────────────────────────────────────────
  // TAB: IF FIRED
  // ────────────────────────────────────────────────────────────
  function renderFired(el) {
    const p = getParams();
    const profile = Store.profile.get();

    // Multa FGTS (40% do saldo)
    const multaFgts = p.fgts * 0.40;
    const totalFgts = p.fgts + multaFgts; // saldo + multa

    // Aviso prévio (30 days + 3 per year, capped at 90 days = ~3 months)
    const yearsAtJob = 2;
    const avisoPrevio = Math.min(3, 1 + yearsAtJob * 0.25); // months
    const avisoPrevioVal = p.salary * avisoPrevio;

    // Férias proporcionais + 1/3
    const feriasProps = (p.salary / 12) * 10 * (4/3); // ~10 months accrued

    // 13o proporcional
    const decimoTerceiro = p.salary * (10/12);

    const totalEmergency = totalFgts + avisoPrevioVal + feriasProps + decimoTerceiro + p.carValue;
    const monthsCovered = totalEmergency / p.salary;

    // Runway scenarios
    const expenses = p.salary * 0.70; // assume 70% spending ratio
    const runwayMonths = totalEmergency / expenses;

    el.innerHTML = `
      <!-- Emergency fund breakdown -->
      <div class="hero-card" style="margin-bottom:var(--space-md)">
        <div class="hero-label">Total "Se Eu For Mandado Embora" Package</div>
        <div class="hero-value" style="color:var(--green)">${Fmt.currency(totalEmergency)}</div>
        <div style="color:var(--text-secondary);font-size:13px;margin-top:var(--space-sm)">${runwayMonths.toFixed(0)} months of expenses at current spend level</div>
      </div>

      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-title" style="margin-bottom:var(--space-md)">Breakdown</div>
        <div class="asset-list">
          <div class="asset-item">
            <div class="asset-icon green">🏦</div>
            <div class="asset-info">
              <div class="asset-name">FGTS balance</div>
              <div class="asset-sub">Current + 8% FGTS monthly contributions</div>
            </div>
            <div class="asset-value positive">${Fmt.currency(p.fgts)}</div>
          </div>
          <div class="asset-item">
            <div class="asset-icon green">⚡</div>
            <div class="asset-info">
              <div class="asset-name">Multa de 40% (FGTS)</div>
              <div class="asset-sub">Company penalty for termination without cause</div>
            </div>
            <div class="asset-value positive">${Fmt.currency(multaFgts)}</div>
          </div>
          <div class="asset-item">
            <div class="asset-icon blue">📅</div>
            <div class="asset-info">
              <div class="asset-name">Aviso prévio</div>
              <div class="asset-sub">${avisoPrevio.toFixed(1)} months estimated</div>
            </div>
            <div class="asset-value positive">${Fmt.currency(avisoPrevioVal)}</div>
          </div>
          <div class="asset-item">
            <div class="asset-icon yellow">🌴</div>
            <div class="asset-info">
              <div class="asset-name">Férias proporcionais + ⅓</div>
              <div class="asset-sub">~10 months accrued</div>
            </div>
            <div class="asset-value positive">${Fmt.currency(feriasProps)}</div>
          </div>
          <div class="asset-item">
            <div class="asset-icon yellow">🎄</div>
            <div class="asset-info">
              <div class="asset-name">13º salário proporcional</div>
              <div class="asset-sub">10/12 of annual bonus</div>
            </div>
            <div class="asset-value positive">${Fmt.currency(decimoTerceiro)}</div>
          </div>
          <div class="asset-item">
            <div class="asset-icon blue">🚗</div>
            <div class="asset-info">
              <div class="asset-name">VW Up TSI 2018/19</div>
              <div class="asset-sub">Current market value (can sell)</div>
            </div>
            <div class="asset-value positive">${Fmt.currency(p.carValue)}</div>
          </div>
        </div>
      </div>

      <!-- FGTS projection if fired at different times -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-title" style="margin-bottom:var(--space-md)">FGTS If Fired At...</div>
        <div class="telemetry-list">
          ${[1,2,3,5,10].map(yr => {
            const projFgts = fgtsProjection(p.fgts, p.salary, p.fgtsRate, yr * 12);
            const multa = projFgts * 0.40;
            return `
              <div class="telemetry-item">
                <div class="telemetry-header">
                  <div class="telemetry-name">Year ${yr} (${new Date().getFullYear()+yr})</div>
                  <div class="telemetry-amounts">
                    <span class="telemetry-spent">${Fmt.compact(projFgts + multa)}</span>
                    <span>with multa</span>
                  </div>
                </div>
                <div class="progress-bar-wrap">
                  <div class="progress-bar-fill green" style="width:${Math.min(100, ((projFgts+multa)/200000)*100)}%"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="pill pill-green" style="margin-bottom:var(--space-xl)">
        You have a solid safety net. Focus on eliminating debt to maximize your runway.
      </div>
    `;
  }

  function addMilestone() {
    App.toast('Milestone editor coming soon!', 'info');
  }

  return { render, setTab, updateRetirement, updateDebt, addMilestone, saveMilestones };
})();
