/* ============================================================================
 * shell.js — App shell: sidebar, topbar, role switcher, modal, toast
 * OWNER: Angelo Andrei P. Sierra
 *
 * Every page calls App.Shell.mount({...}) once. The shell renders the chrome,
 * gates the navigation against the signed-in user's permissions (WBS 2.3),
 * and then hands control back to the page module.
 * ========================================================================== */
(function (App) {
  'use strict';

  var esc = App.Dom.esc;

  /* --- Navigation model ---------------------------------------------------- *
   * `perm`  : permission required to even see the link (WBS 2.3)
   * `mine`  : built by this developer, per the WBS assignment
   * `stub`  : another developer's module; link goes to an honest placeholder */
  var NAV = [
    { label: 'Operations', items: [
      { id: 'dashboard', icon: 'dashboard', text: 'Dashboard',
        href: 'index.html', wbs: '7.0', perm: 'dashboard.view', mine: true },
      { id: 'calendar', icon: 'calendar', text: 'Scheduling & Calendar',
        href: 'pages/calendar.html', wbs: '5.0', perm: 'calendar.view', mine: true },
      { id: 'users', icon: 'users', text: 'User Management',
        href: 'pages/users.html', wbs: '2.0', perm: 'users.view', mine: true },
      { id: 'wireframes', icon: 'wireframe', text: 'UI Wireframes',
        href: 'pages/wireframes.html', wbs: '2.1/5.1/7.1', perm: 'dashboard.view', mine: true }
    ]},
    { label: 'Not available', items: [
      { id: 'reservations', icon: 'bed', text: 'Hotel Reservation',
        href: 'pages/module-reservations.html', wbs: '4.0',
        perm: 'reservations.view.own', stub: true },
      { id: 'inventory', icon: 'package', text: 'Inventory',
        href: 'pages/module-inventory.html', wbs: '3.0',
        perm: 'inventory.view', stub: true },
      { id: 'reports', icon: 'report', text: 'Report Generation',
        href: 'pages/module-reports.html', wbs: '8.0',
        perm: 'reports.view', stub: true },
      { id: 'audit', icon: 'shield', text: 'Audit Trail & Logs',
        href: 'pages/module-audit.html', wbs: '6.0',
        perm: 'audit.view', stub: true }
    ]},
    { label: 'Account', items: [
      { id: 'account', icon: 'account', text: 'My Account',
        href: 'pages/account.html', wbs: '2.4', perm: 'account.self.edit', mine: true }
    ]}
  ];

  /* --- Sidebar ------------------------------------------------------------- */
  function renderSidebar(activeId, user) {
    var P = App.Paths;
    var groups = NAV.map(function (group) {
      var links = group.items.filter(function (item) {
        return App.RBAC.can(user, item.perm);
      }).map(function (item) {
        var cls = ['nav-link'];
        if (item.id === activeId) cls.push('is-active');
        if (item.stub) cls.push('is-stub');
        return '' +
          '<a class="' + cls.join(' ') + '" href="' + P.to(item.href) + '"' +
             (item.id === activeId ? ' aria-current="page"' : '') + '>' +
            App.Icons.get(item.icon, { size: 17 }) +
            '<span class="nav-link__text">' + esc(item.text) + '</span>' +
          '</a>';
      }).join('');

      if (!links) return '';
      return '<div class="nav-group">' +
               '<div class="nav-group__label">' + esc(group.label) + '</div>' +
               links +
             '</div>';
    }).join('');

    return '' +
      '<aside class="sidebar">' +
        '<div class="sidebar__brand">' +
          '<div class="sidebar__logo">' +
            '<img src="' + App.Paths.to('assets/img/bpsu-logo.png') + '" ' +
              'alt="Bataan Peninsula State University seal" width="30" height="30">' +
          '</div>' +
          '<div>' +
            '<div class="sidebar__title">PATVEP Hostel</div>' +
            '<div class="sidebar__sub">& University Canteen</div>' +
          '</div>' +
        '</div>' +
        '<nav class="sidebar__nav" aria-label="Main navigation">' + groups + '</nav>' +
        '<div class="sidebar__foot">' +
          'Bataan Peninsula State University<br>' +
          'Frontend build by A. Sierra &middot; BSIT-NW3A' +
        '</div>' +
      '</aside>';
  }

  /* --- Topbar -------------------------------------------------------------- */
  function renderTopbar(opts, user) {
    var roleOptions = App.RBAC.ROLE_ORDER.map(function (r) {
      return '<option value="' + r + '"' + (user.role === r ? ' selected' : '') + '>' +
             esc(App.RBAC.ROLES[r].label) + '</option>';
    }).join('');

    return '' +
      '<header class="topbar">' +
        '<button class="icon-btn nav-toggle" id="navToggle" ' +
                'aria-label="Toggle navigation" aria-expanded="false">' +
          App.Icons.get('menu', { size: 20 }) + '</button>' +
        '<div class="topbar__heading">' +
          '<div class="topbar__title">' + esc(opts.title) + '</div>' +
          '<div class="topbar__crumb">' + esc(opts.crumb || '') + '</div>' +
        '</div>' +
        '<div class="topbar__spacer"></div>' +
        '<div class="rolepicker">' +
          '<label class="rolepicker__label" for="rolePicker">Signed in as</label>' +
          '<select class="select select--sm" id="rolePicker" title="Sign-in is not ' +
            'implemented in this build. This control switches the active account so ' +
            'the access rules can be checked from each role.">' + roleOptions + '</select>' +
        '</div>' +
        '<a class="userchip" href="' + App.Paths.page('account.html') + '">' +
          '<span class="avatar avatar--sm avatar--' + esc(user.role) + '">' +
            esc(App.Fmt.initials(user.fullName)) + '</span>' +
          '<span>' +
            '<span class="userchip__name">' + esc(user.fullName) + '</span><br>' +
            '<span class="userchip__role">' + esc(App.RBAC.roleLabel(user.role)) + '</span>' +
          '</span>' +
        '</a>' +
      '</header>';
  }

  /* --- Status bar ---------------------------------------------------------- *
   * The strip along the bottom that operational software always has: what the
   * data covers, when it was read, and how to get around. It is what makes a
   * screen feel like a tool rather than a page.                              */
  function renderStatusBar(opts, user) {
    var now = new Date();
    var clock = String(now.getHours()).padStart(2, '0') + ':' +
                String(now.getMinutes()).padStart(2, '0');

    return '' +
      '<div class="statusbar">' +
        '<span class="statusbar__item">' +
          '<span class="statusbar__dot"></span>' +
          'Local data' +
        '</span>' +
        '<span class="statusbar__sep">|</span>' +
        '<span class="statusbar__item">Read <span class="mono">' + clock + '</span></span>' +
        '<span class="statusbar__spacer"></span>' +
        '<span class="statusbar__item mono">' + esc(user.id) + '</span>' +
      '</div>';
  }

  /* --- Mount --------------------------------------------------------------- */
  function mount(opts) {
    var user = App.Session.current();

    document.body.insertAdjacentHTML('afterbegin',
      '<a class="skip-link" href="#mainContent">Skip to main content</a>' +
      renderSidebar(opts.nav, user) + renderTopbar(opts, user));

    var main = document.querySelector('.main');
    if (main && !main.id) {
      main.id = 'mainContent';
      main.setAttribute('tabindex', '-1');
    }

    document.body.insertAdjacentHTML('beforeend', renderStatusBar(opts, user));

    if (!document.querySelector('.toast-host')) {
      document.body.insertAdjacentHTML('beforeend',
        '<div class="toast-host" id="toastHost" role="status" aria-live="polite"></div>');
    }

    /* role switcher — stands in for WBS 2.2 login */
    var picker = document.getElementById('rolePicker');
    if (picker) {
      picker.addEventListener('change', function () {
        if (App.Session.switchToRole(picker.value)) location.reload();
      });
    }

    var toggle = document.getElementById('navToggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var open = document.body.classList.toggle('nav-open');
        toggle.setAttribute('aria-expanded', String(open));
      });
    }
    document.addEventListener('click', function (e) {
      if (document.body.classList.contains('nav-open') &&
          !e.target.closest('.sidebar') && !e.target.closest('#navToggle')) {
        document.body.classList.remove('nav-open');
      }
    });

    /* page-level access check (WBS 2.3) */
    if (opts.requires && !App.RBAC.guard(user, opts.requires, opts.title)) {
      return null;
    }

    /* element-level access check (WBS 2.3) */
    App.RBAC.applyTo(document, user);

    hydrateIcons(document);

    return user;
  }

  /* --- Page meta line ------------------------------------------------------- *
   * Replaces the explanatory paragraph that used to sit under each heading.
   * Working software states its figures; it does not describe itself in prose.
   *
   *   setMeta([ ['Rooms', '22'], ['Occupied today', '9'], 'Updated 08:42' ])
   * A pair renders as "label value"; a bare string renders as-is.           */
  function setMeta(parts) {
    var host = document.getElementById('pageMeta');
    if (!host) return;
    host.innerHTML = parts.filter(Boolean).map(function (p) {
      return Array.isArray(p)
        ? esc(p[0]) + ' <strong>' + esc(String(p[1])) + '</strong>'
        : '<span class="mono">' + esc(String(p)) + '</span>';
    }).join(' <span class="page-meta__sep">|</span> ');
  }

  /* --- Declarative icons ---------------------------------------------------- *
   * Markup asks for an icon and this fills it in, so pages stay free of inline
   * SVG:
   *   <button data-icon="refresh">Refresh</button>   -> icon prepended
   *   <span data-icon-slot="search"></span>          -> icon inserted          */
  function hydrateIcons(root) {
    App.Dom.qsa('[data-icon]', root).forEach(function (el) {
      if (el.dataset.iconDone) return;
      el.insertAdjacentHTML('afterbegin', App.Icons.get(el.dataset.icon, { size: 15 }));
      el.dataset.iconDone = '1';
    });
    App.Dom.qsa('[data-icon-slot]', root).forEach(function (el) {
      if (el.dataset.iconDone) return;
      el.innerHTML = App.Icons.get(el.dataset.iconSlot, { size: 14 });
      el.dataset.iconDone = '1';
    });
  }

  /* --- Toast --------------------------------------------------------------- */
  var TOAST_ICONS = { ok: 'checkCircle', danger: 'xCircle', warn: 'alert', info: 'info' };

  function toast(message, kind) {
    kind = kind || 'info';
    var host = document.getElementById('toastHost');
    if (!host) return;
    var el = App.Dom.fromHtml(
      '<div class="toast toast--' + kind + '">' +
        '<span class="toast__icon">' +
          App.Icons.get(TOAST_ICONS[kind] || 'info', { size: 16 }) + '</span>' +
        '<span>' + esc(message) + '</span>' +
      '</div>');
    host.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .2s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 220);
    }, 3200);
  }

  /* --- Modal --------------------------------------------------------------- *
   * openModal({ title, sub, body, footer, wide, onMount })
   *   body / footer are HTML strings. Returns a handle with .close().        */
  function openModal(cfg) {
    var backdrop = App.Dom.fromHtml(
      '<div class="modal-backdrop">' +
        '<div class="modal' + (cfg.wide ? ' modal--wide' : '') + '" role="dialog" ' +
             'aria-modal="true" aria-label="' + esc(cfg.title) + '">' +
          '<div class="modal__head">' +
            '<div>' +
              '<div class="modal__title">' + esc(cfg.title) + '</div>' +
              (cfg.sub ? '<div class="modal__sub">' + esc(cfg.sub) + '</div>' : '') +
            '</div>' +
            '<button class="modal__close" aria-label="Close">' +
              App.Icons.get('close', { size: 18 }) + '</button>' +
          '</div>' +
          '<div class="modal__body"></div>' +
          (cfg.footer ? '<div class="modal__foot' +
            (cfg.footerSplit ? ' modal__foot--split' : '') + '"></div>' : '') +
        '</div>' +
      '</div>');

    backdrop.querySelector('.modal__body').innerHTML = cfg.body || '';
    if (cfg.footer) backdrop.querySelector('.modal__foot').innerHTML = cfg.footer;

    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';

    function close() {
      backdrop.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    backdrop.querySelector('.modal__close').addEventListener('click', close);
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) close();
    });
    document.addEventListener('keydown', onKey);

    var handle = { el: backdrop, close: close };
    if (cfg.onMount) cfg.onMount(backdrop, handle);

    var first = backdrop.querySelector('input, select, textarea, button');
    if (first) first.focus();

    return handle;
  }

  /** Confirmation dialog. `onConfirm` runs when the user accepts. */
  function confirmDialog(cfg) {
    return openModal({
      title: cfg.title,
      sub: cfg.sub,
      body: '<p style="font-size:13.5px;line-height:1.6;color:var(--ink-500)">' +
            (cfg.html || esc(cfg.message || '')) + '</p>',
      footer:
        '<button class="btn" data-act="cancel">Cancel</button>' +
        '<button class="btn btn--' + (cfg.danger ? 'danger' : 'primary') + '" ' +
                'data-act="ok">' + esc(cfg.confirmLabel || 'Confirm') + '</button>',
      onMount: function (root, handle) {
        root.querySelector('[data-act="cancel"]').addEventListener('click', handle.close);
        root.querySelector('[data-act="ok"]').addEventListener('click', function () {
          handle.close();
          if (cfg.onConfirm) cfg.onConfirm();
        });
      }
    });
  }

  App.Shell = {
    NAV: NAV,
    mount: mount,
    hydrateIcons: hydrateIcons,
    setMeta: setMeta,
    toast: toast,
    openModal: openModal,
    confirm: confirmDialog
  };
})(window.App = window.App || {});
