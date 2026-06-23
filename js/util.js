/* Mat Plan — shared constants, pure helpers, and derived calculations.
   No DOM, no state mutation here: just logic that the views and store rely on. */
window.MP = window.MP || {};
(function (MP) {
  'use strict';

  // The fixed, non-configurable set of 14 NFHS weight classes (spec §3).
  MP.WEIGHTS = [106, 113, 120, 126, 132, 138, 144, 150, 157, 165, 175, 190, 215, 285];

  // Rating dropdown values (spec §4): '?' plus 1–6 in 0.5 steps.
  MP.RATINGS = ['?', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6'];

  // Human-readable meaning of each whole rating (spec §4 key).
  MP.RATING_KEY = {
    '?': 'Insufficient data',
    '1': 'Low/mid JV',
    '2': 'Strong JV',
    '3': 'Varsity',
    '4': 'State qualifier',
    '5': 'State placer',
    '6': 'State champ'
  };

  // Outcome catalog (spec §7). 'none' = no prediction yet → 0 pts (user's scoring choice).
  MP.OUTCOMES = [
    { v: 'none',       label: '— No prediction —',   side: null,   pts: 0 },
    { v: 'us-pin',     label: 'We win — Pin/Fall',   side: 'us',   pts: 6 },
    { v: 'us-tech',    label: 'We win — Tech Fall',  side: 'us',   pts: 5 },
    { v: 'us-major',   label: 'We win — Major Dec.', side: 'us',   pts: 4 },
    { v: 'us-dec',     label: 'We win — Decision',   side: 'us',   pts: 3 },
    { v: 'them-dec',   label: 'They win — Decision', side: 'them', pts: 3 },
    { v: 'them-major', label: 'They win — Major Dec.', side: 'them', pts: 4 },
    { v: 'them-tech',  label: 'They win — Tech Fall', side: 'them', pts: 5 },
    { v: 'them-pin',   label: 'They win — Pin/Fall', side: 'them', pts: 6 }
  ];

  MP.outcome = function (v) {
    var found;
    MP.OUTCOMES.forEach(function (o) { if (o.v === v) found = o; });
    return found || MP.OUTCOMES[0];
  };

  MP.uid = function (prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  // Map a rating to a color-tier token used in CSS class names. Every half-step gets
  // its own color, so the token is the rating with the dot stripped: 1→'1', 1.5→'15',
  // 4.5→'45', up to '6' (plus 'na'). Snaps to the nearest 0.5 and clamps to 1–6 so
  // informal text like "4?" still lands on a sensible tier.
  MP.tierForRating = function (r) {
    if (r === undefined || r === null) return 'na';
    var s = String(r).trim();
    if (s === '' || s === '?') return 'na';
    var n = parseFloat(s);
    if (isNaN(n)) return 'na';
    n = Math.round(n * 2) / 2;
    if (n < 1) n = 1; else if (n > 6) n = 6;
    return String(n).replace('.', '');
  };

  MP.tierClass = function (r) { return 'tier-' + MP.tierForRating(r); };

  MP.nextWeightUp = function (wt) {
    var i = MP.WEIGHTS.indexOf(Number(wt));
    return (i >= 0 && i < MP.WEIGHTS.length - 1) ? MP.WEIGHTS[i + 1] : Number(wt);
  };

  // Wrestling order for a dual: 14 classes from startWeight, wrapping after 285 (spec §6.2),
  // each tagged with its 1-based position and whether WE report first (spec §6.3–6.4).
  MP.computeOrder = function (startWeight, coinCall) {
    var start = MP.WEIGHTS.indexOf(Number(startWeight));
    if (start < 0) start = 0;
    var order = [];
    for (var i = 0; i < 14; i++) {
      var wt = MP.WEIGHTS[(start + i) % 14];
      var position = i + 1;
      var isOdd = position % 2 === 1;
      var usFirst = (coinCall === 'odds' && isOdd) || (coinCall === 'evens' && !isOdd);
      order.push({ wt: wt, position: position, usFirst: usFirst });
    }
    return order;
  };

  // Is a wrestler eligible to fill a given weight class? (spec §5.5–5.6)
  // The bump-up rule applies in both states: a wrestler can wrestle at their
  // weight, or one standard class above it.
  //  • confirmed class → that class, or one class up
  //  • range record    → any class the range overlaps, or one class above the top
  MP.isEligible = function (wrestler, wt) {
    if (!wrestler || !wrestler.weight) return false;
    wt = Number(wt);
    var w = wrestler.weight;
    if (w.type === 'confirmed') {
      var c = Number(w.class);
      return wt === c || wt === MP.nextWeightUp(c);
    }
    var min = Number(w.min), max = Number(w.max);
    return (min <= wt && wt <= max) || wt === MP.nextWeightUp(max);
  };

  // Short label for a wrestler's current weight state.
  MP.weightLabel = function (wrestler) {
    var w = wrestler && wrestler.weight;
    if (!w) return '—';
    return w.type === 'confirmed' ? String(w.class) : (w.min + '–' + w.max);
  };

  // Numeric [min,max] bounds for a wrestler's weight, regardless of confirmed/range.
  MP.weightBounds = function (wrestler) {
    var w = wrestler && wrestler.weight;
    if (!w) return { min: 9999, max: 9999 };
    if (w.type === 'confirmed') return { min: Number(w.class), max: Number(w.class) };
    return { min: Number(w.min), max: Number(w.max) };
  };

  // Roster sort order: weight min, then weight max, then grade (12th → 9th),
  // then name (A→Z). Wrestlers with no grade sort last within their weight group.
  MP.compareRoster = function (a, b) {
    var wa = MP.weightBounds(a), wb = MP.weightBounds(b);
    if (wa.min !== wb.min) return wa.min - wb.min;
    if (wa.max !== wb.max) return wa.max - wb.max;
    var ga = Number(a.grade) || 0, gb = Number(b.grade) || 0;
    if (ga !== gb) return gb - ga;
    return String(a.name || '').localeCompare(String(b.name || ''));
  };

  // Per-weight effective result for one pick.
  // An explicit prediction always wins. Otherwise (outcome 'none') auto-forfeit
  // applies as a fallback when exactly one side has a wrestler; both empty → 0.
  MP.weightResult = function (pick) {
    var hasOur = !!(pick && pick.our);
    var hasTheir = !!(pick && pick.their);
    var o = MP.outcome(pick ? pick.outcome : 'none');
    if (o.side) return { side: o.side, pts: o.pts, forfeit: false, label: o.label };
    if (hasOur && !hasTheir) return { side: 'us', pts: 6, forfeit: true, label: 'Forfeit' };
    if (!hasOur && hasTheir) return { side: 'them', pts: 6, forfeit: true, label: 'Forfeit' };
    return { side: null, pts: 0, forfeit: false, label: 'No prediction' };
  };

  // Total score for a scenario (sum of per-weight results across all 14 classes).
  MP.scoreScenario = function (scenario) {
    var us = 0, them = 0;
    if (scenario && scenario.picks) {
      MP.WEIGHTS.forEach(function (wt) {
        var res = MP.weightResult(scenario.picks[wt]);
        if (res.side === 'us') us += res.pts;
        else if (res.side === 'them') them += res.pts;
      });
    }
    return { us: us, them: them };
  };

  MP.fmtDate = function (iso) {
    if (!iso) return 'TBD';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  MP.escape = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // Build an <option> list as an HTML string.
  MP.options = function (values, selected, makeLabel) {
    return values.map(function (v) {
      var val = (typeof v === 'object') ? v.value : v;
      var lbl = makeLabel ? makeLabel(v) : ((typeof v === 'object') ? v.label : v);
      var sel = String(val) === String(selected) ? ' selected' : '';
      return '<option value="' + MP.escape(val) + '"' + sel + '>' + MP.escape(lbl) + '</option>';
    }).join('');
  };

})(window.MP);
