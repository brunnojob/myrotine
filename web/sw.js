const CACHE='myrotine-shell-v2';
const ASSETS=['./','./index.html','./style.css','./fonts.css','./app.js','./assistant.js','./domain.js','./evidence.js','./manifest.webmanifest','./assets/logo.png','./assets/favicon.png','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('myrotine-shell-')&&k!==CACHE).map(k=>caches.delete(k)))));});
self.addEventListener('fetch',e=>{if(new URL(e.request.url).pathname.startsWith('/api/'))return;if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return r;}).catch(()=>caches.match(e.request).then(r=>r||new Response('Recurso indisponível offline',{status:503}))));});
