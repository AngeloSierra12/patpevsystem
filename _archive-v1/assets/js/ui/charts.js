/* ============================================================================
 * charts.js — Small hand-built SVG charts
 * OWNER: Angelo Andrei P. Sierra
 *
 * Written by hand rather than pulled from a CDN so the prototype renders with
 * no internet connection and no build step — it has to work off a flash drive
 * during the defense.
 * ========================================================================== */
(function (App) {
  'use strict';

  var esc = App.Dom.esc;

  /* Categorical palette. Values mirror the --data-* tokens in app.css; they are
     repeated here as literals because SVG fill/stroke inside generated markup
     cannot read CSS custom properties reliably across browsers. */
  var PALETTE = ['#ae0404', '#c98a10', '#0e7490', '#6b3fa0', '#7f1010', '#15803d'];
  var TRACK = '#e4dcdd';
  var GRID = '#efeaea';
  var AXIS_TEXT = '#7b7375';
  var LABEL_TEXT = '#403a3c';

  /* --- Donut --------------------------------------------------------------- *
   * data: [{ label, value, color }]                                          */
  function donut(data, opts) {
    opts = opts || {};
    var size = opts.size || 168;
    var thickness = opts.thickness || 24;
    var r = (size - thickness) / 2;
    var cx = size / 2, cy = size / 2;
    var circumference = 2 * Math.PI * r;

    var total = data.reduce(function (s, d) { return s + d.value; }, 0);
    var offset = 0;

    var rings = data.map(function (d, i) {
      var frac = total ? d.value / total : 0;
      var len = frac * circumference;
      var seg = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" ' +
        'fill="none" stroke="' + (d.color || PALETTE[i % PALETTE.length]) + '" ' +
        'stroke-width="' + thickness + '" ' +
        'stroke-dasharray="' + len.toFixed(2) + ' ' + (circumference - len).toFixed(2) + '" ' +
        'stroke-dashoffset="' + (-offset).toFixed(2) + '" ' +
        'transform="rotate(-90 ' + cx + ' ' + cy + ')">' +
        '<title>' + esc(d.label) + ': ' + d.value + '</title></circle>';
      offset += len;
      return seg;
    }).join('');

    var track = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" ' +
                'stroke="' + TRACK + '" stroke-width="' + thickness + '"/>';

    return '<svg class="chart" viewBox="0 0 ' + size + ' ' + size + '" ' +
           'width="' + size + '" height="' + size + '" role="img" ' +
           'aria-label="' + esc(opts.ariaLabel || 'Donut chart') + '">' +
           track + rings + '</svg>';
  }

  /* --- Vertical bar chart -------------------------------------------------- *
   * data: [{ label, value, sublabel, highlight }]                            */
  function bars(data, opts) {
    opts = opts || {};
    var w = opts.width || 620;
    var h = opts.height || 190;
    var padL = 30, padR = 8, padB = 34, padT = 14;
    var plotW = w - padL - padR;
    var plotH = h - padT - padB;

    var max = opts.max || Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1]));
    var step = plotW / data.length;
    var barW = Math.min(opts.barWidth || 34, step * 0.62);

    /* gridlines at 0 / 50 / 100 % of max */
    var grid = [0, 0.5, 1].map(function (f) {
      var y = padT + plotH - f * plotH;
      return '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (w - padR) +
             '" y2="' + y.toFixed(1) + '" stroke="' + GRID + '" stroke-width="1"/>' +
             '<text x="' + (padL - 6) + '" y="' + (y + 3.5).toFixed(1) + '" ' +
             'text-anchor="end" font-size="9.5" fill="' + AXIS_TEXT + '">' +
             Math.round(f * max) + '</text>';
    }).join('');

    var rects = data.map(function (d, i) {
      var barH = max ? (d.value / max) * plotH : 0;
      var x = padL + i * step + (step - barW) / 2;
      var y = padT + plotH - barH;
      var fill = d.highlight ? PALETTE[1] : (d.color || PALETTE[0]);
      return '' +
        '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) +
          '" height="' + Math.max(barH, 1.5).toFixed(1) + '" rx="3" fill="' + fill + '">' +
          '<title>' + esc(d.label) + ': ' + d.value + (opts.unit || '') + '</title></rect>' +
        (barH > 18
          ? '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (y + 13).toFixed(1) +
            '" text-anchor="middle" font-size="10" font-weight="600" fill="#fff">' +
            esc(String(d.value)) + '</text>'
          : '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (y - 4).toFixed(1) +
            '" text-anchor="middle" font-size="10" font-weight="600" fill="' + LABEL_TEXT + '">' +
            esc(String(d.value)) + '</text>') +
        '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (h - padB + 14) +
          '" text-anchor="middle" font-size="10" fill="' + LABEL_TEXT + '">' + esc(d.label) + '</text>' +
        (d.sublabel
          ? '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (h - padB + 25) +
            '" text-anchor="middle" font-size="9" fill="' + AXIS_TEXT + '">' + esc(d.sublabel) + '</text>'
          : '');
    }).join('');

    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" ' +
           'preserveAspectRatio="xMidYMid meet" role="img" ' +
           'aria-label="' + esc(opts.ariaLabel || 'Bar chart') + '">' +
           grid + rects + '</svg>';
  }

  /* --- Horizontal stock bars ----------------------------------------------- *
   * data: [{ label, value, max, kind }]  kind: ok | warn | danger            */
  function hbars(data, opts) {
    opts = opts || {};
    var COLORS = { ok: '#15803d', warn: '#c98a10', danger: '#7f1010' };

    /* One row per item: label, track, figure — so the eye reads straight
       across instead of zig-zagging between a caption and a bar below it. */
    return '<div class="hbars">' + data.map(function (d) {
      var pct = d.max ? Math.min(100, (d.value / d.max) * 100) : 0;
      return '' +
        '<div class="hbar">' +
          '<span class="hbar__label" title="' + esc(d.label) + '">' +
            esc(d.label) + '</span>' +
          '<span class="hbar__track">' +
            '<i class="hbar__fill" style="width:' + pct.toFixed(1) + '%;' +
               'background:' + (COLORS[d.kind] || COLORS.ok) + '"></i>' +
          '</span>' +
          '<span class="hbar__value">' +
            esc(d.valueText || (d.value + ' / ' + d.max)) + '</span>' +
        '</div>';
    }).join('') + '</div>';
  }

  /* --- Legend -------------------------------------------------------------- */
  function legend(items) {
    return '<div class="chart-legend">' + items.map(function (it, i) {
      return '<span class="chart-legend__item">' +
        '<span class="chart-legend__swatch" style="background:' +
          (it.color || PALETTE[i % PALETTE.length]) + '"></span>' +
        esc(it.label) + (it.value != null ? ' <strong>' + esc(String(it.value)) + '</strong>' : '') +
      '</span>';
    }).join('') + '</div>';
  }

  App.Charts = {
    PALETTE: PALETTE,
    donut: donut,
    bars: bars,
    hbars: hbars,
    legend: legend
  };
})(window.App = window.App || {});
