/* ============================================================================
 * audit.js — Audit Trail
 *
 * WBS 7.1 UI wireframing ............ Angelo Andrei P. Sierra
 * WBS 7.2 System event logger ....... Darren Jude S. Tamayo
 * WBS 7.3 Log search and archiving .. Darren Jude S. Tamayo
 *
 * This developer's task on this screen is the wireframe only, which is
 * delivered as part of the wireframe document. The working screen belongs to
 * the module owners named below.
 * ========================================================================== */
(function (App) {
  'use strict';
  var S = App.Shell;

  document.addEventListener('DOMContentLoaded', function () {
    S.mount({ title: 'Audit Trail', nav: 'audit' });
    S.meta([['Entries', App.DB.audit_logs.length],
            'read-only view of audit_logs']);
    S.el('#notice').innerHTML = '<div class="note note--flat">' +
      '<span class="note__icon">' + S.icon('info', 15) + '</span>' +
      '<div>The audit trail records who did what and when. The logger and ' +
      'the search behind it are a separate task.</div></div>';

    S.el('#log').innerHTML = S.table([
      { head: 'Logged at', cls: 'mono', cell: function (r) { return S.esc(r.logged_at); } },
      { head: 'User', cell: function (r) {
        return S.esc(r.username_snapshot) +
          '<div class="who-cell__sub">' + S.esc(r.role_snapshot) + '</div>';
      } },
      { head: 'Action', cell: function (r) {
        return '<code>' + S.esc(r.action_type) + '</code>';
      } },
      { head: 'Target', cls: 'mono', cell: function (r) {
        return S.esc(r.target_entity) + (r.target_id ? ' #' + r.target_id : '');
      } },
      { head: 'Description', cell: function (r) { return S.esc(r.description || ''); } }
    ], App.Q.auditLog()) +
      S.owned('Darren Jude S. Tamayo', 'Event logger, search, filtering and archiving',
        'Writing entries automatically, then searching, filtering and archiving ' +
        'them as the volume grows.');
  });
})(window.App = window.App || {});
