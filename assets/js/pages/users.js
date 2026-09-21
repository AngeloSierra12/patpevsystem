/* ============================================================================
 * users.js — User Management
 * Angelo Andrei P. Sierra — Frontend and UI/UX Developer
 *
 * Charter deliverable: "A module that allows administrators to manage user
 * accounts, assign user roles, control user permissions, and update user
 * information."
 *
 * All four are here. The three that write — create, update, deactivate —
 * show the exact row they would send rather than reporting a save that did
 * not happen. There is no API yet, and a form that lies about saving is worse
 * than one that is honest about waiting.
 * ========================================================================== */
(function (App) {
  'use strict';
  var S = App.Shell;
  var Q = App.Q;

  var q = '', roleFilter = 'all';

  /* the schema's four roles, with what each is for */
  var ROLES = [
    ['ADMIN',         'Administrator', 'Full access, including user management'],
    ['STAFF_HOSTEL',  'Hostel Staff',  'Reservations, guests, check-in and payments'],
    ['STAFF_CANTEEN', 'Canteen Staff', 'Inventory, suppliers and deliveries'],
    ['GUEST',         'Guest',         'Own profile and own bookings only']
  ];

  /* What each role may do. This is the reference the permission rules will be
     written against; enforcing it is authentication work, not this screen. */
  var MATRIX = [
    ['Reservations',        ['full', 'full', 'none', 'own']],
    ['Guest records',       ['full', 'full', 'none', 'own']],
    ['Payments and billing',['full', 'full', 'none', 'view']],
    ['Canteen inventory',   ['full', 'view', 'full', 'none']],
    ['Suppliers, deliveries',['full', 'none', 'full', 'none']],
    ['Reports',             ['full', 'view', 'view', 'none']],
    ['User management',     ['full', 'none', 'none', 'none']],
    ['Audit trail',         ['full', 'none', 'none', 'none']]
  ];

  document.addEventListener('DOMContentLoaded', function () {
    S.mount({ title: 'User Management', nav: 'users' });

    S.el('#notice').innerHTML =
      '<div class="note note--flat">' +
        '<span class="note__icon">' + S.icon('info', 15) + '</span>' +
        '<div>This screen is the <strong>user dashboard</strong>: it lists and ' +
        'filters the accounts on file, and assigns roles. Sign-in itself and ' +
        'the enforcement of these permissions are separate tasks.</div>' +
      '</div>';

    var search = S.el('#q'), timer;
    search.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { q = search.value.trim().toLowerCase(); render(); }, 150);
    });
    S.el('#fRole').addEventListener('change', function (e) {
      roleFilter = e.target.value; render();
    });
    S.el('#btnAdd').addEventListener('click', function () { form(null); });
    S.el('#btnRoles').addEventListener('click', permissions);

    render();
  });

  function visible() {
    return App.DB.users.filter(function (u) {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return [u.full_name, u.username, u.department, u.email]
        .join(' ').toLowerCase().indexOf(q) !== -1;
    });
  }

  var COLUMNS = [
    { head: 'User', cell: function (u) {
      return '<div class="who-cell">' +
        '<span class="avatar">' + S.esc(S.initials(u.full_name)) + '</span>' +
        '<div><div class="who-cell__name">' + S.esc(u.full_name) + '</div>' +
        '<div class="who-cell__sub">' + S.esc(u.username) + '</div></div></div>';
    } },
    { head: 'Role', cell: function (u) { return S.esc(Q.roleLabel(u.role)); } },
    { head: 'Department', cell: function (u) { return S.esc(u.department || '—'); } },
    { head: 'Status', cell: function (u) {
      var on = u.is_active === 1;
      return '<span class="tag tag--' + (on ? 'ok' : 'warn') + '">' +
        '<span class="tag__dot"></span>' + (on ? 'Active' : 'Inactive') + '</span>';
    } },
    { head: 'Last sign-in', cls: 'mono', cell: function (u) {
      return S.esc(u.last_login_at || '—');
    } },
    { head: 'Actions', cls: 'table__act', cell: function (u) {
      return '<button class="btn btn--sm" data-view="' + u.user_id + '">View</button> ' +
             '<button class="btn btn--sm" data-edit="' + u.user_id + '">Edit</button>';
    } }
  ];

  function render() {
    var all = App.DB.users, list = visible();
    var counts = {};
    all.forEach(function (u) { counts[u.role] = (counts[u.role] || 0) + 1; });

    S.meta([['Accounts', all.length],
            ['Admin', counts.ADMIN || 0],
            ['Hostel', counts.STAFF_HOSTEL || 0],
            ['Canteen', counts.STAFF_CANTEEN || 0],
            ['Guest', counts.GUEST || 0]]);

    S.el('#count').textContent =
      list.length === all.length ? all.length + ' accounts'
                                 : list.length + ' of ' + all.length;

    var body = S.el('#rows');
    body.innerHTML = S.table(COLUMNS, list, 'No account matches that search.');

    S.els('[data-view]', body).forEach(function (b) {
      b.addEventListener('click', function () { detail(Number(b.dataset.view)); });
    });
    S.els('[data-edit]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        form(Q.one(App.DB.users, 'user_id', Number(b.dataset.edit)));
      });
    });
  }

  /* ---------------------------------------------------------------------- *
   * Create and update.
   * -------------------------------------------------------------------- */
  function form(user) {
    var editing = !!user;
    var u = user || {};

    var body =
      '<div class="row">' +
        field('Full name', 'full_name', u.full_name, 'text', true) +
        field('Username', 'username', u.username, 'text', true) +
      '</div>' +
      '<div class="row">' +
        field('Email', 'email', u.email, 'email', true) +
        field('Contact number', 'phone', u.phone, 'text', false) +
      '</div>' +
      field('Department', 'department', u.department, 'text', false) +
      '<div class="row">' +
        '<div class="field">' +
          '<label class="field__label" for="role">Role</label>' +
          '<select class="select" id="role" name="role">' +
            ROLES.map(function (r) {
              return '<option value="' + r[0] + '"' +
                (u.role === r[0] ? ' selected' : '') + '>' + S.esc(r[1]) + '</option>';
            }).join('') +
          '</select>' +
          '<div class="field__hint">Decides what this account may see and do.</div>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="is_active">Status</label>' +
          '<select class="select" id="is_active" name="is_active">' +
            '<option value="1"' + (u.is_active !== 0 ? ' selected' : '') + '>Active</option>' +
            '<option value="0"' + (u.is_active === 0 ? ' selected' : '') + '>Inactive</option>' +
          '</select>' +
          '<div class="field__hint">Accounts are deactivated, never deleted, so the ' +
            'audit trail keeps its actor.</div>' +
        '</div>' +
      '</div>' +
      (editing ? '' :
        '<div class="field">' +
          '<label class="field__label" for="password">Temporary password</label>' +
          '<input class="input" type="text" id="password" name="password" ' +
            'autocomplete="off" placeholder="The user changes this on first sign-in">' +
          '<div class="field__hint">Stored as a bcrypt hash by the API, never in ' +
            'plain text and never in this browser.</div>' +
        '</div>') +
      '<div id="uOut"></div>';

    S.dialog({
      title: editing ? 'Edit ' + u.full_name : 'Add user',
      body: body,
      okText: editing ? 'Update account' : 'Create account',
      onOk: function (root) {
        var v = S.readForm(root);
        var errs = {};
        if (!v.full_name) errs.full_name = 'A name is required.';
        if (!v.username) errs.username = 'A username is required.';
        else if (!/^[a-z0-9_]{3,50}$/.test(v.username)) {
          errs.username = 'Lower case letters, numbers and underscore, 3 to 50 characters.';
        } else {
          var clash = App.DB.users.filter(function (x) {
            return x.username === v.username && x.user_id !== u.user_id;
          })[0];
          if (clash) errs.username = 'That username is already taken.';
        }
        if (!v.email) errs.email = 'An email address is required.';
        else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) {
          errs.email = 'That does not look like an email address.';
        }
        if (!S.markErrors(root, errs)) return false;

        var record = {
          full_name: v.full_name,
          username: v.username,
          email: v.email,
          phone: v.phone || null,
          department: v.department || null,
          role: v.role,
          is_active: Number(v.is_active)
        };
        if (editing) record.user_id = u.user_id;

        S.el('#uOut', root).innerHTML = S.wouldWrite(
          'users', record,
          editing
            ? 'Validated. This is the row that would replace user ' + u.user_id +
              '. Saving needs the API layer, which is a separate task.'
            : 'Validated. This is the row that would be written, with ' +
              'password_hash added server side. Saving needs the API layer.');
        S.el('#uOut', root).scrollIntoView({ block: 'nearest' });
        return false;   // keep the dialog open so the record can be read
      }
    });
  }

  function field(label, name, value, type, required) {
    return '<div class="field">' +
      '<label class="field__label" for="' + name + '">' + S.esc(label) +
        (required ? '' : ' <span class="muted">optional</span>') + '</label>' +
      '<input class="input" type="' + type + '" id="' + name + '" name="' + name +
        '" value="' + S.esc(value || '') + '">' +
    '</div>';
  }

  /* ---------------------------------------------------------------------- *
   * Read-only detail.
   * -------------------------------------------------------------------- */
  function detail(id) {
    var u = Q.one(App.DB.users, 'user_id', id);
    if (!u) return;
    var on = u.is_active === 1;
    var role = ROLES.filter(function (r) { return r[0] === u.role; })[0] || [];

    S.dialog({
      title: u.full_name,
      cancelText: 'Close',
      body:
        '<div style="display:flex;align-items:center;gap:13px;margin-bottom:14px">' +
          '<span class="avatar avatar--lg">' + S.esc(S.initials(u.full_name)) + '</span>' +
          '<div><div style="font-size:15px;font-weight:600">' + S.esc(u.full_name) + '</div>' +
          '<div class="metric__note">' + S.esc(Q.roleLabel(u.role)) + ' · ' +
          S.esc(role[2] || '') + '</div></div>' +
        '</div>' +
        '<div class="kv">' +
          kv('Account number', String(u.user_id)) +
          kv('Username', S.esc(u.username)) +
          kv('Email', S.esc(u.email)) +
          kv('Contact', S.esc(u.phone || '—')) +
          kv('Department', S.esc(u.department || '—')) +
          kv('Status', '<span class="tag tag--' + (on ? 'ok' : 'warn') + '">' +
            (on ? 'Active' : 'Inactive') + '</span>') +
          kv('Created', '<span class="mono">' + S.esc(u.created_at || '—') + '</span>') +
          kv('Last sign-in', '<span class="mono">' + S.esc(u.last_login_at || '—') + '</span>') +
        '</div>'
    });
  }

  function kv(k, v) {
    return '<div class="kv__k">' + S.esc(k) + '</div><div>' + v + '</div>';
  }

  /* ---------------------------------------------------------------------- *
   * Role permissions.
   *
   * The reference the access rules get written against. Showing it as a grid
   * makes the gaps obvious: a canteen account has no business in the audit
   * trail, and a guest has no business in anyone else's booking.
   * -------------------------------------------------------------------- */
  function permissions() {
    var LEVEL = {
      full: ['ok', 'Full'], view: ['info', 'View'],
      own:  ['warn', 'Own only'], none: ['', '—']
    };

    S.dialog({
      title: 'Role permissions',
      cancelText: 'Close',
      body:
        '<div class="note note--flat" style="margin-bottom:12px">' +
          '<span class="note__icon">' + S.icon('info', 15) + '</span>' +
          '<div>What each role is intended to reach. This is the reference the ' +
          'access rules are written against; enforcing it is authentication ' +
          'work and is not built yet.</div></div>' +
        '<div class="tablewrap"><table class="table"><thead><tr>' +
          '<th>Area</th>' + ROLES.map(function (r) {
            return '<th>' + S.esc(r[1]) + '</th>';
          }).join('') +
        '</tr></thead><tbody>' +
        MATRIX.map(function (row) {
          return '<tr><td data-label="Area">' + S.esc(row[0]) + '</td>' +
            row[1].map(function (lv, i) {
              var l = LEVEL[lv];
              return '<td data-label="' + S.esc(ROLES[i][1]) + '">' +
                (l[0] ? '<span class="tag tag--' + l[0] + '">' + l[1] + '</span>'
                      : '<span class="muted">' + l[1] + '</span>') + '</td>';
            }).join('') + '</tr>';
        }).join('') +
        '</tbody></table></div>'
    });
  }
})(window.App = window.App || {});
