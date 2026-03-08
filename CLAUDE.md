# Matt Money — Financial Tracker PWA

## Project Overview
Personal finance tracker PWA for daily expense tracking, account management, credit cards, net worth, and financial projections. Built for a user named Matthew based in Brazil (BRL currency).

## Tech Stack
- **Pure vanilla JS** — no frameworks, no build tools, no npm, no dependencies
- **Chart.js 4.4** via CDN (only external dependency)
- **localStorage** for all data persistence (prefix: `mm_`)
- **PWA** with service worker and manifest
- **GitHub Pages** deploys from `src/` directory automatically

## Architecture

### File Structure
```
src/
├── index.html              — App shell, modals, setup wizard HTML
├── css/style.css           — All styles (CSS custom properties, dual theme)
├── js/
│   ├── app.js              — Core: routing, init, setup wizard, theme, tx detail/edit
│   ├── api.js              — Data CRUD layer + Gemini AI receipt scanning
│   ├── utils/
│   │   ├── storage.js      — localStorage abstraction (Store singleton)
│   │   └── formatter.js    — Currency/date formatting (Fmt singleton)
│   └── views/
│       ├── dashboard.js    — Main dashboard with charts and summary
│       ├── transactions.js — Transaction history list
│       ├── add-transaction.js — Add new transaction form
│       ├── accounts.js     — Bank accounts & credit cards management
│       ├── patrimonio.js   — Net worth view (assets, debts, goals)
│       └── simulator.js    — Financial projections & career milestones
├── sw.js                   — Service worker
└── manifest.json           — PWA manifest
apps-script/MattMoney.gs    — Optional Google Sheets backend (not required)
```

### Key Patterns
- **IIFE modules**: Every JS file exports a singleton via IIFE (`const App = (() => { ... })()`)
- **Script load order matters**: `formatter.js` → `storage.js` → `api.js` → view files → `app.js` (last)
- **Async view rendering**: Each view module has a `render()` method returning a Promise
- **Navigation**: `App.navigate(viewName)` — views: `dashboard`, `transactions`, `add`, `accounts`, `patrimonio`, `simulator`
- **Bottom nav** with 4 tabs + centered FAB for "Add Transaction"
- **Modal-based** editing for transactions, accounts, credit cards
- **Data export/import**: JSON backup (version 3 format)

### Data Model (localStorage keys with `mm_` prefix)
- `data_tx` — Transactions array: `{id, date, description, amount, type, category, accountId, ...}`
- `data_accounts` — Bank accounts: `{id, name, bank, type, balance}`
- `data_credit_cards` — Credit cards: `{id, name, brand, limit, currentBalance, closingDay, dueDay, ...}`
- `data_debts` — Legacy debts array
- `data_patrimonio` — Assets object (fgts, investments, etc.)
- `data_categories` — Budget categories with emoji, color, budget amount
- `data_milestones` — Career salary milestones
- `profile` — User profile: name, salary, savingsGoal, targetYears, etc.
- `setup_done` — Boolean flag for setup wizard completion
- `ui` — UI state: activeMonth, activeView, theme

### Theming
- Dual theme via `data-theme` attribute on `<html>`: `"claude"` (light) or `"dark"`
- CSS custom properties: `--bg`, `--surface`, `--text`, `--primary`, `--accent`, etc.
- Toggle via `App.toggleTheme()`

### Currency
- Brazilian Real (BRL) — formatted via `Fmt.currency()` using `pt-BR` locale
- All amounts stored as numbers (not cents)

## API Integrations (Optional)
- **Gemini AI**: Receipt scanning via API key in settings. Model fallback chain in `api.js`
- **Google Apps Script**: Optional Sheets sync via URL in settings

## Development Guidelines
- No build step — edit files directly, push to deploy
- Test changes by opening `src/index.html` in browser
- Keep all JS as vanilla ES6+ (no modules/imports, uses global scope)
- Maintain IIFE pattern for new view files
- Add new views to both `index.html` (script tag + HTML container) and `app.js` (navigate function)
- New localStorage keys: always use `Store.raw.get/set` with the `mm_` prefix handled automatically
- When adding API functions, follow the pattern in `api.js` and call `Store.cache.invalidateAll()` on mutations

## Current Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Setup Wizard | **Built** (basic) | 3 steps: profile, accounts, cards. Needs expansion to 6 steps — see VISION.md |
| Transaction Tracking | **Built** | Full CRUD, categories, account linkage, search, filters |
| AI Receipt Scanning | **Built** | Gemini with 3-model fallback, line items, barcodes, NF-e keys |
| Dashboard | **Built** | Monthly summary, charts, category breakdown, 6-month trends |
| Account Management | **Built** | Bank accounts + credit cards with balances and limits |
| Credit Card Tracking | **Partial** | Has limit/balance/closing day/due day. Missing: per-month bill amounts, debt trajectory, installment tracking |
| Net Worth (Patrimônio) | **Built** (basic) | FGTS, car, savings, investments, debt ratio. Missing: property, historical trends |
| Simulator | **Built** | 4 tabs: retirement, debt payoff, salary plan, if-fired. Functional with compound growth |
| Cash Flow Engine | **Planned** | Monthly planning view to replace Google Sheets — see VISION.md Phase 2 |
| Income Intelligence | **Planned** | CLT deductions, holerite scanning, planned vs actual — see VISION.md Phase 4 |
| Investment Planning | **Planned** | Allocation tracking, card-as-debit mode — see VISION.md Phase 5 |
| BI Data Export | **Planned** | Structured CSV exports for dashboards — see VISION.md Phase 6 |
| Theming & PWA | **Built** | Dual theme, service worker, offline support, manifest |
| Data Export/Import | **Built** | JSON backup v3 format |

## Key Design Principles

- **Effortless data entry** — AI-first (receipt scanning, holerite scanning, bill import). Minimize manual typing.
- **Everything in one place** — Replace the Google Sheets workflow entirely. Every financial data point lives here.
- **Brazil/CLT-first** — FGTS, 13º salário, INSS/IRRF, adiantamento, férias are first-class concepts.
- **Projections drive behavior** — Always show the future impact of today's decisions.
- **localStorage-only core** — No backend required. Works offline, instantly responsive.

## Product Vision

See **[VISION.md](VISION.md)** for the complete product roadmap, Matthew's financial strategy goals ("Live on the 15th"), phased feature plan, data model extensions, and design principles that govern all future work.
