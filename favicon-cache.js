// ===== Portab - Favicon Cache =====
// Caches favicons in chrome.storage.local to avoid repeated network requests.

(function() {
  const CACHE_KEY = 'faviconCacheV1';
  const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  const FAILED_TTL = 24 * 60 * 60 * 1000;    // 1 day for failed lookups

  let memCache = null;
  let loadPromise = null;

  async function loadCache() {
    if (memCache) return memCache;
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      const data = await chrome.storage.local.get(CACHE_KEY);
      memCache = data[CACHE_KEY] || {};
      return memCache;
    })();
    return loadPromise;
  }

  async function saveCache() {
    if (!memCache) return;
    await chrome.storage.local.set({ [CACHE_KEY]: memCache });
  }

  async function getCachedFavicon(domain) {
    if (!domain) return null;
    const cache = await loadCache();
    const entry = cache[domain];
    if (!entry) return null;
    const age = Date.now() - entry.ts;
    const ttl = entry.status === 'ok' ? CACHE_TTL : FAILED_TTL;
    if (age > ttl) {
      delete cache[domain];
      saveCache();
      return null;
    }
    return entry;
  }

  async function setCachedFavicon(domain, url, status) {
    if (!domain) return;
    const cache = await loadCache();
    cache[domain] = { url, status, ts: Date.now() };
    saveCache();
  }

  async function resolveFavicon(domain, pageUrl, size = 32) {
    // 1. Try cache
    const cached = await getCachedFavicon(domain);
    if (cached && cached.status === 'ok' && cached.url) {
      return cached.url;
    }

    // 2. Only _favicon/ API — instant, no network
    if (pageUrl) {
      var url = chrome.runtime.getURL('_favicon/') + '?pageUrl=' + encodeURIComponent(pageUrl) + '&size=' + size;
      try {
        var ok = await new Promise(function(resolve) {
          var img = new Image();
          var t = setTimeout(function() { img.onload = img.onerror = null; resolve(false); }, 1000);
          img.onload = function() { clearTimeout(t); resolve(true); };
          img.onerror = function() { clearTimeout(t); resolve(false); };
          img.src = url;
        });
        if (ok) {
          await setCachedFavicon(domain, url, 'ok');
          return url;
        }
      } catch (e) {}
    }

    await setCachedFavicon(domain, '', 'failed');
    return null;
  }

  async function clearFaviconCache() {
    memCache = {};
    await chrome.storage.local.remove(CACHE_KEY);
  }

  // Expose to window
  window.FaviconCache = { resolveFavicon, clearFaviconCache };
})();
