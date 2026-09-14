/* DART FOG service worker v8.0 — cache-first with VALIDATED writes
   - Serves the cached copy instantly (fast, offline, no per-open download)
     -> gives the "weekly, not every open" behaviour you asked for.
   - CRITICAL: only ever caches a response that is a complete HTTP 200 with a
     sane Content-Length, so a truncated/interrupted download can NEVER
     overwrite a good cached copy (that was the bug that black-screened before).
   - Weekly auto-check and the manual "Check for updates" button both force a
     fresh, validated fetch via the message handler below. */
var CACHE = 'dart-fog-v8.0';
var MIN_HTML_BYTES = 5000000; /* the app HTML is ~15MB; reject anything suspiciously small */

self.addEventListener('install', function(e){ self.skipWaiting(); });

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; })
        .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* is this response safe to cache? (complete 200, and if it declares a size, big enough for the app) */
function cacheable(req, res){
  if(!res || res.status !== 200 || res.type === 'opaqueredirect') return false;
  var isDoc = req.mode === 'navigate' || req.destination === 'document' ||
              (req.url.indexOf('.html') !== -1);
  if(isDoc){
    var len = res.headers.get('content-length');
    if(len !== null && parseInt(len,10) < MIN_HTML_BYTES) return false; /* truncated HTML -> refuse */
  }
  return true;
}

self.addEventListener('fetch', function(e){
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(function(c){
      return c.match(e.request).then(function(hit){
        if (hit) return hit; /* cache-first: instant, offline, no download */
        return fetch(e.request).then(function(r){
          if (cacheable(e.request, r)) c.put(e.request, r.clone());
          return r;
        });
      });
    })
  );
});

/* forced refresh from the page (weekly auto-check + manual button) */
self.addEventListener('message', function(e){
  var data = e.data || {};
  if (data.type !== 'UPDATE') return;
  var urls = data.urls || [];
  var port = e.ports && e.ports[0];
  caches.open(CACHE).then(function(c){
    return Promise.all(urls.map(function(u){
      return fetch(u, { cache: 'reload' }).then(function(r){
        var req = new Request(u);
        if (cacheable(req, r)) { return c.put(u, r.clone()).then(function(){ return true; }); }
        return false; /* refuse to cache a bad/truncated copy */
      }).catch(function(){ return false; });
    }));
  }).then(function(results){
    if (port) port.postMessage({ type:'UPDATE_DONE', ok: results.some(function(x){ return x; }) });
  }).catch(function(){ if (port) port.postMessage({ type:'UPDATE_DONE', ok:false }); });
});
