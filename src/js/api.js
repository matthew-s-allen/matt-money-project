/* ============================================================
   API LAYER — Local-first. All data in localStorage.
   Gemini (optional) for AI receipt scanning.
   Apps Script URL in Settings = optional Google Sheets sync.
   ============================================================ */

const API = (() => {

  // ── Transactions ──────────────────────────────────────────

  async function getTransactions({ month = null, category = null, type = null } = {}) {
    let txs = Store.data.getTransactions();
    if (month)    txs = txs.filter(t => t.date?.startsWith(month));
    if (category) txs = txs.filter(t => t.category === category);
    if (type)     txs = txs.filter(t => t.type === type);
    return txs.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  }

  async function addTransaction(tx) {
    const txs = Store.data.getTransactions();
    const newTx = {
      ...tx,
      id:        tx.id || crypto.randomUUID(),
      createdAt: tx.createdAt || new Date().toISOString()
    };
    txs.push(newTx);
    Store.data.setTransactions(txs);
    // Auto-update linked account/card balance
    if (newTx.accountId) {
      adjustAccountBalance(newTx.accountId, newTx.type === 'income' ? newTx.amount : -newTx.amount);
    }
    Store.cache.invalidateAll();
    return { data: newTx, success: true };
  }

  async function updateTransaction(id, updates) {
    const txs = Store.data.getTransactions();
    const idx = txs.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Transaction not found: ' + id);
    const oldTx = txs[idx];
    txs[idx] = { ...oldTx, ...updates, id };
    const newTx = txs[idx];
    Store.data.setTransactions(txs);
    // Reverse old balance impact, apply new
    if (oldTx.accountId) {
      adjustAccountBalance(oldTx.accountId, oldTx.type === 'income' ? -oldTx.amount : oldTx.amount);
    }
    if (newTx.accountId) {
      adjustAccountBalance(newTx.accountId, newTx.type === 'income' ? newTx.amount : -newTx.amount);
    }
    Store.cache.invalidateAll();
    return { data: newTx, success: true };
  }

  async function deleteTransaction(id) {
    const txs = Store.data.getTransactions();
    const tx = txs.find(t => t.id === id);
    Store.data.setTransactions(txs.filter(t => t.id !== id));
    // Reverse balance impact
    if (tx && tx.accountId) {
      adjustAccountBalance(tx.accountId, tx.type === 'income' ? -tx.amount : tx.amount);
    }
    Store.cache.invalidateAll();
    return { success: true };
  }

  // ── Account balance auto-adjustment ─────────────────────
  function adjustAccountBalance(accountId, delta) {
    // Try bank accounts first
    const accounts = Store.data.getAccounts();
    const acctIdx = accounts.findIndex(a => a.id === accountId);
    if (acctIdx >= 0) {
      accounts[acctIdx].balance = (accounts[acctIdx].balance || 0) + delta;
      Store.data.setAccounts(accounts);
      return;
    }
    // Try credit cards (expenses increase balance, income decreases it)
    const cards = Store.data.getCreditCards();
    const cardIdx = cards.findIndex(c => c.id === accountId);
    if (cardIdx >= 0) {
      cards[cardIdx].currentBalance = (cards[cardIdx].currentBalance || 0) - delta;
      Store.data.setCreditCards(cards);
    }
  }

  // ── Summary (computed locally) ────────────────────────────

  async function getSummary(month) {
    const cacheKey = `summary_${month}`;
    const cached = Store.cache.fresh(cacheKey, 5000);
    if (cached) return cached;

    const all     = Store.data.getTransactions();
    const monthly = all.filter(t => t.date?.startsWith(month));

    let income = 0, expenses = 0;
    const byCat = {};
    monthly.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') {
        income += amt;
      } else {
        expenses += amt;
        byCat[t.category] = (byCat[t.category] || 0) + amt;
      }
    });

    // Include credit card faturas (bills) as expenses
    const faturas = getFaturas();
    const cards = Store.data.getCreditCards();
    const now0 = new Date();
    const isCurrentOrFutureMonth = month >= `${now0.getFullYear()}-${String(now0.getMonth()+1).padStart(2,'0')}`;
    (cards || []).forEach(card => {
      const fatura = faturas.find(f => f.cardId === card.id && f.month === month);
      // Only fall back to currentBalance for current/future month; for past months only count manual faturas
      const cardAmt = fatura ? fatura.amount : (isCurrentOrFutureMonth ? (card.currentBalance || 0) : 0);
      if (cardAmt > 0) {
        expenses += cardAmt;
        byCat['credit_cards'] = (byCat['credit_cards'] || 0) + cardAmt;
      }
    });

    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const now         = new Date();
    const cutoff      = new Date(year, mon - 1, daysInMonth);
    const daysPassed  = now < cutoff ? now.getDate() : daysInMonth;

    const summary = {
      month,
      totalIncome:  income,
      totalExpenses: expenses,
      balance:      income - expenses,
      byCategory:   byCat,
      txCount:      monthly.length,
      avgPerDay:    daysPassed > 0 ? expenses / daysPassed : 0,
      savingsRate:  income > 0 ? (income - expenses) / income * 100 : 0,
      recentTx:     monthly.slice().sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0)).slice(0, 10)
    };

    Store.cache.set(cacheKey, summary);
    return summary;
  }

  async function getMonthlyHistory(months = 6) {
    const cacheKey = `history_${months}`;
    const cached   = Store.cache.fresh(cacheKey, 10_000);
    if (cached) return cached;

    const all  = Store.data.getTransactions();
    const hist = {};
    all.forEach(t => {
      if (!t.date) return;
      const mo = t.date.substring(0, 7);
      if (!hist[mo]) hist[mo] = { month: mo, income: 0, expenses: 0 };
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') hist[mo].income += amt;
      else hist[mo].expenses += amt;
    });

    // Include credit card faturas in each month's expenses
    const histFaturas = getFaturas();
    const histCards = Store.data.getCreditCards();
    for (const [mo, entry] of Object.entries(hist)) {
      (histCards || []).forEach(card => {
        const fatura = histFaturas.find(f => f.cardId === card.id && f.month === mo);
        const cardAmt = fatura ? fatura.amount : 0;
        if (cardAmt > 0) entry.expenses += cardAmt;
      });
    }
    // For months with no transactions but with faturas, add them
    histFaturas.forEach(f => {
      if (!hist[f.month]) {
        hist[f.month] = { month: f.month, income: 0, expenses: f.amount || 0 };
      }
    });

    const result = Object.values(hist)
      .sort((a, b) => (a.month > b.month ? 1 : -1))
      .slice(-months);

    Store.cache.set(cacheKey, result);
    return result;
  }

  // ── Debts ─────────────────────────────────────────────────

  async function getDebts() {
    return Store.data.getDebts();
  }

  async function upsertDebt(debt) {
    const debts = Store.data.getDebts();
    const idx   = debts.findIndex(d => d.id === debt.id);
    const entry = { ...debt, id: debt.id || crypto.randomUUID(), updatedAt: new Date().toISOString() };
    if (idx >= 0) debts[idx] = entry; else debts.push(entry);
    Store.data.setDebts(debts);
    Store.cache.invalidate('debts');
    return { data: entry, success: true };
  }

  // ── Patrimônio ────────────────────────────────────────────

  async function getPatrimonio() {
    return Store.data.getPatrimonio();
  }

  async function updatePatrimonio(updates) {
    const current = Store.data.getPatrimonio();
    const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
    Store.data.setPatrimonio(updated);
    Store.cache.invalidate('patrimonio');
    return { data: updated, success: true };
  }

  // ── Categories ────────────────────────────────────────────

  async function getCategories() {
    return Store.data.getCategories();
  }

  // ── Salary milestones ─────────────────────────────────────

  async function getSalaryMilestones() {
    return Store.data.getMilestones();
  }

  async function saveSalaryMilestones(milestones) {
    Store.data.setMilestones(milestones);
    Store.cache.invalidate('salary_milestones');
    return { success: true };
  }

  // ── Gemini AI (receipt / note parsing) ────────────────────

  // Model waterfall: best reasoning first, lightweight safety net last.
  // Falls back automatically on rate-limit (429), unavailability (503),
  // or model-not-found (404) errors — only fails if all models are exhausted.
  const GEMINI_MODELS = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ];

  // Strict JSON schema passed directly to the API — no prompt-engineering guesswork.
  const RECEIPT_SCHEMA = {
    type: 'object',
    properties: {
      merchant:       { type: 'string' },
      store_cnpj:     { type: 'string', description: 'CNPJ of the emitter if visible' },
      date:           { type: 'string', description: 'YYYY-MM-DD' },
      time:           { type: 'string', description: 'HH:MM in 24h format' },
      total:          { type: 'number' },
      taxes:          { type: 'number', description: 'Total tax amount (Tributos Totais) if shown' },
      discount_total: { type: 'number', description: 'Total discount amount applied to the whole receipt' },
      payment_method: { type: 'string', description: 'e.g. Cartao Credito, Cartao Debito, Dinheiro, Pix' },
      nfe_key:        { type: 'string', description: '44-digit NF-e / NFC-e access key if visible' },
      category:       { type: 'string', enum: ['food','transport','housing','health','education','subscriptions','clothing','entertainment','debt','savings','other'] },
      description:    { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:       { type: 'string' },
            barcode:    { type: 'string', description: 'Product barcode / EAN / CODIGO if visible' },
            qty:        { type: 'number' },
            unit:       { type: 'string', description: 'Unit of measure: UN, KG, L, ML, etc.' },
            unit_price: { type: 'number', description: 'Price per single unit before discounts (VL UNIT)' },
            price:      { type: 'number', description: 'Final line total after any discounts (VL TOTAL)' },
            discount:   { type: 'number', description: 'Discount amount applied to this specific line item, 0 if none' },
          },
          required: ['name', 'qty', 'price'],
        },
      },
      type:       { type: 'string', enum: ['expense', 'income'] },
      currency:   { type: 'string' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    },
    required: ['merchant','date','total','category','description','items','type','currency','confidence'],
  };

  const RECEIPT_PROMPT = `You are a Brazilian financial assistant specializing in exhaustive receipt data extraction.
Analyze this receipt image and extract ALL available structured data — leave nothing out.

Critical extraction rules:
- Capture EVERY line item without exception. Long supermarket receipts may have 20+ items — extract them all.
- For each item capture: the barcode (CODIGO), full product name (DESCRICAO), quantity (QTDE), unit (UN/KG/L/ML), unit price (VL UNIT), line total (VL TOTAL), and any discount (DESCONTO) applied to that specific line.
- Extract the 44-digit NF-e / NFC-e access key if visible at the bottom.
- Extract the emitter CNPJ.
- Extract the payment method (Cartao Credito/Debito, Dinheiro, Pix, etc.).
- Extract taxes (Tributos Totais) and total savings/discounts if shown.
- Use today's date if not visible. Default currency to BRL.
- Set confidence to "low" only if the image is clearly not a financial document.`;

  async function parseReceiptWithGemini(base64Image, mimeType = 'image/jpeg') {
    const geminiKey = Store.config.val('geminiKey');
    if (!geminiKey) throw new Error('Gemini API key not set. Add it in Settings ⚙️ (it\'s free from aistudio.google.com).');

    const body = JSON.stringify({
      contents: [{
        parts: [
          { text: RECEIPT_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64Image } },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: 'application/json',
        response_schema: RECEIPT_SCHEMA,
        maxOutputTokens: 2048,
      },
    });

    const FALLBACK_CODES = new Set([429, 503, 404]);
    let lastError;

    for (const model of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      let res;
      try {
        res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      } catch (networkErr) {
        lastError = networkErr;
        continue;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        lastError = new Error(`Gemini error (${model}): ${err?.error?.message || res.statusText}`);
        if (FALLBACK_CODES.has(res.status)) continue; // try next model
        throw lastError; // hard error (e.g. 400 bad request, 401 invalid key)
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      try {
        return JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) { lastError = new Error('Gemini returned unexpected format'); continue; }
        return JSON.parse(jsonMatch[0]);
      }
    }

    throw lastError || new Error('All Gemini models failed');
  }

  // ── Export / Import ───────────────────────────────────────

  function exportData() {
    const blob  = Store.data.exportAll();
    const json  = JSON.stringify(blob, null, 2);
    const bytes = new Blob([json], { type: 'application/json' });
    const url   = URL.createObjectURL(bytes);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = `matt-money-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const blob = JSON.parse(e.target.result);
          Store.data.importAll(blob);
          Store.cache.invalidateAll();
          resolve(blob);
        } catch(err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsText(file);
    });
  }

  // ── Backup & Sync ──────────────────────────────────────────

  // Sync: save snapshot + optionally write to file system folder
  async function syncBackup(accountName) {
    if (!accountName) throw new Error('Account name required');
    const snapshot = await Store.backup.save(accountName);
    // Auto-cleanup old backups (keep 30 days)
    await Store.backup.cleanup(accountName, 30);

    // Try to write to File System Access folder if we have a handle
    await writeToFolder(accountName, snapshot);

    return snapshot;
  }

  // Write a snapshot to the selected folder via File System Access API
  async function writeToFolder(accountName, snapshot) {
    if (!('showDirectoryPicker' in window)) return false;
    let dirHandle;
    try {
      dirHandle = await Store.backup.getDirectoryHandle();
    } catch { return false; }
    if (!dirHandle) return false;

    try {
      // Verify we still have permission
      const perm = await dirHandle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        const req = await dirHandle.requestPermission({ mode: 'readwrite' });
        if (req !== 'granted') return false;
      }

      // Create account subfolder
      const acctDir = await dirHandle.getDirectoryHandle(accountName, { create: true });
      // Write backup file
      const fileName = `backup-${snapshot.dateKey}.json`;
      const fileHandle = await acctDir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(snapshot.data, null, 2));
      await writable.close();
      return true;
    } catch (e) {
      console.warn('Failed to write to folder:', e);
      return false;
    }
  }

  // Select a folder for auto-saving backups (File System Access API)
  async function selectBackupFolder() {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('Folder selection is not supported on this browser. Use Download or Share instead.');
    }
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await Store.backup.setDirectoryHandle(handle);
    return handle.name;
  }

  // Share a backup file (mobile-friendly)
  async function shareBackup(snapshotOrNull) {
    const blob = snapshotOrNull?.data || Store.data.exportAll();
    const json = JSON.stringify(blob, null, 2);
    const file = new File([json], `matt-money-backup-${new Date().toISOString().slice(0,10)}.json`, { type: 'application/json' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: 'Matt Money Backup',
        text: 'Financial data backup',
        files: [file]
      });
      return true;
    }
    throw new Error('Sharing not supported on this browser. Use Download instead.');
  }

  // Download a specific snapshot
  function downloadSnapshot(snapshot) {
    const json  = JSON.stringify(snapshot.data, null, 2);
    const bytes = new Blob([json], { type: 'application/json' });
    const url   = URL.createObjectURL(bytes);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = `${snapshot.account}-backup-${snapshot.dateKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Start fresh: clear all data but keep config
  function startFresh() {
    const cfg = Store.config.get();
    Store.raw.clear();
    Store.config.set(cfg);
    Store.cache.invalidateAll();
  }

  // ── Salary Calculator (CLT Brazil) ─────────────────────────

  // INSS 2024/2025 progressive brackets
  const INSS_BRACKETS = [
    { limit: 1412.00,  rate: 0.075 },
    { limit: 2666.68,  rate: 0.09 },
    { limit: 4000.03,  rate: 0.12 },
    { limit: 7786.02,  rate: 0.14 }
  ];

  // IRRF 2024/2025 brackets (applied after INSS deduction)
  const IRRF_BRACKETS = [
    { limit: 2259.20, rate: 0.00,  deduction: 0 },
    { limit: 2826.65, rate: 0.075, deduction: 169.44 },
    { limit: 3751.05, rate: 0.15,  deduction: 381.44 },
    { limit: 4664.68, rate: 0.225, deduction: 662.77 },
    { limit: Infinity, rate: 0.275, deduction: 896.00 }
  ];

  function calcINSS(grossSalary) {
    let inss = 0;
    let prev = 0;
    for (const b of INSS_BRACKETS) {
      const taxable = Math.min(grossSalary, b.limit) - prev;
      if (taxable <= 0) break;
      inss += taxable * b.rate;
      prev = b.limit;
    }
    return Math.round(inss * 100) / 100;
  }

  function calcIRRF(grossSalary, inss) {
    const base = grossSalary - inss;
    for (const b of IRRF_BRACKETS) {
      if (base <= b.limit) {
        const tax = base * b.rate - b.deduction;
        return Math.max(0, Math.round(tax * 100) / 100);
      }
    }
    return 0;
  }

  function calcSalaryBreakdown(profile) {
    const gross = profile.salary || 0;
    const inss = calcINSS(gross);
    const irrf = calcIRRF(gross, inss);
    const healthPlan = profile.deductHealthPlan || 0;
    const dental = profile.deductDental || 0;
    const vt = profile.deductValeTransporte || 0;
    const otherDeduct = profile.deductOther || 0;
    const totalDeductions = inss + irrf + healthPlan + dental + vt + otherDeduct;
    const netSalary = gross - totalDeductions;

    // Benefits
    const va = profile.benefitVA || 0;
    const vr = profile.benefitVR || 0;
    const otherBenefit = profile.benefitOther || 0;
    const totalBenefits = va + vr + otherBenefit;
    const totalTakeHome = netSalary + totalBenefits;

    // Vacation calculation
    const vacationDays = profile.vacationDaysTotal || 30;
    const daysToSell = profile.vacationDaysToSell || 0;
    const actualVacationDays = vacationDays - daysToSell;

    // Vacation pay: salary + 1/3 bonus for vacation period
    const dailySalary = gross / 30;
    const vacationPay = dailySalary * actualVacationDays;
    const vacationBonus = vacationPay / 3; // terco constitucional
    const abonoPecuniario = daysToSell > 0 ? (dailySalary * daysToSell * 4 / 3) : 0; // sold days + 1/3

    // 13th salary (2 installments)
    const decimoTerceiro = gross;
    const decimoTerceiroINSS = calcINSS(gross);
    const decimoTerceiroIRRF = calcIRRF(gross, decimoTerceiroINSS);
    const decimoTerceiroNet = gross - decimoTerceiroINSS - decimoTerceiroIRRF;

    // FGTS (employer contribution, not deducted)
    const fgtsMonthly = gross * 0.08;

    // Annual projection
    const annualGross = gross * 12;
    const annualNet = netSalary * 12;
    const annualBenefits = totalBenefits * 12;
    const annualVacation = vacationPay + vacationBonus + abonoPecuniario;
    const annualTotal = annualNet + annualBenefits + decimoTerceiroNet + annualVacation;

    return {
      gross, inss, irrf,
      healthPlan, dental, vt, otherDeduct,
      totalDeductions, netSalary,
      va, vr, otherBenefit, totalBenefits,
      totalTakeHome,
      // Vacation
      vacationDays, actualVacationDays, daysToSell,
      vacationPay, vacationBonus, abonoPecuniario,
      // 13th
      decimoTerceiro, decimoTerceiroNet,
      // FGTS
      fgtsMonthly,
      // Annual
      annualGross, annualNet, annualBenefits,
      annualVacation, annualTotal
    };
  }

  // ── Installments (Parcelas) ────────────────────────────────

  function getInstallments() {
    return Store.data.getInstallments();
  }

  function setInstallments(v) {
    Store.data.setInstallments(v);
  }

  async function upsertInstallment(inst) {
    const all = getInstallments();
    const entry = {
      ...inst,
      id: inst.id || crypto.randomUUID(),
      updatedAt: new Date().toISOString()
    };
    const idx = all.findIndex(i => i.id === entry.id);
    if (idx >= 0) all[idx] = entry; else all.push(entry);
    setInstallments(all);
    Store.cache.invalidateAll();
    return { data: entry, success: true };
  }

  async function deleteInstallment(id) {
    setInstallments(getInstallments().filter(i => i.id !== id));
    Store.cache.invalidateAll();
    return { success: true };
  }

  // ── Manual Faturas (per card per month) ──────────────────────

  function getFaturas() {
    return Store.data.getFaturas();
  }

  function setFatura(cardId, month, amount) {
    const all = getFaturas();
    const idx = all.findIndex(f => f.cardId === cardId && f.month === month);
    if (amount === 0 || amount === null || amount === undefined || amount === '') {
      // Remove entry if zeroed
      if (idx >= 0) all.splice(idx, 1);
    } else {
      const entry = { cardId, month, amount: parseFloat(amount) || 0 };
      if (idx >= 0) all[idx] = entry; else all.push(entry);
    }
    Store.data.setFaturas(all);
    Store.cache.invalidateAll();
  }

  function getFaturasForCard(cardId) {
    return getFaturas().filter(f => f.cardId === cardId);
  }

  // Get future faturas combining manual entries + installment projections
  function getFuturasFatura(cardId, months = 6) {
    const card = Store.data.getCreditCards().find(c => c.id === cardId);
    if (!card) return [];

    const manualFaturas = getFaturasForCard(cardId);
    const installments = getInstallments().filter(i => i.cardId === cardId);
    const now = new Date();
    const faturas = [];

    for (let m = 0; m < months; m++) {
      const faturaDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
      const monthKey = `${faturaDate.getFullYear()}-${String(faturaDate.getMonth() + 1).padStart(2, '0')}`;

      // Manual fatura amount takes priority
      const manual = manualFaturas.find(f => f.month === monthKey);
      let installmentTotal = 0;
      const items = [];

      for (const inst of installments) {
        const [startY, startM] = inst.startMonth.split('-').map(Number);
        const startDate = new Date(startY, startM - 1, 1);
        const monthsSinceStart = (faturaDate.getFullYear() - startDate.getFullYear()) * 12 + (faturaDate.getMonth() - startDate.getMonth());

        if (monthsSinceStart >= 0 && monthsSinceStart < inst.totalInstallments) {
          const installmentNum = monthsSinceStart + 1;
          items.push({
            description: inst.description,
            amount: inst.monthlyAmount,
            installment: `${installmentNum}/${inst.totalInstallments}`
          });
          installmentTotal += inst.monthlyAmount;
        }
      }

      faturas.push({
        month: monthKey,
        manualAmount: manual ? manual.amount : null,
        installmentTotal,
        total: manual ? manual.amount : installmentTotal,
        items,
        closingDay: card.closingDay,
        dueDay: card.dueDay
      });
    }

    return faturas;
  }

  // ── Accounts ─────────────────────────────────────────────

  async function getAccounts() {
    return Store.data.getAccounts();
  }

  async function upsertAccount(account) {
    const accounts = Store.data.getAccounts();
    const idx = accounts.findIndex(a => a.id === account.id);
    const entry = { ...account, id: account.id || crypto.randomUUID(), updatedAt: new Date().toISOString() };
    if (idx >= 0) accounts[idx] = entry; else accounts.push(entry);
    Store.data.setAccounts(accounts);
    Store.cache.invalidateAll();
    return { data: entry, success: true };
  }

  async function deleteAccount(id) {
    Store.data.setAccounts(Store.data.getAccounts().filter(a => a.id !== id));
    Store.cache.invalidateAll();
    return { success: true };
  }

  // ── Credit Cards ────────────────────────────────────────

  async function getCreditCards() {
    return Store.data.getCreditCards();
  }

  async function upsertCreditCard(card) {
    const cards = Store.data.getCreditCards();
    const idx = cards.findIndex(c => c.id === card.id);
    const entry = { ...card, id: card.id || crypto.randomUUID(), updatedAt: new Date().toISOString() };
    if (idx >= 0) cards[idx] = entry; else cards.push(entry);
    Store.data.setCreditCards(cards);
    Store.cache.invalidateAll();
    return { data: entry, success: true };
  }

  async function deleteCreditCard(id) {
    Store.data.setCreditCards(Store.data.getCreditCards().filter(c => c.id !== id));
    Store.cache.invalidateAll();
    return { success: true };
  }

  // ── Cash Flow (monthly planning) ──────────────────────────

  function getCashFlowMonth(month) {
    const all = Store.data.getCashFlow();
    return all.find(m => m.month === month) || { month, plannedExpenses: [] };
  }

  function saveCashFlowMonth(month, updates) {
    const all = Store.data.getCashFlow();
    const idx = all.findIndex(m => m.month === month);
    const current = idx >= 0 ? all[idx] : { month, plannedExpenses: [] };
    const entry = { ...current, ...updates, month };
    if (idx >= 0) all[idx] = entry; else all.push(entry);
    Store.data.setCashFlow(all);
    Store.cache.invalidateAll();
    return entry;
  }

  function addCashFlowExpense(month, expense) {
    const mdata = getCashFlowMonth(month);
    const expenses = [...(mdata.plannedExpenses || [])];
    const entry = { id: crypto.randomUUID(), ...expense };
    expenses.push(entry);
    saveCashFlowMonth(month, { plannedExpenses: expenses });
    return entry;
  }

  function updateCashFlowExpense(month, id, updates) {
    const mdata = getCashFlowMonth(month);
    const expenses = (mdata.plannedExpenses || []).map(e => e.id === id ? { ...e, ...updates } : e);
    saveCashFlowMonth(month, { plannedExpenses: expenses });
  }

  function deleteCashFlowExpense(month, id) {
    const mdata = getCashFlowMonth(month);
    const expenses = (mdata.plannedExpenses || []).filter(e => e.id !== id);
    saveCashFlowMonth(month, { plannedExpenses: expenses });
  }

  // ── Compatibility stubs (no-ops since data is always local) ──

  async function flushQueue()  { return; }
  // ── Personal Loans ────────────────────────────────────────

  function getLoans() { return Store.data.getLoans(); }

  async function upsertLoan(loan) {
    const all = Store.data.getLoans();
    const idx = all.findIndex(l => l.id === loan.id);
    const entry = { ...loan, id: loan.id || crypto.randomUUID(), updatedAt: new Date().toISOString() };
    if (idx >= 0) all[idx] = entry; else all.push(entry);
    Store.data.setLoans(all);
    Store.cache.invalidateAll();
    return { data: entry, success: true };
  }

  async function deleteLoan(id) {
    Store.data.setLoans(Store.data.getLoans().filter(l => l.id !== id));
    Store.cache.invalidateAll();
    return { success: true };
  }

  // ── Subscriptions (fixed monthly recurring costs) ─────────

  function getSubscriptions() {
    return Store.data.getSubscriptions();
  }

  async function upsertSubscription(sub) {
    const all = Store.data.getSubscriptions();
    const idx = all.findIndex(s => s.id === sub.id);
    const entry = { ...sub, id: sub.id || crypto.randomUUID(), updatedAt: new Date().toISOString() };
    if (idx >= 0) all[idx] = entry; else all.push(entry);
    Store.data.setSubscriptions(all);
    Store.cache.invalidateAll();
    return { data: entry, success: true };
  }

  async function deleteSubscription(id) {
    Store.data.setSubscriptions(Store.data.getSubscriptions().filter(s => s.id !== id));
    Store.cache.invalidateAll();
    return { success: true };
  }

  // Returns total installment charges scheduled for a given month (YYYY-MM)
  function getMonthlyInstallmentTotal(month) {
    const installments = Store.data.getInstallments();
    const [y, m] = month.split('-').map(Number);
    let total = 0;
    installments.forEach(inst => {
      if (!inst.startMonth) return;
      const [sy, sm] = inst.startMonth.split('-').map(Number);
      const offset = (y - sy) * 12 + (m - sm);
      if (offset >= 0 && offset < (inst.totalInstallments || 0)) {
        total += inst.monthlyAmount || 0;
      }
    });
    return total;
  }

  // Returns all active installment items for a given month
  function getMonthlyInstallmentItems(month) {
    const installments = Store.data.getInstallments();
    const [y, m] = month.split('-').map(Number);
    const items = [];
    installments.forEach(inst => {
      if (!inst.startMonth) return;
      const [sy, sm] = inst.startMonth.split('-').map(Number);
      const offset = (y - sy) * 12 + (m - sm);
      if (offset >= 0 && offset < (inst.totalInstallments || 0)) {
        items.push({
          id: inst.id,
          description: inst.description,
          amount: inst.monthlyAmount || 0,
          installment: `${offset + 1}/${inst.totalInstallments}`
        });
      }
    });
    return items;
  }

  // ── Annual Overview (12-month year view) ─────────────────
  function getAnnualOverview(year) {
    const profile = Store.profile.get();
    const breakdown = calcSalaryBreakdown(profile);
    const subs = getSubscriptions().filter(s => s.active !== false);
    const subsTotal = subs.reduce((s, sub) => s + (sub.amount || 0), 0);
    const loans = Store.data.getLoans();
    const loansTotal = loans.reduce((s, l) => s + (l.monthlyPayment || 0), 0);
    const allTx = Store.data.getTransactions();
    const aoFaturas = getFaturas();
    const aoCards = Store.data.getCreditCards();

    const now = new Date();
    const currentMonth = now.getFullYear() * 12 + now.getMonth(); // absolute month index

    const predictedBase = (profile.predictedMonthlyIncome > 0)
      ? profile.predictedMonthlyIncome
      : breakdown.totalTakeHome;

    const months = [];
    for (let m = 0; m < 12; m++) {
      const monthKey = `${year}-${String(m + 1).padStart(2, '0')}`;
      const absMonth = year * 12 + m;
      const isPast = absMonth < currentMonth;
      const isCurrent = absMonth === currentMonth;
      const isFuture = absMonth > currentMonth;

      // Actual transactions
      const monthTx = allTx.filter(t => t.date?.startsWith(monthKey));
      let actualIncome = 0, actualExpenses = 0;
      monthTx.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        if (t.type === 'income') actualIncome += amt;
        else actualExpenses += amt;
      });

      // Include credit card faturas (bills) as expenses
      // Only use currentBalance fallback for current month; for other months, only count manual faturas
      (aoCards || []).forEach(card => {
        const fatura = aoFaturas.find(f => f.cardId === card.id && f.month === monthKey);
        const cardAmt = fatura ? fatura.amount : (isCurrent ? (card.currentBalance || 0) : 0);
        if (cardAmt > 0) actualExpenses += cardAmt;
      });

      // Installments for this month
      const instTotal = getMonthlyInstallmentTotal(monthKey);

      // Predicted income: base + 13th salary in applicable months + vacation
      let predictedIncome = predictedBase;
      const m1 = profile.decimo13Month1 || 11;
      const m2 = profile.decimo13Month2 || 12;
      if ((m + 1) === m1) predictedIncome += breakdown.decimoTerceiroNet / 2;
      if ((m + 1) === m2) predictedIncome += breakdown.decimoTerceiroNet / 2;
      // Vacation pay in vacation months
      (profile.vacationPlans || []).forEach(vp => {
        if (vp.month === (m + 1)) {
          predictedIncome += breakdown.vacationBonus + breakdown.abonoPecuniario;
        }
      });

      const committed = subsTotal + instTotal + loansTotal;
      const totalOutflows = actualExpenses + committed;
      const income = actualIncome || 0;
      const surplus = (income > 0 ? income : predictedIncome) - totalOutflows;

      months.push({
        month: monthKey,
        isPast, isCurrent, isFuture,
        actualIncome, actualExpenses,
        subscriptions: subsTotal,
        subscriptionItems: subs,
        installments: instTotal,
        installmentItems: getMonthlyInstallmentItems(monthKey),
        loanPayments: loansTotal,
        loanItems: loans,
        committed,
        totalOutflows,
        predictedIncome,
        surplus
      });
    }
    return months;
  }

  async function initBackend() { return { success: true }; }

  return {
    getTransactions, addTransaction, updateTransaction, deleteTransaction,
    getSummary, getMonthlyHistory,
    getDebts, upsertDebt,
    getPatrimonio, updatePatrimonio,
    getCategories,
    getSalaryMilestones, saveSalaryMilestones,
    getAccounts, upsertAccount, deleteAccount,
    getCreditCards, upsertCreditCard, deleteCreditCard,
    getLoans, upsertLoan, deleteLoan,
    getSubscriptions, upsertSubscription, deleteSubscription,
    getMonthlyInstallmentTotal, getMonthlyInstallmentItems,
    parseReceiptWithGemini,
    exportData, importData,
    calcSalaryBreakdown, calcINSS, calcIRRF,
    getInstallments, upsertInstallment, deleteInstallment,
    getFaturas, setFatura, getFaturasForCard, getFuturasFatura,
    getCashFlowMonth, saveCashFlowMonth, addCashFlowExpense, updateCashFlowExpense, deleteCashFlowExpense,
    getAnnualOverview,
    syncBackup, selectBackupFolder, shareBackup, downloadSnapshot, startFresh,
    flushQueue, initBackend
  };
})();
