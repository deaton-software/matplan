/* Mat Plan — Confirm Weights (spec §12.D). For one dual: scratch wrestlers not
   competing, then confirm each remaining wrestler's actual class from a dropdown
   of ALL 14 classes (§5.4 — not range-limited). Confirming permanently collapses
   their roster weight to that class (user decision); reopen widens it back. */
window.MP = window.MP || {};
(function (MP) {
  'use strict';
  var S = MP.store;

  function cardHTML(w, dual) {
    if (S.isScratched(dual, w.id)) {
      return '<div class="w-card scratched"><div class="w-row">' +
        '<div><div class="w-name">' + MP.escape(w.name || '(unnamed)') + '</div>' +
        '<div class="scratched-label">Scratched — not wrestling this dual</div></div>' +
        '<button class="link-btn" data-undo="' + w.id + '">Undo</button>' +
      '</div></div>';
    }

    if (w.weight && w.weight.type === 'confirmed') {
      var bump = MP.nextWeightUp(w.weight.class);
      return '<div class="w-card confirmed"><div class="confirmed-summary">' +
        '<div class="left"><span class="check">✓</span><div>' +
          '<div class="w-name">' + MP.escape(w.name || '(unnamed)') + '</div>' +
          '<div class="eligible">Eligible at <b>' + w.weight.class + '</b>' + (bump !== w.weight.class ? ' or bump to <b>' + bump + '</b>' : '') + '</div>' +
          '<div class="new-range">Roster set to ' + w.weight.class + ' (no longer a range) — reopen anytime to widen it</div>' +
        '</div></div>' +
        '<div style="text-align:right"><div class="actual-wt">' + w.weight.class + '</div>' +
          '<button class="link-btn" data-edit="' + w.id + '">edit</button></div>' +
      '</div></div>';
    }

    // Unconfirmed (range)
    var min = w.weight ? w.weight.min : 106;
    var max = w.weight ? w.weight.max : 106;
    return '<div class="w-card"><div class="w-row"><div>' +
        '<div class="w-name">' + MP.escape(w.name || '(unnamed)') + '</div>' +
        '<div class="w-range">Range: ' + min + '–' + max + '</div>' +
      '</div></div>' +
      '<div class="w-input-row">' +
        '<select class="wt-select" data-sel="' + w.id + '">' + MP.options(MP.WEIGHTS.map(String), String(min)) + '</select>' +
        '<button class="scratch-btn" data-scratch="' + w.id + '">Scratch</button>' +
        '<button class="confirm-btn" data-confirm="' + w.id + '">Confirm</button>' +
      '</div></div>';
  }

  function paint(root, dualId) {
    var d = S.dual(dualId); if (!d) return;
    var roster = S.rosterOf(d.oppTeamId);
    var active = roster.filter(function (w) { return !S.isScratched(d, w.id); });
    var confirmedCount = active.filter(function (w) { return w.weight && w.weight.type === 'confirmed'; }).length;

    root.querySelector('#cardList').innerHTML = roster.length
      ? roster.map(function (w) { return cardHTML(w, d); }).join('')
      : '<div class="empty">This team has no wrestlers yet. Add them on the roster screen first.</div>';

    var pct = active.length ? Math.round((confirmedCount / active.length) * 100) : 0;
    root.querySelector('#barFill').style.width = pct + '%';
    root.querySelector('#countLabel').textContent = confirmedCount + '/' + active.length;
    root.querySelector('#bottomCount').textContent = confirmedCount + ' of ' + active.length;
    root.querySelector('#finishBtn').disabled = confirmedCount === 0;

    root.querySelectorAll('button[data-confirm]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-confirm');
        var sel = root.querySelector('select[data-sel="' + id + '"]');
        S.confirmWrestlerWeight(id, sel.value);
        if (!d.weighedIn) S.updateDual(dualId, { weighedIn: true });
        paint(root, dualId);
      });
    });
    root.querySelectorAll('button[data-scratch]').forEach(function (b) {
      b.addEventListener('click', function () { S.toggleScratch(dualId, b.getAttribute('data-scratch')); paint(root, dualId); });
    });
    root.querySelectorAll('button[data-undo]').forEach(function (b) {
      b.addEventListener('click', function () { S.toggleScratch(dualId, b.getAttribute('data-undo')); paint(root, dualId); });
    });
    root.querySelectorAll('button[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { S.reopenWrestlerWeight(b.getAttribute('data-edit')); paint(root, dualId); });
    });
  }

  function render(root, params) {
    var d = S.dual(params[0]);
    if (!d) { root.className = 'shell narrow'; root.innerHTML = '<div class="empty">Dual not found. <a href="#/home">Back home</a></div>'; return; }
    var our = S.team(d.ourTeamId), opp = S.team(d.oppTeamId);

    root.className = 'shell narrow has-bottom-bar';
    root.innerHTML =
      '<button class="back-link" data-go="#/dual/' + d.id + '">‹ Back to dual</button>' +
      '<header class="top"><button class="wordmark" data-go="#/home">MAT PLAN <span>· confirm opponent weights</span></button></header>' +
      '<p class="subhead">' + MP.escape((opp ? opp.name : 'Opponent')) +
        ' — confirm each of their wrestlers’ actual weight class for this dual, and scratch anyone they’re not bringing. Confirming collapses a range into a single class on their roster, until you reopen it. (Set ' +
        MP.escape(our ? our.name : 'your team') + '’s own weights on their roster.)</p>' +

      '<div class="progress-banner">' +
        '<span class="label">Confirmed</span>' +
        '<div class="bar-track"><div class="bar-fill" id="barFill" style="width:0%"></div></div>' +
        '<span class="label"><b id="countLabel">0/0</b></span>' +
      '</div>' +

      '<div id="cardList"></div>' +

      '<div class="bottom-bar">' +
        '<span class="count"><b id="bottomCount">0 of 0</b> confirmed</span>' +
        '<button class="btn" id="finishBtn" disabled>Go to dual →</button>' +
      '</div>';

    root.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { MP.router.go(b.getAttribute('data-go')); });
    });
    root.querySelector('#finishBtn').addEventListener('click', function () { MP.router.go('#/dual/' + d.id); });

    paint(root, d.id);
  }

  MP.views = MP.views || {};
  MP.views.confirmWeights = { render: render };
})(window.MP);
