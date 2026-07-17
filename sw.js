/* DART FOG service worker v5.2
   HTML (navigations): network-first with 4s timeout -> instant offline fallback to cache,
   and any completed download always refreshes the cache in the background.
   Other requests (icon etc.): cache-first with background revalidate. */
var CACHE = 'dart-fog-v5.2';

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
  var isDoc = e.request.mode === 'navigate' ||
              (e.request.destination === 'document') ||
              /\.html($|\?)/.test(e.request.url);
  e.respondWith(
    caches.open(CACHE).then(function(c){
      return c.match(e.request).then(function(hit){
        // network fetch always updates the cache when it completes
        var net = fetch(e.request).then(function(r){
          if (r && r.status === 200) c.put(e.request, r.clone());
          return r;
        });
        if (isDoc) {
          if (!hit) return net;                       // nothing cached yet
          // network-first with timeout; cache fallback, download continues in background
          var timer = new Promise(function(res){ setTimeout(function(){ res(hit); }, 4000); });
          return Promise.race([net.catch(function(){ return hit; }), timer]);
        }
        // non-document: cache-first, revalidate silently
        net.catch(function(){});
        return hit || net;
      });
    })
  );
});
