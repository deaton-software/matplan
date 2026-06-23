/* Mat Plan — tiny hash router. Maps the URL hash to a view + params and
   re-renders into #app. MP.rerender() repaints the current route after a mutation. */
window.MP = window.MP || {};
(function (MP) {
  'use strict';

  var routes = [
    { re: /^#\/dual\/([^/]+)\/confirm$/,   view: 'confirmWeights' },
    { re: /^#\/dual\/([^/]+)$/,            view: 'planDual' },
    { re: /^#\/roster\/([^/]+)\/confirm$/, view: 'confirmTeamWeights' },
    { re: /^#\/roster\/([^/]+)$/,          view: 'roster' },
    { re: /^#\/roster$/,                 view: 'roster' },
    { re: /^#\/home$/,                   view: 'home' },
    { re: /^#?\/?$/,                     view: 'home' }
  ];

  var current = { view: 'home', params: [] };

  function resolve(hash) {
    hash = hash || '#/home';
    for (var i = 0; i < routes.length; i++) {
      var m = hash.match(routes[i].re);
      if (m) return { view: routes[i].view, params: m.slice(1) };
    }
    return { view: 'home', params: [] };
  }

  MP.router = {
    get current() { return current; },

    go: function (hash) {
      if (location.hash === hash) MP.router.render();
      else location.hash = hash;
    },

    render: function () {
      current = resolve(location.hash);
      var root = document.getElementById('app');
      var view = MP.views[current.view] || MP.views.home;
      window.scrollTo(0, 0);
      view.render(root, current.params);
    },

    start: function () {
      window.addEventListener('hashchange', MP.router.render);
      MP.router.render();
    }
  };

  MP.rerender = function () { MP.router.render(); };
})(window.MP);
