/* ============================================================================
 * shell.js — layout, navigation, icons, helpers
 * Angelo Andrei P. Sierra
 *
 * Draws the sidebar, top bar and status strip, then hands control to the page.
 *
 * This is a UI shell for early research and development. Screens show their
 * real structure and controls; the logic behind them belongs to modules that
 * have not been written yet, and each of those areas names its owner on screen
 * rather than pretending to work.
 * ========================================================================== */
(function (App) {
  'use strict';

  var root = /\/pages\//.test(location.pathname) ? '../' : '';
  App.path = function (p) { return root + p; };

  /* --- helpers ------------------------------------------------------------ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(sel, r) { return (r || document).querySelector(sel); }
  function els(sel, r) { return Array.prototype.slice.call((r || document).querySelectorAll(sel)); }
  function peso(n) { return 'Php ' + Number(n || 0).toLocaleString('en-PH'); }
  function initials(name) {
    var p = String(name || '').trim().split(/\s+/).filter(function (w) { return w.length > 1; });
    if (!p.length) return '?';
    return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }

  var MONTHS = ['January','February','March','April','May','June','July',
                'August','September','October','November','December'];
  var DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function iso(d) {
    /* local date, never toISOString(): that converts to UTC first, which in
       Philippine time lands the day before. */
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  }
  function today() { return iso(new Date()); }
  function parseIso(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    return m ? new Date(+m[1], +m[2]-1, +m[3]) : null;
  }
  function addDays(s, n) {
    var d = parseIso(s); if (!d) return '';
    d.setDate(d.getDate() + n); return iso(d);
  }
  function dayNum(s) { var d = parseIso(s); return d ? d.getDate() : ''; }
  function dowShort(s) { var d = parseIso(s); return d ? DOW[d.getDay()] : ''; }
  function shortDate(s) {
    var d = parseIso(s); if (!d) return '—';
    return MONTHS[d.getMonth()].slice(0,3) + ' ' + d.getDate();
  }

  /* --- icons: inline SVG, never emoji ------------------------------------- */
  var ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    bed: '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/>',
    box: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    report: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    account: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.66V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.66"/>',
    menu: '<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>'
  };

  function icon(name, size) {
    if (!ICONS[name]) return '';
    return '<svg class="icon" width="' + (size || 17) + '" height="' + (size || 17) +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  /* --- navigation: the seven modules plus the account screen --------------- */
  var NAV = [
    { group: 'Operations', items: [
      { id:'dashboard',    text:'Dashboard',             icon:'dashboard', href:'index.html' },
      { id:'reservations', text:'Hotel Reservation',     icon:'bed',       href:'pages/reservations.html' },
      { id:'inventory',    text:'Canteen Inventory',     icon:'box',       href:'pages/inventory.html' },
      { id:'calendar',     text:'Scheduling & Calendar', icon:'calendar',  href:'pages/calendar.html' }
    ]},
    { group: 'Administration', items: [
      { id:'users',   text:'User Management', icon:'users',  href:'pages/users.html' },
      { id:'reports', text:'Reports',         icon:'report', href:'pages/reports.html' },
      { id:'audit',   text:'Audit Trail',     icon:'shield', href:'pages/audit.html' }
    ]},
    { group: 'Account', items: [
      { id:'account', text:'My Account', icon:'account', href:'pages/account.html' }
    ]}
  ];

  /* which nav group a screen belongs to, for the bar */
  function sectionOf(navId) {
    for (var i = 0; i < NAV.length; i++) {
      for (var j = 0; j < NAV[i].items.length; j++) {
        if (NAV[i].items[j].id === navId) return NAV[i].group;
      }
    }
    return '';
  }

  /* --- mount --------------------------------------------------------------- *
   * opts.title names the screen for the browser tab and the nav; the visible
   * page name is the <h1> already in the markup.                             */
  function mount(opts) {
    var nav = NAV.map(function (g) {
      return '<div class="nav__label">' + esc(g.group) + '</div>' +
        g.items.map(function (it) {
          return '<a class="nav__link' + (it.id === opts.nav ? ' is-on' : '') + '" href="' +
            App.path(it.href) + '"' + (it.id === opts.nav ? ' aria-current="page"' : '') + '>' +
            icon(it.icon) + '<span>' + esc(it.text) + '</span></a>';
        }).join('');
    }).join('');

    var me = App.Q.me();

    document.body.insertAdjacentHTML('afterbegin',
      '<a class="skip-link" href="#main">Skip to main content</a>' +
      '<aside class="sidebar">' +
        '<div class="brand">' +
          '<span class="brand__seal"><img src="' + App.path('assets/img/bpsu-logo.png') +
            '" alt="Bataan Peninsula State University seal" width="30" height="30"></span>' +
          '<span><span class="brand__name">PATVEP Hostel</span>' +
          '<span class="brand__sub">&amp; University Canteen</span></span>' +
        '</div>' +
        '<nav class="nav" aria-label="Main navigation">' + nav + '</nav>' +
        '<div class="nav__foot">Bataan Peninsula State University<br>Main Campus</div>' +
      '</aside>' +
      '<header class="topbar">' +
        '<button class="navtoggle" id="navToggle" aria-label="Toggle navigation" ' +
          'aria-expanded="false">' + icon('menu', 18) + '</button>' +
        /* The bar names the section, not the page. The page name is the <h1> a
           few pixels below, and printing it in both places said the same word
           twice. The section is the one piece of context the heading does not
           already give you, and on a phone it is the only thing left saying
           which part of the system you are in once the sidebar slides away. */
        '<span class="topbar__section">' + esc(sectionOf(opts.nav)) + '</span>' +
        '<span class="topbar__spacer"></span>' +
        '<a class="who" href="' + App.path('pages/account.html') + '">' +
          '<span class="avatar">' + esc(initials(me.full_name)) + '</span>' +
          '<span><span class="who__name">' + esc(me.full_name) + '</span><br>' +
          '<span class="who__role">' + esc(App.Q.roleLabel(me.role)) + '</span></span>' +
        '</a>' +
      '</header>');

    var main = el('.main');
    if (main) { main.id = 'main'; main.setAttribute('tabindex', '-1'); }

    document.body.insertAdjacentHTML('beforeend',
      '<div class="status">' +
        '<span class="status__dot"></span>' +
        '<span>UI shell · records from the project database</span>' +
        '<span class="status__spacer"></span>' +
        '<span class="status__role">' + esc(App.Q.roleLabel(me.role)) + '</span>' +
      '</div>');

    var tog = el('#navToggle');
    tog.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      tog.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (e) {
      if (document.body.classList.contains('nav-open') &&
          !e.target.closest('.sidebar') && !e.target.closest('#navToggle')) {
        document.body.classList.remove('nav-open');
      }
    });

    fillIcons(document);
  }

  /* markup asks for an icon with data-icon, this fills it in */
  function fillIcons(r) {
    els('[data-icon]', r).forEach(function (n) {
      if (n.dataset.iconDone) return;
      n.insertAdjacentHTML('afterbegin', icon(n.dataset.icon, 15));
      n.dataset.iconDone = '1';
    });
  }

  function meta(parts) {
    var host = el('#pageMeta');
    if (!host) return;
    host.innerHTML = parts.filter(Boolean).map(function (p) {
      return Array.isArray(p) ? esc(p[0]) + ' <strong>' + esc(String(p[1])) + '</strong>'
                              : esc(String(p));
    }).join(' <i>|</i> ');
  }

  /* --- one table renderer ------------------------------------------------- *
   * Four screens were each hand-writing the same <thead>/<tbody> markup, with
   * the column's alignment class typed once in the header and again in every
   * cell. A column is now described once: its heading, its class, and how it
   * renders one record.
   *
   *   S.table([{ head: 'Room', cell: function (r) { return r.room_number; } },
   *             { head: 'Rate', cls: 'table__num', cell: ... }], rows)
   * ----------------------------------------------------------------------- */
  function table(cols, rows, emptyText) {
    if (!rows.length) {
      return '<div class="empty">' + icon('search', 24) +
             esc(emptyText || 'Nothing to show.') + '</div>';
    }
    function attr(c) { return c.cls ? ' class="' + c.cls + '"' : ''; }
    return '<div class="tablewrap"><table class="table"><thead><tr>' +
      cols.map(function (c) { return '<th' + attr(c) + '>' + esc(c.head) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr>' + cols.map(function (c) {
          /* data-label carries the heading down to the cell. On a phone the
             header row is hidden and each cell prints its own label from this,
             so a row becomes a readable card instead of a column the reader has
             to scroll sideways to find. */
          return '<td' + attr(c) + ' data-label="' + esc(c.head) + '">' +
            c.cell(r) + '</td>';
        }).join('') + '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  /* --- the marker for work that belongs to someone else -------------------- *
   * Used wherever a screen has a real place for a feature this developer does
   * not own. It states what goes there and who is building it, so the shell is
   * honest about its own boundaries.                                         */
  function owned(who, what, detail) {
    /* `what` is optional, and should be left out whenever this marker sits
       inside a panel whose heading already names the region. Passing it anyway
       printed the heading twice, one line apart — which reads as a rendering
       fault on a phone, where the panels stack. */
    return '<div class="pending">' +
      (what ? '<div class="pending__title">' + esc(what) + '</div>' : '') +
      '<div class="pending__text">' + esc(detail || '') + '</div>' +
      '<span class="pending__who">To be built by ' + esc(who) + '</span>' +
      '</div>';
  }

  App.Shell = {
    mount: mount, icon: icon, meta: meta, owned: owned, table: table,
    esc: esc, el: el, els: els, peso: peso, initials: initials,
    iso: iso, today: today, parseIso: parseIso, addDays: addDays,
    dayNum: dayNum, dowShort: dowShort, shortDate: shortDate,
    MONTHS: MONTHS, DOW: DOW
  };
})(window.App = window.App || {});
