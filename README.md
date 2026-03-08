# 🏎️ Matt Money — Financial Command Center

> Personal financial tracking with F1-style data telemetry.
> **R$ 0 extra cost** — runs on Google Sheets + free Gemini API.

![Dark Mode F1 Dashboard](https://img.shields.io/badge/Design-F1%20Dark%20Mode-e8002d?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-Mobile%20First-39d353?style=flat-square)
![Google Sheets](https://img.shields.io/badge/Backend-Google%20Sheets-00a8e8?style=flat-square)
![Gemini AI](https://img.shields.io/badge/AI-Gemini%201.5%20Flash-ffd600?style=flat-square)

---

## Five screens, everything you need

| Screen | F1 Name | Purpose |
|--------|---------|---------|
| Dashboard | **Pit Lane** | Monthly telemetry: balance, savings rate, spend breakdown |
| Add Transaction | **Quick Add** | Camera → Gemini AI reads receipt → one tap save |
| Transaction List | **Race History** | All transactions, searchable, filterable by category |
| Simulator | **Grand Prix** | Retirement, debt payoff, salary progression, "if fired" |
| Patrimônio | **Garage** | FGTS + car + savings + investments = total net worth |

## Setup

→ See **[SETUP.md](SETUP.md)** for complete step-by-step instructions.

**TL;DR:**
1. Create a Google Sheet
2. Paste `apps-script/Code.gs` + `apps-script/Sheets.gs` → deploy as Web App
3. Get a free Gemini API key from aistudio.google.com
4. Host on GitHub Pages or open `src/index.html` locally
5. Enter your Apps Script URL + API key → done

## Stack

- **Frontend**: Vanilla JS PWA (no build tools, no npm, no dependencies)
- **Backend**: Google Apps Script (serverless, free)
- **Database**: Google Sheets (connect directly to Looker Studio)
- **AI**: Gemini 1.5 Flash (free tier — reads receipts, notes, any image)
- **Charts**: Chart.js (CDN)
- **Fonts**: Rajdhani + Inter + DM Mono (Google Fonts)

## Simulator capabilities

- **Retirement**: 3 scenarios (conservative/moderate/aggressive), 5-30 year horizon
- **Debt payoff**: Avalanche method, multiple payment scenarios, paydown trajectory chart
- **Salary**: Career milestone planner (includes Sr Analyst promotion path at ~2.5 years)
- **If fired**: FGTS + multa 40% + aviso prévio + férias + 13º + car = full package

## Brazilian-specific features

- FGTS tracking (balance + 8% monthly contribution + 6% annual growth)
- Multa de 40% calculator
- Aviso prévio estimator
- CDI-based investment scenarios (conservative/moderate/aggressive)
- All amounts in R$ (BRL)
- Decisão anual salary increase modeling

---

*Built with Claude Code | Goal: R$ 500k → R$ 1.5M | 0 → Hero 🇧🇷🏎️*
