/* ============================================================
   LOCAL STORAGE LAYER — Config, cache, offline queue
   ============================================================ */

const Store = (() => {
  const PREFIX = 'mm_';

  const raw = {
    get(key, fallback = null) {
      try { const v = localStorage.getItem(PREFIX + key); return v !== null ? JSON.parse(v) : fallback; }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); }
      catch (e) { console.warn('LocalStorage write failed:', e); }
    },
    del(key) { localStorage.removeItem(PREFIX + key); },
    clear() {
      Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
    }
  };

  // ── Config (persisted user settings) ──────────────────────
  const config = {
    get()  { return raw.get('config', {}); },
    set(updates) { raw.set('config', { ...config.get(), ...updates }); },
    val(key, fallback = null) { return config.get()[key] ?? fallback; },
    isSetup() {
      const c = config.get();
      return !!(c.scriptUrl && c.geminiKey);
    }
  };

  // ── Data cache (transactions, categories etc) ──────────────
  const cache = {
    get(key) { return raw.get(`cache_${key}`, null); },
    set(key, data) { raw.set(`cache_${key}`, { data, ts: Date.now() }); },
    fresh(key, maxAgeMs = 60_000) {
      const c = raw.get(`cache_${key}`, null);
      return c && (Date.now() - c.ts < maxAgeMs) ? c.data : null;
    },
    invalidate(key) { raw.del(`cache_${key}`); },
    invalidateAll() {
      Object.keys(localStorage)
        .filter(k => k.startsWith(PREFIX + 'cache_'))
        .forEach(k => localStorage.removeItem(k));
    }
  };

  // ── Offline queue (pending writes when offline) ────────────
  const queue = {
    get() { return raw.get('offline_queue', []); },
    add(item) {
      const q = queue.get();
      q.push({ ...item, queuedAt: Date.now(), id: crypto.randomUUID() });
      raw.set('offline_queue', q);
    },
    remove(id) {
      raw.set('offline_queue', queue.get().filter(i => i.id !== id));
    },
    clear() { raw.del('offline_queue'); },
    count() { return queue.get().length; }
  };

  // ── Profile defaults (onboarding data) ────────────────────
  const profile = {
    get() {
      return raw.get('profile', {
        name: 'Matthew',
        salary: 7500,
        fgts: 68000,
        carValue: 50000,
        debtTotal: 14000,
        savingsGoal: 500000,
        targetYears: 15
      });
    },
    set(updates) { raw.set('profile', { ...profile.get(), ...updates }); }
  };

  // ── View state (active month, filters etc) ─────────────────
  const ui = {
    get() { return raw.get('ui', { activeMonth: Fmt.currentMonthKey(), activeView: 'dashboard' }); },
    set(updates) { raw.set('ui', { ...ui.get(), ...updates }); },
    val(key, fallback = null) { return ui.get()[key] ?? fallback; }
  };

  return { raw, config, cache, queue, profile, ui };
})();
