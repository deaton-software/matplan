/* Mat Plan — Confirm Weights (team roster variant). The same screen as the dual
   opponent confirm flow (spec §12.D), but pointed at a single team's own roster:
   • Scratch toggles the roster-level `out` flag (excludes them from all lineups).
   • Confirm locks the wrestler to the class chosen in the dropdown (collapses a
     range to that single class until reopened).
   No dual, no auto-guessing, no auto-scratch. Repaints in place (no scroll jump). */
window.MP = window.MP || {};
(function (MP) {
  'use strict';
  var S = MP.store;

  function cardHTML(w) {
    if (w.out) {
      return '<div class="w-card scratched"><div class="w-row">' +
        '<div><div class="w-name">' + MP.escape(w.name || '(unnamed)') + '</div>' +
        '<div class="scratched-label">Scratched — out of the lineup</div></div>' +
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

    // Unconfirmed (range): dropdown defaults to the bottom of the range.
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

  function paint(root, teamId) {
    var roster = S.rosterOf(teamId);
    var active = roster.filter(function (w) { return !w.out; });
    var confirmedCount = active.filter(function (w) { return w.weight && w.weight.type === 'confirmed'; }).length;

    root.querySelector('#cardList').innerHTML = roster.length
      ? roster.map(cardHTML).join('')
      : '<div class="empty">This team has no wrestlers yet. Add them on the roster screen first.</div>';

    var pct = active.length ? Math.round((confirmedCount / active.length) * 100) : 0;
    root.querySelector('#barFill').style.width = pct + '%';
    root.querySelector('#countLabel').textContent = confirmedCount + '/' + active.length;
    root.querySelector('#bottomCount').textContent = confirmedCount + ' of ' + active.length;

    root.querySelectorAll('button[data-confirm]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-confirm');
        var sel = root.querySelector('select[data-sel="' + id + '"]');
        S.confirmWrestlerWeight(id, sel.value);
        paint(root, teamId);
      });
    });
    root.querySelectorAll('button[data-scratch]').forEach(function (b) {
      b.addEventListener('click', function () { S.toggleOut(b.getAttribute('data-scratch')); paint(root, teamId); });
    });
    root.querySelectorAll('button[data-undo]').forEach(function (b) {
      b.addEventListener('click', function () { S.toggleOut(b.getAttribute('data-undo')); paint(root, teamId); });
    });
    root.querySelectorAll('button[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { S.reopenWrestlerWeight(b.getAttribute('data-edit')); paint(root, teamId); });
    });
  }

  function render(root, params) {
    var teamId = params[0];
    var team = S.team(teamId);
    if (!team) { root.className = 'shell narrow'; root.innerHTML = '<div class="empty">Team not found. <a href="#/home">Back home</a></div>'; return; }

    root.className = 'shell narrow has-bottom-bar';
    root.innerHTML =
      '<button class="back-link" data-go="#/roster/' + teamId + '">‹ Back to roster</button>' +
      '<header class="top"><button class="wordmark" data-go="#/home">MAT PLAN <span>· confirm weights</span></button></header>' +
      '<p class="subhead">' + MP.escape(team.name) +
        ' — confirm each wrestler’s actual weight class and scratch anyone out of the lineup. Confirming collapses a range into a single class on the roster, until you reopen it.</p>' +

      '<div class="progress-banner">' +
        '<span class="label">Confirmed</span>' +
        '<div class="bar-track"><div class="bar-fill" id="barFill" style="width:0%"></div></div>' +
        '<span class="label"><b id="countLabel">0/0</b></span>' +
      '</div>' +

      '<div id="cardList"></div>' +

      '<div class="bottom-bar">' +
        '<span class="count"><b id="bottomCount">0 of 0</b> confirmed</span>' +
        '<button class="btn" id="finishBtn">Done →</button>' +
      '</div>';

    root.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { MP.router.go(b.getAttribute('data-go')); });
    });
    root.querySelector('#finishBtn').addEventListener('click', function () { MP.router.go('#/roster/' + teamId); });

    paint(root, teamId);
  }

  MP.views = MP.views || {};
  MP.views.confirmTeamWeights = { render: render };
})(window.MP);
