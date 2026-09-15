/* ============================================================================
 * module-stub.js — Placeholder for modules owned by other developers
 * OWNER: Angelo Andrei P. Sierra
 *
 * These pages exist so the navigation is complete and the examiner can see the
 * whole system's shape. They deliberately state that the module is not built
 * and who is responsible for it, rather than faking a working screen.
 *
 * The page supplies its details on <body data-*>, so all four stubs share this
 * one script.
 * ========================================================================== */
(function (App) {
  'use strict';

  var esc = App.Dom.esc;

  document.addEventListener('DOMContentLoaded', function () {
    var d = document.body.dataset;

    var user = App.Shell.mount({
      title: d.moduleTitle,
      crumb: 'Not available in this build',
      nav: d.moduleNav,
      requires: d.modulePerm
    });
    if (!user) return;

    var features = (d.moduleFeatures || '').split('|').filter(Boolean);

    document.querySelector('.page-body').innerHTML =
      '<div class="stub-page">' +
        '<div class="stub-page__icon">' +
          App.Icons.get(d.moduleIcon, { size: 28 }) + '</div>' +
        '<h1 class="stub-page__title">' + esc(d.moduleTitle) + '</h1>' +
        '<div class="stub-page__owner">Assigned to ' + esc(d.moduleOwner) + '</div>' +
        '<p class="stub-page__text">' +
          'This module is not part of the work assigned to the Frontend &amp; UI/UX ' +
          'Developer, so it is not implemented in this build. The link is kept in ' +
          'the navigation so the system’s full structure is visible, and so the ' +
          'access rules for it can still be demonstrated.' +
        '</p>' +
        (features.length
          ? '<div class="stub-page__list">' +
              '<strong style="display:block;margin-bottom:6px;color:var(--ink-900)">' +
              'Planned scope</strong>' +
              features.map(function (f) {
                return '<div>&middot; ' + esc(f) + '</div>';
              }).join('') +
            '</div>'
          : '') +
        '<div class="notice notice--muted" style="text-align:left">' +
          '<span class="notice__icon">' + App.Icons.get('info', { size: 15 }) + '</span>' +
          '<div>' +
            '<div class="notice__title">What this build does provide</div>' +
            esc(d.moduleProvided || 'Nothing from this module is used elsewhere.') +
          '</div>' +
        '</div>' +
        '<div class="flex-gap" style="justify-content:center">' +
          '<a class="btn btn--primary" href="' + App.Paths.to('index.html') +
            '" data-icon="dashboard">Back to dashboard</a>' +
          '<a class="btn" href="' + App.Paths.page('wireframes.html') +
            '" data-icon="wireframe">See the UI wireframes</a>' +
        '</div>' +
      '</div>';

    App.Shell.hydrateIcons(document);
    App.RBAC.applyTo(document, user);
  });
})(window.App = window.App || {});
