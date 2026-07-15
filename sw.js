/* DART FOG service worker — offline cache, stale-while-revalidate */
var CACHE = 'dart-fog-v5.1';
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; })
        .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});
self.addEventListener('fetch', function(e){
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(function(c){
      return c.match(e.request).then(function(hit){
        var net = fetch(e.request).then(function(r){
          if (r && r.status === 200) c.put(e.request, r.clone());
          return r;
        }).catch(function(){ return hit; });
        return hit || net;
      });
    })
  );
});
