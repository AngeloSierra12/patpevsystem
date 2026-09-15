/* ============================================================================
 * calendar.js — Scheduling & Calendar module
 * ----------------------------------------------------------------------------
 * WBS 5.0  |  5.2 Interactive calendar + room occupancy timeline
 *           |  5.3 Schedule conflict detection (UI layer)
 * OWNER: Angelo Andrei P. Sierra
 *
 * The conflict rules themselves live in core/scheduling.js so the same logic
 * can be reused by the Reservation module (WBS 4.0) when it is built. This
 * file is the presentation of those rules.
 * ========================================================================== */
(function (App) {
  'use strict';

  var esc = App.Dom.esc;
  var D = App.Dates;
  var Fmt = App.Fmt;
  var S = App.Scheduling;

  var user;
  var state = {
    anchor: null,      // ISO date inside the displayed month / timeline window
    selected: null,    // ISO date shown in the side panel
    view: 'month',     // 'month' | 'timeline'
    filter: 'all',
    timelineDays: 14
  };

  var EVENT_TYPES = {
    maintenance: { label: 'Maintenance / room block', color: 'var(--danger-600)',
                   icon: 'wrench' },
    delivery:    { label: 'Canteen delivery',         color: 'var(--accent-600)',
                   icon: 'truck' },
    inventory:   { label: 'Inventory activity',       color: 'var(--data-3)',
                   icon: 'clipboard' },
    other:       { label: 'Other activity',           color: 'var(--ink-400)',
                   icon: 'info' }
  };

  /* --- boot ---------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    user = App.Shell.mount({
      title: 'Scheduling & Calendar',
      crumb: 'Reservation schedule and room occupancy',
      nav: 'calendar',
      requires: 'calendar.view'
    });
    if (!user) return;

    state.anchor = D.todayIso();
    state.selected = D.todayIso();

    bindToolbar();
    renderGuestNotice();
    render();

    /* deep link from the dashboard quick-action panel */
    if (/action=new/.test(location.search) && App.RBAC.can(user, 'calendar.create')) {
      openEntryModal(null);
    }
  });

  function bindToolbar() {
    document.getElementById('btnPrev').addEventListener('click', function () { step(-1); });
    document.getElementById('btnNext').addEventListener('click', function () { step(1); });

    document.getElementById('btnToday').addEventListener('click', function () {
      state.anchor = D.todayIso();
      state.selected = D.todayIso();
      render();
    });

    document.getElementById('viewMonth').addEventListener('click', function () {
      setView('month');
    });
    document.getElementById('viewTimeline').addEventListener('click', function () {
      setView('timeline');
    });

    document.getElementById('filterType').addEventListener('change', function (e) {
      state.filter = e.target.value;
      render();
    });

    var btnNew = document.getElementById('btnNew');
    if (btnNew) btnNew.addEventListener('click', function () { openEntryModal(null); });
  }

  function setView(v) {
    state.view = v;
    document.getElementById('viewMonth').classList.toggle('is-active', v === 'month');
    document.getElementById('viewTimeline').classList.toggle('is-active', v === 'timeline');
    render();
  }

  function step(dir) {
    if (state.view === 'month') {
      var d = D.parse(state.anchor);
      d.setMonth(d.getMonth() + dir, 1);
      state.anchor = D.toIso(d);
    } else {
      state.anchor = D.addDays(state.anchor, dir * state.timelineDays);
    }
    render();
  }

  /* --- visibility ---------------------------------------------------------- *
   * A guest holds calendar.view but not calendar.view.all, so they see only
   * their own reservations. (WBS 2.3 in action.)                             */
  function canSeeAll() { return App.RBAC.can(user, 'calendar.view.all'); }

  function visibleReservations() {
    var list = App.Store.reservations.list().filter(S.holdsRoom);
    if (!canSeeAll()) {
      list = list.filter(function (r) { return r.guestId === user.id; });
    }
    if (state.filter === 'maintenance' || state.filter === 'delivery' ||
        state.filter === 'inventory') {
      return [];
    }
    return list;
  }

  function visibleEvents() {
    if (!canSeeAll()) return [];          // internal activities are staff-only
    var list = App.Store.events.list();
    if (state.filter === 'reservations') return [];
    if (state.filter !== 'all') {
      list = list.filter(function (e) { return e.type === state.filter; });
    }
    return list;
  }

  function renderGuestNotice() {
    if (canSeeAll()) return;
    document.getElementById('guestNotice').innerHTML =
      '<div class="notice">' +
        '<span class="notice__icon">' + App.Icons.get('info', { size: 15 }) + '</span>' +
        '<div>' +
          '<div class="notice__title">You are seeing a filtered calendar</div>' +
          'Your role does not include <code>calendar.view.all</code>, so only your ' +
          'own bookings are shown. Room availability counts are still visible so ' +
          'you can plan a stay.' +
        '</div>' +
      '</div>';
  }

  /* --- render -------------------------------------------------------------- */
  function render() {
    if (state.view === 'month') renderMonth(); else renderTimeline();
    renderPanel();
    renderAvailability();
    renderLegend();

    var occ = S.occupancy(state.selected);
    App.Shell.setMeta([
      Fmt.longDate(state.selected),
      ['Occupied', occ.occupied + ' of ' + occ.total],
      ['Free', occ.available]
    ]);

    App.RBAC.applyTo(document, user);
  }

  /* ---------------------------------------------------- 5.2 month view ----- */
  function renderMonth() {
    var anchor = D.parse(state.anchor);
    var year = anchor.getFullYear(), month = anchor.getMonth();

    document.getElementById('calTitle').textContent = D.MONTHS[month] + ' ' + year;

    var first = new Date(year, month, 1);
    var gridStart = D.toIso(new Date(year, month, 1 - first.getDay()));
    var today = D.todayIso();

    var reservations = visibleReservations();
    var events = visibleEvents();

    var html = D.DAYS_SHORT.map(function (d) {
      return '<div class="cal-dow">' + d + '</div>';
    }).join('');

    for (var i = 0; i < 42; i++) {
      var iso = D.addDays(gridStart, i);
      var cellDate = D.parse(iso);
      var outside = cellDate.getMonth() !== month;

      var cls = ['cal-cell'];
      if (outside) cls.push('is-outside');
      if (iso === today) cls.push('is-today');
      if (iso === state.selected) cls.push('is-selected');
      if (D.isWeekend(iso)) cls.push('is-weekend');

      html += '<div class="' + cls.join(' ') + '" data-date="' + iso + '" ' +
              'role="button" tabindex="0">' +
                '<div class="cal-cell__num">' +
                  '<span>' + cellDate.getDate() + '</span>' +
                  (iso === today
                    ? '<span class="cal-cell__today-pill">Today</span>'
                    : '<span class="cal-cell__load">' + dayLoad(iso) + '</span>') +
                '</div>' +
                dayPills(iso, reservations, events) +
              '</div>';
    }

    document.getElementById('calBody').innerHTML = '<div class="cal-grid">' + html + '</div>';

    App.Dom.qsa('.cal-cell').forEach(function (cell) {
      cell.addEventListener('click', function () { selectDate(cell.dataset.date); });
      cell.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectDate(cell.dataset.date);
        }
      });
    });
  }

  /** Short occupancy marker shown in the corner of each month cell. */
  function dayLoad(iso) {
    if (!canSeeAll()) {
      var o = S.occupancy(iso);
      return o.available + ' free';
    }
    var occ = S.occupancy(iso);
    return occ.occupied + '/' + occ.total;
  }

  /** Up to three coloured pills per day, then a "+n more" marker. */
  function dayPills(iso, reservations, events) {
    var items = [];

    reservations.forEach(function (r) {
      if (r.checkIn === iso) {
        items.push({ cls: r.status === 'pending' ? 'pending' : 'checkin',
                     text: '→ ' + r.guestName });
      } else if (r.checkOut === iso) {
        items.push({ cls: 'checkout', text: '← ' + r.guestName });
      }
    });

    events.forEach(function (e) {
      if (D.diffDays(e.start, iso) >= 0 && D.diffDays(iso, e.end || e.start) >= 0) {
        items.push({ cls: e.type, text: e.title });
      }
    });

    var shown = items.slice(0, 3).map(function (it) {
      return '<span class="cal-pill cal-pill--' + it.cls + '">' + esc(it.text) + '</span>';
    }).join('');

    if (items.length > 3) {
      shown += '<span class="cal-more">+' + (items.length - 3) + ' more</span>';
    }
    return shown;
  }

  /* ------------------------------------------ 5.2 room occupancy timeline -- */
  function renderTimeline() {
    var start = state.anchor;
    var days = state.timelineDays;
    var dates = [];
    for (var i = 0; i < days; i++) dates.push(D.addDays(start, i));

    document.getElementById('calTitle').textContent =
      Fmt.longDate(dates[0]) + ' – ' + Fmt.longDate(dates[days - 1]);

    var rooms = App.Store.rooms.list();
    var reservations = visibleReservations();
    var events = visibleEvents().filter(S.isBlocking);
    var today = D.todayIso();

    var cols = '190px repeat(' + days + ', minmax(48px, 1fr))';

    /* header row */
    var head = '<div class="tl__head" style="grid-template-columns:' + cols + '">' +
      '<div class="tl__room"><span class="tl__room-type">Room</span></div>' +
      dates.map(function (d) {
        var dt = D.parse(d);
        return '<div class="tl__dayhead' + (d === today ? ' is-today' : '') + '">' +
          D.DAYS_SHORT[dt.getDay()] + '<strong>' + dt.getDate() + '</strong></div>';
      }).join('') + '</div>';

    /* one row per room */
    var rows = rooms.map(function (room) {
      var cells = dates.map(function (d) {
        var cls = 'tl__daycell';
        if (D.isWeekend(d)) cls += ' is-weekend';
        if (d === today) cls += ' is-today';
        return '<div class="' + cls + '" data-date="' + d + '"></div>';
      }).join('');

      /* bars are absolutely positioned over the row, one per booking */
      var bars = [];

      reservations.filter(function (r) { return r.roomId === room.id; })
        .forEach(function (r) { bars.push(barFor(r.checkIn, r.checkOut, r.status,
          r.guestName + ' · ' + r.id, r.id, 'reservation')); });

      events.filter(function (e) { return e.roomId === room.id; })
        .forEach(function (e) { bars.push(barFor(e.start, D.addDays(e.end || e.start, 1),
          'block', e.title, e.id, 'event')); });

      function barFor(from, toExclusive, kind, label, id, entity) {
        var startIdx = D.diffDays(start, from);
        var endIdx = D.diffDays(start, toExclusive);
        if (endIdx <= 0 || startIdx >= days) return '';       // outside the window

        var clampedStart = Math.max(0, startIdx);
        var clampedEnd = Math.min(days, endIdx);
        var widthCols = clampedEnd - clampedStart;
        if (widthCols <= 0) return '';

        /* the room column is 190px wide; each day column is (100% - 190px)/days */
        var left = 'calc(190px + (100% - 190px) * ' + (clampedStart / days) + ')';
        var width = 'calc((100% - 190px) * ' + (widthCols / days) + ' - 4px)';

        return '<div class="tl__bar tl__bar--' + kind + '" ' +
               'style="left:' + left + ';width:' + width + '" ' +
               'data-entity="' + entity + '" data-id="' + esc(id) + '" ' +
               'title="' + esc(label) + ' (' + Fmt.shortDate(from) + ' to ' +
                 Fmt.shortDate(D.addDays(toExclusive, -1)) + ')">' +
               esc(label) + '</div>';
      }

      return '<div class="tl__row" style="grid-template-columns:' + cols +
             ';position:relative">' +
        '<div class="tl__room">' +
          '<span class="tl__room-code">' + esc(room.code) + '</span>' +
          '<span class="tl__room-type">' + esc(room.type) + ' · ' +
            room.capacity + ' pax</span>' +
        '</div>' + cells + bars.join('') + '</div>';
    }).join('');

    document.getElementById('calBody').innerHTML =
      '<div class="tl"><div class="tl__inner">' + head + rows + '</div></div>';

    App.Dom.qsa('.tl__daycell').forEach(function (c) {
      c.addEventListener('click', function () { selectDate(c.dataset.date); });
    });
    App.Dom.qsa('.tl__bar').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        if (b.dataset.entity === 'event') openEntryModal(b.dataset.id);
        else showReservation(b.dataset.id);
      });
    });
  }

  function selectDate(iso) {
    if (!iso) return;
    state.selected = iso;
    render();
  }

  /* --- day detail panel ---------------------------------------------------- */
  function renderPanel() {
    var iso = state.selected;
    var occ = S.occupancy(iso);

    document.getElementById('panelDate').textContent = Fmt.longDate(iso);
    document.getElementById('panelMeta').textContent =
      Fmt.relative(iso) + ' · ' + occ.occupied + ' of ' + occ.total +
      ' rooms held · ' + occ.available + ' free';

    var reservations = visibleReservations();
    var arrivals = reservations.filter(function (r) { return r.checkIn === iso; });
    var departures = reservations.filter(function (r) { return r.checkOut === iso; });
    var inHouse = reservations.filter(function (r) {
      return D.diffDays(r.checkIn, iso) > 0 && D.diffDays(iso, r.checkOut) > 0;
    });
    var events = visibleEvents().filter(function (e) {
      return D.diffDays(e.start, iso) >= 0 && D.diffDays(iso, e.end || e.start) >= 0;
    });

    var html = '';

    html += section('Arrivals', arrivals, 'var(--ok-700)', function (r) {
      return { title: r.guestName,
               meta: 'Room ' + App.Store.rooms.codeOf(r.roomId) + ' · ' + r.pax +
                     ' pax · ' + Fmt.titleCase(r.status) + ' · until ' +
                     Fmt.shortDate(r.checkOut),
               notes: r.notes, id: r.id, entity: 'reservation' };
    });

    html += section('Departures', departures, 'var(--info-700)', function (r) {
      return { title: r.guestName,
               meta: 'Room ' + App.Store.rooms.codeOf(r.roomId) + ' · checked in ' +
                     Fmt.shortDate(r.checkIn),
               notes: '', id: r.id, entity: 'reservation' };
    });

    html += section('Staying over', inHouse, 'var(--ink-400)', function (r) {
      return { title: r.guestName,
               meta: 'Room ' + App.Store.rooms.codeOf(r.roomId) + ' · ' +
                     Fmt.shortDate(r.checkIn) + ' to ' + Fmt.shortDate(r.checkOut),
               notes: '', id: r.id, entity: 'reservation' };
    });

    html += section('Scheduled activities', events, 'var(--accent-600)', function (e) {
      return { title: e.title,
               meta: (EVENT_TYPES[e.type] || EVENT_TYPES.other).label +
                     (e.roomId ? ' · Room ' + App.Store.rooms.codeOf(e.roomId) : '') +
                     (e.start !== e.end
                       ? ' · ' + Fmt.shortDate(e.start) + ' to ' + Fmt.shortDate(e.end)
                       : ''),
               notes: e.notes, id: e.id, entity: 'event',
               color: (EVENT_TYPES[e.type] || EVENT_TYPES.other).color };
    });

    if (!html) {
      html = '<div class="empty">' +
        '<div class="empty__icon">' + App.Icons.get('calendar', { size: 26 }) + '</div>' +
        '<div class="empty__title">Nothing scheduled</div>' +
        '<div class="empty__text">No arrivals, departures or activities on this date.</div>' +
      '</div>';
    }

    if (App.RBAC.can(user, 'calendar.create')) {
      html += '<button class="btn btn--block mt-2" id="panelAdd">' +
              App.Icons.get('plus', { size: 15 }) +
              'Add entry on ' + esc(Fmt.shortDate(iso)) + '</button>';
    }

    var body = document.getElementById('panelBody');
    body.innerHTML = html;

    var add = document.getElementById('panelAdd');
    if (add) add.addEventListener('click', function () { openEntryModal(null, iso); });

    App.Dom.qsa('.day-item[data-entity]', body).forEach(function (el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function () {
        if (el.dataset.entity === 'event') openEntryModal(el.dataset.id);
        else showReservation(el.dataset.id);
      });
    });

    function section(label, items, color, mapFn) {
      if (!items.length) return '';
      return '<div class="mb-2">' +
        '<div class="day-section__label">' + esc(label) +
          ' (' + items.length + ')</div>' +
        items.map(function (it) {
          var m = mapFn(it);
          return '<div class="day-item" data-entity="' + m.entity + '" data-id="' +
                 esc(m.id) + '">' +
            '<span class="day-item__stripe" style="background:' +
              (m.color || color) + '"></span>' +
            '<div class="day-item__body">' +
              '<div class="day-item__title">' + esc(m.title) + '</div>' +
              '<div class="day-item__meta">' + esc(m.meta) + '</div>' +
              (m.notes ? '<div class="day-item__notes">' + esc(m.notes) + '</div>' : '') +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    }
  }

  /* --- availability strip for the selected date ---------------------------- */
  function renderAvailability() {
    var start = state.selected;
    var days = 10;
    var strip = '';

    for (var i = 0; i < days; i++) {
      var iso = D.addDays(start, i);
      var o = S.occupancy(iso);
      var busy = o.available <= 1;
      strip += '<div class="availability-strip__day' + (busy ? ' is-busy' : '') + '" ' +
               'title="' + esc(Fmt.longDate(iso)) + ': ' + o.available + ' of ' +
               o.total + ' free">' +
               D.parse(iso).getDate() + '<br>' + o.available +
               '</div>';
    }

    var freeRooms = S.availableRooms(start, D.addDays(start, 1));
    var byType = {};
    freeRooms.forEach(function (r) { byType[r.type] = (byType[r.type] || 0) + 1; });

    document.getElementById('availabilityBox').innerHTML =
      '<p class="text-sm text-muted mb-1">Rooms free per night, starting ' +
        esc(Fmt.longDate(start)) + '. Red means one room or fewer left.</p>' +
      '<div class="availability-strip">' + strip + '</div>' +
      '<div class="mt-2 text-sm">' +
        '<strong>Free on ' + esc(Fmt.shortDate(start)) + ':</strong> ' +
        (Object.keys(byType).length
          ? Object.keys(byType).map(function (t) {
              return esc(t) + ' ×' + byType[t];
            }).join(', ')
          : '<span style="color:var(--danger-700)">fully booked</span>') +
      '</div>';
  }

  function renderLegend() {
    var items = [
      { label: 'Check-in', color: 'var(--ok-700)' },
      { label: 'Check-out', color: 'var(--info-700)' },
      { label: 'Pending confirmation', color: 'var(--accent-600)' },
      { label: 'Maintenance / blocked', color: 'var(--danger-600)' },
      { label: 'Canteen delivery', color: 'var(--accent-700)' }
    ];
    document.getElementById('calLegend').innerHTML =
      items.map(function (i) {
        return '<span class="chart-legend__item">' +
          '<span class="chart-legend__swatch" style="background:' + i.color + '"></span>' +
          esc(i.label) + '</span>';
      }).join('') +
      '<span style="margin-left:auto" class="text-sm text-muted">' +
      (state.view === 'month'
        ? 'Click any day for details'
        : 'Click a bar to open the entry') + '</span>';
  }

  /* --- read-only reservation view ----------------------------------------- *
   * Reservations belong to WBS 4.0, so this module shows them but never
   * edits them.                                                              */
  function showReservation(id) {
    var r = App.Store.reservations.get(id);
    if (!r) return;
    var room = App.Store.rooms.get(r.roomId);
    var nights = D.diffDays(r.checkIn, r.checkOut);

    App.Shell.openModal({
      title: r.guestName,
      sub: 'Reservation ' + r.id,
      body:
        '<div class="kv">' +
          kv('Status', Fmt.titleCase(r.status)) +
          kv('Room', room ? room.code + ' · ' + room.type : r.roomId) +
          kv('Check-in', Fmt.longDate(r.checkIn)) +
          kv('Check-out', Fmt.longDate(r.checkOut)) +
          kv('Nights', String(nights)) +
          kv('Guests', String(r.pax) + (room && r.pax > room.capacity
            ? ' (over the ' + room.capacity + ' capacity)' : '')) +
          kv('Amount', Fmt.peso(r.total)) +
          kv('Notes', r.notes || '—') +
        '</div>' +
        '<div class="notice notice--muted mt-2">' +
          '<span class="notice__icon">' + App.Icons.get('info', { size: 15 }) + '</span>' +
          '<div><div class="notice__title">Read-only in this module</div>' +
          'Reservations are created and edited in the Hotel Reservation module ' +
          'which is not available in this build. The calendar displays ' +
          'reservations and checks them for conflicts.</div>' +
        '</div>',
      footer: '<button class="btn" data-act="close">Close</button>',
      onMount: function (root, handle) {
        root.querySelector('[data-act="close"]').addEventListener('click', handle.close);
      }
    });

    function kv(k, v) {
      return '<div class="kv__k">' + esc(k) + '</div><div class="kv__v">' + esc(v) + '</div>';
    }
  }

  /* ===================================================================== *
   * 5.3 — Add / edit schedule entry, with live conflict detection
   * ===================================================================== */
  function openEntryModal(eventId, presetDate) {
    var existing = eventId ? App.Store.events.get(eventId) : null;
    var editable = existing
      ? App.RBAC.can(user, 'calendar.edit')
      : App.RBAC.can(user, 'calendar.create');

    var rooms = App.Store.rooms.list();
    var start = existing ? existing.start : (presetDate || state.selected);
    var end = existing ? existing.end : (presetDate || state.selected);

    var typeOptions = Object.keys(EVENT_TYPES).map(function (k) {
      return '<option value="' + k + '"' +
             (existing && existing.type === k ? ' selected' : '') + '>' +
             esc(EVENT_TYPES[k].label) + '</option>';
    }).join('');

    var roomOptions = '<option value="">No specific room</option>' +
      rooms.map(function (r) {
        return '<option value="' + r.id + '"' +
               (existing && existing.roomId === r.id ? ' selected' : '') + '>' +
               esc(r.code + ' · ' + r.type + ' (' + r.capacity + ' pax)') +
               '</option>';
      }).join('');

    var body =
      '<div class="field">' +
        '<label class="field__label" for="fTitle">Entry title <span class="field__req">*</span></label>' +
        '<input class="input" id="fTitle" maxlength="90" placeholder="e.g. Aircon servicing, Deluxe wing" ' +
          'value="' + esc(existing ? existing.title : '') + '">' +
        '<div class="field__error" id="errTitle" hidden></div>' +
      '</div>' +

      '<div class="field-row">' +
        '<div class="field">' +
          '<label class="field__label" for="fType">Type</label>' +
          '<select class="select" id="fType">' + typeOptions + '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="fRoom">Room affected</label>' +
          '<select class="select" id="fRoom">' + roomOptions + '</select>' +
          '<div class="field__hint">Maintenance entries block the room from booking.</div>' +
        '</div>' +
      '</div>' +

      '<div class="field-row">' +
        '<div class="field">' +
          '<label class="field__label" for="fStart">Start date <span class="field__req">*</span></label>' +
          '<input class="input" type="date" id="fStart" value="' + esc(start) + '">' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="fEnd">End date <span class="field__req">*</span></label>' +
          '<input class="input" type="date" id="fEnd" value="' + esc(end) + '">' +
          '<div class="field__hint">Inclusive. The entry covers this day too.</div>' +
        '</div>' +
      '</div>' +

      '<div class="field">' +
        '<label class="field__label" for="fNotes">Notes</label>' +
        '<textarea class="textarea" id="fNotes" maxlength="240" ' +
          'placeholder="Contractor, time window, anything staff should know">' +
          esc(existing ? existing.notes : '') + '</textarea>' +
      '</div>' +

      '<div class="mt-2">' +
        '<div class="field__label">Conflict check</div>' +
        '<div id="conflictBox"></div>' +
      '</div>';

    var footer =
      (existing && App.RBAC.can(user, 'calendar.delete')
        ? '<button class="btn btn--danger" data-act="delete">Delete entry</button>'
        : '<span></span>') +
      '<span class="flex-gap">' +
        '<button class="btn" data-act="cancel">Cancel</button>' +
        '<button class="btn btn--primary" data-act="save"' +
          (editable ? '' : ' disabled') + '>' +
          (existing ? 'Save changes' : 'Create entry') + '</button>' +
      '</span>';

    App.Shell.openModal({
      title: existing ? 'Edit schedule entry' : 'New schedule entry',
      sub: existing ? existing.id : 'Checked against every reservation and room block',
      body: body,
      footer: footer,
      footerSplit: true,
      wide: true,
      onMount: function (root, handle) {
        var f = {
          title: root.querySelector('#fTitle'),
          type: root.querySelector('#fType'),
          room: root.querySelector('#fRoom'),
          start: root.querySelector('#fStart'),
          end: root.querySelector('#fEnd'),
          notes: root.querySelector('#fNotes')
        };
        var box = root.querySelector('#conflictBox');
        var saveBtn = root.querySelector('[data-act="save"]');
        var findings = [];

        function candidate() {
          return {
            id: existing ? existing.id : null,
            kind: 'event',
            type: f.type.value,
            roomId: f.room.value || null,
            start: f.start.value,
            end: f.end.value
          };
        }

        function check() {
          findings = S.detect(candidate());
          box.innerHTML = renderFindings(findings);

          var blocked = S.hasBlockingConflict(findings);
          /* calendar.override lets an admin save despite an error, because a
             real hostel sometimes has to double-book deliberately. */
          var mayOverride = App.RBAC.can(user, 'calendar.override');
          saveBtn.disabled = !editable || (blocked && !mayOverride);
          saveBtn.textContent = blocked && mayOverride && editable
            ? 'Save anyway (override)'
            : (existing ? 'Save changes' : 'Create entry');
          saveBtn.classList.toggle('btn--danger', blocked && mayOverride);
        }

        ['input', 'change'].forEach(function (evt) {
          Object.keys(f).forEach(function (k) {
            f[k].addEventListener(evt, check);
          });
        });

        /* keep the end date from drifting before the start date */
        f.start.addEventListener('change', function () {
          if (D.diffDays(f.start.value, f.end.value) < 0) f.end.value = f.start.value;
          check();
        });

        check();

        root.querySelector('[data-act="cancel"]').addEventListener('click', handle.close);

        var del = root.querySelector('[data-act="delete"]');
        if (del) {
          del.addEventListener('click', function () {
            handle.close();
            App.Shell.confirm({
              title: 'Delete this schedule entry?',
              message: '"' + existing.title + '" will be removed from the calendar. ' +
                       'This cannot be undone.',
              confirmLabel: 'Delete entry',
              danger: true,
              onConfirm: function () {
                App.Store.events.remove(existing.id);
                App.Shell.toast('Schedule entry deleted.', 'ok');
                render();
              }
            });
          });
        }

        saveBtn.addEventListener('click', function () {
          var errTitle = root.querySelector('#errTitle');
          if (!f.title.value.trim()) {
            f.title.classList.add('is-invalid');
            errTitle.hidden = false;
            errTitle.textContent = 'A title is required.';
            f.title.focus();
            return;
          }
          f.title.classList.remove('is-invalid');
          errTitle.hidden = true;

          var data = {
            title: f.title.value.trim(),
            type: f.type.value,
            roomId: f.room.value || null,
            start: f.start.value,
            end: f.end.value,
            notes: f.notes.value.trim(),
            createdBy: user.id
          };

          if (existing) {
            App.Store.events.update(existing.id, data);
            App.Shell.toast('Schedule entry updated.', 'ok');
          } else {
            App.Store.events.create(data);
            App.Shell.toast('Schedule entry created.', 'ok');
          }

          if (S.hasBlockingConflict(findings)) {
            App.Shell.toast('Saved with an unresolved conflict. It is flagged on the calendar.', 'warn');
          }

          state.selected = data.start;
          handle.close();
          render();
        });
      }
    });
  }

  /** Turn detect() output into the conflict panel. */
  function renderFindings(findings) {
    if (!findings.length) {
      return '<div class="conflict conflict--ok">' +
        '<span class="conflict__icon">' +
          App.Icons.get('checkCircle', { size: 15 }) + '</span>' +
        '<div><div class="conflict__title">No conflicts found</div>' +
        '<div class="conflict__detail">The dates are valid and nothing else is ' +
        'booked into this room for that period.</div></div></div>';
    }

    return findings.map(function (f) {
      return '<div class="conflict conflict--' +
               (f.level === 'error' ? 'error' : 'warn') + '">' +
        '<span class="conflict__icon">' +
          App.Icons.get(f.level === 'error' ? 'xCircle' : 'alert', { size: 15 }) +
        '</span>' +
        '<div>' +
          '<div class="conflict__title">' + esc(f.title) + '</div>' +
          '<div class="conflict__detail">' + esc(f.detail) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }
})(window.App = window.App || {});
