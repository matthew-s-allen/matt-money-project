/**
 * MATT MONEY — Google Apps Script Backend
 * Deploy this as a Web App: Execute as "Me", Access: "Anyone"
 *
 * Sheet tabs created automatically:
 *   Transactions | Categories | Debts | Patrimônio | Salary_Milestones | Config | Monthly_Cache
 */

// ── Constants ────────────────────────────────────────────────
var SHEET_NAMES = {
  transactions:     'Transactions',
  categories:       'Categories',
  debts:            'Debts',
  patrimonio:       'Patrimônio',
  salaryMilestones: 'Salary_Milestones',
  config:           'Config',
  monthlyCache:     'Monthly_Cache'
};

// ── CORS Headers ─────────────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json'
  };
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message, code) {
  return jsonResponse({ error: message, code: code || 500 });
}

// ── Entry Points ─────────────────────────────────────────────
function doGet(e) {
  try {
    var action = e.parameter.action || '';
    var params = e.parameter;

    switch (action) {
      case 'getTransactions':     return handleGetTransactions(params);
      case 'deleteTransaction':   return handleDeleteTransaction(params);
      case 'getSummary':          return handleGetSummary(params);
      case 'getMonthlyHistory':   return handleGetMonthlyHistory(params);
      case 'getDebts':            return jsonResponse({ data: Sheets.getAll(SHEET_NAMES.debts, Sheets.DEBT_HEADERS) });
      case 'getPatrimonio':       return jsonResponse({ data: Sheets.getPatrimonio() });
      case 'getCategories':       return jsonResponse({ data: Sheets.getAll(SHEET_NAMES.categories, Sheets.CAT_HEADERS) });
      case 'getSalaryMilestones': return jsonResponse({ data: Sheets.getAll(SHEET_NAMES.salaryMilestones, Sheets.MILESTONE_HEADERS) });
      case 'initSheets':          return handleInitSheets();
      default:                    return errorResponse('Unknown action: ' + action, 400);
    }
  } catch (err) {
    Logger.log('doGet error: ' + err.toString());
    return errorResponse(err.toString(), 500);
  }
}

function doPost(e) {
  try {
    var action = e.parameter.action || '';
    var body   = JSON.parse(e.postData.contents || '{}');

    switch (action) {
      case 'addTransaction':      return handleAddTransaction(body);
      case 'updateTransaction':   return handleUpdateTransaction(body);
      case 'upsertDebt':          return handleUpsertDebt(body);
      case 'updatePatrimonio':    return handleUpdatePatrimonio(body);
      case 'saveSalaryMilestones':return handleSaveMilestones(body);
      default:                    return errorResponse('Unknown action: ' + action, 400);
    }
  } catch (err) {
    Logger.log('doPost error: ' + err.toString());
    return errorResponse(err.toString(), 500);
  }
}

// ── Transaction handlers ─────────────────────────────────────
function handleGetTransactions(params) {
  var all = Sheets.getAll(SHEET_NAMES.transactions, Sheets.TX_HEADERS);

  if (params.month) {
    all = all.filter(function(tx) {
      return tx.date && tx.date.startsWith(params.month);
    });
  }
  if (params.category) {
    all = all.filter(function(tx) { return tx.category === params.category; });
  }
  if (params.type) {
    all = all.filter(function(tx) { return tx.type === params.type; });
  }

  // Sort newest first
  all.sort(function(a, b) { return b.date > a.date ? 1 : -1; });

  return jsonResponse({ data: all });
}

function handleAddTransaction(body) {
  // Validate required fields
  if (!body.amount || !body.type) {
    return errorResponse('Missing required fields: amount, type', 400);
  }

  var id = Utilities.getUuid();
  var now = new Date().toISOString();

  var tx = {
    id:          id,
    type:        body.type || 'expense',
    amount:      parseFloat(body.amount) || 0,
    description: body.description || '',
    merchant:    body.merchant || '',
    category:    body.category || 'other',
    date:        body.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    notes:       body.notes || '',
    items:       JSON.stringify(body.items || []),
    createdAt:   now
  };

  Sheets.appendRow(SHEET_NAMES.transactions, Sheets.TX_HEADERS, tx);

  // Invalidate monthly cache for this month
  var month = tx.date.substring(0, 7);
  Sheets.invalidateCache(month);

  return jsonResponse({ data: tx, success: true });
}

function handleUpdateTransaction(body) {
  if (!body.id) return errorResponse('Missing transaction id', 400);

  var updated = Sheets.updateRow(
    SHEET_NAMES.transactions,
    Sheets.TX_HEADERS,
    body.id,
    body
  );

  Sheets.invalidateCache(body.date ? body.date.substring(0,7) : null);
  return jsonResponse({ data: updated, success: true });
}

function handleDeleteTransaction(params) {
  if (!params.id) return errorResponse('Missing transaction id', 400);
  Sheets.deleteRow(SHEET_NAMES.transactions, Sheets.TX_HEADERS, params.id);
  return jsonResponse({ success: true });
}

// ── Summary handler ──────────────────────────────────────────
function handleGetSummary(params) {
  var month = params.month || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');

  // Check cache
  var cached = Sheets.getCache(month);
  if (cached) return jsonResponse({ data: cached });

  var all = Sheets.getAll(SHEET_NAMES.transactions, Sheets.TX_HEADERS);
  var monthly = all.filter(function(tx) { return tx.date && tx.date.startsWith(month); });

  var totalIncome   = 0;
  var totalExpenses = 0;
  var byCategory    = {};
  var txCount       = monthly.length;

  monthly.forEach(function(tx) {
    var amt = parseFloat(tx.amount) || 0;
    if (tx.type === 'income') {
      totalIncome += amt;
    } else {
      totalExpenses += amt;
      byCategory[tx.category] = (byCategory[tx.category] || 0) + amt;
    }
  });

  // Days in the selected month
  var parts = month.split('-');
  var daysInMonth = new Date(parseInt(parts[0]), parseInt(parts[1]), 0).getDate();
  var daysPassed = new Date() < new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, daysInMonth)
    ? new Date().getDate()
    : daysInMonth;

  var summary = {
    month:          month,
    totalIncome:    totalIncome,
    totalExpenses:  totalExpenses,
    balance:        totalIncome - totalExpenses,
    byCategory:     byCategory,
    txCount:        txCount,
    avgPerDay:      daysPassed > 0 ? totalExpenses / daysPassed : 0,
    savingsRate:    totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0,
    recentTx:       monthly.slice(0, 10)
  };

  Sheets.setCache(month, summary);
  return jsonResponse({ data: summary });
}

// ── Monthly history handler ──────────────────────────────────
function handleGetMonthlyHistory(params) {
  var monthCount = parseInt(params.months) || 6;
  var all = Sheets.getAll(SHEET_NAMES.transactions, Sheets.TX_HEADERS);

  var history = {};

  all.forEach(function(tx) {
    if (!tx.date) return;
    var month = tx.date.substring(0, 7);
    if (!history[month]) history[month] = { month: month, income: 0, expenses: 0 };
    var amt = parseFloat(tx.amount) || 0;
    if (tx.type === 'income') history[month].income += amt;
    else history[month].expenses += amt;
  });

  var sorted = Object.values(history)
    .sort(function(a, b) { return a.month > b.month ? 1 : -1; })
    .slice(-monthCount);

  return jsonResponse({ data: sorted });
}

// ── Debt handler ─────────────────────────────────────────────
function handleUpsertDebt(body) {
  if (!body.id) body.id = Utilities.getUuid();
  Sheets.upsertRow(SHEET_NAMES.debts, Sheets.DEBT_HEADERS, body);
  return jsonResponse({ data: body, success: true });
}

// ── Patrimônio handler ───────────────────────────────────────
function handleUpdatePatrimonio(body) {
  body.updatedAt = new Date().toISOString();
  Sheets.upsertSingleRow(SHEET_NAMES.patrimonio, Sheets.PATRIMONIO_HEADERS, body);
  return jsonResponse({ data: body, success: true });
}

// ── Salary milestones handler ────────────────────────────────
function handleSaveMilestones(body) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.salaryMilestones);
  if (!sheet) return errorResponse('Sheet not found', 404);

  // Clear and rewrite
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);

  var milestones = body.milestones || [];
  milestones.forEach(function(ms) {
    Sheets.appendRow(SHEET_NAMES.salaryMilestones, Sheets.MILESTONE_HEADERS, ms);
  });

  return jsonResponse({ success: true });
}

// ── Sheet initialization ─────────────────────────────────────
function handleInitSheets() {
  try {
    Sheets.initAllSheets();
    return jsonResponse({ success: true, message: 'Sheets initialized successfully' });
  } catch (err) {
    return errorResponse('Init failed: ' + err.toString(), 500);
  }
}
