/* DART FOG service worker v6.0
   Strategy: cache-first for everything (instant open, offline, NO per-open download).
   Updates happen only when the page asks (weekly auto-check or manual "Update" button),
   via a postMessage the page sends; the SW then fetches fresh, updates the cache, and replies. */
var CACHE = 'dart-fog-v6.0';

self.addEventListener('install', function(e){ self.skipWaiting(); });

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; })
        .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* cache-first: serve cached instantly; only hit network if not cached yet (first ever load) */
self.addEventListener('fetch', function(e){
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(function(c){
      return c.match(e.request).then(function(hit){
        if (hit) return hit;
        return fetch(e.request).then(function(r){
          if (r && r.status === 200) c.put(e.request, r.clone());
          return r;
        });
      });
    })
  );
});

/* forced update: page sends {type:'UPDATE', urls:[...]}; fetch fresh (bypassing HTTP cache),
   replace in cache, then tell the page whether anything changed */
self.addEventListener('message', function(e){
  var data = e.data || {};
  if (data.type !== 'UPDATE') return;
  var urls = data.urls || [];
  var port = e.ports && e.ports[0];
  caches.open(CACHE).then(function(c){
    return Promise.all(urls.map(function(u){
      return fetch(u, { cache: 'reload' }).then(function(r){
        if (r && r.status === 200) { return c.put(u, r.clone()).then(function(){ return true; }); }
        return false;
      }).catch(function(){ return false; });
    }));
  }).then(function(results){
    var ok = results.some(function(x){ return x; });
    if (port) port.postMessage({ type: 'UPDATE_DONE', ok: ok });
  }).catch(function(){
    if (port) port.postMessage({ type: 'UPDATE_DONE', ok: false });
  });
});
