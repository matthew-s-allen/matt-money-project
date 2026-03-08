/* ============================================================
   FORMATTER UTILITIES — BRL currency, dates, numbers
   ============================================================ */

const Fmt = (() => {
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
  const BRL_COMPACT = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const PCT = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const NUM = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const MONTHS_FULL_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  return {
    /** Format as R$ currency */
    currency(n) {
      return BRL.format(Number(n) || 0);
    },

    /** Compact: R$ 1.4k, R$ 68k, R$ 1.5M */
    compact(n) {
      n = Number(n) || 0;
      if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
      if (Math.abs(n) >= 1_000)     return `R$ ${(n / 1_000).toFixed(1)}k`;
      return BRL.format(n);
    },

    /** Raw number with thousand separators */
    number(n) { return NUM.format(Number(n) || 0); },

    /** Percentage */
    percent(n) { return PCT.format((Number(n) || 0) / 100); },

    /** Percentage already in 0-1 range */
    percentDirect(n) { return PCT.format(Number(n) || 0); },

    /** Month name short PT */
    monthShort(date) {
      const d = date instanceof Date ? date : new Date(date);
      return MONTHS_PT[d.getMonth()];
    },

    /** Month + Year: "Mar 2026" */
    monthYear(date) {
      const d = date instanceof Date ? date : new Date(date + 'T12:00:00');
      return `${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`;
    },

    /** Full month + year PT: "Março 2026" */
    monthYearFull(date) {
      const d = date instanceof Date ? date : new Date(date + 'T12:00:00');
      return `${MONTHS_FULL_PT[d.getMonth()]} ${d.getFullYear()}`;
    },

    /** Date: "08 Mar" */
    dayMonth(date) {
      const d = date instanceof Date ? date : new Date(date + 'T12:00:00');
      return `${String(d.getDate()).padStart(2,'0')} ${MONTHS_PT[d.getMonth()]}`;
    },

    /** Date: "08/03/2026" */
    dateShort(date) {
      const d = date instanceof Date ? date : new Date(date + 'T12:00:00');
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    },

    /** "today", "yesterday", or "08 Mar" */
    relativeDate(date) {
      const d = date instanceof Date ? date : new Date(date + 'T12:00:00');
      const today = new Date(); today.setHours(12,0,0,0);
      const diff = Math.round((today - d) / 86400000);
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Yesterday';
      return Fmt.dayMonth(d);
    },

    /** Delta indicator: "+R$200" or "-R$50" */
    delta(n) {
      n = Number(n) || 0;
      return (n >= 0 ? '+' : '') + BRL.format(n);
    },

    /** ISO date string "YYYY-MM-DD" from a Date */
    toISODate(date) {
      const d = date instanceof Date ? date : new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    },

    /** Parse "YYYY-MM-DD" safely */
    parseDate(str) {
      if (!str) return new Date();
      return new Date(str + 'T12:00:00');
    },

    /** Years/months until a future date */
    timeUntil(targetDate) {
      const now = new Date();
      const diff = new Date(targetDate) - now;
      const months = Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24 * 30.44)));
      if (months >= 24) return `${Math.floor(months/12)} years ${months % 12} mo`;
      if (months >= 12) return `${Math.floor(months/12)} year ${months % 12} mo`;
      return `${months} months`;
    },

    /** Current month key "2026-03" */
    currentMonthKey() {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
    },

    /** YYYY-MM from Date object */
    monthKey(date) {
      const d = date instanceof Date ? date : new Date(date + 'T12:00:00');
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    }
  };
})();
