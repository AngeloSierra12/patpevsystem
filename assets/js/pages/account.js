/* ============================================================================
 * account.js — My Account
 * Angelo Andrei P. Sierra — Frontend and UI/UX Developer
 *
 * The signed-in person's own view of their account: their details, what their
 * role lets them reach, and their recent activity out of the audit trail.
 *
 * There is no sign-in yet, so the shell runs as one fixed account read from
 * the users table. Changing a password is deliberately not offered here: it
 * needs the authentication layer, and a form that took a password and threw
 * it away would be worse than no form.
 * ========================================================================== */
(function (App) {
  'use strict';
  var S = App.Shell;
  var Q = App.Q;

  /* what each role reaches — the same reference the User Management screen
     shows, kept in step with it by hand until the rules are real */
  var MATRIX = {
    ADMIN: [
      ['Reservations and guests', 'Full'],
      ['Payments and billing', 'Full'],
      ['Canteen inventory', 'Full'],
      ['Suppliers and deliveries', 'Full'],
      ['Reports', 'Full'],
      ['User management', 'Full'],
      ['Audit trail', 'Full']
    ],
    STAFF_HOSTEL: [
      ['Reservations and guests', 'Full'],
      ['Payments and billing', 'Full'],
      ['Canteen inventory', 'View only'],
      ['Suppliers and deliveries', 'No access'],
      ['Reports', 'View only'],
      ['User management', 'No access'],
      ['Audit trail', 'No access']
    ],
    STAFF_CANTEEN: [
      ['Reservations and guests', 'No access'],
      ['Payments and billing', 'No access'],
      ['Canteen inventory', 'Full'],
      ['Suppliers and deliveries', 'Full'],
      ['Reports', 'View only'],
      ['User management', 'No access'],
      ['Audit trail', 'No access']
    ],
    GUEST: [
      ['Own bookings', 'Full'],
      ['Own profile', 'Full'],
      ['Payments and billing', 'View own only'],
      ['Canteen inventory', 'No access'],
      ['Reports', 'No access'],
      ['User management', 'No access'],
      ['Audit trail', 'No access']
    ]
  };

  var TAG = {
    'Full': 'ok', 'View only': 'info', 'View own only': 'warn',
    'No access': '', 'Own bookings': 'ok'
  };

  document.addEventListener('DOMContentLoaded', function () {
    S.mount({ title: 'My Account', nav: 'account' });

    var me = Q.me();
    S.meta([['Signed in as', me.full_name],
            ['Role', Q.roleLabel(me.role)],
            'no sign-in yet']);

    profile(me);
    access(me);
  });

  function profile(me) {
    S.el('#profile').innerHTML =
      '<div style="display:flex;align-items:center;gap:13px;margin-bottom:14px">' +
        '<span class="avatar avatar--lg">' + S.esc(S.initials(me.full_name)) + '</span>' +
        '<div>' +
          '<div style="font-size:15px;font-weight:600">' + S.esc(me.full_name) + '</div>' +
          '<div class="metric__note">' + S.esc(me.email || '') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="kv">' +
        kv('Account number', String(me.user_id)) +
        kv('Username', S.esc(me.username || '')) +
        kv('Role', S.esc(Q.roleLabel(me.role))) +
        kv('Department', S.esc(me.department || '—')) +
        kv('Contact', S.esc(me.phone || '—')) +
        kv('Account created', '<span class="mono">' + S.esc(me.created_at || '—') + '</span>') +
        kv('Last sign-in', '<span class="mono">' + S.esc(me.last_login_at || '—') + '</span>') +
      '</div>' +
      '<div class="note note--flat" style="margin-top:14px">' +
        '<span class="note__icon">' + S.icon('info', 15) + '</span>' +
        '<div>Changing a password needs the authentication layer, which is a ' +
        'separate task. Until it exists there is no password form here, because ' +
        'one that accepted a password and discarded it would be worse than none. ' +
        'Ask an administrator to reset it meanwhile.</div>' +
      '</div>';
  }

  function access(me) {
    var rows = MATRIX[me.role] || [];

    S.el('#access').innerHTML =
      '<div class="metric__note" style="margin-bottom:10px">' +
        'What a <strong>' + S.esc(Q.roleLabel(me.role)) + '</strong> account is ' +
        'intended to reach. These rules are not enforced yet, so every screen ' +
        'is currently reachable regardless of what this says.' +
      '</div>' +
      rows.map(function (r) {
        var tag = TAG[r[1]];
        return '<div class="rowitem" style="padding:6px 0">' +
          '<span class="rowitem__main"><span class="rowitem__title" ' +
            'style="font-weight:400">' + S.esc(r[0]) + '</span></span>' +
          (tag ? '<span class="tag tag--' + tag + '">' + S.esc(r[1]) + '</span>'
               : '<span class="muted">' + S.esc(r[1]) + '</span>') +
        '</div>';
      }).join('') +
      recent(me);
  }

  /* the audit trail already records what this account has done */
  function recent(me) {
    var mine = Q.auditLog().filter(function (r) {
      return r.user_id === me.user_id;
    }).slice(0, 6);

    if (!mine.length) return '';

    return '<div class="label" style="margin-top:16px">My recent activity</div>' +
      mine.map(function (r) {
        return '<div class="rowitem" style="padding:6px 0;border-bottom:none">' +
          '<span class="rowitem__main">' +
            '<span class="rowitem__title" style="font-weight:400">' +
              S.esc(Q.actionLabel(r.action_type)) + '</span>' +
            '<span class="rowitem__sub">' + S.esc(r.description || '') + '</span>' +
          '</span>' +
          '<span class="rowitem__end mono" style="font-weight:400;font-size:10.5px">' +
            S.esc(String(r.logged_at).slice(0, 10)) + '</span>' +
        '</div>';
      }).join('');
  }

  function kv(k, v) {
    return '<div class="kv__k">' + S.esc(k) + '</div><div>' + v + '</div>';
  }
})(window.App = window.App || {});
