/* ============================================================================
 * calendar.js — Scheduling and Calendar
 * Angelo Andrei P. Sierra — Frontend and UI/UX Developer
 *
 * Charter deliverable: "A calendar interface for viewing reservations,
 * monitoring room bookings, and managing the reservation schedule."
 *
 * The month grid, the day detail and the conflict report all read the real
 * reservation records. Saving a schedule change is a write, and writes belong
 * to the reservation logic — see the note at the foot of the conflict panel.
 * ========================================================================== */
(function (App) {
  'use strict';
  var S = App.Shell;
  var Q = App.Q;

  var view = null;      // first day of the month on screen
  var picked = null;    // selected day

  document.addEventListener('DOMContentLoaded', function () {
    S.mount({ title: 'Scheduling and Calendar', nav: 'calendar' });

    picked = S.today();
    view = picked.slice(0, 8) + '01';

    S.meta([['Reservations', App.DB.reservations.length],
            ['Rooms', App.DB.rooms.length],
            'bookings laid out by night']);

    S.el('#prev').addEventListener('click', function () { step(-1); });
    S.el('#next').addEventListener('click', function () { step(1); });

    render();
  });

  function step(months) {
    var d = S.parseIso(view);
    d.setMonth(d.getMonth() + months);
    view = S.iso(d).slice(0, 8) + '01';
    render();
  }

  function render() {
    month();
    day();
    conflicts();
  }

  /* ---------------------------------------------------------------------- *
   * Month grid.
   *
   * A night is the unit, not a day: a stay from the 13th to the 16th occupies
   * the nights of the 13th, 14th and 15th, and the room is free again on the
   * 16th. Checking `check_in <= night < check_out` is what makes two stays
   * that meet on the same date not count as an overlap.
   * -------------------------------------------------------------------- */
  function month() {
    var first = S.parseIso(view);
    var y = first.getFullYear(), m = first.getMonth();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var lead = first.getDay();
    var today = S.today();

    S.el('#calTitle').textContent = S.MONTHS[m] + ' ' + y;

    var cells = S.DOW.map(function (d) {
      return '<div class="cal__dow">' + d + '</div>';
    }).join('');

    /* tail of the previous month, so the grid starts on the right weekday */
    var prevLen = new Date(y, m, 0).getDate();
    for (var i = lead - 1; i >= 0; i--) {
      cells += '<div class="cal__day is-out"><span class="cal__num">' +
        (prevLen - i) + '</span></div>';
    }

    for (var n = 1; n <= daysInMonth; n++) {
      var iso = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(n).padStart(2, '0');
      var held = Q.heldOn(iso);
      var arrivals = Q.arrivalsOn(iso);
      var cls = 'cal__day' + (iso === today ? ' is-today' : '') +
                (iso === picked ? ' is-picked' : '');

      var pills = held.slice(0, 2).map(function (r) {
        var alt = arrivals.indexOf(r) !== -1;
        return '<span class="cal__pill' + (alt ? ' cal__pill--alt' : '') +
          '" title="' + S.esc(r.reference_number) + '">' +
          (alt ? '→ ' : '') + 'Room ' + S.esc(r.room_number_snapshot) + '</span>';
      }).join('');
      var more = held.length > 2
        ? '<span class="cal__pill cal__pill--more">+' + (held.length - 2) + ' more</span>' : '';

      cells += '<div class="' + cls + '" data-day="' + iso + '" role="button" tabindex="0">' +
        '<span class="cal__num">' + n + '</span>' + pills + more + '</div>';
    }

    /* head of the next month, to square off the final week */
    var filled = lead + daysInMonth;
    var tail = (7 - (filled % 7)) % 7;
    for (var t = 1; t <= tail; t++) {
      cells += '<div class="cal__day is-out"><span class="cal__num">' + t + '</span></div>';
    }

    S.el('#cal').innerHTML = '<div class="cal">' + cells + '</div>';

    S.els('[data-day]').forEach(function (c) {
      c.addEventListener('click', function () { picked = c.dataset.day; render(); });
      c.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault(); picked = c.dataset.day; render();
        }
      });
    });
  }

  /* ---------------------------------------------------------------------- *
   * Selected day — arrivals, departures, and who is staying.
   * -------------------------------------------------------------------- */
  function day() {
    var arrivals = Q.arrivalsOn(picked);
    var departures = Q.departuresOn(picked);
    var held = Q.heldOn(picked);

    var head = '<div style="padding:11px 13px;border-bottom:1px solid var(--line)">' +
      '<div style="font-size:13px;font-weight:600">' + S.esc(longDate(picked)) + '</div>' +
      '<div class="metric__note">' + held.length + ' of ' + App.DB.rooms.length +
        ' rooms held · ' + arrivals.length + ' arriving · ' +
        departures.length + ' leaving</div></div>';

    if (!arrivals.length && !departures.length && !held.length) {
      S.el('#day').innerHTML = head +
        '<div class="empty">' + S.icon('calendar', 24) + 'Nothing scheduled.</div>';
      return;
    }

    S.el('#day').innerHTML = head +
      group('Arriving', arrivals) + group('Departing', departures) +
      group('In house', held.filter(function (r) {
        return arrivals.indexOf(r) === -1;
      }));
  }

  function group(label, rows) {
    if (!rows.length) return '';
    return '<div style="padding:9px 13px 4px"><div class="label" ' +
        'style="margin-bottom:4px">' + S.esc(label) + '</div>' +
      rows.map(function (r) {
        var g = Q.one(App.DB.guests, 'guest_id', r.guest_id);
        var st = Q.resStatus(r.status);
        return '<div class="rowitem" style="padding:6px 0">' +
          '<span class="rowitem__main">' +
            '<span class="rowitem__title">Room ' + S.esc(r.room_number_snapshot) +
              ' · ' + S.esc(g ? g.full_name : 'Unknown guest') + '</span>' +
            '<span class="rowitem__sub mono">' + S.esc(r.reference_number) + '</span>' +
          '</span>' +
          '<span class="tag tag--' + st.tag + '">' + S.esc(st.text) + '</span>' +
        '</div>';
      }).join('') + '</div>';
  }

  /* ---------------------------------------------------------------------- *
   * Conflict detection.
   *
   * Two live bookings on the same room whose night ranges overlap. Cancelled
   * and checked-out stays are excluded: neither holds a room. This reports
   * what is already in the records — refusing a *new* booking at the moment
   * of saving is part of the reservation logic, not of this screen.
   * -------------------------------------------------------------------- */
  function conflicts() {
    var live = App.DB.reservations.filter(function (r) {
      return ['PENDING', 'CONFIRMED', 'CHECKED_IN'].indexOf(r.status) !== -1;
    });

    var clashes = [];
    for (var i = 0; i < live.length; i++) {
      for (var j = i + 1; j < live.length; j++) {
        var a = live[i], b = live[j];
        if (a.room_id !== b.room_id) continue;
        if (a.check_in_date < b.check_out_date && b.check_in_date < a.check_out_date) {
          clashes.push([a, b]);
        }
      }
    }

    var head = '<div style="padding:11px 13px;border-bottom:1px solid var(--line)">' +
      '<div class="metric__note">' + live.length +
      ' live bookings checked for overlapping nights on the same room.</div></div>';

    if (!clashes.length) {
      S.el('#conflict').innerHTML = head +
        '<div class="empty">' + S.icon('check', 24) +
        'No double bookings found.</div>';
      return;
    }

    S.el('#conflict').innerHTML = head + clashes.map(function (p) {
      return '<div class="note note--warn" style="margin:11px 13px">' +
        '<span class="note__icon">' + S.icon('alert', 15) + '</span>' +
        '<div><strong>Room ' + S.esc(p[0].room_number_snapshot) + '</strong> is held twice.<br>' +
          S.esc(p[0].reference_number) + ' (' + S.esc(S.shortDate(p[0].check_in_date)) +
            '–' + S.esc(S.shortDate(p[0].check_out_date)) + ')<br>' +
          S.esc(p[1].reference_number) + ' (' + S.esc(S.shortDate(p[1].check_in_date)) +
            '–' + S.esc(S.shortDate(p[1].check_out_date)) + ')' +
        '</div></div>';
    }).join('');
  }

  function longDate(iso) {
    var d = S.parseIso(iso);
    if (!d) return '';
    return S.DOW[d.getDay()] + ', ' + S.MONTHS[d.getMonth()] + ' ' +
           d.getDate() + ', ' + d.getFullYear();
  }
})(window.App = window.App || {});
