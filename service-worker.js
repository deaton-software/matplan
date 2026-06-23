/* Mat Plan service worker — offline-first app shell (spec §9).
   Precaches local files; runtime-caches everything else (incl. Google Fonts)
   so the app is fully usable with zero connectivity after the first load. */
var CACHE = 'matplan-v14';
var SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/util.js',
  './js/db.js',
  './js/seed.js',
  './js/store.js',
  './js/sync.js',
  './js/router.js',
  './js/app.js',
  './js/views/home.js',
  './js/views/roster.js',
  './js/views/planDual.js',
  './js/views/confirmWeights.js',
  './js/views/confirmTeamWeights.js',
  './manifest.webmanifest',
  './icons/icon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  // Sync traffic must never be cached: GitHub API reads (publish/pull) always go to
  // the network, or a stale cached copy would defeat the whole point of pulling.
  if (req.url.indexOf('api.github.com') !== -1 ||
      req.url.indexOf('githubusercontent.com') !== -1 ||
      req.url.indexOf('matplan-data.json') !== -1) {
    e.respondWith(fetch(req).catch(function () { return caches.match(req); }));
    return;
  }
  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { try { c.put(req, copy); } catch (err) {} });
        return res;
      }).catch(function () { return cached; });
    })
  );
});
