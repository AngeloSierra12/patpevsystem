/* ============================================================================
 * dashboard.js — Operations Dashboard
 * ----------------------------------------------------------------------------
 * WBS 7.0  |  7.2 Metrics integration  |  7.3 Quick actions panel
 * OWNER: Angelo Andrei P. Sierra
 *
 * The dashboard reads hostel figures through App.Scheduling and canteen figures
 * through App.Store.inventory. It owns neither data set — it only presents
 * them — so when the Reservation (4.0) and Inventory (3.0) modules go live
 * against the real database, this page keeps working unchanged.
 * ========================================================================== */
(function (App) {
  'use strict';

  var esc = App.Dom.esc;
  var D = App.Dates;
  var Fmt = App.Fmt;
  var user;

  document.addEventListener('DOMContentLoaded', function () {
    user = App.Shell.mount({
      title: 'Operations Dashboard',
      crumb: 'IGP PATVEP Hostel & University Canteen',
      nav: 'dashboard',
      requires: 'dashboard.view'
    });
    if (!user) return;              // guard replaced the page
    render();

    document.getElementById('btnRefresh').addEventListener('click', function () {
      render();
      App.Shell.toast('Dashboard refreshed.', 'ok');
    });
  });

  function render() {
    var today = D.todayIso();
    /* Guests get a cut-down view — see WBS 2.3 permission catalogue. */
    var full = App.RBAC.can(user, 'dashboard.metrics.all');

    renderStats(today, full);
    renderOccupancyChart(today);
    renderRoomDonut(today);
    renderStock(full);
    renderLowStock(full);
    renderQuickActions();
    renderMovement(today, full);
    renderUpcoming(full);

    document.getElementById('todayDate').textContent = Fmt.longDate(today);

    var occ = App.Scheduling.occupancy(today);
    App.Shell.setMeta([
      Fmt.longDate(today),
      ['Occupied', occ.occupied + ' of ' + occ.total],
      ['Free', occ.available]
    ]);

    App.RBAC.applyTo(document, user);
  }

  /* --- 7.2 metric tiles ---------------------------------------------------- */
  function renderStats(today, full) {
    var occ = App.Scheduling.occupancy(today);
    var arrivals = App.Scheduling.arrivals(today);
    var departures = App.Scheduling.departures(today);
    var low = App.Store.inventory.lowStock();
    var pending = App.Store.reservations.list().filter(function (r) {
      return r.status === 'pending';
    });
    var mine = App.Store.reservations.byGuest(user.id);

    var tiles;

    if (full) {
      tiles = [
        { label: 'Occupancy today', value: Fmt.pct(occ.rate),
          meta: occ.occupied + ' of ' + occ.total + ' rooms held',
          bar: occ.rate, kind: occ.rate > 0.85 ? 'warn' : '' },
        { label: 'Rooms available', value: occ.available,
          unit: '/ ' + occ.total,
          meta: occ.blocked ? occ.blocked + ' blocked for maintenance' : 'No rooms blocked',
          kind: occ.available <= 2 ? 'danger' : 'info' },
        { label: 'Arrivals today', value: arrivals.length,
          meta: departures.length + ' departure' + (departures.length === 1 ? '' : 's') +
                ' · ' + pending.length + ' awaiting confirmation',
          kind: pending.length ? 'warn' : 'info' },
        { label: 'Low stock items', value: low.length,
          meta: Fmt.peso(App.Store.inventory.totalValue()) + ' stock value',
          kind: low.length ? 'danger' : '' }
      ];
    } else {
      /* Guest view */
      var upcomingMine = mine.filter(function (r) {
        return D.diffDays(today, r.checkIn) >= 0 && r.status !== 'cancelled';
      });
      tiles = [
        { label: 'My bookings', value: mine.length, meta: 'Across all dates', kind: 'info' },
        { label: 'Upcoming stays', value: upcomingMine.length,
          meta: upcomingMine.length ? 'Next: ' + Fmt.longDate(upcomingMine[0].checkIn) : 'None booked',
          kind: '' },
        { label: 'Rooms available today', value: occ.available, unit: '/ ' + occ.total,
          meta: 'Check the calendar for other dates', kind: '' }
      ];
    }

    /* One ruled strip, not a row of floating cards — the metrics belong
       together, so they read as one instrument panel. */
    var host = document.getElementById('statRow');
    host.className = 'metricbar';
    host.innerHTML = tiles.map(function (t) {
      return '' +
        '<div class="metric' + (t.kind ? ' metric--' + t.kind : '') + '">' +
          '<div class="metric__label">' + esc(t.label) + '</div>' +
          '<div class="metric__value">' + esc(String(t.value)) +
            (t.unit ? ' <span class="metric__unit">' + esc(t.unit) + '</span>' : '') +
          '</div>' +
          '<div class="metric__meta">' + esc(t.meta) + '</div>' +
          (t.bar != null
            ? '<div class="metric__bar"><i style="width:' +
              (t.bar * 100).toFixed(1) + '%"></i></div>'
            : '') +
        '</div>';
    }).join('');
  }

  /* --- 7-day occupancy ----------------------------------------------------- */
  function renderOccupancyChart(today) {
    var series = App.Scheduling.occupancySeries(today, 7);
    var total = series[0] ? series[0].total : 0;

    var data = series.map(function (o, i) {
      return {
        label: D.DAYS_SHORT[D.parse(o.date).getDay()],
        sublabel: Fmt.shortDate(o.date),
        value: o.occupied,
        highlight: i === 0
      };
    });

    var avg = series.reduce(function (s, o) { return s + o.rate; }, 0) / (series.length || 1);
    var peak = series.reduce(function (m, o) { return o.rate > m.rate ? o : m; }, series[0]);

    document.getElementById('occChart').innerHTML =
      App.Charts.bars(data, { max: total, height: 200, ariaLabel: '7-day room occupancy' }) +
      '<div class="mt-2 text-sm text-muted">Average ' + Fmt.pct(avg) +
      ', busiest ' + Fmt.dayDate(peak.date) + '</div>';
  }

  /* --- room status donut --------------------------------------------------- */
  function renderRoomDonut(today) {
    var occ = App.Scheduling.occupancy(today);
    var data = [
      { label: 'Occupied', value: occ.occupied, color: '#ae0404' },
      { label: 'Available', value: occ.available, color: '#e4dcdd' },
      { label: 'Blocked', value: occ.blocked, color: '#4a4244' }
    ].filter(function (d) { return d.value > 0; });

    document.getElementById('roomDonut').innerHTML =
      '<div class="donut-wrap">' +
        App.Charts.donut(data, { size: 160, thickness: 22, ariaLabel: 'Room status today' }) +
        '<div class="donut-center">' +
          '<div class="donut-center__value">' + Fmt.pct(occ.rate) + '</div>' +
          '<div class="donut-center__label">Occupied</div>' +
        '</div>' +
      '</div>' +
      App.Charts.legend(data.map(function (d) {
        return { label: d.label, value: d.value, color: d.color };
      }));
  }

  /* --- canteen stock ------------------------------------------------------- */
  function renderStock(full) {
    var host = document.getElementById('stockChart');
    if (!full) {
      host.innerHTML = lockedPanel('inventory.view',
        'Canteen stock figures are limited to hostel and canteen staff.');
      return;
    }

    var items = App.Store.inventory.list().sort(function (a, b) {
      return (a.stock / (a.reorder || 1)) - (b.stock / (b.reorder || 1));
    }).slice(0, 6);

    var data = items.map(function (i) {
      var ceiling = Math.max(i.reorder * 2, i.stock, 1);
      var kind = i.stock <= 0 ? 'danger' : (i.stock <= i.reorder ? 'warn' : 'ok');
      return {
        label: i.name,
        value: i.stock,
        max: ceiling,
        kind: kind,
        valueText: i.stock + ' ' + i.unit + ' · min ' + i.reorder
      };
    });

    host.innerHTML = App.Charts.hbars(data) +
      '<div class="text-sm text-muted mt-1">6 of ' +
      App.Store.inventory.list().length + ' items, lowest first</div>';
  }

  function renderLowStock(full) {
    var host = document.getElementById('lowStock');
    var badge = document.getElementById('lowCount');

    if (!full) {
      badge.hidden = true;
      host.innerHTML = '<div style="padding:18px">' +
        lockedPanel('inventory.view', 'Stock alerts are staff-only.') + '</div>';
      return;
    }

    var low = App.Store.inventory.lowStock().sort(function (a, b) {
      return a.stock - b.stock;
    });
    badge.hidden = false;
    badge.textContent = low.length;

    if (!low.length) {
      host.innerHTML = emptyState('checkCircle', 'All stock healthy',
        'No canteen item has fallen to its reorder point.');
      return;
    }

    host.innerHTML = low.map(function (i) {
      var out = i.stock <= 0;
      return '' +
        '<div class="alert-row">' +
          '<span class="alert-row__dot" style="background:' +
            (out ? 'var(--danger-600)' : 'var(--accent-600)') + '"></span>' +
          '<div class="alert-row__body">' +
            '<div class="alert-row__title">' + esc(i.name) + '</div>' +
            '<div class="alert-row__meta">' + esc(i.category) + ' &middot; reorder at ' +
              i.reorder + ' ' + esc(i.unit) + ' &middot; ' + esc(i.supplier) + '</div>' +
          '</div>' +
          '<div class="alert-row__value" style="color:' +
            (out ? 'var(--danger-700)' : 'var(--accent-700)') + '">' +
            i.stock + '</div>' +
        '</div>';
    }).join('');
  }

  /* --- 7.3 quick actions --------------------------------------------------- *
   * Each action declares the permission it needs. Actions belonging to modules
   * another developer owns are shown as pending rather than hidden, so the
   * panel reflects the real state of the project.                            */
  function renderQuickActions() {
    var P = App.Paths;
    var actions = [
      { label: 'Add schedule entry', desc: 'Calendar module', icon: 'plus',
        perm: 'calendar.create', href: P.page('calendar.html') + '?action=new', kind: '' },
      { label: 'Open calendar', desc: 'Month & timeline view', icon: 'calendar',
        perm: 'calendar.view', href: P.page('calendar.html'), kind: 'info' },
      { label: 'Add user account', desc: 'User management', icon: 'users',
        perm: 'users.create', href: P.page('users.html') + '?action=new', kind: 'accent' },
      { label: 'Manage users', desc: 'Roles & permissions', icon: 'settings',
        perm: 'users.view', href: P.page('users.html'), kind: '' },
      { label: 'New reservation', desc: 'Not available', icon: 'bed',
        perm: 'reservations.manage', href: P.page('module-reservations.html'),
        kind: 'muted', pending: true },
      { label: 'Record stock', desc: 'Not available', icon: 'package',
        perm: 'inventory.manage', href: P.page('module-inventory.html'),
        kind: 'muted', pending: true },
      { label: 'Generate report', desc: 'Not available', icon: 'report',
        perm: 'reports.view', href: P.page('module-reports.html'),
        kind: 'muted', pending: true },
      { label: 'My account', desc: 'Profile & permissions', icon: 'account',
        perm: 'account.self.edit', href: P.page('account.html'), kind: 'info' }
    ].filter(function (a) { return App.RBAC.can(user, a.perm); });

    var host = document.getElementById('quickActions');

    if (!actions.length) {
      host.innerHTML = emptyState('lock', 'No actions available',
        'Your role does not currently permit any quick action.');
      return;
    }

    host.innerHTML = '<div class="qa-grid">' + actions.map(function (a) {
      return '' +
        '<a class="qa' + (a.kind ? ' qa--' + a.kind : '') +
            (a.pending ? ' qa--pending' : '') + '" href="' + a.href + '">' +
          '<span class="qa__icon">' + App.Icons.get(a.icon, { size: 17 }) + '</span>' +
          '<span class="qa__label">' + esc(a.label) + '</span>' +
        '</a>';
    }).join('') + '</div>' +
    '';
  }

  /* --- arrivals / departures ---------------------------------------------- */
  function renderMovement(today, full) {
    var host = document.getElementById('movement');
    var arrivals = App.Scheduling.arrivals(today);
    var departures = App.Scheduling.departures(today);

    if (!full) {
      arrivals = arrivals.filter(function (r) { return r.guestId === user.id; });
      departures = departures.filter(function (r) { return r.guestId === user.id; });
    }

    var rows = arrivals.map(function (r) { return row(r, 'in'); })
      .concat(departures.map(function (r) { return row(r, 'out'); }));

    if (!rows.length) {
      host.innerHTML = emptyState('inbox', 'Nothing scheduled today',
        full ? 'No guest is due to arrive or leave today.'
             : 'You have no arrival or departure today.');
      return;
    }
    host.innerHTML = rows.join('');

    function row(r, dir) {
      var isIn = dir === 'in';
      return '' +
        '<div class="alert-row">' +
          '<span class="badge badge--' + (isIn ? 'ok' : 'info') + '">' +
            (isIn ? 'Check-in' : 'Check-out') + '</span>' +
          '<div class="alert-row__body">' +
            '<div class="alert-row__title">' + esc(r.guestName) + '</div>' +
            '<div class="alert-row__meta">Room ' + esc(App.Store.rooms.codeOf(r.roomId)) +
              ' &middot; ' + esc(r.id) + ' &middot; ' + esc(Fmt.titleCase(r.status)) +
              ' &middot; ' + r.pax + ' pax</div>' +
          '</div>' +
          '<div class="alert-row__value">' + Fmt.peso(r.total) + '</div>' +
        '</div>';
    }
  }

  /* --- upcoming schedule --------------------------------------------------- */
  function renderUpcoming(full) {
    var today = D.todayIso();
    var host = document.getElementById('upcoming');

    var events = App.Store.events.list().filter(function (e) {
      return D.diffDays(today, e.end || e.start) >= 0;
    });

    var reservations = App.Store.reservations.list().filter(function (r) {
      if (r.status === 'cancelled') return false;
      if (D.diffDays(today, r.checkIn) < 0) return false;
      return full || r.guestId === user.id;
    }).map(function (r) {
      return { title: r.guestName + ' arriving', type: 'reservation',
               start: r.checkIn, end: r.checkOut, roomId: r.roomId, notes: r.notes };
    });

    var all = (full ? events : []).concat(reservations).sort(function (a, b) {
      return D.diffDays(b.start, a.start) * -1;
    }).slice(0, 7);

    if (!all.length) {
      host.innerHTML = emptyState('calendar', 'Nothing upcoming',
        'No scheduled entries from today onward.');
      return;
    }

    var COLORS = {
      maintenance: 'var(--danger-600)', delivery: 'var(--accent-600)',
      inventory: 'var(--data-3)', reservation: 'var(--primary-600)', other: 'var(--ink-400)'
    };

    host.innerHTML = all.map(function (e) {
      return '' +
        '<div class="alert-row">' +
          '<span class="alert-row__dot" style="background:' +
            (COLORS[e.type] || COLORS.other) + '"></span>' +
          '<div class="alert-row__body">' +
            '<div class="alert-row__title">' + esc(e.title) + '</div>' +
            '<div class="alert-row__meta">' + esc(Fmt.titleCase(e.type)) +
              (e.roomId ? ' &middot; Room ' + esc(App.Store.rooms.codeOf(e.roomId)) : '') +
              ' &middot; ' + esc(Fmt.longDate(e.start)) + '</div>' +
          '</div>' +
          '<div class="cell-muted nowrap">' + esc(Fmt.relative(e.start)) + '</div>' +
        '</div>';
    }).join('');
  }

  /* --- shared bits --------------------------------------------------------- */
  function emptyState(icon, title, text) {
    return '<div class="empty">' +
      '<div class="empty__icon">' + App.Icons.get(icon, { size: 26 }) + '</div>' +
      '<div class="empty__title">' + esc(title) + '</div>' +
      '<div class="empty__text">' + esc(text) + '</div></div>';
  }

  function lockedPanel(perm, message) {
    return '<div class="notice notice--muted">' +
      '<span class="notice__icon">' + App.Icons.get('lock', { size: 15 }) + '</span>' +
      '<div><div class="notice__title">Restricted panel</div>' +
      esc(message) + ' Requires <code>' + esc(perm) + '</code>.</div></div>';
  }
})(window.App = window.App || {});
