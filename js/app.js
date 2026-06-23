/* Mat Plan — bootstrap. Load persisted state, start the router, register the
   service worker for offline use. */
window.MP = window.MP || {};
(function (MP) {
  'use strict';

  MP.views = MP.views || {};

  MP.store.init().then(function () {
    MP.router.start();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./service-worker.js').catch(function () { /* offline cache optional */ });
    });
  }
})(window.MP);
