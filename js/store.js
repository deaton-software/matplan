/* Mat Plan — in-memory app state, mutations, selectors, and a lightweight
   change log (spec §8). Every mutation updates state, appends a log entry where
   meaningful, and schedules a debounced save. Views read via selectors and call
   MP.rerender() after mutating. */
window.MP = window.MP || {};
(function (MP) {
  'use strict';

  var state = null;
  var saveTimer = null;

  function emptyState() {
    return {
      version: 1,
      teams: [],
      wrestlers: [],
      duals: [],
      changeLog: [],
      settings: { ourTeamId: null }
    };
  }

  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { if (state) MP.db.save(state); }, 200);
  }

  function log(summary) {
    state.changeLog.unshift({ ts: Date.now(), summary: summary });
    if (state.changeLog.length > 100) state.changeLog.length = 100;
  }

  function find(arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }

  // Replace rosters/wrestlers with MP.SEED and clear duals (one-time, tag-gated).
  function applySeed() {
    state.teams = [];
    state.wrestlers = [];
    state.duals = [];
    state.settings.ourTeamId = null;
    MP.SEED.teams.forEach(function (t) {
      var team = { id: MP.uid('team'), name: t.name, isOurs: !!t.isOurs, createdAt: Date.now() };
      state.teams.push(team);
      if (t.isOurs) state.settings.ourTeamId = team.id;
      (t.wrestlers || []).forEach(function (w) {
        state.wrestlers.push({
          id: MP.uid('w'), teamId: team.id, name: w.name,
          grade: (w.grade === '' || w.grade == null) ? '' : w.grade,
          weight: w.weight || { type: 'range', min: 106, max: 106 },
          rating: w.rating || '?', notes: w.notes || '', lastModified: Date.now()
        });
      });
    });
    state.seedTag = MP.SEED.tag;
    log('Loaded rosters from Wrestling Scouting workbook');
    persist();
  }

  var store = {
    get state() { return state; },

    init: function () {
      return MP.db.load().then(function (loaded) {
        state = (loaded && loaded.version) ? loaded : emptyState();
        if (!state.teams) state.teams = [];
        if (!state.wrestlers) state.wrestlers = [];
        if (!state.duals) state.duals = [];
        if (!state.changeLog) state.changeLog = [];
        if (!state.settings) state.settings = { ourTeamId: null };
        // First-run seed only: give a brand-new (empty) device the baseline rosters
        // so it's never blank before the first pull. Never wipes an in-use device.
        if (MP.SEED && !state.seedTag && state.teams.length === 0) applySeed();
        return state;
      });
    },

    save: persist,
    changeLog: function () { return state.changeLog; },

    // ---------- Teams ----------
    teams: function () { return state.teams; },
    team: function (id) { return find(state.teams, id); },
    ourTeam: function () {
      var t; state.teams.forEach(function (x) { if (x.isOurs) t = x; }); return t || null;
    },
    addTeam: function (name) {
      var t = { id: MP.uid('team'), name: (name || 'New team').trim(), isOurs: false, createdAt: Date.now() };
      if (!state.teams.some(function (x) { return x.isOurs; })) {
        t.isOurs = true; state.settings.ourTeamId = t.id;
      }
      state.teams.push(t);
      log('Created roster "' + t.name + '"');
      persist();
      return t;
    },
    renameTeam: function (id, name) {
      var t = store.team(id); if (!t) return;
      t.name = name; log('Renamed roster to "' + name + '"'); persist();
    },
    setOurTeam: function (id) {
      state.teams.forEach(function (t) { t.isOurs = (t.id === id); });
      state.settings.ourTeamId = id;
      log('Set "our team"'); persist();
    },
    removeTeam: function (id) {
      var t = store.team(id);
      state.teams = state.teams.filter(function (x) { return x.id !== id; });
      state.wrestlers = state.wrestlers.filter(function (w) { return w.teamId !== id; });
      state.duals = state.duals.filter(function (d) { return d.ourTeamId !== id && d.oppTeamId !== id; });
      if (state.settings.ourTeamId === id) state.settings.ourTeamId = null;
      log('Deleted roster' + (t ? ' "' + t.name + '"' : '')); persist();
    },

    // ---------- Wrestlers ----------
    rosterOf: function (teamId) {
      return state.wrestlers.filter(function (w) { return w.teamId === teamId; });
    },
    wrestler: function (id) { return find(state.wrestlers, id); },
    addWrestler: function (teamId, data) {
      data = data || {};
      var w = {
        id: MP.uid('w'),
        teamId: teamId,
        name: data.name || '',
        grade: data.grade != null ? data.grade : 9,
        weight: data.weight || { type: 'range', min: Number(data.min || 106), max: Number(data.max || 106) },
        rating: data.rating || '?',
        notes: data.notes || '',
        lastModified: Date.now()
      };
      state.wrestlers.push(w);
      persist();
      return w;
    },
    updateWrestler: function (id, patch) {
      var w = store.wrestler(id); if (!w) return;
      Object.keys(patch).forEach(function (k) { w[k] = patch[k]; });
      w.lastModified = Date.now();
      persist();
    },
    setWrestlerRange: function (id, min, max) {
      var w = store.wrestler(id); if (!w) return;
      w.weight = { type: 'range', min: Number(min), max: Number(max) };
      delete w.prevRange;
      w.lastModified = Date.now(); persist();
    },
    // Confirm a weigh-in: permanently collapse the roster weight to one class
    // (user decision). Remember the prior range so reopen can restore it (spec §5.4).
    confirmWrestlerWeight: function (id, cls) {
      var w = store.wrestler(id); if (!w) return;
      if (w.weight && w.weight.type === 'range') w.prevRange = { min: w.weight.min, max: w.weight.max };
      w.weight = { type: 'confirmed', class: Number(cls) };
      w.lastModified = Date.now();
      log(w.name + ' confirmed at ' + cls);
      persist();
    },
    reopenWrestlerWeight: function (id) {
      var w = store.wrestler(id); if (!w) return;
      var fallback = (w.weight && w.weight.class) || 106;
      var r = w.prevRange || { min: fallback, max: fallback };
      w.weight = { type: 'range', min: r.min, max: r.max };
      delete w.prevRange;
      w.lastModified = Date.now();
      log(w.name + ' weight reopened to range'); persist();
    },
    removeWrestler: function (id) {
      state.wrestlers = state.wrestlers.filter(function (w) { return w.id !== id; });
      persist();
    },
    // Roster-level scratch: marks a wrestler "out" so they're excluded from all lineups.
    toggleOut: function (id) {
      var w = store.wrestler(id); if (!w) return;
      w.out = !w.out; w.lastModified = Date.now();
      log((w.out ? 'Scratched ' : 'Un-scratched ') + (w.name || 'wrestler'));
      persist();
    },
    // Reorder one team's wrestlers in place (weight → grade → name); persists.
    sortRoster: function (teamId) {
      var idx = [];
      state.wrestlers.forEach(function (w, i) { if (w.teamId === teamId) idx.push(i); });
      var sorted = idx.map(function (i) { return state.wrestlers[i]; }).sort(MP.compareRoster);
      idx.forEach(function (i, k) { state.wrestlers[i] = sorted[k]; });
      log('Sorted roster by weight'); persist();
    },
    // Reset a whole team for a fresh confirm-weights pass: reopen every confirmed
    // weight (restoring its prior range) and clear every roster-level scratch.
    unlockAndUnscratchRoster: function (teamId) {
      var changed = 0;
      state.wrestlers.forEach(function (w) {
        if (w.teamId !== teamId) return;
        var did = false;
        if (w.weight && w.weight.type === 'confirmed') {
          var r = w.prevRange || { min: w.weight.class, max: w.weight.class };
          w.weight = { type: 'range', min: r.min, max: r.max };
          delete w.prevRange; did = true;
        }
        if (w.out) { w.out = false; did = true; }
        if (did) { w.lastModified = Date.now(); changed++; }
      });
      if (changed) log('Unlocked & un-scratched roster (' + changed + ')');
      persist();
    },

    // ---------- Duals ----------
    duals: function () { return state.duals; },
    dual: function (id) { return find(state.duals, id); },
    addDual: function (data) {
      var first = { id: MP.uid('sc'), name: 'Base lineup', picks: {} };
      var d = {
        id: MP.uid('dual'),
        ourTeamId: data.ourTeamId,
        oppTeamId: data.oppTeamId,
        date: data.date || '',
        startWeight: Number(data.startWeight || 106),
        coinCall: data.coinCall || 'odds',
        weighedIn: false,
        scratched: [],
        scenarios: [first],
        activeScenarioId: first.id,
        createdAt: Date.now(),
        lastModified: Date.now()
      };
      state.duals.push(d);
      log('Created dual'); persist();
      return d;
    },
    updateDual: function (id, patch) {
      var d = store.dual(id); if (!d) return;
      Object.keys(patch).forEach(function (k) { d[k] = patch[k]; });
      d.lastModified = Date.now(); persist();
    },
    removeDual: function (id) {
      state.duals = state.duals.filter(function (d) { return d.id !== id; });
      log('Deleted dual'); persist();
    },
    dualStatus: function (d) { return d && d.weighedIn ? 'weighed' : 'planning'; },
    isScratched: function (d, wrestlerId) { return !!d && d.scratched.indexOf(wrestlerId) >= 0; },
    toggleScratch: function (dualId, wrestlerId) {
      var d = store.dual(dualId); if (!d) return;
      var i = d.scratched.indexOf(wrestlerId);
      if (i >= 0) d.scratched.splice(i, 1); else d.scratched.push(wrestlerId);
      d.lastModified = Date.now(); persist();
    },

    // ---------- Scenarios ----------
    activeScenario: function (d) {
      return find(d.scenarios, d.activeScenarioId) || d.scenarios[0];
    },
    addScenario: function (dualId) {
      var d = store.dual(dualId); if (!d) return null;
      var s = { id: MP.uid('sc'), name: 'Scenario ' + (d.scenarios.length + 1), picks: {} };
      d.scenarios.push(s); d.activeScenarioId = s.id; persist(); return s;
    },
    renameScenario: function (dualId, scId, name) {
      var d = store.dual(dualId); if (!d) return;
      var s = find(d.scenarios, scId); if (s) { s.name = name; persist(); }
    },
    removeScenario: function (dualId, scId) {
      var d = store.dual(dualId); if (!d || d.scenarios.length <= 1) return;
      d.scenarios = d.scenarios.filter(function (s) { return s.id !== scId; });
      if (d.activeScenarioId === scId) d.activeScenarioId = d.scenarios[0].id;
      persist();
    },
    setActiveScenario: function (dualId, scId) {
      var d = store.dual(dualId); if (!d) return;
      d.activeScenarioId = scId; persist();
    },
    setPick: function (dualId, scId, wt, field, value) {
      var d = store.dual(dualId); if (!d) return;
      var s = find(d.scenarios, scId); if (!s) return;
      if (!s.picks[wt]) s.picks[wt] = { our: null, their: null, outcome: 'none', key: false };
      s.picks[wt][field] = value;
      d.lastModified = Date.now(); persist();
    },

    // ---------- Publish / Pull (sync.js) ----------
    // Replace this device's data wholesale with a published desktop snapshot.
    importSnapshot: function (snap) {
      var a = snap.app || {};
      state.teams = a.teams || [];
      state.wrestlers = a.wrestlers || [];
      state.duals = a.duals || [];
      state.settings = a.settings || { ourTeamId: null };
      state.lastPulledAt = snap.publishedAt || Date.now();
      if (!state.seedTag) state.seedTag = (MP.SEED && MP.SEED.tag) || 'pulled'; // don't re-seed over a pull
      log('Pulled latest version from desktop');
      persist();
    },
    // Mark this device as current with what it just published (so it shows "up to date").
    markPublished: function (ts) {
      state.lastPulledAt = ts || Date.now();
      persist();
    }
  };

  MP.store = store;
})(window.MP);
