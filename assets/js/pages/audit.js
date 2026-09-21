/* ============================================================================
 * audit.js — Audit Trail
 * Angelo Andrei P. Sierra — Frontend and UI/UX Developer
 *
 * Charter deliverable: "A security module that records user login history,
 * user activities, system transactions, and changes made to reservations and
 * inventory."
 *
 * This screen reads and searches that record. Writing entries is the job of
 * the database triggers, which already do it — three of the rows below were
 * written by trg_payment_after_insert, not seeded by hand.
 * ========================================================================== */
(function (App) {
  'use strict';
  var S = App.Shell;
  var Q = App.Q;

  var q = '', action = 'all', entity = 'all';

  document.addEventListener('DOMContentLoaded', function () {
    S.mount({ title: 'Audit Trail', nav: 'audit' });

    S.el('#notice').innerHTML =
      '<div class="note note--flat">' +
        '<span class="note__icon">' + S.icon('info', 15) + '</span>' +
        '<div>The audit trail is <strong>append only</strong>. Entries are ' +
        'written by the database as transactions happen and cannot be edited ' +
        'or deleted from this screen — that is what makes it evidence.</div>' +
      '</div>';

    fillFilters();

    var search = S.el('#q'), timer;
    search.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        q = search.value.trim().toLowerCase();
        render();
      }, 150);
    });
    S.el('#fAction').addEventListener('change', function (e) {
      action = e.target.value; render();
    });
    S.el('#fEntity').addEventListener('change', function (e) {
      entity = e.target.value; render();
    });

    render();
  });

  /* the filters are built from what is actually in the log, so a new action
     type added by a trigger appears here without touching this file */
  function fillFilters() {
    function fill(sel, key, label) {
      var seen = {};
      App.DB.audit_logs.forEach(function (r) { seen[r[key]] = true; });
      S.el(sel).insertAdjacentHTML('beforeend',
        Object.keys(seen).sort().map(function (v) {
          return '<option value="' + S.esc(v) + '">' + S.esc(label(v)) + '</option>';
        }).join(''));
    }
    fill('#fAction', 'action_type', Q.actionLabel);
    fill('#fEntity', 'target_entity', Q.entityLabel);
  }

  function visible() {
    return Q.auditLog().filter(function (r) {
      if (action !== 'all' && r.action_type !== action) return false;
      if (entity !== 'all' && r.target_entity !== entity) return false;
      if (!q) return true;
      return [r.username_snapshot, Q.roleLabel(r.role_snapshot),
              Q.actionLabel(r.action_type), Q.entityLabel(r.target_entity),
              r.description, r.logged_at]
        .join(' ').toLowerCase().indexOf(q) !== -1;
    });
  }

  var COLUMNS = [
    { head: 'Logged at', cls: 'mono', cell: function (r) { return S.esc(r.logged_at); } },
    { head: 'User', cell: function (r) {
      return S.esc(r.username_snapshot) +
        '<div class="who-cell__sub">' + S.esc(Q.roleLabel(r.role_snapshot)) + '</div>';
    } },
    { head: 'Action', cell: function (r) { return S.esc(Q.actionLabel(r.action_type)); } },
    { head: 'Area', cell: function (r) {
      return S.esc(Q.entityLabel(r.target_entity)) +
        (r.target_id ? ' <span class="muted">no. ' + r.target_id + '</span>' : '');
    } },
    { head: 'Description', cell: function (r) { return S.esc(r.description || ''); } }
  ];

  function render() {
    var all = App.DB.audit_logs, list = visible();

    var actors = {};
    all.forEach(function (r) { actors[r.username_snapshot] = true; });

    S.meta([['Entries', all.length],
            ['Users', Object.keys(actors).length],
            'append only']);

    S.el('#count').textContent =
      list.length === all.length ? all.length + ' entries'
                                 : list.length + ' of ' + all.length;

    S.el('#log').innerHTML =
      S.table(COLUMNS, list, 'No entry matches that search.');
  }
})(window.App = window.App || {});
