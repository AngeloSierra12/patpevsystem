/* ============================================================================
 * wireframes.js — UI wireframe deliverables
 * ----------------------------------------------------------------------------
 * WBS 2.1 (User Management) | 5.1 (Scheduling & Calendar) | 7.1 (Dashboard)
 * OWNER: Angelo Andrei P. Sierra — Frontend & UI/UX Developer
 *
 * Low-fidelity wireframes drawn as inline SVG. They are kept inside the running
 * system rather than in a separate image file so that the design intent and the
 * built screen can be compared side by side, and so the wireframes cannot drift
 * out of the repository.
 *
 * Deliberately low fidelity: grey blocks and labels, no colour and no real
 * data, because a wireframe is about layout, hierarchy and flow — decisions
 * about colour and type belong to the design system in app.css.
 * ========================================================================== */
(function (App) {
  'use strict';

  var esc = App.Dom.esc;

  /* --- drawing primitives -------------------------------------------------- */
  var FILL = '#e8edf3', FILL_2 = '#f3f6fa', STROKE = '#b0bece', TEXT = '#5a6b80';

  function box(x, y, w, h, label, o) {
    o = o || {};
    var out = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
      '" rx="' + (o.r == null ? 3 : o.r) + '" fill="' + (o.fill || FILL) +
      '" stroke="' + (o.stroke || STROKE) + '" stroke-width="1"' +
      (o.dash ? ' stroke-dasharray="4 3"' : '') + '/>';
    if (label) {
      out += text(x + (o.align === 'center' ? w / 2 : 8),
                  y + h / 2 + 3.5, label,
                  { anchor: o.align === 'center' ? 'middle' : 'start',
                    size: o.size || 10, weight: o.weight });
    }
    return out;
  }

  function text(x, y, s, o) {
    o = o || {};
    return '<text x="' + x + '" y="' + y + '" font-size="' + (o.size || 10) +
      '" fill="' + (o.fill || TEXT) + '" font-family="Fira Sans, sans-serif"' +
      (o.weight ? ' font-weight="' + o.weight + '"' : '') +
      (o.anchor ? ' text-anchor="' + o.anchor + '"' : '') + '>' + esc(s) + '</text>';
  }

  /* stack of grey lines standing in for body copy */
  function lines(x, y, w, count, gap) {
    var out = '';
    for (var i = 0; i < count; i++) {
      var lw = i === count - 1 ? w * 0.6 : w;
      out += '<rect x="' + x + '" y="' + (y + i * (gap || 7)) + '" width="' + lw +
             '" height="3" rx="1.5" fill="' + STROKE + '" opacity=".55"/>';
    }
    return out;
  }

  /* numbered annotation marker matching the notes under each frame */
  function marker(x, y, n) {
    return '<circle cx="' + x + '" cy="' + y + '" r="8.5" fill="#1e40af"/>' +
      '<text x="' + x + '" y="' + (y + 3.3) + '" font-size="9.5" font-weight="600" ' +
      'fill="#fff" text-anchor="middle" font-family="Fira Code, monospace">' + n + '</text>';
  }

  function svg(w, h, inner, label) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" ' +
      'style="max-width:' + w + 'px;display:block;margin:0 auto" role="img" ' +
      'aria-label="' + esc(label) + '">' +
      '<rect width="' + w + '" height="' + h + '" fill="#fff"/>' + inner + '</svg>';
  }

  /* app chrome shared by all three wireframes */
  function chrome(w, h, title) {
    return box(0, 0, 132, h, '', { fill: '#dde4ec', r: 0 }) +
      text(12, 22, 'LOGO', { size: 9, weight: 600 }) +
      text(12, 44, 'NAVIGATION', { size: 7.5, weight: 600 }) +
      box(8, 52, 116, 16, 'Dashboard', { fill: '#c3cfdd', size: 8.5 }) +
      box(8, 72, 116, 16, 'Calendar', { fill: '#eaeff5', size: 8.5 }) +
      box(8, 92, 116, 16, 'User Management', { fill: '#eaeff5', size: 8.5 }) +
      box(8, 112, 116, 16, 'Other modules', { fill: '#eaeff5', size: 8.5 }) +
      box(132, 0, w - 132, 40, '', { fill: FILL_2, r: 0 }) +
      text(144, 18, title, { size: 10.5, weight: 600, fill: '#2c3a4d' }) +
      text(144, 30, 'breadcrumb / context', { size: 8 }) +
      box(w - 210, 10, 92, 20, 'role selector', { fill: '#fff', size: 8, align: 'center' }) +
      box(w - 108, 10, 96, 20, 'signed-in user', { fill: '#fff', size: 8, align: 'center' });
  }

  /* ===================================================================== *
   * WBS 7.1 — Dashboard wireframe
   * ===================================================================== */
  function dashboardWireframe() {
    var W = 900, H = 540, g = '';

    g += chrome(W, H, 'Operations Dashboard');
    g += text(144, 60, 'PAGE TITLE + ONE-LINE PURPOSE', { size: 9, weight: 600 });
    g += box(W - 200, 52, 88, 22, 'secondary', { fill: '#fff', size: 8, align: 'center' });
    g += box(W - 106, 52, 94, 22, 'primary action', { fill: '#c3cfdd', size: 8, align: 'center' });

    /* KPI row */
    for (var i = 0; i < 4; i++) {
      var x = 144 + i * 189;
      g += box(x, 86, 177, 66, '', { fill: '#fff' });
      g += '<rect x="' + x + '" y="86" width="3" height="66" fill="#9aabbf"/>';
      g += text(x + 12, 104, 'METRIC LABEL', { size: 7.5, weight: 600 });
      g += '<rect x="' + (x + 12) + '" y="112" width="46" height="16" rx="2" fill="' + STROKE + '"/>';
      g += text(x + 12, 142, 'supporting figure', { size: 7.5 });
    }
    g += marker(150, 92, 1);

    /* occupancy chart */
    g += box(144, 164, 500, 168, '', { fill: '#fff' });
    g += text(156, 182, 'HOSTEL OCCUPANCY, NEXT 7 DAYS', { size: 8.5, weight: 600 });
    g += text(156, 194, 'rooms held per night', { size: 7.5 });
    for (var b = 0; b < 7; b++) {
      var bh = [58, 70, 48, 62, 40, 52, 34][b];
      g += box(176 + b * 66, 308 - bh, 40, bh, '', { fill: '#c3cfdd', r: 2 });
      g += text(196 + b * 66, 322, ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][b],
                { size: 7.5, anchor: 'middle' });
    }
    g += marker(150, 170, 2);

    /* quick actions */
    g += box(656, 164, 232, 168, '', { fill: '#fff' });
    g += text(668, 182, 'QUICK ACTIONS', { size: 8.5, weight: 600 });
    g += text(668, 194, 'filtered by role', { size: 7.5 });
    for (var q = 0; q < 6; q++) {
      var qx = 668 + (q % 2) * 108, qy = 204 + Math.floor(q / 2) * 40;
      g += box(qx, qy, 100, 32, '', { fill: FILL_2 });
      g += box(qx + 6, qy + 6, 20, 20, '', { fill: '#c3cfdd', r: 4 });
      g += lines(qx + 32, qy + 11, 58, 2, 7);
    }
    g += marker(662, 170, 3);

    /* stock + alerts */
    g += box(144, 344, 500, 180, '', { fill: '#fff' });
    g += text(156, 362, 'CANTEEN STOCK LEVELS', { size: 8.5, weight: 600 });
    for (var s = 0; s < 6; s++) {
      var sy = 378 + s * 23;
      g += lines(156, sy, 120, 1);
      g += box(300, sy - 4, 320, 7, '', { fill: FILL_2, r: 3.5 });
      g += box(300, sy - 4, [250, 180, 120, 90, 60, 30][s], 7, '', { fill: '#9aabbf', r: 3.5 });
    }
    g += marker(150, 350, 4);

    g += box(656, 344, 232, 180, '', { fill: '#fff' });
    g += text(668, 362, 'LOW STOCK ALERTS', { size: 8.5, weight: 600 });
    for (var a = 0; a < 5; a++) {
      var ay = 376 + a * 28;
      g += '<circle cx="674" cy="' + (ay + 8) + '" r="3.5" fill="#9aabbf"/>';
      g += lines(686, ay + 4, 130, 2, 8);
      g += box(852, ay + 2, 24, 12, '', { fill: '#c3cfdd', r: 2 });
    }
    g += marker(662, 350, 5);

    return svg(W, H, g, 'Dashboard wireframe');
  }

  /* ===================================================================== *
   * WBS 5.1 — Scheduling & Calendar wireframe
   * ===================================================================== */
  function calendarWireframe() {
    var W = 900, H = 560, g = '';

    g += chrome(W, H, 'Scheduling & Calendar');
    g += text(144, 60, 'PAGE TITLE + PURPOSE', { size: 9, weight: 600 });
    g += box(W - 200, 52, 60, 22, 'Today', { fill: '#fff', size: 8, align: 'center' });
    g += box(W - 134, 52, 122, 22, '+ Add schedule entry',
             { fill: '#c3cfdd', size: 8, align: 'center' });

    /* toolbar */
    g += box(144, 86, 500, 36, '', { fill: '#fff' });
    g += box(154, 94, 22, 20, '<', { fill: FILL_2, size: 9, align: 'center' });
    g += box(178, 94, 22, 20, '>', { fill: FILL_2, size: 9, align: 'center' });
    g += text(210, 108, 'September 2026', { size: 9.5, weight: 600 });
    g += box(400, 94, 70, 20, 'Month', { fill: '#c3cfdd', size: 8, align: 'center' });
    g += box(472, 94, 84, 20, 'Timeline', { fill: FILL_2, size: 8, align: 'center' });
    g += box(564, 94, 70, 20, 'filter', { fill: '#fff', size: 8, align: 'center' });
    g += marker(150, 92, 1);

    /* month grid */
    g += box(144, 130, 500, 250, '', { fill: '#fff' });
    var dows = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    for (var d = 0; d < 7; d++) {
      g += box(144 + d * 71.4, 130, 71.4, 20, dows[d],
               { fill: FILL_2, size: 8, align: 'center', r: 0 });
    }
    for (var c = 0; c < 28; c++) {
      var cx = 144 + (c % 7) * 71.4, cy = 150 + Math.floor(c / 7) * 57.5;
      var isToday = c === 10;
      g += box(cx, cy, 71.4, 57.5, '', { fill: isToday ? '#dbe3ec' : '#fff', r: 0 });
      g += text(cx + 6, cy + 13, String((c % 30) + 1), { size: 8, weight: 600 });
      g += text(cx + 62, cy + 13, '4/22', { size: 6.5, anchor: 'end' });
      if (c % 3 !== 1) {
        g += box(cx + 4, cy + 18, 63, 9, '', { fill: '#c3cfdd', r: 2 });
        g += box(cx + 4, cy + 30, 63, 9, '', { fill: '#d6dfe9', r: 2 });
      }
      if (c % 5 === 0) g += text(cx + 6, cy + 50, '+2 more', { size: 6.5 });
    }
    g += marker(150, 136, 2);

    /* right panel */
    g += box(656, 130, 232, 170, '', { fill: '#fff' });
    g += text(668, 148, 'SELECTED DAY', { size: 8.5, weight: 600 });
    g += text(668, 160, 'arrivals / departures / activities', { size: 7 });
    for (var p = 0; p < 4; p++) {
      var py = 170 + p * 30;
      g += '<rect x="668" y="' + py + '" width="3" height="22" rx="1.5" fill="#9aabbf"/>';
      g += lines(678, py + 5, 190, 2, 9);
    }
    g += marker(662, 136, 3);

    g += box(656, 310, 232, 130, '', { fill: '#fff' });
    g += text(668, 328, 'AVAILABILITY CHECK', { size: 8.5, weight: 600 });
    g += text(668, 340, 'rooms free per night', { size: 7 });
    for (var av = 0; av < 10; av++) {
      g += box(668 + av * 21.5, 350, 19, 26, '', { fill: av > 6 ? '#d9c4c4' : '#cfdccf', r: 2 });
    }
    g += lines(668, 392, 200, 3, 9);
    g += marker(662, 316, 4);

    /* timeline preview */
    g += box(144, 392, 500, 132, '', { fill: '#fff' });
    g += text(156, 410, 'ALTERNATE VIEW: ROOM OCCUPANCY TIMELINE', { size: 8.5, weight: 600 });
    g += box(156, 418, 90, 14, 'Room', { fill: FILL_2, size: 7 });
    for (var dh = 0; dh < 10; dh++) {
      g += box(248 + dh * 38, 418, 36, 14, String(dh + 12),
               { fill: FILL_2, size: 6.5, align: 'center' });
    }
    for (var rw = 0; rw < 5; rw++) {
      var ry = 436 + rw * 17;
      g += box(156, ry, 90, 15, '10' + (rw + 1) + 'S', { fill: '#fff', size: 7 });
      var bx = 248 + [0, 2, 1, 4, 3][rw] * 38;
      var bw = [3, 2, 4, 2, 3][rw] * 38 - 4;
      g += box(bx, ry + 2, bw, 11, 'booking', { fill: '#9aabbf', size: 6.5, align: 'center', r: 2 });
    }
    g += marker(150, 398, 5);

    return svg(W, H, g, 'Scheduling and calendar wireframe');
  }

  /* ===================================================================== *
   * WBS 2.1 — User Management wireframe
   * ===================================================================== */
  function usersWireframe() {
    var W = 900, H = 540, g = '';

    g += chrome(W, H, 'User Management');
    g += text(144, 60, 'PAGE TITLE + PURPOSE', { size: 9, weight: 600 });
    g += box(W - 218, 52, 106, 22, 'Permission matrix',
             { fill: '#fff', size: 8, align: 'center' });
    g += box(W - 106, 52, 94, 22, '+ Add user', { fill: '#c3cfdd', size: 8, align: 'center' });

    /* role summary */
    for (var r = 0; r < 3; r++) {
      var rx = 144 + r * 252;
      g += box(rx, 86, 240, 78, '', { fill: '#fff' });
      g += box(rx + 12, 98, 22, 22, '', { fill: '#c3cfdd', r: 4 });
      g += text(rx + 42, 113, ['ADMINISTRATOR', 'STAFF', 'GUEST'][r], { size: 8.5, weight: 600 });
      g += text(rx + 228, 113, 'n accounts', { size: 7.5, anchor: 'end' });
      g += lines(rx + 12, 130, 216, 3, 8);
    }
    g += marker(150, 92, 1);

    /* filter bar */
    g += box(144, 176, 744, 40, '', { fill: '#fff' });
    g += box(156, 186, 200, 20, 'search name / username / email',
             { fill: FILL_2, size: 7.5 });
    g += box(366, 186, 90, 20, 'role filter', { fill: '#fff', size: 7.5, align: 'center' });
    g += box(464, 186, 96, 20, 'status filter', { fill: '#fff', size: 7.5, align: 'center' });
    g += text(876, 200, 'n of n accounts', { size: 7.5, anchor: 'end' });
    g += marker(150, 182, 2);

    /* table */
    g += box(144, 216, 744, 296, '', { fill: '#fff' });
    var cols = ['USER', 'ROLE', 'DEPARTMENT', 'STATUS', 'PERMISSIONS', 'LAST LOGIN', 'ACTIONS'];
    var colX = [156, 292, 360, 470, 550, 660, 800];
    g += box(144, 216, 744, 22, '', { fill: FILL_2, r: 0 });
    cols.forEach(function (c, i) {
      g += text(colX[i], 231, c, { size: 7, weight: 600 });
    });

    for (var row = 0; row < 7; row++) {
      var y = 238 + row * 38;
      g += '<line x1="144" y1="' + (y + 38) + '" x2="888" y2="' + (y + 38) +
           '" stroke="#e4eaf1"/>';
      g += '<circle cx="166" cy="' + (y + 19) + '" r="9" fill="#c3cfdd"/>';
      g += lines(182, y + 12, 88, 2, 9);
      g += box(292, y + 12, 56, 14, '', { fill: '#dbe3ec', r: 7 });
      g += lines(360, y + 12, 96, 2, 9);
      g += box(470, y + 12, 62, 14, '', { fill: '#dbe3ec', r: 7 });
      g += lines(550, y + 16, 90, 1);
      g += lines(660, y + 16, 100, 1);
      g += box(776, y + 11, 44, 16, '', { fill: FILL_2, r: 3 });
      g += box(824, y + 11, 34, 16, '', { fill: FILL_2, r: 3 });
      g += box(862, y + 11, 20, 16, '', { fill: FILL_2, r: 3 });
    }
    g += marker(150, 222, 3);
    g += marker(770, 250, 4);
    g += marker(556, 250, 5);

    return svg(W, H, g, 'User management wireframe');
  }

  /* ===================================================================== *
   * Annotations
   * ===================================================================== */
  var SECTIONS = [
    {
      id: 'wf-dashboard',
      wbs: '7.1',
      title: 'Dashboard',
      intro: 'The dashboard answers one question on entry: is anything wrong right ' +
             'now? Numbers first, detail below, actions on the right where the eye ' +
             'finishes a left-to-right scan.',
      draw: dashboardWireframe,
      caption: 'Low-fidelity layout for the operations dashboard at desktop width ' +
               '(collapses to a single column below 860px).',
      notes: [
        ['Four metric tiles, never more.', 'Occupancy, rooms free, arrivals and low ' +
          'stock are the four figures hostel staff actually act on. A fifth tile ' +
          'pushes the row to two lines and weakens the hierarchy.'],
        ['Occupancy trend gets the largest block.', 'A seven-day bar chart reads ' +
          'faster than a table for "are we filling up?", and today is highlighted ' +
          'so the reader has an anchor.'],
        ['Quick actions sit top-right.', 'Shortcuts into the modules a user is ' +
          'allowed to touch. The panel is built from the permission list, so a ' +
          'guest simply sees fewer tiles rather than disabled ones.'],
        ['Canteen stock shares the page with hostel data.', 'The charter asks for ' +
          'one platform, so hostel and canteen figures are deliberately not split ' +
          'across separate screens.'],
        ['Alerts are a list, not a chart.', 'A low-stock warning has to name the ' +
          'item and its supplier. A chart would hide exactly the detail that makes ' +
          'the alert actionable.']
      ]
    },
    {
      id: 'wf-calendar',
      wbs: '5.1',
      title: 'Scheduling &amp; Calendar',
      intro: 'Two views of the same data: a month grid for "what is happening on ' +
             'the 14th", and a room timeline for "which rooms are free next week". ' +
             'Front-desk staff need both, so the switch is one click, not a ' +
             'separate page.',
      draw: calendarWireframe,
      caption: 'Month view with the day-detail panel; the timeline view replaces ' +
               'the grid in the same container.',
      notes: [
        ['View switch lives in the toolbar.', 'Month and Timeline are peers, not ' +
          'separate pages, so the date position and filters survive the switch.'],
        ['Each day cell shows a load figure.', 'A small "4/22" in the corner means ' +
          'a staff member can judge availability without opening the day.'],
        ['The detail panel never overlaps the calendar.', 'Clicking a day fills the ' +
          'right column instead of opening a modal, so the reader keeps their place ' +
          'in the month.'],
        ['Availability strip supports planning ahead.', 'Ten days of free-room counts ' +
          'answer the walk-in question, "do you have anything next week?"'],
        ['Timeline rows are rooms, columns are days.', 'This is the view that makes ' +
          'a double-booking visible as two bars in one row, which is the failure ' +
          'the charter names as the top project risk.']
      ]
    },
    {
      id: 'wf-users',
      wbs: '2.1',
      title: 'User Management',
      intro: 'An administrator screen. The priority is being able to find one ' +
             'account quickly and see, without clicking, what that account is ' +
             'allowed to do.',
      draw: usersWireframe,
      caption: 'Account list with role summary above and per-row actions on the ' +
               'right.',
      notes: [
        ['Role cards explain before they count.', 'Placing the three roles and their ' +
          'descriptions above the table means an administrator assigning a role ' +
          'reads what it means first.'],
        ['Search, role and status filters together.', 'These are the three ways staff ' +
          'actually look for an account: by name, by what they are, and by whether ' +
          'they still have access.'],
        ['One row per account, seven columns.', 'Identity, role, department, status, ' +
          'permission deviation, last login, actions. Anything more and the table ' +
          'scrolls sideways on a laptop.'],
        ['Actions are per row, not a bulk toolbar.', 'Account changes are ' +
          'deliberate, single decisions. Bulk editing permissions is how a system ' +
          'ends up with a guest holding admin rights.'],
        ['A permissions column, not just a role.', 'Accounts often need one extra ' +
          'permission. Showing "+1 granted" or "−1 revoked" in the list means an ' +
          'exception is visible from the table instead of buried in a dialog.']
      ]
    }
  ];

  /* --- render -------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    var user = App.Shell.mount({
      title: 'UI Wireframes',
      crumb: 'Layout studies for the built screens',
      nav: 'wireframes',
      requires: 'dashboard.view'
    });
    if (!user) return;

    document.getElementById('wfNav').innerHTML = SECTIONS.map(function (s) {
      return '<a class="btn btn--sm" href="#' + s.id + '">' +
             s.title + '</a>';
    }).join('');

    document.getElementById('wfBody').innerHTML = SECTIONS.map(function (s) {
      return '' +
        '<section class="wf-section card" id="' + s.id + '">' +
          '<div class="card__head">' +
            '<div>' +
              '<div class="card__title">' + s.title + '</div>' +
              '<div class="card__sub">' + esc(s.intro) + '</div>' +
            '</div>' +

          '</div>' +
          '<div class="card__body">' +
            '<div class="wf-frame">' + s.draw() + '</div>' +
            '<p class="wf-caption">' + esc(s.caption) + '</p>' +
            '<div class="wf-annot">' +
              s.notes.map(function (n, i) {
                return '<div class="wf-annot__item">' +
                  '<span class="wf-annot__num">' + (i + 1) + '</span>' +
                  '<span class="wf-annot__text"><strong>' + esc(n[0]) + '</strong> ' +
                    esc(n[1]) + '</span>' +
                '</div>';
              }).join('') +
            '</div>' +
          '</div>' +
        '</section>';
    }).join('');

    App.Shell.setMeta([
      ['Frames', SECTIONS.length],
      ['Annotations', SECTIONS.reduce(function (n, s) { return n + s.notes.length; }, 0)],
      'low fidelity'
    ]);

    App.Shell.hydrateIcons(document);
    App.RBAC.applyTo(document, user);
  });
})(window.App = window.App || {});
