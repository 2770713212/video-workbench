const prefix = "cutlab:" + self.registration.scope + ":";
const cacheName = prefix + "v4.1";
const files = ["index.html","manifest.json","css/style.css","assets/icon.svg","assets/icon-192.png","assets/icon-512.png",
  ...["app","audio","demo-generator","detector","exporter","renderer","store"].map(name => "js/"+name+".js")];
const urls = new Set(files.map(path => new URL(path,self.registration.scope).href));
self.addEventListener("install", event => event.waitUntil((async () => {
  const cache = await caches.open(cacheName);
  await cache.addAll([...urls].map(url => new Request(url,{cache:"reload"})));
  await self.skipWaiting();
})()));
self.addEventListener("activate", event => event.waitUntil((async () => {
  await Promise.all((await caches.keys()).filter(k=>k.startsWith(prefix)&&k!==cacheName).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  url.search = "";
  if(url.href === self.registration.scope) url.pathname += "index.html";
  if(urls.has(url.href)) event.respondWith(caches.open(cacheName).then(async cache =>
    (await cache.match(url.href)) || fetch(event.request)));
});
