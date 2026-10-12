/* Offline support for the Chord Sheet Maker page (chords.html).
   Only that one page is handled; every other request goes straight to the network,
   so this is safe to host at the root of the STWC site.
   The page registers this file as chords-sw.js?p=<its own path>. */
var CACHE = 'chord-sheet-maker-v1';
var KEY = 'chord-sheet-page';
var PAGE = decodeURIComponent((new URL(self.location.href)).searchParams.get('p') || '/');

function norm(p){ return p.replace(/index\.html$/,'').replace(/\.html$/,'').replace(/\/+$/,'') || '/'; }
var PAGE_N = norm(PAGE);

function isOurPage(res, text){ return res && res.ok && /<title>Chord Sheet Maker<\/title>/.test(text); }

// Redirected responses can't be used to answer a navigation, so rebuild a clean one.
function clean(res, body){
  return new Response(body, {status:200, statusText:'OK', headers:{'Content-Type':'text/html; charset=utf-8'}});
}

function fetchAndStore(){
  return fetch(PAGE, {cache:'reload'}).then(function(res){
    return res.clone().text().then(function(text){
      if(!isOurPage(res, text)) throw new Error('not the chord page');
      return caches.open(CACHE).then(function(c){ return c.put(KEY, clean(res, text)); }).then(function(){ return text; });
    });
  });
}

self.addEventListener('install', function(e){
  e.waitUntil(fetchAndStore().catch(function(){}).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(ks){
      return Promise.all(ks.filter(function(k){return k!==CACHE && k.indexOf('chord-sheet-maker')===0}).map(function(k){return caches.delete(k)}));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request, url = new URL(req.url);
  if(req.mode!=='navigate' || url.origin!==self.location.origin || norm(url.pathname)!==PAGE_N) return;

  e.respondWith(
    new Promise(function(resolve){
      var done = false;
      function fromCache(){
        caches.open(CACHE).then(function(c){ return c.match(KEY); }).then(function(r){
          if(!done){ done = true; resolve(r || fetch(req)); }
        });
      }
      var t = setTimeout(fromCache, 4000);                    // slow or no connection: use the saved copy
      fetchAndStore().then(function(text){
        clearTimeout(t);
        if(!done){ done = true; resolve(clean(null, text)); }
      }).catch(function(){ clearTimeout(t); fromCache(); });
    })
  );
});
