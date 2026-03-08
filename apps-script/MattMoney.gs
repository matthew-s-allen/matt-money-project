/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║         MATT MONEY — Complete Backend (All-in-One)       ║
 * ║                                                          ║
 * ║  SETUP (do this once, takes ~5 min on your phone):      ║
 * ║  1. Select ALL this text → Copy                         ║
 * ║  2. Go to script.google.com → New project               ║
 * ║  3. Select all default code → Paste                     ║
 * ║  4. Click ▶ Run → choose function: setup → Run          ║
 * ║  5. Accept permissions (once)                           ║
 * ║  6. Deploy → New deployment → Web App                   ║
 * ║     • Execute as: Me                                    ║
 * ║     • Who has access: Anyone                            ║
 * ║  7. Copy the Web App URL → paste into Matt Money app    ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * FUTURE UPDATES: Just refresh your app — frontend updates
 * automatically. Backend updates are rare and will come with
 * specific paste instructions.
 */

// ── Version ──────────────────────────────────────────────────
var VERSION = '1.0.0';

// ── Sheet names ───────────────────────────────────────────────
var S = {
  tx:         'Transactions',
  cats:       'Categories',
  debts:      'Debts',
  patrimonio: 'Patrimônio',
  milestones: 'Salary_Milestones',
  config:     'Config',
  cache:      'Monthly_Cache'
};

// ── Column headers ────────────────────────────────────────────
var H = {
  tx:         ['id','type','amount','description','merchant','category','date','notes','items','createdAt'],
  cats:       ['id','emoji','label','color','budget','active'],
  debts:      ['id','name','balance','interestRate','minPayment','bank','type','updatedAt'],
  patrimonio: ['key','fgts','carValue','savings','investments','updatedAt'],
  milestones: ['year','salary','event','notes'],
  cache:      ['month','data','updatedAt']
};

// ════════════════════════════════════════════════════════════════
//  ONE-TIME SETUP — Run this function once to create everything
// ════════════════════════════════════════════════════════════════
function setup() {
  // 1. Create the Google Spreadsheet
  var ss = SpreadsheetApp.create('💰 Matt Money — Financial Data');
  var id = ss.getId();

  // 2. Store the ID so the Web App can find it later
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', id);

  // 3. Build all the tabs
  _initAllSheets(ss);

  // 4. Log success — check Execution log for your spreadsheet URL
  Logger.log('✅ SETUP COMPLETE!');
  Logger.log('');
  Logger.log('📊 Your Google Sheet: ' + ss.getUrl());
  Logger.log('');
  Logger.log('👉 NEXT: Deploy → New deployment → Web App');
  Logger.log('   Execute as: Me | Who has access: Anyone');
  Logger.log('   Copy the Web App URL and paste it into the Matt Money app.');
}

// ════════════════════════════════════════════════════════════════
//  WEB APP ENTRY POINTS
// ════════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    var action = (e.parameter && e.parameter.action) ? e.parameter.action : '';
    var p = e.parameter || {};

    if (action === 'getTransactions')     return _json({ data: _getTx(p) });
    if (action === 'deleteTransaction')   return _deleteTx(p);
    if (action === 'getSummary')          return _getSummary(p);
    if (action === 'getMonthlyHistory')   return _getHistory(p);
    if (action === 'getDebts')            return _json({ data: _getAll(S.debts, H.debts) });
    if (action === 'getPatrimonio')       return _json({ data: _getPatrimonio() });
    if (action === 'getCategories')       return _json({ data: _getAll(S.cats, H.cats) });
    if (action === 'getSalaryMilestones') return _json({ data: _getAll(S.milestones, H.milestones) });
    if (action === 'initSheets')          return _initSheets();
    if (action === 'version')             return _json({ version: VERSION });

    return _err('Unknown action: ' + action, 400);
  } catch(e) {
    Logger.log('doGet error: ' + e.toString());
    return _err(e.toString(), 500);
  }
}

function doPost(e) {
  try {
    var action = (e.parameter && e.parameter.action) ? e.parameter.action : '';
    var body = JSON.parse(e.postData ? e.postData.contents : '{}');

    if (action === 'addTransaction')       return _addTx(body);
    if (action === 'updateTransaction')    return _updateTx(body);
    if (action === 'upsertDebt')           return _upsertDebt(body);
    if (action === 'updatePatrimonio')     return _updatePatrimonio(body);
    if (action === 'saveSalaryMilestones') return _saveMilestones(body);

    return _err('Unknown action: ' + action, 400);
  } catch(e) {
    Logger.log('doPost error: ' + e.toString());
    return _err(e.toString(), 500);
  }
}

// ════════════════════════════════════════════════════════════════
//  RESPONSE HELPERS
// ════════════════════════════════════════════════════════════════
function _json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
function _err(msg, code) {
  return _json({ error: msg, code: code || 500 });
}

// ════════════════════════════════════════════════════════════════
//  SPREADSHEET ACCESS
// ════════════════════════════════════════════════════════════════
function _ss() {
  // Try container-bound first, fall back to stored ID
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch(e) {}

  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Sheet ID not found. Please run setup() first.');
  return SpreadsheetApp.openById(id);
}

function _sheet(name) {
  var sheet = _ss().getSheetByName(name);
  if (!sheet) throw new Error('Tab "' + name + '" not found. Run initSheets to recreate.');
  return sheet;
}

// ════════════════════════════════════════════════════════════════
//  CORE CRUD
// ════════════════════════════════════════════════════════════════
function _getAll(sheetName, headers) {
  var sheet = _sheet(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values
    .filter(function(r) { return r[0] && String(r[0]).trim() !== ''; })
    .map(function(r) { return _toObj(headers, r); });
}

function _append(sheetName, headers, obj) {
  _sheet(sheetName).appendRow(_toRow(headers, obj));
  return obj;
}

function _update(sheetName, headers, id, updates) {
  var sheet = _sheet(sheetName);
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      var merged = _merge(_toObj(headers, data[i]), updates);
      merged.id  = id;
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([_toRow(headers, merged)]);
      return merged;
    }
  }
  throw new Error('Row not found: ' + id);
}

function _delete(sheetName, id) {
  var sheet = _sheet(sheetName);
  var data  = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(id)) { sheet.deleteRow(i + 1); return true; }
  }
  return false;
}

function _upsert(sheetName, headers, obj) {
  var sheet = _sheet(sheetName);
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(obj.id)) {
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([_toRow(headers, obj)]);
      return obj;
    }
  }
  return _append(sheetName, headers, obj);
}

function _upsertSingle(sheetName, headers, obj) {
  var sheet = _sheet(sheetName);
  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 1, 1, headers.length).setValues([_toRow(headers, obj)]);
  } else {
    _append(sheetName, headers, obj);
  }
  return obj;
}

// ── Row serialization ─────────────────────────────────────────
var _numFields = ['amount','balance','interestRate','minPayment','salary','year','fgts','carValue','savings','investments','budget'];

function _toObj(headers, row) {
  var obj = {};
  headers.forEach(function(h, i) {
    var v = row[i];
    if (h === 'items') {
      try { obj[h] = v ? JSON.parse(v) : []; } catch(e) { obj[h] = []; }
    } else if (_numFields.indexOf(h) >= 0) {
      obj[h] = parseFloat(v) || 0;
    } else if (h === 'active') {
      obj[h] = v !== false && v !== 'false' && v !== '';
    } else {
      obj[h] = (v !== undefined && v !== null) ? String(v) : '';
    }
  });
  return obj;
}

function _toRow(headers, obj) {
  return headers.map(function(h) {
    var v = obj[h];
    if (v === undefined || v === null) return '';
    if (h === 'items' && Array.isArray(v)) return JSON.stringify(v);
    return v;
  });
}

function _merge(base, updates) {
  var result = {};
  Object.keys(base).forEach(function(k) { result[k] = base[k]; });
  Object.keys(updates).forEach(function(k) { result[k] = updates[k]; });
  return result;
}

// ════════════════════════════════════════════════════════════════
//  TRANSACTION HANDLERS
// ════════════════════════════════════════════════════════════════
function _getTx(p) {
  var all = _getAll(S.tx, H.tx);
  if (p.month)    all = all.filter(function(t) { return t.date && t.date.indexOf(p.month) === 0; });
  if (p.category) all = all.filter(function(t) { return t.category === p.category; });
  if (p.type)     all = all.filter(function(t) { return t.type === p.type; });
  return all.sort(function(a,b) { return b.date > a.date ? 1 : -1; });
}

function _addTx(body) {
  if (!body.amount || !body.type) return _err('Missing amount or type', 400);
  var tz = Session.getScriptTimeZone();
  var tx = {
    id:          Utilities.getUuid(),
    type:        body.type,
    amount:      parseFloat(body.amount) || 0,
    description: body.description || '',
    merchant:    body.merchant || '',
    category:    body.category || 'other',
    date:        body.date || Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'),
    notes:       body.notes || '',
    items:       JSON.stringify(body.items || []),
    createdAt:   new Date().toISOString()
  };
  _append(S.tx, H.tx, tx);
  _clearCache(tx.date.substring(0, 7));
  return _json({ data: tx, success: true });
}

function _updateTx(body) {
  if (!body.id) return _err('Missing id', 400);
  var updated = _update(S.tx, H.tx, body.id, body);
  if (body.date) _clearCache(body.date.substring(0,7));
  return _json({ data: updated, success: true });
}

function _deleteTx(p) {
  if (!p.id) return _err('Missing id', 400);
  _delete(S.tx, p.id);
  return _json({ success: true });
}

// ════════════════════════════════════════════════════════════════
//  SUMMARY & HISTORY
// ════════════════════════════════════════════════════════════════
function _getSummary(p) {
  var tz    = Session.getScriptTimeZone();
  var month = p.month || Utilities.formatDate(new Date(), tz, 'yyyy-MM');

  var cached = _readCache(month);
  if (cached) return _json({ data: cached });

  var all     = _getAll(S.tx, H.tx);
  var monthly = all.filter(function(t) { return t.date && t.date.indexOf(month) === 0; });

  var income = 0, expenses = 0, byCat = {}, count = monthly.length;
  monthly.forEach(function(t) {
    var amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') income += amt;
    else { expenses += amt; byCat[t.category] = (byCat[t.category] || 0) + amt; }
  });

  var parts = month.split('-');
  var daysInMonth = new Date(parseInt(parts[0]), parseInt(parts[1]), 0).getDate();
  var now = new Date();
  var cutoff = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, daysInMonth);
  var daysPassed = now < cutoff ? now.getDate() : daysInMonth;

  var summary = {
    month: month, totalIncome: income, totalExpenses: expenses,
    balance: income - expenses, byCategory: byCat, txCount: count,
    avgPerDay: daysPassed > 0 ? expenses / daysPassed : 0,
    savingsRate: income > 0 ? (income - expenses) / income * 100 : 0,
    recentTx: monthly.slice(0, 10)
  };

  _writeCache(month, summary);
  return _json({ data: summary });
}

function _getHistory(p) {
  var months = parseInt(p.months) || 6;
  var all    = _getAll(S.tx, H.tx);
  var hist   = {};

  all.forEach(function(t) {
    if (!t.date) return;
    var mo = t.date.substring(0, 7);
    if (!hist[mo]) hist[mo] = { month: mo, income: 0, expenses: 0 };
    var amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') hist[mo].income += amt; else hist[mo].expenses += amt;
  });

  return _json({
    data: Object.values(hist)
      .sort(function(a,b) { return a.month > b.month ? 1 : -1; })
      .slice(-months)
  });
}

// ════════════════════════════════════════════════════════════════
//  DEBTS / PATRIMÔNIO / MILESTONES
// ════════════════════════════════════════════════════════════════
function _upsertDebt(body) {
  if (!body.id) body.id = Utilities.getUuid();
  body.updatedAt = new Date().toISOString();
  _upsert(S.debts, H.debts, body);
  return _json({ data: body, success: true });
}

function _getPatrimonio() {
  try {
    var sheet = _sheet(S.patrimonio);
    if (sheet.getLastRow() < 2) return {};
    return _toObj(H.patrimonio, sheet.getRange(2, 1, 1, H.patrimonio.length).getValues()[0]);
  } catch(e) { return {}; }
}

function _updatePatrimonio(body) {
  body.key       = 'main';
  body.updatedAt = new Date().toISOString();
  _upsertSingle(S.patrimonio, H.patrimonio, body);
  return _json({ data: body, success: true });
}

function _saveMilestones(body) {
  var sheet   = _sheet(S.milestones);
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
  (body.milestones || []).forEach(function(ms) { _append(S.milestones, H.milestones, ms); });
  return _json({ success: true });
}

// ════════════════════════════════════════════════════════════════
//  CACHE (stored in Monthly_Cache sheet for fast reads)
// ════════════════════════════════════════════════════════════════
function _readCache(month) {
  try {
    var data = _sheet(S.cache).getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === month) { try { return JSON.parse(data[i][1]); } catch(e) { return null; } }
    }
  } catch(e) {}
  return null;
}

function _writeCache(month, data) {
  try {
    var sheet = _sheet(S.cache);
    var rows  = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === month) {
        sheet.getRange(i+1,1,1,3).setValues([[month, JSON.stringify(data), new Date().toISOString()]]);
        return;
      }
    }
    sheet.appendRow([month, JSON.stringify(data), new Date().toISOString()]);
  } catch(e) {}
}

function _clearCache(month) {
  try {
    var sheet = _sheet(S.cache);
    var data  = sheet.getDataRange().getValues();
    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === month) { sheet.deleteRow(i + 1); return; }
    }
  } catch(e) {}
}

// ════════════════════════════════════════════════════════════════
//  SHEET INITIALIZATION
// ════════════════════════════════════════════════════════════════
function _initSheets() {
  try { _initAllSheets(_ss()); return _json({ success: true, message: 'Sheets ready' }); }
  catch(e) { return _err('Init failed: ' + e.toString(), 500); }
}

function _initAllSheets(ss) {
  var tz = 'America/Sao_Paulo';

  _makeSheet(ss, S.tx, H.tx, [
    [Utilities.getUuid(),'expense',150,'Supermercado Extra','Extra','food','2026-03-01','','[]',new Date().toISOString()],
    [Utilities.getUuid(),'income',7500,'Salário março','Empresa','other','2026-03-05','','[]',new Date().toISOString()]
  ]);

  _makeSheet(ss, S.cats, H.cats, [
    ['food','🛒','Food','#f97316',2000,true],
    ['transport','🚗','Transport','#00a8e8',800,true],
    ['housing','🏠','Housing','#a855f7',2500,true],
    ['health','❤️','Health','#e8002d',500,true],
    ['education','📚','Education','#ffd600',300,true],
    ['subscriptions','📱','Subscriptions','#39d353',400,true],
    ['clothing','👕','Clothing','#ec4899',300,true],
    ['entertainment','🎬','Entertainment','#8b5cf6',200,true],
    ['debt','💳','Debt','#ef4444',1500,true],
    ['savings','🏦','Savings','#39d353',2000,true],
    ['restaurant','🍽️','Dining','#f59e0b',600,true],
    ['other','📦','Other','#6b7280',500,true]
  ]);

  _makeSheet(ss, S.debts, H.debts, [
    [Utilities.getUuid(),'Cartão Nubank',8000,9.9,240,'Nubank','credit_card',new Date().toISOString()],
    [Utilities.getUuid(),'Cartão Itaú',6000,8.5,180,'Itaú','credit_card',new Date().toISOString()]
  ]);

  _makeSheet(ss, S.patrimonio, H.patrimonio, [
    ['main',68000,50000,0,0,new Date().toISOString()]
  ]);

  _makeSheet(ss, S.milestones, H.milestones, [
    [1,7500,'Current — Senior Specialist (Procurement)',''],
    [2,8500,'Annual decisão raise (estimated)',''],
    [3,11000,'Sr Analyst + Big Data Superior diploma',''],
    [5,13000,'Estimated senior growth',''],
    [10,18000,'Long-term career projection','']
  ]);

  _makeSheet(ss, S.config, ['key','value'], []);
  _makeSheet(ss, S.cache, H.cache, []);

  // Delete default "Sheet1" if it exists
  var defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Planilha1');
  if (defaultSheet) try { ss.deleteSheet(defaultSheet); } catch(e) {}

  Logger.log('All ' + Object.keys(S).length + ' sheets initialized.');
}

function _makeSheet(ss, name, headers, data) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  // Only write if headers not already there
  if (sheet.getLastRow() < 1 || sheet.getRange(1,1).getValue() !== headers[0]) {
    sheet.clearContents();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (data && data.length) {
      sheet.getRange(2, 1, data.length, headers.length).setValues(data);
    }
  }

  // Style header
  var hdr = sheet.getRange(1, 1, 1, headers.length);
  hdr.setFontWeight('bold');
  hdr.setBackground('#1a1a2e');
  hdr.setFontColor('#e8002d');
  hdr.setFontSize(11);
  sheet.setFrozenRows(1);

  // Column widths for Transactions
  if (name === S.tx) {
    [250,80,100,280,180,130,100,220,60,220].forEach(function(w,i) {
      try { sheet.setColumnWidth(i+1, w); } catch(e) {}
    });
  }

  return sheet;
}
