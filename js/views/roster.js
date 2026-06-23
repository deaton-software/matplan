/* Mat Plan — Roster (spec §12.B). Team selector, filters, an inline-editable
   table (stacks to cards on mobile), add-wrestler, and the paste-and-review
   intake (spec §11). Ratings are the single shared field, edited here and
   reflected everywhere (spec §4). */
window.MP = window.MP || {};
(function (MP) {
  'use strict';
  var S = MP.store;

  // Repaint the roster but keep the user's scroll position. The hash router
  // always scrolls to top on render — fine for navigation, but jarring for
  // in-place edits like lock/scratch (the buttons were unusable on mobile).
  function rerenderKeepScroll() {
    var y = window.pageYOffset;
    MP.rerender();
    window.scrollTo(0, y);
  }

  function weightCellHTML(w) {
    if (w.weight && w.weight.type === 'confirmed') {
      return '<div class="weight-cell"><span class="confirmed-tag"><span class="lock">🔒</span>' + w.weight.class +
        '</span><button class="link-btn" data-reopen="' + w.id + '">reopen</button></div>';
    }
    var min = w.weight ? w.weight.min : 106;
    var max = w.weight ? w.weight.max : 106;
    return '<div class="weight-cell">' +
      '<input class="editable" data-wmin="' + w.id + '" value="' + min + '" inputmode="numeric">' +
      '<span>–</span>' +
      '<input class="editable" data-wmax="' + w.id + '" value="' + max + '" inputmode="numeric">' +
      '<button class="link-btn" data-lock="' + w.id + '" title="Lock to a single weight class">🔒<span class="btn-lbl"> lock</span></button></div>';
  }

  function rowHTML(w) {
    // Tolerate informal ratings (e.g. "4?") by adding the raw value to the list if non-standard.
    var ratingVals = MP.RATINGS.indexOf(String(w.rating)) >= 0 ? MP.RATINGS : MP.RATINGS.concat([String(w.rating)]);
    return '<tr' + (w.out ? ' class="out-row"' : '') + '>' +
      '<td data-label="Name"><input class="editable" data-field="name" data-id="' + w.id + '" value="' + MP.escape(w.name) + '"></td>' +
      '<td data-label="Grade"><input class="editable" style="max-width:3.2em" data-field="grade" data-id="' + w.id + '" value="' + MP.escape(w.grade) + '" inputmode="numeric"></td>' +
      '<td data-label="Weight">' + weightCellHTML(w) + '</td>' +
      '<td data-label="Rating"><select class="rating-select ' + MP.tierClass(w.rating) + '" data-rating="' + w.id + '">' +
        MP.options(ratingVals, w.rating) + '</select></td>' +
      '<td data-label="Notes"><input class="editable" data-field="notes" data-id="' + w.id + '" value="' + MP.escape(w.notes) + '"></td>' +
      '<td data-label="" class="row-actions">' +
        '<button class="link-btn" data-scratch-w="' + w.id + '">' + (w.out ? 'un-scratch' : 'scratch') + '</button>' +
        '<button class="del-btn" data-del="' + w.id + '" title="Remove wrestler">✕</button>' +
      '</td>' +
    '</tr>';
  }

  function matchesFilters(w, fGrade, fWeight, fRating) {
    if (fGrade && String(w.grade) !== fGrade) return false;
    if (fRating && String(w.rating) !== fRating) return false;
    if (fWeight) {
      var f = Number(fWeight);
      if (w.weight && w.weight.type === 'confirmed') { if (Number(w.weight.class) !== f) return false; }
      else if (w.weight) { if (!(Number(w.weight.min) <= f && f <= Number(w.weight.max))) return false; }
    }
    return true;
  }

  var filters = { grade: '', weight: '', rating: '' };

  function render(root, params) {
    var teams = S.teams();
    if (!teams.length) {
      root.className = 'shell wide';
      root.innerHTML = headerHTML('') +
        '<div class="panel"><div class="empty">No rosters yet.<br>Go back Home and create your team to start adding wrestlers.</div></div>';
      wireHeader(root);
      return;
    }

    var teamId = params[0] && S.team(params[0]) ? params[0] : (S.ourTeam() ? S.ourTeam().id : teams[0].id);
    var team = S.team(teamId);
    var roster = S.rosterOf(teamId);

    var teamOpts = teams.map(function (t) {
      return '<option value="' + t.id + '"' + (t.id === teamId ? ' selected' : '') + '>' + MP.escape(t.name) + (t.isOurs ? ' (our team)' : '') + '</option>';
    }).join('');

    var rows = roster.filter(function (w) { return matchesFilters(w, filters.grade, filters.weight, filters.rating); }).map(rowHTML).join('');

    root.className = 'shell wide';
    root.innerHTML = headerHTML('roster') +
      '<div class="panel">' +
        '<div class="roster-head">' +
          '<div class="roster-title-wrap">' +
            '<select class="team-select" id="teamSelect">' + teamOpts + '</select>' +
            (team.isOurs ? '<span class="our-badge">Our team</span>' : '<button class="btn btn-sm ghost" id="makeOurs">Set as our team</button>') +
          '</div>' +
          '<div class="actions">' +
            '<button class="btn" id="addBtn">+ Add wrestler</button>' +
            '<button class="btn" id="confirmWeightsBtn">Confirm weights</button>' +
            '<button class="btn primary" id="pasteBtn">Paste roster</button>' +
            '<button class="btn ghost" id="renameBtn">Rename</button>' +
            '<button class="btn danger" id="deleteBtn">Delete</button>' +
          '</div>' +
        '</div>' +

        '<div class="filters">' +
          '<select id="fGrade"><option value="">Grade: all</option>' + MP.options(['9', '10', '11', '12'], filters.grade) + '</select>' +
          '<select id="fWeight"><option value="">Weight class: all</option>' + MP.options(MP.WEIGHTS.map(String), filters.weight) + '</select>' +
          '<select id="fRating"><option value="">Rating: all</option>' + MP.options(['6', '5', '4', '3', '2', '1', '?'], filters.rating) + '</select>' +
          '<button class="btn btn-sm ghost" id="sortBtn" title="Sort by weight (min, then max), then grade, then name">↕ Sort by weight</button>' +
        '</div>' +

        '<table class="roster-table"><thead><tr>' +
          '<th style="width:24%">Name</th><th style="width:10%">Grade</th><th style="width:20%">Weight</th>' +
          '<th style="width:12%">Rating</th><th>Notes</th><th style="width:96px"></th>' +
        '</tr></thead><tbody>' +
          (rows || '') +
        '</tbody></table>' +
        (roster.length === 0 ? '<div class="empty" style="margin-top:14px">No wrestlers yet. Use “+ Add wrestler” or “Paste roster”.</div>' :
          (rows ? '' : '<div class="empty" style="margin-top:14px">No wrestlers match these filters.</div>')) +

        '<div class="legend">' +
          '<span><i style="background:#6b7280"></i>1 — Low/mid JV</span>' +
          '<span><i style="background:#5b8a72"></i>2 — Strong JV</span>' +
          '<span><i style="background:#3d7ab5"></i>3 — Varsity</span>' +
          '<span><i style="background:#4f9e6b"></i>4 — State qualifier</span>' +
          '<span><i style="background:#cf8a2e"></i>5 — State placer</span>' +
          '<span><i style="background:#b5403b"></i>6 — State champ</span>' +
          '<span><i style="background:#4a5260"></i>? — Insufficient data</span>' +
        '</div>' +
        '<p class="note">Tap any cell to edit — changes save automatically and update this wrestler everywhere they appear (lineups included). Confirmed weigh-in classes are locked; tap “reopen” to widen back to a range.</p>' +
      '</div>' +
      pasteModalHTML();

    wireHeader(root);

    root.querySelector('#teamSelect').addEventListener('change', function () { MP.router.go('#/roster/' + this.value); });
    var makeOurs = root.querySelector('#makeOurs');
    if (makeOurs) makeOurs.addEventListener('click', function () { S.setOurTeam(teamId); MP.rerender(); });

    root.querySelector('#confirmWeightsBtn').addEventListener('click', function () {
      S.unlockAndUnscratchRoster(teamId);
      MP.router.go('#/roster/' + teamId + '/confirm');
    });
    root.querySelector('#sortBtn').addEventListener('click', function () { S.sortRoster(teamId); MP.rerender(); });
    root.querySelector('#addBtn').addEventListener('click', function () {
      S.addWrestler(teamId, {});
      filters = { grade: '', weight: '', rating: '' };
      MP.rerender();
    });
    root.querySelector('#renameBtn').addEventListener('click', function () {
      var name = prompt('Rename roster', team.name);
      if (name && name.trim()) { S.renameTeam(teamId, name.trim()); MP.rerender(); }
    });
    root.querySelector('#deleteBtn').addEventListener('click', function () {
      if (confirm('Delete roster “' + team.name + '” and all its wrestlers? Duals involving this team are also removed. This cannot be undone.')) {
        S.removeTeam(teamId); MP.router.go('#/home');
      }
    });

    // Filters (re-render)
    ['fGrade', 'fWeight', 'fRating'].forEach(function (id) {
      root.querySelector('#' + id).addEventListener('change', function () {
        filters.grade = root.querySelector('#fGrade').value;
        filters.weight = root.querySelector('#fWeight').value;
        filters.rating = root.querySelector('#fRating').value;
        MP.rerender();
      });
    });

    // Inline edits (save on blur/change; no re-render so focus is preserved)
    root.querySelectorAll('input[data-field]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var id = inp.getAttribute('data-id'), field = inp.getAttribute('data-field');
        var val = field === 'grade' ? (parseInt(inp.value, 10) || '') : inp.value;
        var patch = {}; patch[field] = val; S.updateWrestler(id, patch);
      });
    });
    root.querySelectorAll('input[data-wmin], input[data-wmax]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var id = inp.getAttribute('data-wmin') || inp.getAttribute('data-wmax');
        var w = S.wrestler(id);
        var min = root.querySelector('input[data-wmin="' + id + '"]').value;
        var max = root.querySelector('input[data-wmax="' + id + '"]').value;
        S.setWrestlerRange(id, min, max);
      });
    });
    root.querySelectorAll('select[data-rating]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var id = sel.getAttribute('data-rating');
        S.updateWrestler(id, { rating: sel.value });
        sel.className = 'rating-select ' + MP.tierClass(sel.value);
      });
    });
    root.querySelectorAll('button[data-reopen]').forEach(function (b) {
      b.addEventListener('click', function () { S.reopenWrestlerWeight(b.getAttribute('data-reopen')); rerenderKeepScroll(); });
    });
    root.querySelectorAll('button[data-lock]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-lock');
        var minInput = root.querySelector('input[data-wmin="' + id + '"]');
        var cls = minInput ? Number(minInput.value) : 0;
        if (!cls) return;
        S.confirmWrestlerWeight(id, cls); rerenderKeepScroll();
      });
    });
    root.querySelectorAll('button[data-scratch-w]').forEach(function (b) {
      b.addEventListener('click', function () { S.toggleOut(b.getAttribute('data-scratch-w')); rerenderKeepScroll(); });
    });
    root.querySelectorAll('button[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var w = S.wrestler(b.getAttribute('data-del'));
        if (!w.name || confirm('Remove ' + (w.name || 'this wrestler') + '?')) { S.removeWrestler(b.getAttribute('data-del')); rerenderKeepScroll(); }
      });
    });

    wirePasteModal(root, teamId);
  }

  function headerHTML(label) {
    return '<button class="back-link" data-go="#/home">‹ Home</button>' +
      '<header class="top"><button class="wordmark" data-go="#/home">MAT PLAN <span>· ' + (label || 'roster') + '</span></button></header>';
  }
  function wireHeader(root) {
    root.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { MP.router.go(b.getAttribute('data-go')); });
    });
  }

  /* ---- Paste & review (spec §11) ---- */
  var staged = [];
  function pasteModalHTML() {
    return '<div class="overlay" id="pasteOverlay"><div class="modal">' +
      '<h3>Paste roster</h3>' +
      '<p class="hint">Paste names from Trackwrestling or anywhere else, one per line (a trailing number is read as a weight). Review and clean up before committing — nothing saves to the roster automatically.</p>' +
      '<textarea id="pasteArea" placeholder="Jordan Mackey 138\nTate Whitfield 150\nCole Renner 165"></textarea>' +
      '<div style="margin-top:10px"><button class="btn" id="parseBtn">Parse lines →</button></div>' +
      '<div class="stage-list" id="stageList"></div>' +
      '<div class="stage-count" id="stageCount"></div>' +
      '<div class="modal-actions">' +
        '<button class="btn ghost" id="pasteCancel">Cancel</button>' +
        '<button class="btn primary" id="commitBtn">Commit to roster</button>' +
      '</div>' +
    '</div></div>';
  }
  function renderStaged(root) {
    var list = root.querySelector('#stageList');
    list.innerHTML = staged.map(function (s, i) {
      return '<div class="stage-row">' +
        '<input data-sname="' + i + '" value="' + MP.escape(s.name) + '">' +
        '<input class="wt-in" data-swt="' + i + '" value="' + MP.escape(s.weight) + '" placeholder="wt">' +
        '<button class="del-btn" data-srm="' + i + '">✕</button></div>';
    }).join('');
    root.querySelector('#stageCount').textContent = staged.length ? (staged.length + ' wrestler' + (staged.length === 1 ? '' : 's') + ' staged') : '';
    list.querySelectorAll('input[data-sname]').forEach(function (inp) {
      inp.addEventListener('change', function () { staged[+inp.getAttribute('data-sname')].name = inp.value; });
    });
    list.querySelectorAll('input[data-swt]').forEach(function (inp) {
      inp.addEventListener('change', function () { staged[+inp.getAttribute('data-swt')].weight = inp.value; });
    });
    list.querySelectorAll('button[data-srm]').forEach(function (b) {
      b.addEventListener('click', function () { staged.splice(+b.getAttribute('data-srm'), 1); renderStaged(root); });
    });
  }
  function wirePasteModal(root, teamId) {
    var overlay = root.querySelector('#pasteOverlay');
    function close() { overlay.classList.remove('open'); staged = []; root.querySelector('#pasteArea').value = ''; root.querySelector('#stageList').innerHTML = ''; root.querySelector('#stageCount').textContent = ''; }
    root.querySelector('#pasteBtn').addEventListener('click', function () { overlay.classList.add('open'); });
    root.querySelector('#pasteCancel').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    root.querySelector('#parseBtn').addEventListener('click', function () {
      var lines = root.querySelector('#pasteArea').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      staged = lines.map(function (line) {
        var m = line.match(/^(.*\D)\s+(\d{2,3})\s*$/);
        return m ? { name: m[1].trim(), weight: m[2] } : { name: line, weight: '' };
      });
      renderStaged(root);
    });
    root.querySelector('#commitBtn').addEventListener('click', function () {
      staged.forEach(function (s) {
        if (!s.name) return;
        var wt = Number(s.weight) || 106;
        S.addWrestler(teamId, { name: s.name, min: wt, max: wt });
      });
      close(); MP.rerender();
    });
  }

  MP.views = MP.views || {};
  MP.views.roster = { render: render };
})(window.MP);
