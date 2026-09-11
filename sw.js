/* My Workouts: يفتح التطبيق بدون نت، ويجيب آخر نسخة لما يكون فيه نت.
   قالب — build_app.py يعبّي f9546f2ddf و https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;900&family=Readex+Pro:wght@400;500;600&display=swap وينسخه لـ my-workouts/sw.js */
var VERSION = 'mw-f9546f2ddf';
var FONTS = 'fonts-v1';
var FONT_CSS = 'https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;900&family=Readex+Pro:wght@400;500;600&display=swap';
var SHELL = ['./', './manifest.json', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png'];

function fresh(u) { return new Request(u, { cache: 'reload' }); }

/* الخطوط تنحفظ من أول مرة عشان شكل التطبيق يبقى نفسه بدون نت */
function cacheFonts() {
  return caches.open(FONTS).then(function (c) {
    return c.match(FONT_CSS).then(function (had) {
      if (had) return;
      return fetch(FONT_CSS, { mode: 'cors' }).then(function (r) {
        if (!r.ok) return;
        return r.clone().text().then(function (css) {
          var urls = [], m, re = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;
          while ((m = re.exec(css))) urls.push(m[1]);
          return Promise.all(urls.map(function (u) {
            return fetch(u, { mode: 'cors' }).then(function (f) { if (f.ok) return c.put(u, f); });
          })).then(function () { return c.put(FONT_CSS, r); });
        });
      });
    });
  }).catch(function () {});
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (c) { return c.addAll(SHELL.map(fresh)); })
      .then(cacheFonts)
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf('mw-') === 0 && k !== VERSION;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function withTimeout(ms, p) {
  return new Promise(function (ok, no) {
    var t = setTimeout(function () { no(new Error('slow network')); }, ms);
    p.then(function (r) { clearTimeout(t); ok(r); }, function (err) { clearTimeout(t); no(err); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  /* الصفحة: آخر نسخة من النت، ولو النت ضعيف (4 ثواني) أو مقطوع تفتح المحفوظة */
  if (req.mode === 'navigate') {
    var save = null;
    var net = fetch(req.url, { cache: 'no-cache' }).then(function (r) {
      if (r.ok) {
        var copy = r.clone();
        save = caches.open(VERSION).then(function (c) { return c.put('./', copy); });
      }
      return r;
    });
    e.waitUntil(net.then(function () { return save; }, function () {}));
    e.respondWith(withTimeout(4000, net).catch(function () {
      return caches.match('./').then(function (hit) { return hit || net; });
    }));
    return;
  }

  /* الخطوط: من المحفوظ أول */
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(function (c) {
      return c.match(req, { ignoreVary: true }).then(function (hit) {
        return hit || fetch(req).then(function (r) {
          if (r.ok || r.type === 'opaque') c.put(req, r.clone());
          return r;
        });
      });
    }));
    return;
  }

  /* الأيقونات وملف التطبيق */
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || fetch(req); }));
  }
});
