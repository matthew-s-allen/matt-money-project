/**
 * MATT MONEY — Sheets Operations Layer
 * Handles all read/write operations to Google Sheets tabs
 */

var Sheets = (function() {

  // ── Header definitions ────────────────────────────────────
  var TX_HEADERS         = ['id','type','amount','description','merchant','category','date','notes','items','createdAt'];
  var CAT_HEADERS        = ['id','emoji','label','color','budget','active'];
  var DEBT_HEADERS       = ['id','name','balance','interestRate','minPayment','bank','type','updatedAt'];
  var PATRIMONIO_HEADERS = ['key','fgts','carValue','savings','investments','updatedAt'];
  var MILESTONE_HEADERS  = ['year','salary','event','notes'];
  var CACHE_HEADERS      = ['month','data','updatedAt'];

  // ── Sheet helpers ─────────────────────────────────────────
  function getSheet(name) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(name);
    if (!sheet) throw new Error('Sheet "' + name + '" not found. Please run initSheets first.');
    return sheet;
  }

  function getOrCreateSheet(name) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    return sheet;
  }

  // ── Row serialization ─────────────────────────────────────
  function rowToObject(headers, row) {
    var obj = {};
    headers.forEach(function(h, i) {
      var val = row[i];
      if (h === 'items') {
        try { obj[h] = val ? JSON.parse(val) : []; }
        catch { obj[h] = []; }
      } else if (h === 'amount' || h === 'balance' || h === 'interestRate' || h === 'minPayment' || h === 'salary' || h === 'year' || h === 'fgts' || h === 'carValue' || h === 'savings' || h === 'investments') {
        obj[h] = parseFloat(val) || 0;
      } else if (h === 'active') {
        obj[h] = val !== false && val !== 'false' && val !== '';
      } else {
        obj[h] = val !== undefined && val !== null ? String(val) : '';
      }
    });
    return obj;
  }

  function objectToRow(headers, obj) {
    return headers.map(function(h) {
      var val = obj[h];
      if (val === undefined || val === null) return '';
      if (h === 'items' && Array.isArray(val)) return JSON.stringify(val);
      return val;
    });
  }

  // ── Core CRUD ─────────────────────────────────────────────
  function getAll(sheetName, headers) {
    var sheet = getSheet(sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    return values
      .filter(function(row) { return row[0] && row[0] !== ''; })
      .map(function(row) { return rowToObject(headers, row); });
  }

  function appendRow(sheetName, headers, obj) {
    var sheet = getSheet(sheetName);
    var row = objectToRow(headers, obj);
    sheet.appendRow(row);
    return obj;
  }

  function updateRow(sheetName, headers, id, updates) {
    var sheet = getSheet(sheetName);
    var data  = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        var existing = rowToObject(headers, data[i]);
        var merged   = Object.assign({}, existing, updates, { id: id });
        var row = objectToRow(headers, merged);
        sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
        return merged;
      }
    }
    throw new Error('Row with id ' + id + ' not found');
  }

  function deleteRow(sheetName, headers, id) {
    var sheet = getSheet(sheetName);
    var data  = sheet.getDataRange().getValues();

    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]) === String(id)) {
        sheet.deleteRow(i + 1);
        return true;
      }
    }
    return false;
  }

  function upsertRow(sheetName, headers, obj) {
    var sheet = getSheet(sheetName);
    var data  = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(obj.id)) {
        var row = objectToRow(headers, obj);
        sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
        return obj;
      }
    }
    // Not found — append
    return appendRow(sheetName, headers, obj);
  }

  function upsertSingleRow(sheetName, headers, obj) {
    var sheet = getSheet(sheetName);
    var lastRow = sheet.getLastRow();

    if (lastRow >= 2) {
      var row = objectToRow(headers, obj);
      sheet.getRange(2, 1, 1, headers.length).setValues([row]);
    } else {
      appendRow(sheetName, headers, obj);
    }
    return obj;
  }

  // ── Patrimônio (single-row) ───────────────────────────────
  function getPatrimonio() {
    var sheet;
    try { sheet = getSheet(SHEET_NAMES.patrimonio); }
    catch (e) { return {}; }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return {};

    var row = sheet.getRange(2, 1, 1, PATRIMONIO_HEADERS.length).getValues()[0];
    return rowToObject(PATRIMONIO_HEADERS, row);
  }

  // ── Monthly cache (stored in sheet for fast reads) ─────────
  function getCache(month) {
    var sheet;
    try { sheet = getSheet(SHEET_NAMES.monthlyCache); }
    catch (e) { return null; }

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === month) {
        try { return JSON.parse(data[i][1]); }
        catch { return null; }
      }
    }
    return null;
  }

  function setCache(month, data) {
    var sheet;
    try { sheet = getSheet(SHEET_NAMES.monthlyCache); }
    catch (e) { return; }

    var allData = sheet.getDataRange().getValues();
    var found   = false;

    for (var i = 1; i < allData.length; i++) {
      if (allData[i][0] === month) {
        sheet.getRange(i + 1, 1, 1, 3).setValues([[month, JSON.stringify(data), new Date().toISOString()]]);
        found = true;
        break;
      }
    }

    if (!found) {
      sheet.appendRow([month, JSON.stringify(data), new Date().toISOString()]);
    }
  }

  function invalidateCache(month) {
    if (!month) return;
    var sheet;
    try { sheet = getSheet(SHEET_NAMES.monthlyCache); }
    catch (e) { return; }

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === month) {
        sheet.deleteRow(i + 1);
        return;
      }
    }
  }

  // ── Initialize all sheets ─────────────────────────────────
  function initAllSheets() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Transactions
    initSheet(ss, SHEET_NAMES.transactions, TX_HEADERS, [
      ['sample-id-1', 'expense', 150.00, 'Supermercado Extra', 'Extra', 'food', '2026-03-01', '', '[]', new Date().toISOString()],
      ['sample-id-2', 'income',  7500.00, 'Salário março', 'Empresa', 'other', '2026-03-05', '', '[]', new Date().toISOString()]
    ], {
      bold: true, background: '#1a1a1a', fontColor: '#e8002d', frozen: 1
    });

    // Categories
    initSheet(ss, SHEET_NAMES.categories, CAT_HEADERS, [
      ['food',          '🛒', 'Food',          '#f97316', 2000, true],
      ['transport',     '🚗', 'Transport',     '#00a8e8', 800,  true],
      ['housing',       '🏠', 'Housing',       '#a855f7', 2500, true],
      ['health',        '❤️', 'Health',        '#e8002d', 500,  true],
      ['education',     '📚', 'Education',     '#ffd600', 300,  true],
      ['subscriptions', '📱', 'Subscriptions', '#39d353', 400,  true],
      ['clothing',      '👕', 'Clothing',      '#ec4899', 300,  true],
      ['entertainment', '🎬', 'Entertainment', '#8b5cf6', 200,  true],
      ['debt',          '💳', 'Debt',          '#ef4444', 1500, true],
      ['savings',       '🏦', 'Savings',       '#39d353', 2000, true],
      ['restaurant',    '🍽️', 'Dining',        '#f59e0b', 600,  true],
      ['other',         '📦', 'Other',         '#6b7280', 500,  true]
    ]);

    // Debts
    initSheet(ss, SHEET_NAMES.debts, DEBT_HEADERS, [
      [Utilities.getUuid(), 'Cartão Nubank',   8000, 9.9, 240,  'Nubank',   'credit_card', new Date().toISOString()],
      [Utilities.getUuid(), 'Cartão Itaú',     6000, 8.5, 180,  'Itaú',     'credit_card', new Date().toISOString()]
    ]);

    // Patrimônio
    initSheet(ss, SHEET_NAMES.patrimonio, PATRIMONIO_HEADERS, [
      ['main', 68000, 50000, 0, 0, new Date().toISOString()]
    ]);

    // Salary Milestones
    initSheet(ss, SHEET_NAMES.salaryMilestones, MILESTONE_HEADERS, [
      [1, 7500,  'Current — Senior Specialist (Procurement)'],
      [2, 8500,  'Annual decisão raise (estimated)'],
      [3, 11000, 'Sr Analyst promotion + Big Data Superior diploma'],
      [5, 13000, 'Estimated senior growth'],
      [10,18000, 'Long-term career projection']
    ]);

    // Config
    initSheet(ss, SHEET_NAMES.config, ['key', 'value'], []);

    // Monthly Cache
    initSheet(ss, SHEET_NAMES.monthlyCache, CACHE_HEADERS, []);

    // Style the Transactions sheet
    styleTransactionsSheet(ss);
  }

  function initSheet(ss, name, headers, sampleData, options) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }

    // Write headers if not present
    var firstCell = sheet.getRange(1, 1).getValue();
    if (!firstCell || firstCell !== headers[0]) {
      sheet.clearContents();
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

      if (sampleData && sampleData.length) {
        sheet.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);
      }
    }

    // Style header row
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1a1a1a');
    headerRange.setFontColor('#e8002d');
    headerRange.setFontSize(11);

    sheet.setFrozenRows(1);

    return sheet;
  }

  function styleTransactionsSheet(ss) {
    var sheet = ss.getSheetByName(SHEET_NAMES.transactions);
    if (!sheet) return;

    // Set column widths
    sheet.setColumnWidth(1, 240);  // id
    sheet.setColumnWidth(2, 80);   // type
    sheet.setColumnWidth(3, 100);  // amount
    sheet.setColumnWidth(4, 250);  // description
    sheet.setColumnWidth(5, 180);  // merchant
    sheet.setColumnWidth(6, 120);  // category
    sheet.setColumnWidth(7, 100);  // date
    sheet.setColumnWidth(8, 200);  // notes
    sheet.setColumnWidth(9, 200);  // items
    sheet.setColumnWidth(10, 200); // createdAt

    // Auto-resize alternating row colors
    sheet.getRange(1, 1, 1, TX_HEADERS.length).setBorder(null, null, true, null, null, null, '#e8002d', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  }

  return {
    getSheet:       getSheet,
    getAll:         getAll,
    appendRow:      appendRow,
    updateRow:      updateRow,
    deleteRow:      deleteRow,
    upsertRow:      upsertRow,
    upsertSingleRow:upsertSingleRow,
    getPatrimonio:  getPatrimonio,
    getCache:       getCache,
    setCache:       setCache,
    invalidateCache:invalidateCache,
    initAllSheets:  initAllSheets,

    // Headers (exposed for Code.gs)
    TX_HEADERS:         TX_HEADERS,
    CAT_HEADERS:        CAT_HEADERS,
    DEBT_HEADERS:       DEBT_HEADERS,
    PATRIMONIO_HEADERS: PATRIMONIO_HEADERS,
    MILESTONE_HEADERS:  MILESTONE_HEADERS,
    CACHE_HEADERS:      CACHE_HEADERS
  };
})();
