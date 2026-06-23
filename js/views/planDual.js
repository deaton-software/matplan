/* Mat Plan — Plan Dual (spec §12.C): combined setup + lineup scenario builder.
   Starting weight + coin-toss drive a live wrestling order with per-weight
   "who reports first" flags (§6). Each weight gets our/their wrestler picks
   (eligibility per §5.6), an outcome with live points, and a key-match star.
   A sticky bar shows the live score. Edits repaint in place (no scroll jump). */
window.MP = window.MP || {};
(function (MP) {
  'use strict';
  var S = MP.store;

  function metaChips(w) {
    if (!w) return '';
    // Rating is editable right here too (it's one shared field): changing it updates
    // this wrestler everywhere and recolors live. Tolerate informal ratings like "4?".
    var ratingVals = MP.RATINGS.indexOf(String(w.rating)) >= 0 ? MP.RATINGS : MP.RATINGS.concat([String(w.rating)]);
    return '<span class="grade-chip">Gr ' + MP.escape(w.grade) + '</span>' +
      '<select class="rating-select rating-mini ' + MP.tierClass(w.rating) + '" data-drating="' + w.id + '">' +
        MP.options(ratingVals, w.rating) + '</select>';
  }

  // Options for one slot: "— none —" plus every eligible (non-scratched) wrestler,
  // always including the currently-selected one even if it became ineligible.
  function slotOptions(roster, wt, selectedId, dual) {
    var opts = '<option value="">— none —</option>';
    roster.forEach(function (w) {
      var scratched = S.isScratched(dual, w.id) || !!w.out;
      var eligible = MP.isEligible(w, wt);
      if ((eligible && !scratched) || w.id === selectedId) {
        var note = w.id === selectedId && (!eligible || scratched) ? ' (' + (scratched ? 'scratched' : 'ineligible') + ')' : '';
        opts += '<option value="' + w.id + '"' + (w.id === selectedId ? ' selected' : '') + '>' + MP.escape(w.name || '(unnamed)') + note + '</option>';
      }
    });
    return opts;
  }

  function ptsHTML(res) {
    if (res.side === 'us') return '<div class="pts us">+' + res.pts + '</div>';
    if (res.side === 'them') return '<div class="pts them">−' + res.pts + '</div>';
    return '<div class="pts zero">0</div>';
  }

  function cardHTML(slot, pick, ourRoster, theirRoster, dual) {
    var wt = slot.wt;
    var ourW = pick.our ? S.wrestler(pick.our) : null;
    var theirW = pick.their ? S.wrestler(pick.their) : null;
    var res = MP.weightResult(pick);

    // Outcome dropdown is always enabled — predict anytime, with or without wrestlers.
    var outcomeControl = '<select data-outcome="' + wt + '">' +
      MP.options(MP.OUTCOMES.map(function (o) { return { value: o.v, label: o.label }; }), pick.outcome) + '</select>';
    var forfeitNote = '';
    if (res.forfeit) {
      var who = res.side === 'us' ? 'Opponent has no wrestler at this weight' : 'No wrestler entered on our side';
      forfeitNote = '<div class="forfeit-note">Auto-forfeit: ' + who + ' (+6 to ' + (res.side === 'us' ? 'us' : 'them') + ') — pick an outcome to override</div>';
    }

    return '<div class="m-card ' + (slot.usFirst ? 'us-first' : 'them-first') + (pick.key ? ' key' : '') + '">' +
        '<div class="m-top">' +
          '<div class="m-head">' +
            '<span class="m-pos">#' + slot.position + '</span>' +
            '<span class="m-wt">' + wt + '</span>' +
            '<span class="tag ' + (slot.usFirst ? 'us-tag' : 'them-tag') + '">' + (slot.usFirst ? 'we report 1st' : 'they report 1st') + '</span>' +
          '</div>' +
          '<button class="star-btn ' + (pick.key ? 'active' : '') + '" data-star="' + wt + '" title="Flag key match">★</button>' +
        '</div>' +
        '<div class="m-grid">' +
          '<div class="m-select us">' +
            '<select data-pick="our" data-wt="' + wt + '">' + slotOptions(ourRoster, wt, pick.our, dual) + '</select>' +
            '<div class="m-chips">' + metaChips(ourW) + '</div>' +
          '</div>' +
          '<div class="m-vs">vs</div>' +
          '<div class="m-select them">' +
            '<select data-pick="their" data-wt="' + wt + '">' + slotOptions(theirRoster, wt, pick.their, dual) + '</select>' +
            '<div class="m-chips">' + metaChips(theirW) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="m-outcome">' + outcomeControl + ptsHTML(res) + '</div>' +
        forfeitNote +
      '</div>';
  }

  function paint(root, dualId) {
    var d = S.dual(dualId); if (!d) return;
    var sc = S.activeScenario(d);
    var ourRoster = S.rosterOf(d.ourTeamId);
    var theirRoster = S.rosterOf(d.oppTeamId);
    var order = MP.computeOrder(d.startWeight, d.coinCall);

    // Scenario bar + tools
    var chips = d.scenarios.map(function (s) {
      return '<button class="scenario-chip ' + (s.id === d.activeScenarioId ? 'active' : '') + '" data-sc="' + s.id + '">' + MP.escape(s.name) + '</button>';
    }).join('');
    root.querySelector('#scenarioWrap').innerHTML =
      '<div class="scenario-bar">' + chips + '<button class="scenario-chip add" id="scAdd">+ New scenario</button></div>' +
      '<div class="legend-row" style="margin-top:0">' +
        '<button class="link-btn" id="scRename">Rename scenario</button>' +
        (d.scenarios.length > 1 ? '<button class="link-btn" id="scDelete">Delete scenario</button>' : '') +
      '</div>';

    // Matchup cards
    root.querySelector('#matchups').innerHTML = order.map(function (slot) {
      var pick = sc.picks[slot.wt] || { our: null, their: null, outcome: 'none', key: false };
      return cardHTML(slot, pick, ourRoster, theirRoster, d);
    }).join('');

    // Score
    var score = MP.scoreScenario(sc);
    root.querySelector('#usScore').textContent = score.us;
    root.querySelector('#themScore').textContent = score.them;

    // Wire scenario controls
    root.querySelectorAll('[data-sc]').forEach(function (c) {
      c.addEventListener('click', function () { S.setActiveScenario(dualId, c.getAttribute('data-sc')); paint(root, dualId); });
    });
    root.querySelector('#scAdd').addEventListener('click', function () { S.addScenario(dualId); paint(root, dualId); });
    root.querySelector('#scRename').addEventListener('click', function () {
      var name = prompt('Rename scenario', sc.name);
      if (name && name.trim()) { S.renameScenario(dualId, sc.id, name.trim()); paint(root, dualId); }
    });
    var scDel = root.querySelector('#scDelete');
    if (scDel) scDel.addEventListener('click', function () {
      if (confirm('Delete scenario “' + sc.name + '”?')) { S.removeScenario(dualId, sc.id); paint(root, dualId); }
    });

    // Wire cards
    root.querySelectorAll('select[data-pick]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        S.setPick(dualId, d.activeScenarioId, sel.getAttribute('data-wt'), sel.getAttribute('data-pick'), sel.value || null);
        paint(root, dualId);
      });
    });
    root.querySelectorAll('select[data-outcome]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        S.setPick(dualId, d.activeScenarioId, sel.getAttribute('data-outcome'), 'outcome', sel.value);
        paint(root, dualId);
      });
    });
    root.querySelectorAll('button[data-star]').forEach(function (b) {
      b.addEventListener('click', function () {
        var wt = b.getAttribute('data-star');
        var pick = sc.picks[wt] || {};
        S.setPick(dualId, d.activeScenarioId, wt, 'key', !pick.key);
        paint(root, dualId);
      });
    });
    root.querySelectorAll('select[data-drating]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        S.updateWrestler(sel.getAttribute('data-drating'), { rating: sel.value });
        paint(root, dualId);
      });
    });
  }

  function render(root, params) {
    var d = S.dual(params[0]);
    if (!d) { root.className = 'shell'; root.innerHTML = '<div class="empty">Dual not found. <a href="#/home">Back home</a></div>'; return; }
    var our = S.team(d.ourTeamId), opp = S.team(d.oppTeamId);
    var ourName = our ? our.name : 'Our team';
    var oppName = opp ? opp.name : 'Opponent';

    root.className = 'shell has-bottom-bar';
    root.innerHTML =
      '<button class="back-link" data-go="#/home">‹ Home</button>' +
      '<header class="top"><button class="wordmark" data-go="#/home">MAT PLAN <span>· plan dual — ' + MP.escape(ourName) + ' vs ' + MP.escape(oppName) + '</span></button></header>' +

      '<div id="scenarioWrap"></div>' +

      '<div class="panel">' +
        '<div class="setup-row">' +
          '<div class="field"><label>Starting weight class</label><select id="startWeight">' + MP.options(MP.WEIGHTS.map(String), String(d.startWeight)) + '</select></div>' +
          '<div class="field"><label>Coin toss — our call</label><select id="coinCall">' +
            '<option value="odds"' + (d.coinCall === 'odds' ? ' selected' : '') + '>We report first on ODDS</option>' +
            '<option value="evens"' + (d.coinCall === 'evens' ? ' selected' : '') + '>We report first on EVENS</option>' +
          '</select></div>' +
        '</div>' +
        '<div class="setup-row" style="margin-top:12px;align-items:center">' +
          '<button class="btn" id="confirmGo">Confirm opponent weigh-ins →</button>' +
          (d.weighedIn ? '<span class="status-pill status-weighed" style="align-self:center">Weighed in — eligibility uses confirmed classes + bump rule</span>' : '<span class="subhead" style="margin:0">Wrestlers are selectable at their weight or one class above (bump-up).</span>') +
          '<button class="btn danger" id="deleteDualBtn" style="margin-left:auto">Delete dual</button>' +
        '</div>' +
      '</div>' +

      '<div class="legend-row">' +
        '<span><i style="background:var(--us)"></i>We report first (opponent sees our pick first)</span>' +
        '<span><i style="background:var(--them)"></i>They report first (we see their pick first)</span>' +
        '<span>★ key match</span>' +
      '</div>' +

      '<div class="matchups" id="matchups"></div>' +

      '<div class="score-bar">' +
        '<div class="score-side us"><div class="name">' + MP.escape(ourName) + '</div><div class="num" id="usScore">0</div></div>' +
        '<div class="score-div">–</div>' +
        '<div class="score-side them"><div class="name">' + MP.escape(oppName) + '</div><div class="num" id="themScore">0</div></div>' +
      '</div>';

    root.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { MP.router.go(b.getAttribute('data-go')); });
    });
    root.querySelector('#startWeight').addEventListener('change', function () {
      S.updateDual(d.id, { startWeight: Number(this.value) }); paint(root, d.id);
    });
    root.querySelector('#coinCall').addEventListener('change', function () {
      S.updateDual(d.id, { coinCall: this.value }); paint(root, d.id);
    });
    root.querySelector('#confirmGo').addEventListener('click', function () { MP.router.go('#/dual/' + d.id + '/confirm'); });
    root.querySelector('#deleteDualBtn').addEventListener('click', function () {
      if (confirm('Delete this dual (' + ourName + ' vs ' + oppName + ')? Its lineup scenarios are removed. This cannot be undone.')) {
        S.removeDual(d.id); MP.router.go('#/home');
      }
    });

    paint(root, d.id);
  }

  MP.views = MP.views || {};
  MP.views.planDual = { render: render };
})(window.MP);
