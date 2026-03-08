/* ============================================================
   ADD TRANSACTION VIEW — Quick entry + AI receipt parsing
   ============================================================ */

const AddTransaction = (() => {
  let state = {
    type: 'expense',
    category: 'food',
    imageBase64: null,
    imageMime: null,
    aiSuggestion: null,
    isScanning: false
  };

  function render() {
    const container = document.getElementById('view-add');
    state = { type: 'expense', category: 'food', imageBase64: null, imageMime: null, aiSuggestion: null, isScanning: false };

    container.innerHTML = `
      <div class="section-header">
        <div>
          <div class="section-title">Quick Add</div>
          <div class="section-subtitle">Log income or expense</div>
        </div>
      </div>

      <!-- Type toggle -->
      <div class="type-toggle" style="margin-bottom:var(--space-md)">
        <button class="type-toggle-btn active-expense" id="btn-expense" onclick="AddTransaction.setType('expense')">
          ↓ Expense
        </button>
        <button class="type-toggle-btn" id="btn-income" onclick="AddTransaction.setType('income')">
          ↑ Income
        </button>
      </div>

      <!-- Amount -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="amount-input-wrap">
          <span class="amount-prefix">R$</span>
          <input type="number" id="tx-amount" class="form-input" placeholder="0,00" min="0" step="0.01" inputmode="decimal" />
        </div>
      </div>

      <!-- Receipt / Camera -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-header">
          <span class="card-title">Receipt / Note (AI-powered)</span>
          <span class="pill pill-red">Gemini</span>
        </div>

        <div class="camera-zone" id="camera-zone" onclick="document.getElementById('file-input').click()">
          <input type="file" id="file-input" accept="image/*" style="display:none" />
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <p>Tap to take a photo or upload receipt</p>
          <small>Gemini AI will read merchant, items & total</small>
        </div>

        <div id="ai-status" class="hidden"></div>
        <div id="ai-suggestion-card" class="hidden"></div>
      </div>

      <!-- Details -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-title" style="margin-bottom:var(--space-md)">Details</div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <input type="text" id="tx-description" class="form-input" placeholder="What was this for?" />
        </div>

        <div class="form-group">
          <label class="form-label">Merchant / Payee</label>
          <input type="text" id="tx-merchant" class="form-input" placeholder="Store name, person, etc." />
        </div>

        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" id="tx-date" class="form-input" value="${Fmt.toISODate(new Date())}" />
        </div>

        <div class="form-group">
          <label class="form-label">Notes (optional)</label>
          <textarea id="tx-notes" class="form-textarea" placeholder="Additional context, parcel details, etc."></textarea>
        </div>
      </div>

      <!-- Category -->
      <div class="card" style="margin-bottom:var(--space-md)">
        <div class="card-title" style="margin-bottom:var(--space-md)">Category</div>
        <div class="cat-grid" id="cat-grid">
          ${App.CATEGORIES.map(cat => `
            <button class="cat-btn ${cat.id === state.category ? 'selected' : ''}"
              data-cat="${cat.id}"
              onclick="AddTransaction.selectCategory('${cat.id}')">
              <span class="cat-emoji">${cat.emoji}</span>
              ${cat.label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Save button -->
      <button class="btn btn-primary btn-full" id="save-tx-btn" onclick="AddTransaction.save()" style="margin-bottom:var(--space-xl)">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        Save Transaction
      </button>
    `;

    // Wire up file input
    document.getElementById('file-input').addEventListener('change', handleFileSelect);

    // Wire up drag & drop on camera zone
    const zone = document.getElementById('camera-zone');
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) processImage(file);
    });
  }

  function setType(type) {
    state.type = type;
    document.getElementById('btn-expense').className = 'type-toggle-btn' + (type === 'expense' ? ' active-expense' : '');
    document.getElementById('btn-income').className  = 'type-toggle-btn' + (type === 'income'  ? ' active-income'  : '');
  }

  function selectCategory(catId) {
    state.category = catId;
    document.querySelectorAll('.cat-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.cat === catId);
    });
  }

  // ── Image handling ─────────────────────────────────────────
  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    await processImage(file);
  }

  async function processImage(file) {
    // Show preview
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1];
      state.imageBase64 = base64;
      state.imageMime = file.type;

      // Show preview in camera zone
      const zone = document.getElementById('camera-zone');
      zone.innerHTML = `
        <div class="receipt-preview" style="width:100%">
          <img src="${e.target.result}" alt="Receipt preview" />
          <div class="receipt-preview-overlay">
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('file-input').click()">Change</button>
            <button class="btn btn-ghost btn-sm" onclick="AddTransaction.clearImage()" style="color:var(--red)">Remove</button>
          </div>
        </div>
      `;

      // Scan with Gemini
      await scanWithAI(base64, file.type);
    };
    reader.readAsDataURL(file);
  }

  async function scanWithAI(base64, mimeType) {
    const statusEl = document.getElementById('ai-status');
    const suggCard = document.getElementById('ai-suggestion-card');

    statusEl.classList.remove('hidden');
    statusEl.innerHTML = `
      <div class="ai-scanning">
        <div class="ai-dot"></div>
        <span>Gemini is analyzing your receipt...</span>
      </div>
    `;
    suggCard.classList.add('hidden');
    state.isScanning = true;

    try {
      const result = await API.parseReceiptWithGemini(base64, mimeType);
      state.aiSuggestion = result;
      state.isScanning = false;

      statusEl.innerHTML = `
        <div class="ai-scanning" style="border-color:var(--green);background:var(--green-glow)">
          <div class="ai-dot" style="background:var(--green)"></div>
          <span style="color:var(--green)">AI scan complete! Review and confirm below.</span>
        </div>
      `;

      // Show suggestion card
      suggCard.classList.remove('hidden');
      suggCard.innerHTML = renderAISuggestion(result);

      // Auto-fill form fields (user can edit before saving)
      autoFillFromAI(result);

    } catch (err) {
      state.isScanning = false;
      statusEl.innerHTML = `
        <div class="ai-scanning" style="border-color:var(--red);background:var(--red-glow)">
          <div class="ai-dot"></div>
          <span style="color:var(--red)">AI scan failed: ${err.message}. Fill in manually.</span>
        </div>
      `;
    }
  }

  function renderAISuggestion(r) {
    const confidenceColor = r.confidence === 'high' ? 'var(--green)' : r.confidence === 'medium' ? 'var(--yellow)' : 'var(--red)';
    return `
      <div class="ai-suggestion">
        <div class="ai-tag">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Gemini Suggestion · Confidence: <span style="color:${confidenceColor};margin-left:2px">${r.confidence}</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-sm);margin-bottom:var(--space-md)">
          <div>
            <div class="t-label">Merchant</div>
            <div style="font-size:14px;font-weight:500;margin-top:2px">${r.merchant || '—'}</div>
          </div>
          <div>
            <div class="t-label">Total</div>
            <div style="font-family:var(--font-display);font-size:18px;font-weight:700;margin-top:2px;color:var(--red)">${Fmt.currency(r.total || 0)}</div>
          </div>
          <div>
            <div class="t-label">Date</div>
            <div style="font-size:14px;margin-top:2px">${r.date ? Fmt.dateShort(r.date) : '—'}</div>
          </div>
          <div>
            <div class="t-label">Category</div>
            <div style="font-size:14px;margin-top:2px">${App.getCat(r.category).emoji} ${App.getCat(r.category).label}</div>
          </div>
        </div>

        ${r.items && r.items.length ? `
          <div class="t-label" style="margin-bottom:var(--space-sm)">Items extracted</div>
          ${r.items.slice(0,5).map(i => `
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);padding:4px 0;border-bottom:1px solid var(--border)">
              <span>${i.name}</span>
              <span style="font-family:var(--font-mono)">${Fmt.currency(i.price)}</span>
            </div>
          `).join('')}
          ${r.items.length > 5 ? `<div class="t-muted" style="margin-top:4px">+ ${r.items.length-5} more items</div>` : ''}
        ` : ''}

        <div style="display:flex;gap:var(--space-sm);margin-top:var(--space-md)">
          <button class="btn btn-success btn-sm" style="flex:1" onclick="AddTransaction.acceptAI()">
            ✓ Use these values
          </button>
          <button class="btn btn-secondary btn-sm" onclick="AddTransaction.clearAI()">
            Ignore
          </button>
        </div>
      </div>
    `;
  }

  function autoFillFromAI(r) {
    if (r.total && r.total > 0) {
      const amtEl = document.getElementById('tx-amount');
      if (amtEl && !amtEl.value) amtEl.value = r.total;
    }
    if (r.merchant) {
      const mEl = document.getElementById('tx-merchant');
      if (mEl && !mEl.value) mEl.value = r.merchant;
    }
    if (r.description) {
      const dEl = document.getElementById('tx-description');
      if (dEl && !dEl.value) dEl.value = r.description;
    }
    if (r.date) {
      const dateEl = document.getElementById('tx-date');
      if (dateEl) dateEl.value = r.date;
    }
    if (r.category) {
      selectCategory(r.category);
    }
    if (r.type === 'income') {
      setType('income');
    }
  }

  function acceptAI() {
    if (!state.aiSuggestion) return;
    autoFillFromAI(state.aiSuggestion);
    App.toast('AI values applied. Review and save!', 'success', 2000);
  }

  function clearAI() {
    state.aiSuggestion = null;
    document.getElementById('ai-suggestion-card').classList.add('hidden');
  }

  function clearImage() {
    state.imageBase64 = null;
    state.imageMime = null;
    state.aiSuggestion = null;

    const zone = document.getElementById('camera-zone');
    zone.innerHTML = `
      <input type="file" id="file-input" accept="image/*" capture="environment" style="display:none" />
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
      <p>Tap to take a photo or upload receipt</p>
      <small>Gemini AI will read merchant, items & total</small>
    `;
    zone.onclick = () => document.getElementById('file-input').click();
    document.getElementById('file-input').addEventListener('change', handleFileSelect);
    document.getElementById('ai-status').classList.add('hidden');
    document.getElementById('ai-suggestion-card').classList.add('hidden');
  }

  // ── Save transaction ───────────────────────────────────────
  async function save() {
    const amount      = parseFloat(document.getElementById('tx-amount').value);
    const description = document.getElementById('tx-description').value.trim();
    const merchant    = document.getElementById('tx-merchant').value.trim();
    const date        = document.getElementById('tx-date').value;
    const notes       = document.getElementById('tx-notes').value.trim();

    if (!amount || amount <= 0) {
      App.toast('Please enter an amount', 'error');
      document.getElementById('tx-amount').focus();
      return;
    }

    if (!description && !merchant) {
      App.toast('Please add a description or merchant name', 'error');
      document.getElementById('tx-description').focus();
      return;
    }

    const btn = document.getElementById('save-tx-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const tx = {
      type: state.type,
      amount,
      description: description || merchant,
      merchant,
      category: state.category,
      date: date || Fmt.toISODate(new Date()),
      notes,
      items: state.aiSuggestion?.items || [],
      createdAt: new Date().toISOString()
    };

    try {
      const result = await API.addTransaction(tx);

      if (result.queued) {
        App.toast('Saved offline — will sync when connected', 'info');
      } else {
        App.toast(`${state.type === 'income' ? 'Income' : 'Expense'} saved! ${Fmt.currency(amount)}`, 'success');
      }

      // Reset form and go to dashboard
      setTimeout(() => App.navigate('dashboard'), 600);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Save Transaction';
      App.toast(`Error: ${e.message}`, 'error');
    }
  }

  return { render, setType, selectCategory, clearImage, acceptAI, clearAI, save };
})();
