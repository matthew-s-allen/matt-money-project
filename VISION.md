# Matt Money — Product Vision

## Who & Why

Matthew is a CLT (Consolidação das Leis do Trabalho) employee based in Brazil, earning in BRL. He currently manages his finances through a detailed Google Sheets spreadsheet and wants Matt Money to fully replace it — giving him a holistic, real-time view of his entire financial life in one intuitive app.

**End goal**: Financial independence through disciplined tracking, strategic saving, and compound growth — with the app as the central tool that makes it effortless and motivating.

---

## The Core Strategy: "Live on the 15th"

Matthew's financial strategy has a clear path:

1. **Zero all credit card monthly debt** — Stop carrying balances month-to-month
2. **Track every expense** — Build complete awareness of where money goes
3. **Live only on the adiantamento (salary advance) received on the 15th** — All living expenses covered by the advance
4. **End-of-month salary goes 100% to savings/investments** — The full paycheck on the ~30th is untouched
5. **Use credit cards for points/miles only** — Treat cards like debit: every card purchase triggers an equal transfer from checking to a dedicated savings account, keeping a 1:1 ratio with the card fatura (bill) at all times

The app must track progress toward each step and push the user forward with clear visualizations.

---

## What the App Replaces

### The Google Sheets Model

Matthew's current spreadsheet tracks monthly cash flow with this structure:

| Row | Description |
|-----|-------------|
| **Account Balances** | True balance, current balance, total debt, credit card balance, loan/financing amounts per account (Cash, Nubank, C6, Santander, Sam's Club, Porto Seguro, Karol) |
| **Month Start Balance** | Opening balance for each month (Jan–Dec + next Jan) |
| **Fixed Expenses** | Sam's Exp, Internet, Nubank Exp, etc. per month |
| **1st: Start After Exp** | Balance after fixed expenses are paid |
| **Advance Salary (15th)** | Adiantamento received mid-month (e.g., R$3,120/mo) |
| **Santander Exp** | Expenses charged to Santander account |
| **C6 Exp** | Expenses on C6 account |
| **Porto Seguro Exp** | Insurance/recurring on Porto Seguro |
| **Extra Income** | Any additional income that month |
| **Extra Expense** | Any additional expenses |
| **15th: Adv. After Exp** | Balance after advance salary minus mid-month expenses |
| **30th Salary** | End-of-month full salary (e.g., R$2,600/mo) |
| **Sam's Club** | Sam's Club card payment |
| **Extra Income/Expense** | End-of-month extras |
| **Santander Loan** | Loan payment |
| **30th: End After Exp** | Final balance at month end |
| **Total Expenses** | Sum of all expenses for the month |
| **Total Income** | Sum of all income for the month |
| **Overflow** | Income minus expenses (surplus or deficit) |
| **Investments** | Amount directed to investments |
| **Total Debt** | Running total of all debt |
| **Difference from Previous Month** | Month-over-month change |

The spreadsheet uses percentage growth columns (6%, 8%, 10%, 12%, 14%... up to 30%) projecting balances forward month by month for the entire year.

**The app must replicate ALL of this** — showing the same data in a more intuitive, interactive way with automatic calculations.

---

## Feature Roadmap

### Phase 1: Enhanced Setup Wizard

The initial onboarding must collect ALL data needed for a complete financial picture from day one. Hand-holding UX — guide the user step by step, explain why each piece of data matters.

**Current state (3 steps)**: Name/salary, bank accounts, credit cards.
**Target state (6 steps)**:

| Step | Collects | Details |
|------|----------|---------|
| 1. Profile | Personal & employment info | Name, gross salary, employer name, CLT start date, years at employer (for FGTS/severance calculations) |
| 2. Bank Accounts | All accounts | Name, bank, type (checking/savings/investment), current balance, flag as primary account |
| 3. Credit Cards | Full card details | Name, brand/flag (Visa/Mastercard/Elo/etc.), issuing bank, limit, current balance used, available credit, closing day, due day, interest rate, min payment. **Per-month bill amounts**: user checks their card app and enters what's showing for each future month that has data (to bootstrap expense tracking and see total debt across all months) |
| 4. Assets & Property | Net worth items | FGTS current balance, car (make/model/year/market value, financed? remaining balance), house/apartment (owned? value, mortgage details, remaining balance), other investments (Tesouro Direto, CDB, FIIs, stocks, crypto — type + amount + institution) |
| 5. Income Details | CLT income structure | Gross salary, estimated net take-home (app can calculate CLT deductions: INSS, IRRF, VT, VR, health plan), adiantamento amount and date (typically 15th), end-of-month salary date, 13º salário schedule, planned vacation months |
| 6. Bulk Import (Optional) | Bootstrap expense data | Upload credit card bill PDF/image → AI extracts transactions (same Gemini pattern as receipt scanning). This lets the app have historical expense data from day one |

### Phase 2: Cash Flow Engine

**New view or major dashboard enhancement** that replicates the spreadsheet's monthly planning.

- Start-of-month balance per account (auto-calculated from previous month or manually set)
- Expected income events: adiantamento on 15th, salary on 30th, extras
- Expense allocation per account (which expenses come from which account)
- Two checkpoints: "After 15th advance" and "After 30th salary" — showing balance state at each
- Overflow calculation: total income minus total expenses per month
- Month-over-month difference tracking
- 12-month forward view with projections (like the spreadsheet's percentage columns)
- Red flags when an account would go negative

### Phase 3: Credit Card Deep Tracking

- **Per-card, per-month bill view**: Current month's fatura + future months that have pending charges
- **Total installment debt**: Sum across all cards across all future months until balance reaches zero
- **Debt trajectory chart**: Is total card debt rising or falling over time?
- **Positive vs. expenses ratio**: Visualize how much cash is available versus total committed expenses
- **Integration with cash flow**: Card due dates affect account balances on specific dates
- **Goal tracking**: Progress toward zeroing monthly CC debt (prerequisite for "Live on the 15th")

### Phase 4: Income Intelligence (CLT-Specific)

- **Yearly income preview**: 12-month grid showing expected gross → net take-home per month
- **CLT deduction calculator**: INSS (tiered), IRRF (tiered), VT, VR, health plan, union dues
- **Special months**: 13º salário (paid in Nov/Dec installments), vacation pay (salary + 1/3), FGTS anniversary withdrawal
- **Holerite (payslip) AI scanning**: New Gemini prompt to extract net pay, all deductions, FGTS deposit amount, INSS, IRRF from payslip image/PDF
- **Planned vs. actual**: Side-by-side comparison per month — what was expected vs. what actually hit the account
- **Manual override**: Adjust any month's income when reality differs from projection

### Phase 5: Savings & Investment Planning

- Investment allocation tracking: Where is saved money going? (Tesouro Direto, CDB, FIIs, stocks, crypto)
- **Card-as-debit mode**: When a credit card charge is logged, prompt to transfer the same amount from checking to a dedicated savings account → always maintain 1:1 with card fatura
- Track investment growth over time (simple: manual balance updates; advanced: estimated growth by type)
- Points/miles tracking per card (future enhancement)
- Savings goal progress (how close to living entirely on the 15th advance)

### Phase 6: Data & BI Export

- **Structured CSV export**: Transactions, accounts, categories as clean tables (not just a JSON blob)
- **Time-series data**: Monthly summaries formatted for pivot tables
- **Schema documentation**: So Matthew can build Looker Studio / Google Sheets dashboards on top of the data
- Account-level, category-level, and card-level breakdowns

---

## Data Model Extensions

### Modified Existing Keys

**`data_credit_cards`** — Add fields:
```
{
  ...existing fields,
  issuingBank: "Nubank",           // Bank that issued the card
  availableCredit: 3500,           // limit - currentBalance (computed or stored)
  bills: [                         // Per-month bill amounts (from card app)
    { month: "2026-03", amount: 1200, paid: false },
    { month: "2026-04", amount: 850, paid: false },
    ...
  ]
}
```

**`profile`** — Add fields:
```
{
  ...existing fields,
  employerName: "Company",
  employerStartDate: "2023-06-15",   // CLT registration date
  yearsAtEmployer: 2.7,             // Computed from start date
  grossSalary: 9500,                // Before deductions
  adiantamentoAmount: 3120,         // Advance salary amount
  adiantamentoDay: 15,              // Day of month
  salaryDay: 30,                    // End-of-month salary day
  carMake: "VW", carModel: "Up TSI", carYear: "2018/19",
  hasProperty: false,
  propertyValue: 0,
  mortgageBalance: 0
}
```

### New Keys

| Key | Type | Purpose |
|-----|------|---------|
| `data_income_plan` | Array | `[{month, grossSalary, netSalary, deductions: {inss, irrf, vt, vr, healthPlan, other}, source: "planned"\|"actual"\|"holerite", notes}]` |
| `data_cash_flow` | Array | `[{month, accountId, startBalance, endBalance, entries: [{date, description, amount, type}]}]` |
| `data_investments` | Array | `[{id, type: "tesouro"\|"cdb"\|"fii"\|"stocks"\|"crypto", name, amount, institution, annualRate, updatedAt}]` |
| `data_properties` | Array | `[{id, type: "car"\|"apartment"\|"house", description, value, financed, remainingBalance, monthlyPayment, details: {...}}]` |

**Important**: Any new key must be added to `Store.data.exportAll()` and `importAll()` in `src/js/utils/storage.js` to maintain backup/restore compatibility.

---

## Motivational Features

These features push the user toward their goals:

- **Opportunity cost projections**: "You spent R$750 on restaurants this month. If saved at 14.75% CDI for 20 years, that would be R$X" (partially exists in simulator debt tab)
- **"Live on the 15th" progress tracker**: What percentage of monthly expenses can the adiantamento cover? Show progress toward 100%
- **Debt-free countdown**: Estimated date when all CC monthly debt reaches zero at current payment rate
- **Savings streaks**: Consecutive months where end-of-month salary went entirely to savings
- **Net worth milestones**: Progress bars toward R$100k, R$250k, R$500k, R$1M (already exists in patrimonio view)
- **Year-over-year comparison**: Same month last year vs. this year — are things improving?

---

## Design Principles

Every future change to Matt Money should follow these principles:

1. **Effortless data entry** — AI-first (receipt scanning, holerite scanning, bill import). Minimize manual typing. Smart defaults. The app should feel faster than a spreadsheet.
2. **Everything in one place** — Replace the Google Sheets workflow entirely. If Matthew needs to open Sheets for any financial data, the app has failed.
3. **Brazil/CLT-first** — FGTS, 13º salário, INSS/IRRF deductions, adiantamento, férias, multa rescisória — these are first-class concepts, not afterthoughts.
4. **Projections drive behavior** — Always show the future impact of today's decisions. Compound growth visualizations, debt trajectory, goal countdowns.
5. **localStorage-only core** — No backend required for all core features. The app must work offline and be instantly responsive. Cloud sync is optional/additive.
6. **Intuitive and pleasant** — The user should genuinely want to open the app. Clean UI, satisfying interactions, clear information hierarchy. Not a chore — a tool that empowers.

---

## Technical Notes for Implementation

- **New views** follow the IIFE singleton pattern with a `render()` method. Register in both `index.html` (script tag) and `app.js` (`views` map in `App.renderView()`).
- **AI scanning patterns** (receipt scanning in `api.js` lines 166-277) with model waterfall (gemini-2.5-pro → flash → flash-lite) should be reused for holerite scanning and CC bill import.
- **Profile defaults** in `storage.js` (line ~146) are currently hardcoded (salary: 7500, fgts: 68000, carValue: 50000). The enhanced wizard should replace these with real user data.
- **Export/import** in `storage.js` must be updated whenever new data keys are added.
- **Credit card data model change** is the most impactful schema change — it affects accounts view, patrimonio view, cash flow engine, and debt tracking.
