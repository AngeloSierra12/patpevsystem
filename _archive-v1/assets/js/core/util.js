/* ============================================================================
 * util.js — shared helpers (paths, formatting, dates, DOM)
 * OWNER: Angelo Andrei P. Sierra
 * ========================================================================== */
(function (App) {
  'use strict';

  /* --- Paths --------------------------------------------------------------- *
   * Pages live at the root (index.html) and in /pages/. Links are built
   * through here so the site works from the file system with no server.      */
  var inPagesDir = /\/pages\/[^/]*$/.test(location.pathname);

  App.Paths = {
    root: inPagesDir ? '../' : '',
    to: function (path) { return this.root + path; },
    page: function (name) { return this.root + 'pages/' + name; }
  };

  /* --- Formatting ---------------------------------------------------------- */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var Fmt = {
    /** 12500 -> "Php 12,500" */
    peso: function (n) {
      return 'Php ' + Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 });
    },
    /** 0.7375 -> "74%" */
    pct: function (n, digits) {
      return (Number(n || 0) * 100).toFixed(digits || 0) + '%';
    },
    /** "2026-09-14" -> "September 14, 2026" */
    longDate: function (iso) {
      var d = Dates.parse(iso);
      if (!d) return '—';
      return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    },
    /** "2026-09-14" -> "Sep 14" */
    shortDate: function (iso) {
      var d = Dates.parse(iso);
      if (!d) return '—';
      return MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate();
    },
    /** "2026-09-14" -> "Mon, Sep 14" */
    dayDate: function (iso) {
      var d = Dates.parse(iso);
      if (!d) return '—';
      return DAYS_SHORT[d.getDay()] + ', ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate();
    },
    /** "2026-09-10" -> "2 days ago" / "in 3 days" / "Today" */
    relative: function (iso) {
      var diff = Dates.diffDays(Dates.todayIso(), (iso || '').slice(0, 10));
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Tomorrow';
      if (diff === -1) return 'Yesterday';
      if (diff > 1) return 'in ' + diff + ' days';
      return Math.abs(diff) + ' days ago';
    },
    titleCase: function (s) {
      return String(s || '').replace(/(^|[\s-])([a-z])/g, function (_, p, c) {
        return p + c.toUpperCase();
      });
    },
    initials: function (name) {
      var parts = String(name || '').trim().split(/\s+/).filter(function (w) {
        return w.length > 1 || !/\./.test(w);
      });
      if (!parts.length) return '?';
      var first = parts[0].charAt(0);
      var last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
      return (first + last).toUpperCase();
    }
  };

  /* --- Dates (all internal dates are ISO "YYYY-MM-DD" strings) ------------- */
  var Dates = {
    MONTHS: MONTHS,
    MONTHS_SHORT: MONTHS_SHORT,
    DAYS_SHORT: DAYS_SHORT,

    parse: function (iso) {
      if (!iso) return null;
      var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
      if (!m) return null;
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    },

    toIso: function (d) {
      if (!d) return '';
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    },

    todayIso: function () {
      return this.toIso(new Date());
    },

    addDays: function (iso, n) {
      var d = this.parse(iso);
      if (!d) return '';
      d.setDate(d.getDate() + n);
      return this.toIso(d);
    },

    /** whole days from `a` to `b` (positive when b is later) */
    diffDays: function (a, b) {
      var da = this.parse(a), db = this.parse(b);
      if (!da || !db) return 0;
      return Math.round((db - da) / 86400000);
    },

    /** every ISO date from `start` up to and including `end` */
    range: function (start, end) {
      var out = [], cur = start;
      var guard = 0;
      while (this.diffDays(cur, end) >= 0 && guard++ < 3650) {
        out.push(cur);
        cur = this.addDays(cur, 1);
      }
      return out;
    },

    isWeekend: function (iso) {
      var d = this.parse(iso);
      if (!d) return false;
      return d.getDay() === 0 || d.getDay() === 6;
    }
  };

  /* --- DOM ----------------------------------------------------------------- */
  var Dom = {
    /** escape untrusted text before it goes into innerHTML */
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    qs: function (sel, root) { return (root || document).querySelector(sel); },
    qsa: function (sel, root) {
      return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    },
    on: function (root, evt, sel, handler) {
      root.addEventListener(evt, function (e) {
        var target = e.target.closest(sel);
        if (target && root.contains(target)) handler(e, target);
      });
    },
    /** build an element from an HTML string */
    fromHtml: function (html) {
      var t = document.createElement('template');
      t.innerHTML = html.trim();
      return t.content.firstElementChild;
    }
  };

  App.Fmt = Fmt;
  App.Dates = Dates;
  App.Dom = Dom;
})(window.App = window.App || {});
