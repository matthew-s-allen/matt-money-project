#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code on the web sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "=== Matt Money — Session Start ==="
echo "Pure vanilla JS project: no build tools, no npm, no dependencies."
echo ""
echo "Key files:"
echo "  src/index.html          — App shell + modals"
echo "  src/js/app.js           — Core app logic, navigation, transaction detail"
echo "  src/js/api.js           — Google Apps Script API + Gemini receipt scanning"
echo "  src/js/views/           — Per-screen view modules"
echo "  src/css/style.css       — All styles (CSS custom properties)"
echo "  apps-script/MattMoney.gs — Google Apps Script backend"
echo ""
echo "See CLAUDE.md for full architecture details."
echo "Deploy: push to branch → GitHub Pages serves src/ automatically"
echo "==================================="
