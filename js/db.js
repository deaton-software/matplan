/* Mat Plan — local persistence (spec §9, offline-first).
   The entire app state is stored as a single IndexedDB record. One blob keeps
   the storage layer trivial and leaves a clean seam for a future sync layer.
   Falls back to localStorage if IndexedDB is unavailable (e.g. private mode). */
window.MP = window.MP || {};
(function (MP) {
  'use strict';

  var DB_NAME = 'matplan';
  var STORE = 'state';
  var KEY = 'app';
  var VERSION = 1;
  var LS_KEY = 'matplan:state';

  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!('indexedDB' in window)) { reject(new Error('no-indexeddb')); return; }
      var req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  MP.db = {
    load: function () {
      return openDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE, 'readonly');
          var r = tx.objectStore(STORE).get(KEY);
          r.onsuccess = function () { resolve(r.result || null); };
          r.onerror = function () { reject(r.error); };
        });
      }).catch(function () {
        try {
          var raw = localStorage.getItem(LS_KEY);
          return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
      });
    },

    save: function (state) {
      return openDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(state, KEY);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { reject(tx.error); };
        });
      }).catch(function () {
        try { localStorage.setItem(LS_KEY, JSON.stringify(state)); return true; }
        catch (e) { return false; }
      });
    }
  };

})(window.MP);
