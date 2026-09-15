/* ============================================================================
 * scheduling.js — Occupancy maths and schedule conflict detection
 * ----------------------------------------------------------------------------
 * WBS 5.2 / 5.3  |  OWNER: Angelo Andrei P. Sierra
 *
 * DATE SEMANTICS (important — the whole module depends on this)
 * ------------------------------------------------------------
 * A reservation occupies the HALF-OPEN interval [checkIn, checkOut).
 * The guest vacates on the check-out date, so a new guest may check in that
 * same morning. Two reservations overlap when:
 *
 *        A.checkIn < B.checkOut   AND   B.checkIn < A.checkOut
 *
 * A maintenance / blocking EVENT uses an INCLUSIVE end date, because
 * "cleaning on the 5th to the 7th" means the room is unusable on the 7th too.
 * Event ranges are therefore converted to [start, end + 1 day) before being
 * compared with reservations.
 *
 * Mixing those two conventions up is the classic source of off-by-one double
 * bookings, which the project charter lists as risk #1, so it is stated here
 * once and every function below obeys it.
 * ========================================================================== */
(function (App) {
  'use strict';

  var D = App.Dates;

  /** Event types that make a room unusable while they run. */
  var BLOCKING_EVENT_TYPES = ['maintenance'];

  /** Reservation statuses that do NOT hold the room. */
  var NON_HOLDING_STATUSES = ['cancelled'];

  /* --- interval helpers ---------------------------------------------------- */

  /** Half-open overlap test. All arguments are ISO date strings. */
  function overlaps(aStart, aEnd, bStart, bEnd) {
    return D.diffDays(aStart, bEnd) > 0 && D.diffDays(bStart, aEnd) > 0;
  }

  /** Normalise anything schedulable into { start, endExclusive }. */
  function span(item) {
    if (item.kind === 'event') {
      return { start: item.start, endExclusive: D.addDays(item.end || item.start, 1) };
    }
    return { start: item.checkIn || item.start, endExclusive: item.checkOut || item.end };
  }

  function holdsRoom(reservation) {
    return NON_HOLDING_STATUSES.indexOf(reservation.status) === -1;
  }

  function isBlocking(event) {
    return BLOCKING_EVENT_TYPES.indexOf(event.type) !== -1 && !!event.roomId;
  }

  /* --- occupancy ----------------------------------------------------------- */

  /** Reservations that hold `roomId` on `dateIso`. */
  function reservationsOnDate(dateIso, roomId) {
    return App.Store.reservations.list().filter(function (r) {
      if (!holdsRoom(r)) return false;
      if (roomId && r.roomId !== roomId) return false;
      return D.diffDays(r.checkIn, dateIso) >= 0 && D.diffDays(dateIso, r.checkOut) > 0;
    });
  }

  /** Events falling on `dateIso` (inclusive end). */
  function eventsOnDate(dateIso) {
    return App.Store.events.list().filter(function (e) {
      return D.diffDays(e.start, dateIso) >= 0 &&
             D.diffDays(dateIso, e.end || e.start) >= 0;
    });
  }

  /** Rooms unusable on `dateIso` because of a blocking event. */
  function blockedRoomsOnDate(dateIso) {
    return eventsOnDate(dateIso).filter(isBlocking).map(function (e) { return e.roomId; });
  }

  /**
   * Occupancy snapshot for a single date.
   * @returns {{date, total, occupied, blocked, available, rate}}
   */
  function occupancy(dateIso) {
    var rooms = App.Store.rooms.list();
    var occupiedIds = {};
    reservationsOnDate(dateIso).forEach(function (r) { occupiedIds[r.roomId] = true; });

    var blockedIds = {};
    blockedRoomsOnDate(dateIso).forEach(function (id) {
      if (!occupiedIds[id]) blockedIds[id] = true;
    });

    var occupied = Object.keys(occupiedIds).length;
    var blocked = Object.keys(blockedIds).length;

    return {
      date: dateIso,
      total: rooms.length,
      occupied: occupied,
      blocked: blocked,
      available: rooms.length - occupied - blocked,
      rate: rooms.length ? occupied / rooms.length : 0
    };
  }

  /** Occupancy for each date in a range — feeds the dashboard bar chart. */
  function occupancySeries(startIso, days) {
    var out = [];
    for (var i = 0; i < days; i++) out.push(occupancy(D.addDays(startIso, i)));
    return out;
  }

  /** Reservations checking in / out on a date. */
  function arrivals(dateIso) {
    return App.Store.reservations.list().filter(function (r) {
      return holdsRoom(r) && r.checkIn === dateIso;
    });
  }
  function departures(dateIso) {
    return App.Store.reservations.list().filter(function (r) {
      return holdsRoom(r) && r.checkOut === dateIso;
    });
  }

  /** Is `roomId` free for the whole half-open range? */
  function isRoomFree(roomId, startIso, endExclusiveIso, ignoreId) {
    var clash = App.Store.reservations.list().some(function (r) {
      if (!holdsRoom(r) || r.roomId !== roomId || r.id === ignoreId) return false;
      return overlaps(startIso, endExclusiveIso, r.checkIn, r.checkOut);
    });
    if (clash) return false;

    return !App.Store.events.list().some(function (e) {
      if (!isBlocking(e) || e.roomId !== roomId || e.id === ignoreId) return false;
      var s = span({ kind: 'event', start: e.start, end: e.end });
      return overlaps(startIso, endExclusiveIso, s.start, s.endExclusive);
    });
  }

  /** Every room free for the given range. */
  function availableRooms(startIso, endExclusiveIso, ignoreId) {
    return App.Store.rooms.list().filter(function (room) {
      return isRoomFree(room.id, startIso, endExclusiveIso, ignoreId);
    });
  }

  /* ======================================================================== *
   * WBS 5.3 — CONFLICT DETECTION
   * ------------------------------------------------------------------------
   * detect(candidate) inspects a proposed schedule entry and returns a list of
   * findings, worst first. Nothing is written; the caller decides what to do.
   *
   * candidate = {
   *   id?        string   existing entry being edited (excluded from checks)
   *   kind       'event' | 'reservation'
   *   type?      event type, when kind === 'event'
   *   roomId?    string | null
   *   start      ISO date
   *   end        ISO date   (inclusive for events, = check-out for reservations)
   *   pax?       number
   * }
   *
   * Each finding: { level: 'error'|'warn', code, title, detail }
   *   error — the entry must not be saved as-is
   *   warn  — allowed, but the user should see it first
   * ======================================================================== */
  function detect(candidate) {
    var findings = [];
    var isEvent = candidate.kind === 'event';
    var start = candidate.start;
    var end = candidate.end || candidate.start;

    /* ---- 1. Structural date validity ------------------------------------- */
    if (!start || !end) {
      findings.push({
        level: 'error', code: 'DATE_MISSING',
        title: 'Dates are incomplete',
        detail: 'Both a start and an end date are required before the entry can be checked.'
      });
      return findings;               // nothing else is meaningful without dates
    }

    var length = D.diffDays(start, end);

    if (isEvent && length < 0) {
      findings.push({
        level: 'error', code: 'DATE_ORDER',
        title: 'End date is before the start date',
        detail: 'The entry ends on ' + App.Fmt.longDate(end) + ' but starts on ' +
                App.Fmt.longDate(start) + '.'
      });
      return findings;
    }

    if (!isEvent && length <= 0) {
      findings.push({
        level: 'error', code: 'DATE_ORDER',
        title: 'Check-out must be after check-in',
        detail: 'A reservation has to cover at least one night. Check-in ' +
                App.Fmt.longDate(start) + ', check-out ' + App.Fmt.longDate(end) + '.'
      });
      return findings;
    }

    /* the half-open window this candidate would occupy */
    var win = span({
      kind: candidate.kind, start: start, end: end,
      checkIn: start, checkOut: end
    });

    /* ---- 2. Room double-booking ------------------------------------------ */
    if (candidate.roomId) {
      var room = App.Store.rooms.get(candidate.roomId);

      App.Store.reservations.list().forEach(function (r) {
        if (!holdsRoom(r) || r.roomId !== candidate.roomId || r.id === candidate.id) return;
        if (!overlaps(win.start, win.endExclusive, r.checkIn, r.checkOut)) return;

        findings.push({
          level: 'error', code: 'ROOM_DOUBLE_BOOKED',
          title: 'Room ' + (room ? room.code : candidate.roomId) + ' is already taken',
          detail: r.guestName + ' holds this room from ' + App.Fmt.longDate(r.checkIn) +
                  ' to ' + App.Fmt.longDate(r.checkOut) + ' (' + r.id + ', ' +
                  r.status + '). Those dates overlap the entry you are creating.'
        });
      });

      /* ---- 3. Room blocked by maintenance -------------------------------- */
      App.Store.events.list().forEach(function (e) {
        if (!isBlocking(e) || e.roomId !== candidate.roomId || e.id === candidate.id) return;
        var s = span({ kind: 'event', start: e.start, end: e.end });
        if (!overlaps(win.start, win.endExclusive, s.start, s.endExclusive)) return;

        findings.push({
          level: 'error', code: 'ROOM_BLOCKED',
          title: 'Room is blocked for maintenance',
          detail: '"' + e.title + '" runs ' + App.Fmt.longDate(e.start) + ' to ' +
                  App.Fmt.longDate(e.end) + ' and makes this room unusable during ' +
                  'that period.'
        });
      });

      /* ---- 4. Capacity --------------------------------------------------- */
      if (room && candidate.pax && candidate.pax > room.capacity) {
        findings.push({
          level: 'warn', code: 'OVER_CAPACITY',
          title: 'Guest count is over the room capacity',
          detail: 'Room ' + room.code + ' (' + room.type + ') is rated for ' +
                  room.capacity + ' guests, but ' + candidate.pax + ' were entered. ' +
                  'An extra bed or a second room may be needed.'
        });
      }
    } else if (isEvent && candidate.type === 'maintenance') {
      /* ---- 5. Maintenance with no room ----------------------------------- */
      findings.push({
        level: 'warn', code: 'NO_ROOM_SELECTED',
        title: 'No room attached to this maintenance entry',
        detail: 'The entry will show on the calendar but will not block any room ' +
                'from being booked. Pick a room if it should.'
      });
    }

    /* ---- 6. Entry starts in the past ------------------------------------- */
    var today = D.todayIso();
    if (D.diffDays(today, start) < 0) {
      findings.push({
        level: 'warn', code: 'PAST_DATE',
        title: 'Start date is in the past',
        detail: 'This entry begins ' + App.Fmt.relative(start) + '. Back-dated records ' +
                'are allowed, but they will not appear in upcoming-schedule views.'
      });
    }

    /* ---- 7. Unusually long stay ------------------------------------------ */
    if (length > 30) {
      findings.push({
        level: 'warn', code: 'LONG_SPAN',
        title: 'Unusually long booking',
        detail: 'This entry spans ' + length + ' days. Long stays normally need ' +
                'written approval from IGP administration.'
      });
    }

    /* ---- 8. Pressure on remaining rooms ---------------------------------- */
    var tightDays = D.range(win.start, D.addDays(win.endExclusive, -1))
      .map(function (d) { return { date: d, occ: occupancy(d) }; })
      .filter(function (x) { return x.occ.available <= 1; });

    if (tightDays.length) {
      findings.push({
        level: 'warn', code: 'LOW_AVAILABILITY',
        title: 'Very little room left on ' + tightDays.length +
               ' day' + (tightDays.length > 1 ? 's' : ''),
        detail: 'On ' + tightDays.map(function (x) { return App.Fmt.shortDate(x.date); })
                  .slice(0, 5).join(', ') +
                (tightDays.length > 5 ? ' and others' : '') +
                ', one room or fewer stays free. Walk-in guests may be turned away.'
      });
    }

    /* worst first */
    var order = { error: 0, warn: 1 };
    findings.sort(function (a, b) { return order[a.level] - order[b.level]; });
    return findings;
  }

  /** Convenience: would `detect` block a save? */
  function hasBlockingConflict(findings) {
    return findings.some(function (f) { return f.level === 'error'; });
  }

  App.Scheduling = {
    BLOCKING_EVENT_TYPES: BLOCKING_EVENT_TYPES,
    overlaps: overlaps,
    span: span,
    holdsRoom: holdsRoom,
    isBlocking: isBlocking,
    reservationsOnDate: reservationsOnDate,
    eventsOnDate: eventsOnDate,
    blockedRoomsOnDate: blockedRoomsOnDate,
    occupancy: occupancy,
    occupancySeries: occupancySeries,
    arrivals: arrivals,
    departures: departures,
    isRoomFree: isRoomFree,
    availableRooms: availableRooms,
    detect: detect,
    hasBlockingConflict: hasBlockingConflict
  };
})(window.App = window.App || {});
