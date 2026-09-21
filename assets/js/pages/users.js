/* ============================================================================
 * users.js — User Management
 *
 * WBS 3.4 User Dashboard ....... Angelo Andrei P. Sierra   (this file)
 * WBS 3.1 UI wireframing ....... Andrew Jacob E. Santos
 * WBS 3.3 Role based access .... Andrew Jacob E. Santos    (placeholder)
 * WBS 3.2 Authentication ....... John Carlos R. Capuli
 *
 * Reads the users table. Creating, editing and deleting accounts, and the
 * rules deciding what each role may do, are not this developer's tasks.
 * ========================================================================== */
(function (App) {
  'use strict';
  var S = App.Shell;
  var q = '', roleFilter = 'all';

  document.addEventListener('DOMContentLoaded', function () {
    S.mount({ title: 'User Management', nav: 'users' });

    S.el('#notice').innerHTML =
      '<div class="note note--flat">' +
        '<span class="note__icon">' + S.icon('info', 15) + '</span>' +
        '<div>This screen is the <strong>user dashboard</strong>: it lists and ' +
        'filters the accounts on file. Sign-in and the role permission rules ' +
        'are separate tasks.</div>' +
      '</div>';

    var search = S.el('#q');
    var timer;
    search.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        q = search.value.trim().toLowerCase();
        render();
      }, 150);
    });
    S.el('#fRole').addEventListener('change', function (e) {
      roleFilter = e.target.value;
      render();
    });

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
    { head: 'Role', cell: function (u) { return S.esc(App.Q.roleLabel(u.role)); } },
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
      return '<button class="btn btn--sm" data-view="' + u.user_id + '">View</button>';
    } }
  ];

  function render() {
    var all = App.DB.users;
    var list = visible();

    var counts = {};
    all.forEach(function (u) { counts[u.role] = (counts[u.role] || 0) + 1; });

    S.meta([
      ['Accounts', all.length],
      ['Admin', counts.ADMIN || 0],
      ['Hostel', counts.STAFF_HOSTEL || 0],
      ['Canteen', counts.STAFF_CANTEEN || 0],
      ['Guest', counts.GUEST || 0]
    ]);

    S.el('#count').textContent =
      list.length === all.length ? all.length + ' accounts'
                                 : list.length + ' of ' + all.length;

    var body = S.el('#rows');
    body.innerHTML = S.table(COLUMNS, list, 'No account matches that search.');

    S.els('[data-view]', body).forEach(function (b) {
      b.addEventListener('click', function () { show(Number(b.dataset.view)); });
    });
  }

  /* read-only detail: editing accounts is not this developer's task */
  function show(id) {
    var u = App.Q.one(App.DB.users, 'user_id', id);
    if (!u) return;
    var on = u.is_active === 1;

    S.el('#notice').innerHTML =
      '<section class="panel" style="margin-bottom:14px">' +
        '<div class="panel__head"><span class="panel__title">' +
          S.esc(u.full_name) + '</span>' +
          '<span class="panel__tools"><button class="btn btn--sm" id="closeDetail">' +
          'Close</button></span></div>' +
        '<div class="panel__body">' +
          '<div class="kv">' +
            '<div class="kv__k">Account number</div><div>' + u.user_id + '</div>' +
            '<div class="kv__k">Username</div><div>' + S.esc(u.username) + '</div>' +
            '<div class="kv__k">Email</div><div>' + S.esc(u.email) + '</div>' +
            '<div class="kv__k">Contact</div><div>' + S.esc(u.phone || '—') + '</div>' +
            '<div class="kv__k">Department</div><div>' +
              S.esc(u.department || '—') + '</div>' +
            '<div class="kv__k">Role</div><div>' +
              S.esc(App.Q.roleLabel(u.role)) + '</div>' +
            '<div class="kv__k">Active</div><div><span class="tag tag--' +
              (on ? 'ok' : 'warn') + '">' + (on ? 'Yes' : 'No') + '</span></div>' +
            '<div class="kv__k">Created</div><div class="mono">' +
              S.esc(u.created_at || '—') + '</div>' +
            '<div class="kv__k">Last sign-in</div><div class="mono">' +
              S.esc(u.last_login_at || '—') + '</div>' +
          '</div>' +
          '<div style="height:12px"></div>' +
          S.owned('Andrew Jacob E. Santos', 'Role and permission controls',
            'Assigning the role and deciding what it may do across the system.') +
        '</div>' +
      '</section>';

    S.el('#closeDetail').addEventListener('click', function () {
      S.el('#notice').innerHTML = '';
    });
    window.scrollTo(0, 0);
  }
})(window.App = window.App || {});
