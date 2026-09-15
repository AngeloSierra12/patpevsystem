/* ============================================================================
 * icons.js — Inline SVG icon set
 * OWNER: Angelo Andrei P. Sierra
 *
 * Line icons in the Lucide style, drawn inline so there is no icon font, no
 * CDN request and no network dependency — the system has to run offline.
 *
 * Emoji are deliberately NOT used as interface icons: they render differently
 * on every machine, cannot be recoloured by the theme, and look unprofessional
 * on a projector.
 *
 * Usage:  App.Icons.get('calendar')            -> 18px icon
 *         App.Icons.get('users', { size: 22 }) -> custom size
 * ========================================================================== */
(function (App) {
  'use strict';

  /* Each entry is the inner markup of a 24x24 viewBox. */
  var PATHS = {
    dashboard:
      '<rect x="3" y="3" width="7" height="9" rx="1"/>' +
      '<rect x="14" y="3" width="7" height="5" rx="1"/>' +
      '<rect x="14" y="12" width="7" height="9" rx="1"/>' +
      '<rect x="3" y="16" width="7" height="5" rx="1"/>',

    calendar:
      '<path d="M8 2v4"/><path d="M16 2v4"/>' +
      '<rect width="18" height="18" x="3" y="4" rx="2"/>' +
      '<path d="M3 10h18"/>' +
      '<path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/>' +
      '<path d="M8 18h.01"/><path d="M12 18h.01"/>',

    users:
      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>' +
      '<circle cx="9" cy="7" r="4"/>' +
      '<path d="M22 21v-2a4 4 0 0 0-3-3.87"/>' +
      '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>',

    wireframe:
      '<rect width="18" height="7" x="3" y="3" rx="1"/>' +
      '<rect width="9" height="7" x="3" y="14" rx="1"/>' +
      '<rect width="5" height="7" x="16" y="14" rx="1"/>',

    bed:
      '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/>' +
      '<path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/>' +
      '<path d="M12 4v6"/><path d="M2 18h20"/>',

    package:
      '<path d="m7.5 4.27 9 5.15"/>' +
      '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>' +
      '<path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',

    report:
      '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>' +
      '<path d="M14 2v4a2 2 0 0 0 2 2h4"/>' +
      '<path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',

    shield:
      '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>' +
      '<path d="m9 12 2 2 4-4"/>',

    account:
      '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/>' +
      '<path d="M7 20.66V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.66"/>',

    menu: '<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',

    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    alert:
      '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>' +
      '<path d="M12 9v4"/><path d="M12 17h.01"/>',
    xCircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',

    lock:
      '<rect width="18" height="11" x="3" y="11" rx="2"/>' +
      '<path d="M7 11V7a5 5 0 0 1 10 0v4"/>',

    key:
      '<path d="M2.59 17.41A2 2 0 0 0 2 18.83V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.17a2 2 0 0 0 1.42-.59l.81-.81a6.5 6.5 0 1 0-4-4z"/>' +
      '<circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',

    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    refresh:
      '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>' +
      '<path d="M21 3v5h-5"/>' +
      '<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>' +
      '<path d="M8 16H3v5"/>',

    settings:
      '<path d="M20 7h-9"/><path d="M14 17H5"/>' +
      '<circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',

    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',

    trash:
      '<path d="M3 6h18"/>' +
      '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
      '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
      '<path d="M10 11v6"/><path d="M14 11v6"/>',

    edit:
      '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>' +
      '<path d="M18.38 2.62a1 1 0 0 1 3 3l-9.01 9.01a2 2 0 0 1-.85.51l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.85z"/>',

    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',

    trending: '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',

    wrench:
      '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',

    truck:
      '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>' +
      '<path d="M15 18H9"/>' +
      '<path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>' +
      '<circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',

    clipboard:
      '<rect width="8" height="4" x="8" y="2" rx="1"/>' +
      '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>' +
      '<path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',

    building:
      '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>' +
      '<path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>' +
      '<path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>' +
      '<path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',

    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',

    inbox:
      '<path d="M22 12h-6l-2 3h-4l-2-3H2"/>' +
      '<path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',

    logIn: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',

    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/>' +
          '<rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',

    list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/>' +
          '<path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',

    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.87 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.87 0"/>' +
         '<circle cx="12" cy="12" r="3"/>',

    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/>' +
         '<path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>' +
         '<path d="M2 12h2"/><path d="M20 12h2"/>' +
         '<path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',

    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'
  };

  /**
   * @param {string} name  key from PATHS
   * @param {object} [opts] { size, stroke, cls }
   * @returns {string} inline <svg> markup
   */
  function get(name, opts) {
    opts = opts || {};
    var body = PATHS[name];
    if (!body) return '';
    var size = opts.size || 18;
    return '<svg class="icon' + (opts.cls ? ' ' + opts.cls : '') + '" ' +
           'width="' + size + '" height="' + size + '" viewBox="0 0 24 24" ' +
           'fill="none" stroke="currentColor" stroke-width="' + (opts.stroke || 1.75) + '" ' +
           'stroke-linecap="round" stroke-linejoin="round" ' +
           'aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  function has(name) { return !!PATHS[name]; }

  App.Icons = { get: get, has: has, PATHS: PATHS };
})(window.App = window.App || {});
