# Matt Money — Setup Guide

> **Zero extra cost.** This runs entirely on your existing Google account + Gemini Pro subscription.
> No servers, no hosting fees, no subscriptions beyond what you already pay.

---

## What you'll have when done

- 📱 **PWA** — install on your phone like an app (works offline)
- 📊 **Google Sheets** as your database (connect directly to Looker Studio)
- 🤖 **Gemini AI** reads your receipts and notes automatically
- 🏎️ **F1-style dashboard** — full financial telemetry
- 🔮 **Retirement & debt simulator** with your exact Brazilian salary/FGTS numbers

---

## Step 1 — Create your Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com)
2. Click **+ Blank spreadsheet**
3. Name it `Matt Money — Financial Data`
4. Copy the **Spreadsheet ID** from the URL:
   - URL looks like: `https://docs.google.com/spreadsheets/d/`**`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`**`/edit`
   - The bold part is your Spreadsheet ID (you won't need this, but keep it handy)

---

## Step 2 — Deploy the Apps Script backend

1. In your Google Sheet, go to **Extensions → Apps Script**
2. You'll see a default `Code.gs` file. **Delete all its contents.**
3. Create three files (click the **+** next to "Files"):

### File 1: `Code.gs`
Copy the entire contents of `apps-script/Code.gs` from this repo.

### File 2: `Sheets.gs`
Click **+** → New script file → name it `Sheets`
Copy the entire contents of `apps-script/Sheets.gs` from this repo.

4. Click **Project Settings** (⚙️ gear icon) → check **"Show `appsscript.json` manifest file in editor"**
5. Click `appsscript.json` in the file list and replace its contents with `apps-script/appsscript.json` from this repo.

6. **Initialize the sheets** (first-time only):
   - In Apps Script, click the dropdown next to ▶ Run and select `handleInitSheets`
   - Click ▶ Run
   - Accept permissions when prompted
   - This creates all the Sheet tabs automatically

7. **Deploy as Web App**:
   - Click **Deploy → New deployment**
   - Click the gear ⚙️ next to "Type" → select **Web app**
   - Description: `Matt Money API v1`
   - Execute as: **Me**
   - Who has access: **Anyone** _(no sign-in required — it's your personal data)_
   - Click **Deploy**
   - **Copy the Web App URL** — it looks like:
     `https://script.google.com/macros/s/AKfycby.../exec`

> ⚠️ **Important:** Every time you edit the Apps Script code, you must create a **new deployment** (Deploy → New deployment) and use the new URL. "Manage deployments" shows all versions.

---

## Step 3 — Get your free Gemini API key

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with your Google account (same one with Gemini Pro)
3. Click **Get API key** → **Create API key in new project**
4. Copy the key (starts with `AIza...`)

> **This is free.** Gemini 1.5 Flash has a free tier of 15 requests/minute and 1,500/day — more than enough for personal receipt scanning.

---

## Step 4 — Open and configure the app

### Option A: GitHub Pages (recommended — works as a proper PWA)

1. Push this repo to GitHub (if not already)
2. Go to repo Settings → Pages → Branch: `claude/financial-tracking-app-8qqrM` → Folder: `/src`
3. Your app will be at `https://yourusername.github.io/matt-money-project/`
4. On your phone: open the URL in Chrome → tap ⋮ → **Add to Home Screen**

### Option B: Open locally
1. Open `src/index.html` directly in a browser (some PWA features won't work)

### Configure the app

On first launch, you'll see the setup screen:

1. **Apps Script URL** — paste the URL from Step 2
2. **Gemini API Key** — paste the key from Step 3
3. Click **Activate Command Center**

The app will automatically create all Sheet tabs and load your data.

---

## Step 5 — Connect to Looker Studio

1. Go to [lookerstudio.google.com](https://lookerstudio.google.com)
2. Click **Create → Report**
3. Select **Google Sheets** as data source
4. Select your `Matt Money — Financial Data` spreadsheet
5. Choose the `Transactions` sheet
6. Build your dashboard! Recommended charts:
   - Monthly spending by category (Bar chart)
   - Income vs Expense trend (Line chart)
   - Category breakdown (Pie/Donut)
   - Running balance (Area chart)

---

## Your Sheet structure

After initialization, you'll have these tabs:

| Tab | What it stores |
|-----|---------------|
| `Transactions` | Every income/expense entry |
| `Categories` | Category list with emojis, colors & budgets |
| `Debts` | Your credit cards (Nubank, Itaú, etc.) |
| `Patrimônio` | FGTS, car value, savings, investments |
| `Salary_Milestones` | Your career salary progression plan |
| `Config` | App configuration |
| `Monthly_Cache` | Performance cache (auto-managed) |

---

## Adding transactions

### Fastest method: Camera 📸
1. Tap **+** (red button in nav)
2. Tap the camera zone → take a photo of your receipt or handwritten note
3. Gemini reads it and suggests: merchant, amount, date, category, items
4. Review the suggestion → tap **✓ Use these values**
5. Add any extra notes → **Save**

### Manual method
1. Tap **+**
2. Enter amount → select category → fill description
3. Save — syncs to your Sheet instantly

### Offline
If you have no internet, transactions are queued locally and sync automatically when you reconnect.

---

## Your defaults (pre-configured for you)

| Setting | Value |
|---------|-------|
| Salary | R$ 7,500 |
| FGTS | R$ 68,000 |
| Car | R$ 50,000 (VW Up TSI 2018/19) |
| Debt | R$ 14,000 (multiple cards) |

Update these anytime in **Settings** (⚙️ top right).

---

## Simulator — Grand Prix

The simulator uses Brazilian financial data:
- **CDI rate**: configurable (default 14.75% a.a.)
- **IPCA**: 4.5% a.a.
- **FGTS growth**: 6% a.a. + 8% salary contribution monthly
- **Car depreciation**: 10% a.a.
- **Debt payoff**: Avalanche method (highest interest first)
- **Salary milestones**: Your exact career path (edit in Salary_Milestones sheet)

---

## Troubleshooting

**"Apps Script URL not configured"**
→ Go to Settings (⚙️) and paste your Web App URL

**"Gemini error: 403"**
→ Check your API key is correct in Settings

**"Sheet not found"**
→ In Apps Script, run `handleInitSheets` to recreate all sheets

**"CORS error" or "Failed to fetch"**
→ Redeploy the Apps Script as a new deployment and update the URL in Settings

**App not loading receipts**
→ Make sure camera permissions are granted in your browser/phone settings

---

## Cost breakdown

| Service | Cost |
|---------|------|
| Google Sheets | Free |
| Google Apps Script | Free (6 min/execution, 20k calls/day) |
| Gemini 1.5 Flash API | Free (1,500 requests/day) |
| GitHub Pages | Free |
| Looker Studio | Free |
| **Total** | **R$ 0** |

Your existing costs: Gemini Pro (R$ 99) + Claude Pro — neither is needed for runtime.

---

*Built with Claude Code · F1 Dark Mode · Made for Brasil 🇧🇷🏎️*
