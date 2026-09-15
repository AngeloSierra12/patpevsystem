/* ============================================================================
 * account.js — My Account
 *
 * WBS 3.4 User dashboard ............ Angelo Andrei P. Sierra
 * WBS 3.2 Authentication ............ John Carlos R. Capuli
 * WBS 3.3 Role based access ......... Andrew Jacob E. Santos
 *
 * This developer's task on this screen is the wireframe only, which is
 * delivered as part of the wireframe document. The working screen belongs to
 * the module owners named below.
 * ========================================================================== */
(function (App) {
  'use strict';
  var S = App.Shell;

  document.addEventListener('DOMContentLoaded', function () {
    S.mount({ title: 'My Account', nav: 'account' });
    var me = App.Q.me();
    S.meta([['Signed in as', me.full_name], ['Role', App.Q.roleLabel(me.role)]]);

    S.el('#profile').innerHTML =
      '<div style="display:flex;align-items:center;gap:13px;margin-bottom:13px">' +
        '<span class="avatar avatar--lg">' + S.esc(S.initials(me.full_name)) + '</span>' +
        '<div><div style="font-size:15px;font-weight:600">' + S.esc(me.full_name) +
        '</div><div style="font-size:12px;color:var(--ink-500)">' +
        S.esc(me.email || '') + '</div></div>' +
      '</div>' +
      '<div class="kv">' +
        '<div class="kv__k">user_id</div><div><code>' + me.user_id + '</code></div>' +
        '<div class="kv__k">Username</div><div>' + S.esc(me.username || '') + '</div>' +
        '<div class="kv__k">Department</div><div>' + S.esc(me.department || '') + '</div>' +
        '<div class="kv__k">Contact</div><div>' + S.esc(me.phone || '') + '</div>' +
      '</div>';

    S.el('#access').innerHTML = S.owned(
      'Andrew Jacob E. Santos', 'Role and permissions',
      'What this account is allowed to see and do across the system.');
  });
})(window.App = window.App || {});
