/* Mat Plan — publish/pull sync via the GitHub Contents API (no backend, no deploys).
   Publish writes matplan-data.json straight into the public GitHub repo; Pull reads
   it back fresh. Writing needs a fine-grained token (Contents: read/write); each
   device stores that token locally and it NEVER leaves the device or rides along in
   the published snapshot. Reading is public, so Pull works with or without a token. */
window.MP = window.MP || {};
(function (MP) {
  'use strict';

  // --- Repo config (public repo; GitHub Pages serves the app from it) ---
  var OWNER  = 'deaton-software';
  var REPO   = 'matplan';
  var BRANCH = 'main';
  var PATH   = 'matplan-data.json';
  var API = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + PATH;

  // --- Device-local publish token (paste once per device in "Sync setup") ---
  var TOKEN_KEY = 'matplan:ghToken';
  function getToken() { try { return (localStorage.getItem(TOKEN_KEY) || '').trim(); } catch (e) { return ''; } }
  function setToken(t) {
    try { (t && t.trim()) ? localStorage.setItem(TOKEN_KEY, t.trim()) : localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }
  function hasToken() { return !!getToken(); }

  function headers(accept) {
    var h = { 'Accept': accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    var t = getToken();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }

  // Turn a GitHub error response into a plain-English message.
  function ghError(status, body) {
    if (status === 401) return 'GitHub rejected the token (401). Re-paste it in Sync setup — it may be wrong or expired.';
    if (status === 403) return 'GitHub refused (403). The token may lack “Contents: read/write”, or you hit a rate limit.';
    if (status === 404) return 'Repo or file not found (404). Check the repo name and that it is public.';
    if (status === 409) return 'Someone else just published (409). Pull, re-check, then Publish again.';
    if (status === 422) return 'GitHub rejected the write (422) — likely a stale version id. Try Publish again.';
    return 'GitHub error ' + status + (body && body.message ? ': ' + body.message : '');
  }

  // UTF-8-safe base64 (wrestler names may contain accented characters).
  function b64(str) { return btoa(unescape(encodeURIComponent(str))); }

  function snapshot() {
    var s = MP.store.state;
    return {
      type: 'matplan-snapshot',
      version: 1,
      publishedAt: Date.now(),
      app: { teams: s.teams, wrestlers: s.wrestlers, duals: s.duals, settings: s.settings }
    };
  }

  // Fetch the current file's blob sha (needed to overwrite it). null if it doesn't exist yet.
  function currentSha() {
    return fetch(API + '?ref=' + BRANCH + '&t=' + Date.now(), { headers: headers(), cache: 'no-store' })
      .then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(ghError(r.status, j)); });
        return r.json().then(function (j) { return j.sha || null; });
      });
  }

  MP.sync = {
    getToken: getToken,
    setToken: setToken,
    hasToken: hasToken,

    // Write a fresh snapshot into the repo via the Contents API.
    publish: function () {
      if (!hasToken()) {
        return Promise.reject(new Error('No publish token on this device. Add it in “Sync setup” first.'));
      }
      var snap = snapshot();
      var json = JSON.stringify(snap, null, 2);
      return currentSha().then(function (sha) {
        var body = {
          message: 'Publish ' + new Date(snap.publishedAt).toISOString(),
          content: b64(json),
          branch: BRANCH
        };
        if (sha) body.sha = sha; // update existing file; omit on first-ever publish
        return fetch(API, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(function (r) {
          if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(ghError(r.status, j)); });
          MP.store.markPublished(snap.publishedAt);
          return { ok: true, mode: 'github', publishedAt: snap.publishedAt };
        });
      });
    },

    // Fetch the published snapshot fresh (raw content, never cached). null if none/offline.
    fetchRemote: function () {
      return fetch(API + '?ref=' + BRANCH + '&t=' + Date.now(),
        { headers: headers('application/vnd.github.raw'), cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) return null;          // 404 = nothing published yet
          return r.json();
        }).catch(function () { return null; });
    },

    // Is a newer published version available than this device last pulled?
    checkForUpdate: function () {
      return MP.sync.fetchRemote().then(function (snap) {
        if (!snap || !snap.publishedAt) return { available: false };
        var last = MP.store.state.lastPulledAt || 0;
        return { available: snap.publishedAt > last, publishedAt: snap.publishedAt };
      });
    },

    // Replace this device's data with the published snapshot.
    pull: function () {
      return MP.sync.fetchRemote().then(function (snap) {
        if (!snap || !snap.app) throw new Error('Nothing has been published to the repo yet.');
        MP.store.importSnapshot(snap);
        return snap;
      });
    }
  };
})(window.MP);
