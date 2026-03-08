# Matt Money — Setup Guide
### Everything done on your phone. ~10 minutes.

---

## Before you start, you need:
- Your Google account (you already have this)
- Chrome browser on your phone

That's it.

---

## Step 1 of 4 — Get the backend code

1. Open this in Chrome on your phone:
   **`github.com/matthew-s-allen/matt-money-project`**

2. Tap `apps-script` folder → tap `MattMoney.gs`

3. Tap the **Raw** button (top-right of the file view)

4. **Select all the text → Copy**
   - Android: long-press → Select all → Copy
   - iPhone: long-press → Select All → Copy

> This is the only code you'll ever paste. Everything else updates automatically.

---

## Step 2 of 4 — Deploy the backend (~5 minutes)

1. Open a new tab → go to **`script.google.com`**

2. Tap **New project** (the + button)

3. You'll see a code editor with some default text.
   **Select all of it → Delete → Paste** what you copied in Step 1.

4. Tap the **Save** icon (💾) — name the project `Matt Money`

5. Tap the **▶ Run** button
   - A dropdown appears — make sure it says **`setup`** → tap **Run**
   - First time: tap **Review permissions** → choose your Google account → **Allow**
   - Wait ~10 seconds

6. Tap **Execution log** at the bottom — you should see:
   ```
   ✅ SETUP COMPLETE!
   📊 Your Google Sheet: https://docs.google.com/...
   ```

7. Now deploy it as an API:
   - Tap **Deploy** (top-right) → **New deployment**
   - Tap the ⚙️ gear next to "Type" → select **Web app**
   - Description: `Matt Money v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Tap **Deploy**
   - **Copy the Web App URL** and save it in your Notes app.
     It looks like: `https://script.google.com/macros/s/AKfycb.../exec`

---

## Step 3 of 4 — Get your free Gemini API key (~2 minutes)

1. Open **`aistudio.google.com`** in Chrome
2. Sign in with your Google account
3. Tap **Get API key** → **Create API key**
4. **Copy the key** (starts with `AIza...`) — save it in Notes

> Free tier = 1,500 AI receipt scans per day. Zero cost added.

---

## Step 4 of 4 — Open and activate the app

1. Open **`matthew-s-allen.github.io/matt-money-project`** in Chrome

2. On the setup screen, enter:
   - **Apps Script URL** — the URL from Step 2
   - **Gemini API key** — the key from Step 3

3. Tap **Activate Command Center** — it connects to your Sheet and you're live 🏎️

4. **Install on your home screen:**
   - Android: tap ⋮ menu → **Add to Home screen**
   - iPhone: tap the Share icon → **Add to Home Screen**

---

## That's it. You're done.

- ✅ Connected to your Google Sheet
- ✅ AI receipt scanning active
- ✅ Installed on your home screen like a real app
- ✅ Works offline
- ✅ **Updates automatically** — no action needed when improvements are made

---

## How future updates work

When you want a new feature, just ask Claude Code (this conversation).
It pushes the changes to GitHub → **your app updates automatically** the next time you open it.

For the rare backend change, you'll get a specific note like:
> "Needs a backend update: in Apps Script, tap Deploy → New deployment → same settings → copy new URL → paste in app Settings ⚙️"

---

## Daily use

| What you want | How |
|---------------|-----|
| Add a transaction | Red **+** button in nav bar |
| Scan a receipt | Quick Add → tap camera zone → photo → Gemini reads it → save |
| See this month | **Pit Lane** tab |
| Plan your future | **Grand Prix** tab (retirement, debt, salary) |
| Check net worth | **Garage** tab (FGTS + car + savings − debt) |
| Change salary/FGTS | ⚙️ Settings top-right |

---

## Troubleshooting

**"Apps Script URL not configured"** → Settings ⚙️ → paste your Web App URL

**"Gemini error"** → Settings ⚙️ → check your API key

**App not updating** → Pull down to refresh, or close + reopen from home screen

**Lost your Web App URL** → Apps Script → Deploy → Manage deployments → copy URL

---

## Your data

Everything lives in **your** Google Sheet — you own it 100%.

Connect to **Looker Studio** anytime:
1. `lookerstudio.google.com` → New Report → Google Sheets
2. Select "Matt Money — Financial Data" → "Transactions" tab
3. Build dashboards

---

*R$ 0/month extra · Your data · Auto-updates · 🇧🇷🏎️*
