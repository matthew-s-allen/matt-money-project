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
    editedItems: [],    // live-edited copy of items from AI card
    isScanning: false
  };

  // Safe HTML attribute escaping for user-supplied data in template literals
  const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  function render() {
    const container = document.getElementById('view-add');
    state = { type: 'expense', category: 'food', imageBase64: null, imageMime: null, aiSuggestion: null, editedItems: [], isScanning: false };

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

        <div class="camera-zone" id="camera-zone">
          <input type="file" id="file-input-camera" accept="image/*" capture="environment" style="display:none" />
          <input type="file" id="file-input-file" accept="image/*" style="display:none" />
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <p>Scan a receipt with Gemini AI</p>
          <div class="camera-zone-btns">
            <button class="btn btn-sm btn-camera" onclick="document.getElementById('file-input-camera').click()">📷 Take Photo</button>
            <button class="btn btn-sm btn-file" onclick="document.getElementById('file-input-file').click()">📁 Upload File</button>
          </div>
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

    // Wire up file inputs
    document.getElementById('file-input-camera').addEventListener('change', handleFileSelect);
    document.getElementById('file-input-file').addEventListener('change', handleFileSelect);

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
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1];
      state.imageBase64 = base64;
      state.imageMime = file.type;

      const zone = document.getElementById('camera-zone');
      zone.innerHTML = `
        <input type="file" id="file-input-camera" accept="image/*" capture="environment" style="display:none" />
        <input type="file" id="file-input-file" accept="image/*" style="display:none" />
        <div class="receipt-preview" style="width:100%">
          <img src="${e.target.result}" alt="Receipt preview" />
          <div class="receipt-preview-overlay">
            <button class="btn btn-sm btn-camera" onclick="document.getElementById('file-input-camera').click()">📷 Retake</button>
            <button class="btn btn-sm btn-file" onclick="document.getElementById('file-input-file').click()">📁 Replace</button>
            <button class="btn btn-ghost btn-sm" onclick="AddTransaction.clearImage()" style="color:var(--red)">Remove</button>
          </div>
        </div>
      `;
      document.getElementById('file-input-camera').addEventListener('change', handleFileSelect);
      document.getElementById('file-input-file').addEventListener('change', handleFileSelect);

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
      state.editedItems  = [...(result.items || [])];
      state.isScanning   = false;

      statusEl.innerHTML = `
        <div class="ai-scanning" style="border-color:var(--green);background:var(--green-glow)">
          <div class="ai-dot" style="background:var(--green)"></div>
          <span style="color:var(--green)">AI scan complete! Review and confirm below.</span>
        </div>
      `;

      suggCard.classList.remove('hidden');
      suggCard.innerHTML = renderAISuggestion(result);

      // Auto-fill main form (user can also edit directly in the card above)
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

  // ── AI suggestion card (fully editable) ────────────────────
  function renderAISuggestion(r) {
    const confidenceColor = r.confidence === 'high' ? 'var(--green)' : r.confidence === 'medium' ? 'var(--yellow)' : 'var(--red)';
    const catOptions = App.CATEGORIES.map(c =>
      `<option value="${c.id}" ${c.id === r.category ? 'selected' : ''}>${c.emoji} ${c.label}</option>`
    ).join('');

    const metaBits = [
      r.payment_method && `💳 ${r.payment_method}`,
      r.taxes          && `Tax ${Fmt.currency(r.taxes)}`,
      r.discount_total && `Saved ${Fmt.currency(r.discount_total)}`,
      r.store_cnpj     && `CNPJ ${r.store_cnpj}`,
    ].filter(Boolean).join(' · ');

    return `
      <div class="ai-suggestion">
        <div class="ai-tag">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Gemini Suggestion · Confidence: <span style="color:${confidenceColor};margin-left:2px">${r.confidence?.toUpperCase()}</span>
        </div>

        <div class="form-group" style="margin-bottom:var(--space-sm)">
          <div class="t-label">Merchant</div>
          <input id="ai-edit-merchant" class="form-input" style="margin-top:4px" value="${esc(r.merchant || '')}" placeholder="Merchant name" />
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-sm);margin-bottom:var(--space-sm)">
          <div>
            <div class="t-label">Total (R$)</div>
            <input id="ai-edit-total" type="number" class="form-input"
              style="margin-top:4px;font-family:var(--font-display);font-weight:700;color:var(--red)"
              value="${r.total || 0}" min="0" step="0.01" inputmode="decimal" />
          </div>
          <div>
            <div class="t-label">Date</div>
            <input id="ai-edit-date" type="date" class="form-input" style="margin-top:4px" value="${esc(r.date || '')}" />
          </div>
        </div>

        <div class="form-group" style="margin-bottom:var(--space-sm)">
          <div class="t-label">Category</div>
          <select id="ai-edit-category" class="form-input" style="margin-top:4px">${catOptions}</select>
        </div>

        ${state.editedItems.length ? `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <div class="t-label">${state.editedItems.length} items extracted <span style="color:var(--text-muted);font-weight:400">— tap to edit</span></div>
            <div style="font-size:10px;color:var(--text-muted)">name · qty · total</div>
          </div>
          <div id="ai-items-list" style="max-height:240px;overflow-y:auto;margin-bottom:4px">
            ${state.editedItems.map((item, idx) => renderAIItemRow(item, idx)).join('')}
          </div>
          <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 8px;margin-top:2px"
            onclick="AddTransaction.addAIItem()">+ Add item</button>
        ` : ''}

        ${metaBits ? `<div style="font-size:11px;color:var(--text-muted);margin-top:var(--space-sm);line-height:1.6">${metaBits}</div>` : ''}

        <div style="display:flex;gap:var(--space-sm);margin-top:var(--space-md)">
          <button class="btn btn-success btn-sm" style="flex:1" onclick="AddTransaction.acceptAI()">
            ✓ Use these values
          </button>
          <button class="btn btn-secondary btn-sm" onclick="AddTransaction.clearAI()">Ignore</button>
        </div>
      </div>
    `;
  }

  function renderAIItemRow(item, idx) {
    return `
      <div id="ai-item-row-${idx}" style="display:flex;align-items:center;gap:3px;padding:3px 0;border-bottom:1px solid var(--border)">
        <input id="ai-item-name-${idx}" class="form-input"
          value="${esc(item.name || '')}" placeholder="Item name"
          style="flex:1;font-size:11px;padding:3px 5px;min-width:0;height:auto" />
        <input type="number" id="ai-item-qty-${idx}" value="${item.qty ?? 1}" min="0" step="any"
          title="Qty"
          style="width:44px;font-size:11px;padding:3px 4px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;color:var(--text-secondary);text-align:center" />
        <input type="number" id="ai-item-price-${idx}" value="${item.price ?? 0}" min="0" step="0.01" inputmode="decimal"
          title="Line total (R$)"
          style="width:64px;font-size:11px;padding:3px 4px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;color:var(--red);font-family:var(--font-mono);text-align:right" />
        <button onclick="AddTransaction.removeAIItem(${idx})" title="Remove"
          style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;line-height:1;padding:0 3px;flex-shrink:0">×</button>
      </div>
    `;
  }

  // Flush all visible item row inputs back into state.editedItems
  function saveEditedItemsToState() {
    state.editedItems = state.editedItems.map((item, idx) => {
      const nameEl  = document.getElementById(`ai-item-name-${idx}`);
      const qtyEl   = document.getElementById(`ai-item-qty-${idx}`);
      const priceEl = document.getElementById(`ai-item-price-${idx}`);
      if (!nameEl) return null;
      return {
        ...item,
        name:  nameEl.value.trim(),
        qty:   parseFloat(qtyEl?.value)   || 1,
        price: parseFloat(priceEl?.value) || 0,
      };
    }).filter(Boolean);
  }

  function reRenderItemsList() {
    const list = document.getElementById('ai-items-list');
    if (!list) return;
    list.innerHTML = state.editedItems.map((item, idx) => renderAIItemRow(item, idx)).join('');
  }

  function addAIItem() {
    saveEditedItemsToState();
    state.editedItems.push({ name: '', qty: 1, price: 0 });
    reRenderItemsList();
  }

  function removeAIItem(idx) {
    saveEditedItemsToState();
    state.editedItems.splice(idx, 1);
    reRenderItemsList();
  }

  // Read card inputs → sync to main form + update state
  function acceptAI() {
    if (!state.aiSuggestion) return;
    saveEditedItemsToState();

    const merchant = document.getElementById('ai-edit-merchant')?.value.trim() || '';
    const total    = parseFloat(document.getElementById('ai-edit-total')?.value) || 0;
    const date     = document.getElementById('ai-edit-date')?.value || '';
    const category = document.getElementById('ai-edit-category')?.value || 'other';

    // Push to main form
    const mEl    = document.getElementById('tx-merchant');
    const aEl    = document.getElementById('tx-amount');
    const dateEl = document.getElementById('tx-date');
    const descEl = document.getElementById('tx-description');
    if (mEl)    mEl.value    = merchant;
    if (aEl)    aEl.value    = total;
    if (dateEl) dateEl.value = date;
    if (descEl && !descEl.value) descEl.value = state.aiSuggestion.description || merchant;
    selectCategory(category);

    // Keep suggestion state in sync
    state.aiSuggestion = { ...state.aiSuggestion, merchant, total, date, category, items: state.editedItems };

    App.toast('Applied! Review details below and save.', 'success', 2000);
  }

  function autoFillFromAI(r) {
    if (r.total && r.total > 0) {
      const aEl = document.getElementById('tx-amount');
      if (aEl && !aEl.value) aEl.value = r.total;
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
    if (r.category) selectCategory(r.category);
    if (r.type === 'income') setType('income');
  }

  function clearAI() {
    state.aiSuggestion = null;
    state.editedItems  = [];
    document.getElementById('ai-suggestion-card').classList.add('hidden');
  }

  function clearImage() {
    state.imageBase64  = null;
    state.imageMime    = null;
    state.aiSuggestion = null;
    state.editedItems  = [];

    const zone = document.getElementById('camera-zone');
    zone.innerHTML = `
      <input type="file" id="file-input-camera" accept="image/*" capture="environment" style="display:none" />
      <input type="file" id="file-input-file" accept="image/*" style="display:none" />
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
      <p>Scan a receipt with Gemini AI</p>
      <div class="camera-zone-btns">
        <button class="btn btn-sm btn-camera" onclick="document.getElementById('file-input-camera').click()">📷 Take Photo</button>
        <button class="btn btn-sm btn-file" onclick="document.getElementById('file-input-file').click()">📁 Upload File</button>
      </div>
    `;
    document.getElementById('file-input-camera').addEventListener('change', handleFileSelect);
    document.getElementById('file-input-file').addEventListener('change', handleFileSelect);
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

    // Sync any last edits from the AI card before saving
    if (state.aiSuggestion) saveEditedItemsToState();
    const ai = state.aiSuggestion || {};

    const tx = {
      type:        state.type,
      amount,
      description: description || merchant,
      merchant,
      category:    state.category,
      date:        date || Fmt.toISODate(new Date()),
      notes,
      // Line items (uses card-edited version if present, falls back to raw AI, then empty)
      items: state.editedItems.length > 0 ? state.editedItems : (ai.items || []),
      // Rich receipt metadata — only stored when present
      ...(ai.payment_method  && { payment_method:  ai.payment_method  }),
      ...(ai.store_cnpj      && { store_cnpj:       ai.store_cnpj      }),
      ...(ai.time            && { receipt_time:     ai.time            }),
      ...(ai.taxes           && { taxes:            ai.taxes           }),
      ...(ai.discount_total  && { discount_total:   ai.discount_total  }),
      ...(ai.nfe_key         && { nfe_key:          ai.nfe_key         }),
      createdAt: new Date().toISOString()
    };

    try {
      const result = await API.addTransaction(tx);

      if (result.queued) {
        App.toast('Saved offline — will sync when connected', 'info');
      } else {
        App.toast(`${state.type === 'income' ? 'Income' : 'Expense'} saved! ${Fmt.currency(amount)}`, 'success');
      }

      setTimeout(() => App.navigate('dashboard'), 600);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Save Transaction';
      App.toast(`Error: ${e.message}`, 'error');
    }
  }

  return { render, setType, selectCategory, clearImage, acceptAI, clearAI, addAIItem, removeAIItem, save };
})();
