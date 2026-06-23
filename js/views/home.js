/* Mat Plan — Home (spec §12.A). Two sections: Duals and Rosters, each with an
   inline "+ New" form. Cards open the Plan Dual / Roster screens. */
window.MP = window.MP || {};
(function (MP) {
  'use strict';
  var S = MP.store;

  function dualCard(d) {
    var our = S.team(d.ourTeamId), opp = S.team(d.oppTeamId);
    var status = S.dualStatus(d);
    return '<div class="item-card" data-dual="' + d.id + '">' +
        '<div class="dual-info">' +
          '<div class="matchup"><span class="us">' + MP.escape(our ? our.name : 'Our team') + '</span> vs ' + MP.escape(opp ? opp.name : 'Opponent') + '</div>' +
          '<div class="meta">' + MP.escape(MP.fmtDate(d.date)) + '</div>' +
        '</div>' +
        '<span class="status-pill status-' + status + '">' + (status === 'weighed' ? 'Weighed in' : 'Planning') + '</span>' +
      '</div>';
  }

  function rosterCard(t) {
    var count = S.rosterOf(t.id).length;
    return '<div class="item-card" data-team="' + t.id + '">' +
        '<div class="roster-info">' +
          '<div class="tname">' + MP.escape(t.name) + '</div>' +
          '<div class="meta">' + count + ' wrestler' + (count === 1 ? '' : 's') + '</div>' +
        '</div>' +
        '<div class="card-trail">' + (t.isOurs ? '<span class="our-badge">Our team</span>' : '') + '<span class="chevron">›</span></div>' +
      '</div>';
  }

  function render(root) {
    var our = S.ourTeam();
    var teams = S.teams();
    var duals = S.duals();
    var teamOpts = teams.map(function (t) { return '<option value="' + t.id + '">' + MP.escape(t.name) + '</option>'; }).join('');
    var canCreateDual = teams.length >= 2;

    root.className = 'shell home';
    root.innerHTML =
      '<header class="top">' +
        '<button class="wordmark" data-go="#/home">MAT PLAN<span>' + MP.escape(our ? our.name : 'Dual planning') + '</span></button>' +
      '</header>' +

      '<div class="sync-banner" id="syncBanner" hidden>' +
        '<span>A newer published version is available.</span>' +
        '<button class="btn btn-sm primary" id="bannerPull">Pull now</button>' +
      '</div>' +
      '<div class="sync-bar">' +
        '<button class="btn btn-sm" id="pullBtn">⟳ Pull latest</button>' +
        '<button class="btn btn-sm ghost" id="publishBtn">⤴ Publish</button>' +
        '<button class="btn btn-sm ghost" data-toggle="syncSetup" id="syncCog">⚙ Sync setup</button>' +
        '<span class="sync-status" id="syncStatus"></span>' +
      '</div>' +
      '<div class="inline-form" id="syncSetup">' +
        '<div class="row"><div class="field">' +
          '<label>GitHub publish token (saved only on this device)</label>' +
          '<input type="password" id="ghToken" placeholder="github_pat_…" autocomplete="off" autocapitalize="off" spellcheck="false">' +
        '</div></div>' +
        '<div class="form-actions">' +
          '<span class="sync-status" id="tokenState"></span>' +
          '<button class="btn-sm ghost" id="ghClear">Remove</button>' +
          '<button class="btn-sm primary" id="ghSave">Save token</button>' +
        '</div>' +
      '</div>' +

      '<div class="section">' +
        '<div class="section-head"><h2>Duals</h2><button class="add-btn" data-toggle="dualForm">+ New dual</button></div>' +
        '<div class="inline-form" id="dualForm">' +
          (canCreateDual ?
            '<div class="row">' +
              '<div class="field"><label>Our team</label><select id="ndOur">' + teamOpts + '</select></div>' +
              '<div class="field"><label>Opponent</label><select id="ndOpp">' + teamOpts + '</select></div>' +
            '</div>' +
            '<div class="row"><div class="field"><label>Date</label><input type="date" id="ndDate"></div></div>' +
            '<div class="form-actions">' +
              '<button class="btn-sm ghost" data-toggle="dualForm">Cancel</button>' +
              '<button class="btn-sm primary" id="ndCreate">Create dual</button>' +
            '</div>'
            :
            '<div class="empty">Create at least two rosters first (your team + an opponent), then you can plan a dual.</div>'
          ) +
        '</div>' +
        '<div class="card-list">' +
          (duals.length ? duals.map(dualCard).join('') : '<div class="empty">No duals yet. Add one to start planning a lineup.</div>') +
        '</div>' +
      '</div>' +

      '<div class="section">' +
        '<div class="section-head"><h2>Rosters</h2><button class="add-btn" data-toggle="rosterForm">+ New roster</button></div>' +
        '<div class="inline-form" id="rosterForm">' +
          '<div class="row"><div class="field"><label>Team name</label><input type="text" id="nrName" placeholder="e.g. Riverbend HS"></div></div>' +
          '<div class="form-actions">' +
            '<button class="btn-sm ghost" data-toggle="rosterForm">Cancel</button>' +
            '<button class="btn-sm primary" id="nrCreate">Create roster</button>' +
          '</div>' +
        '</div>' +
        '<div class="card-list">' +
          (teams.length ? teams.map(rosterCard).join('') : '<div class="empty">No rosters yet. Add your team and your opponents here.</div>') +
        '</div>' +
      '</div>';

    if (canCreateDual) {
      var ourSel = root.querySelector('#ndOur');
      var oppSel = root.querySelector('#ndOpp');
      if (our) ourSel.value = our.id;
      for (var i = 0; i < teams.length; i++) {
        if (teams[i].id !== ourSel.value) { oppSel.value = teams[i].id; break; }
      }
    }

    root.querySelectorAll('[data-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = root.querySelector('#' + b.getAttribute('data-toggle'));
        if (f) f.classList.toggle('open');
      });
    });
    root.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { MP.router.go(b.getAttribute('data-go')); });
    });
    root.querySelectorAll('[data-dual]').forEach(function (c) {
      c.addEventListener('click', function () { MP.router.go('#/dual/' + c.getAttribute('data-dual')); });
    });
    root.querySelectorAll('[data-team]').forEach(function (c) {
      c.addEventListener('click', function () { MP.router.go('#/roster/' + c.getAttribute('data-team')); });
    });

    var nr = root.querySelector('#nrCreate');
    if (nr) nr.addEventListener('click', function () {
      var name = root.querySelector('#nrName').value.trim();
      if (!name) return;
      var t = S.addTeam(name);
      MP.router.go('#/roster/' + t.id);
    });

    var nd = root.querySelector('#ndCreate');
    if (nd) nd.addEventListener('click', function () {
      var ourId = root.querySelector('#ndOur').value;
      var oppId = root.querySelector('#ndOpp').value;
      if (ourId === oppId) { alert('Pick two different teams for the dual.'); return; }
      var d = S.addDual({ ourTeamId: ourId, oppTeamId: oppId, date: root.querySelector('#ndDate').value });
      MP.router.go('#/dual/' + d.id);
    });

    // ---- Publish / Pull ----
    var statusEl = root.querySelector('#syncStatus');
    function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }
    var last = S.state.lastPulledAt;
    setStatus(last ? 'Last synced: ' + new Date(last).toLocaleString() : 'Not yet synced on this device.');

    // ---- Token (Sync setup) ----
    var tokenInput = root.querySelector('#ghToken');
    var tokenState = root.querySelector('#tokenState');
    function refreshTokenState() {
      tokenState.textContent = MP.sync.hasToken()
        ? 'Token saved on this device ✓ — you can Publish.'
        : 'No token on this device — Publish is disabled until you add one.';
    }
    refreshTokenState();
    root.querySelector('#ghSave').addEventListener('click', function () {
      MP.sync.setToken(tokenInput.value);
      tokenInput.value = '';
      refreshTokenState();
      setStatus(MP.sync.hasToken() ? 'Publish token saved.' : 'Token cleared.');
    });
    root.querySelector('#ghClear').addEventListener('click', function () {
      MP.sync.setToken('');
      tokenInput.value = '';
      refreshTokenState();
      setStatus('Publish token removed from this device.');
    });

    function doPull() {
      if (!confirm('Pull the latest published version? This replaces the rosters and duals on THIS device with the published copy.')) return;
      setStatus('Pulling…');
      MP.sync.pull().then(function () { MP.rerender(); }).catch(function (e) { setStatus(e.message || 'Pull failed.'); });
    }
    root.querySelector('#pullBtn').addEventListener('click', doPull);
    var bannerPull = root.querySelector('#bannerPull');
    if (bannerPull) bannerPull.addEventListener('click', doPull);

    root.querySelector('#publishBtn').addEventListener('click', function () {
      if (!MP.sync.hasToken()) {
        setStatus('Add a GitHub token in “⚙ Sync setup” before publishing.');
        var f = root.querySelector('#syncSetup'); if (f) f.classList.add('open');
        return;
      }
      setStatus('Publishing…');
      MP.sync.publish().then(function () {
        setStatus('Published ✓ — every device can Pull it now.');
      }).catch(function (e) { setStatus(e.message || 'Publish failed.'); });
    });

    // Launch nudge: reveal the banner if the published version is newer than this device's.
    MP.sync.checkForUpdate().then(function (u) {
      var banner = root.querySelector('#syncBanner');
      if (banner && u && u.available) banner.hidden = false;
    });
  }

  MP.views = MP.views || {};
  MP.views.home = { render: render };
})(window.MP);
