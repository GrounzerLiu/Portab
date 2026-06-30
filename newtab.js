// ===== Portab - New Tab Page =====

let pinnedUrls = new Set();
let pinnedData = new Map();
let cachedHistory = [];

// ===== DOM refs =====
const searchInput = document.getElementById('searchInput');
const pinnedGrid  = document.getElementById('pinnedGrid');
const historyGrid = document.getElementById('historyGrid');

// ===== Init =====
(async function init() {
  await loadSettings();
  initSettings();
  await loadTheme();
  await loadGrid();
  await loadHistoryRange();
  
  // Load cached wallpaper (apply immediately, fetch bing in background)
  await loadWallpaperCached();
  
  await loadSeedColor();
  await loadEngines();
  await loadClock();
  await renderAll();

  // Fade in — all content is ready
  requestAnimationFrame(() => {
    document.body.classList.add('ready');
  });

  // Fetch bing wallpaper update in background
  loadWallpaperBingUpdate();

  // Engine dropdown
  const engineBtn = document.getElementById('engineBtn');
  const engineDropdown = document.getElementById('engineDropdown');
  if (engineBtn) {
    engineBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      rebuildEngineDropdown();
      engineDropdown.classList.toggle('hidden');
    });
  }
  document.addEventListener('click', () => {
    if (engineDropdown && !engineDropdown.classList.contains('hidden')) {
      engineDropdown.classList.add('hidden');
      requestAnimationFrame(() => {
        if (document.activeElement !== searchInput) searchInput.focus();
      });
    }
  });

  // Auto-animate grid changes (FLIP: smooth add/remove/move)
  autoAnimate(pinnedGrid, { duration: 200 });
  autoAnimate(historyGrid, { duration: 200 });

  // SortableJS drag-and-drop for pinned tiles
  if (typeof Sortable !== 'undefined') {
    Sortable.create(pinnedGrid, {
      animation: 200,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      draggable: '.tile.pinned',
      onMove(evt, orig) {
        spotlightAll(orig.clientX, orig.clientY);
      },
      onEnd(evt) {
        // Rebuild pinnedData in new DOM order
        const order = [];
        pinnedGrid.querySelectorAll('.tile.pinned').forEach(t => {
          const url = t.getAttribute('href');
          if (pinnedData.has(url)) order.push(pinnedData.get(url));
        });
        pinnedData = new Map(order.map(v => [v.url, v]));
        savePinned();
      },
    });
  }

  // Search box focus state
  const searchBox = document.querySelector('.search-box');
  const searchPlaceholder = document.getElementById('searchPlaceholder');
  if (searchInput.value) {
    searchPlaceholder.classList.add('has-text');
    searchPlaceholder.textContent = searchInput.value;
  }
  searchInput.addEventListener('focus', () => {
    searchBox.classList.add('focused');
    document.body.classList.add('search-focused');
    // Show suggestions if input already has content
    if (searchInput.value.trim().length >= 2) {
      searchInput.dispatchEvent(new Event('input'));
    }
  });
  searchInput.addEventListener('blur', (e) => {
    if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.search-box')) return;
    searchBox.classList.remove('focused');
    document.body.classList.remove('search-focused');
    if (!searchInput.value) searchPlaceholder.textContent = '搜索或输入网址…';
  });
  searchInput.addEventListener('input', () => {
    searchPlaceholder.textContent = searchInput.value || '搜索或输入网址…';
    searchPlaceholder.classList.toggle('has-text', !!searchInput.value);
    searchClear.classList.toggle('visible', !!searchInput.value);
  });

  // Search button click
  // Search button
  document.getElementById('searchBtn').addEventListener('click', () => {
    searchInput.focus();
    const query = searchInput.value.trim();
    if (!query) return;
    const allEngines = getAllEngines();
    const eng = allEngines.find(e => e.id === currentEngine) || allEngines[0];
    if (eng) window.location.href = eng.url + encodeURIComponent(query);
  });
  // Prevent blur when clicking search icon
  document.getElementById('searchBtn').addEventListener('mousedown', (e) => e.preventDefault());

  // Clear button
  const searchClear = document.getElementById('searchClear');
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchPlaceholder.textContent = '搜索或输入网址…';
    searchPlaceholder.classList.remove('has-text');
    searchClear.classList.remove('visible');
    searchInput.focus();
    // Trigger input event to update suggestions
    searchInput.dispatchEvent(new Event('input'));
  });
  searchClear.addEventListener('mousedown', (e) => e.preventDefault());

  // Context menu
  document.querySelectorAll('.grid').forEach(grid => {
    grid.addEventListener('contextmenu', (e) => {
      const tile = e.target.closest('.tile');
      if (!tile) return;
      e.preventDefault();
      e.stopPropagation();
      showCtxMenu(e.clientX, e.clientY, tile);
    });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper') && !e.target.closest('.suggest-dropdown')) searchInput.blur();
    const m = document.getElementById('ctxMenu');
    if (m) m.classList.add('hidden');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const m = document.getElementById('ctxMenu');
      if (m) m.classList.add('hidden');
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper') && !e.target.closest('.suggest-dropdown')) searchInput.blur();
  });

  // ===== Clock =====
  function updateClockDisplay() {
    var now = new Date();
    var h = now.getHours();
    var m = String(now.getMinutes()).padStart(2, '0');
    var timeStr;
    if (window._clock24h !== false) {
      timeStr = String(h).padStart(2, '0') + ':' + m;
    } else {
      var ampm = h >= 12 ? '下午' : '上午';
      var h12 = h % 12 || 12;
      timeStr = ampm + ' ' + h12 + ':' + m;
    }
    var ct = document.getElementById('clockTime');
    var span = ct.querySelector('span');
    if (span) span.textContent = timeStr;
    ct.dataset.text = timeStr;
    document.getElementById('clockDate').textContent = 
      now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 星期' +
      ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    if (window.updateClockLayout) window.updateClockLayout();
  }
  window.updateClockDisplay = updateClockDisplay;
  updateClockDisplay();
  setInterval(updateClockDisplay, 10000);

  (function() {
    var wrapEl = document.getElementById('clockWrap');
    var timeEl = document.getElementById('clockTime');
    var spanEl = timeEl.querySelector('span');
    var glassEl = document.getElementById('glassBlur');
    var clipText = document.getElementById('clipText');
    var edgeSvg = document.getElementById('edgeSvg');
    var edgeText = document.getElementById('edgeText');
    var edgeGrad = document.getElementById('edgeGrad');

    function updateLayout() {
      if (!spanEl) return;
      var rect = wrapEl.getBoundingClientRect();
      var w = rect.width, h = rect.height;
      var cs = getComputedStyle(spanEl);

      var ls = cs.letterSpacing;
      // SVG clipPath
      var svgEl = document.getElementById('clipSvg');
      if (svgEl) {
        svgEl.setAttribute('width', w);
        svgEl.setAttribute('height', h);
        clipText.setAttribute('x', w / 2);
        clipText.setAttribute('y', h / 2);
        clipText.setAttribute('font-size', parseFloat(cs.fontSize));
        clipText.setAttribute('font-weight', cs.fontWeight);
        clipText.setAttribute('font-family', cs.fontFamily);
        clipText.setAttribute('letter-spacing', ls);
        clipText.textContent = spanEl.textContent;
        glassEl.style.clipPath = 'url(#textClip)';
        glassEl.style.webkitClipPath = 'url(#textClip)';
      }

      // Edge SVG
      if (edgeSvg) {
        edgeSvg.setAttribute('width', w);
        edgeSvg.setAttribute('height', h);
        edgeSvg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        edgeText.setAttribute('x', w / 2);
        edgeText.setAttribute('y', h / 2);
        edgeText.setAttribute('font-size', parseFloat(cs.fontSize));
        edgeText.setAttribute('font-weight', cs.fontWeight);
        edgeText.setAttribute('font-family', cs.fontFamily);
        edgeText.setAttribute('letter-spacing', ls);
        edgeText.textContent = spanEl.textContent;
      }

      // 同步 mask 中的文字
      var maskText = document.getElementById('maskText');
      if (maskText) {
        maskText.setAttribute('x', w / 2);
        maskText.setAttribute('y', h / 2);
        maskText.setAttribute('font-size', parseFloat(cs.fontSize));
        maskText.setAttribute('font-weight', cs.fontWeight);
        maskText.setAttribute('font-family', cs.fontFamily);
        maskText.setAttribute('letter-spacing', ls);
        maskText.textContent = spanEl.textContent;
      }
    }

    updateLayout();
    window.updateClockLayout = updateLayout;
    requestAnimationFrame(updateLayout);

    var lx = 0, ly = 0, aid = 0;
    function tick() {
      var r = wrapEl.getBoundingClientRect();
      timeEl.style.setProperty('--x', (lx - r.left) + 'px');
      timeEl.style.setProperty('--y', (ly - r.top) + 'px');

      var cx = ((lx - r.left) / r.width * 100).toFixed(2);
      var cy = ((ly - r.top) / r.height * 100).toFixed(2);
      edgeGrad.setAttribute('cx', cx + '%');
      edgeGrad.setAttribute('cy', cy + '%');

      aid = requestAnimationFrame(tick);
    }
    window.addEventListener('mousemove', function(e) {
      lx = e.clientX; ly = e.clientY;
      if (!aid) aid = requestAnimationFrame(tick);
    });
    window.addEventListener('mouseout', function(e) {
      if (!e.relatedTarget) { cancelAnimationFrame(aid); aid = 0; }
    });
    window.addEventListener('resize', updateLayout);
  })();

  // 缓存 spotlight 目标元素（卡片、搜索框等），卡片变化后刷新
  var _spotlightEls = null;
  function _getSpotlightEls() {
    if (!_spotlightEls) _spotlightEls = document.querySelectorAll('.tile, .search-box, .settings-btn, .refresh-wallpaper-btn, .add-shortcut-btn');
    return _spotlightEls;
  }
  function _refreshSpotlightEls() { _spotlightEls = null; }
  // renderAll 和 togglePin 等会改变卡片 DOM，结束后刷新缓存
  var _origRenderAll = renderAll;
  renderAll = function() { return _origRenderAll().then(function() { _refreshSpotlightEls(); }); };
  var _origTogglePin = togglePin;
  togglePin = function(item) { _refreshSpotlightEls(); return _origTogglePin(item); };

  // Spotlight hover — capsule distance field, throttled with rAF
  function spotlightOne(el, mx, my) {
    const r = el.getBoundingClientRect();
    const x = mx - r.left;
    const y = my - r.top;
    const m = Math.min(r.width, r.height);
    let distToAxis;
    if (r.width > r.height) {
      const ax = Math.max(m/2, Math.min(x, r.width - m/2));
      distToAxis = Math.hypot(x - ax, y - m/2);
    } else {
      const ay = Math.max(m/2, Math.min(y, r.height - m/2));
      distToAxis = Math.hypot(x - m/2, y - ay);
    }
    const glowDist = distToAxis - m/2;
    const range = parseFloat(getComputedStyle(el).getPropertyValue('--spotlight-range')) || 260;
    const glow = Math.min(1, Math.max(0, 1 - glowDist / range));
    el.style.setProperty('--x', x + 'px');
    el.style.setProperty('--y', y + 'px');
    el.style.setProperty('--glow', glow.toFixed(3));
  }
  function spotlightAll(mx, my) {
    _getSpotlightEls().forEach(el => spotlightOne(el, mx, my));
  }

  let spotlightMouseX = 0, spotlightMouseY = 0, spotlightPending = false;
  window.addEventListener('mousemove', (e) => {
    spotlightMouseX = e.clientX;
    spotlightMouseY = e.clientY;
    if (!spotlightPending) {
      spotlightPending = true;
      requestAnimationFrame(() => {
        spotlightPending = false;
        spotlightAll(spotlightMouseX, spotlightMouseY);
      });
    }
  });
  window.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget) {
      _getSpotlightEls().forEach(el => el.style.setProperty('--glow', '0'));
    }
  });

  // Right-click clock → toggle popup
  const clockPopup = document.getElementById('clockPopup');
  // Ensure popup starts hidden
  clockPopup.classList.add('hidden');
  document.getElementById('clock').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    clockPopup.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#clock')) clockPopup.classList.add('hidden');
  });

  // If input gained focus before we added listeners, fix it
  if (document.activeElement === searchInput) {
    searchBox.classList.add('focused');
    document.body.classList.add('search-focused');
    if (searchInput.value.trim().length >= 2) {
      searchInput.dispatchEvent(new Event('input'));
    }
  }
  // Also account for back-navigation where focus is restored asynchronously
  setTimeout(() => {
    if (document.activeElement === searchInput) {
      searchBox.classList.add('focused');
      document.body.classList.add('search-focused');
      if (searchInput.value.trim().length >= 2) {
        searchInput.dispatchEvent(new Event('input'));
      }
    }
  }, 100);
})();

// ===== Add Shortcut Dialog =====
(function() {
  var addBtn = document.getElementById('addShortcutBtn');
  var addOverlay = document.getElementById('addShortcutOverlay');
  var closeAddBtn = document.getElementById('closeAddShortcut');
  if (addBtn && addOverlay) {
    addBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      addOverlay.classList.remove('hidden');
      var si = document.getElementById('shortcutSearch');
      if (si) { si.value = ''; si.focus(); }
      var sr = document.getElementById('shortcutResults');
      if (sr) sr.innerHTML = '';
      var sh = document.getElementById('shortcutHint');
      if (sh) sh.style.display = '';
    });
    if (closeAddBtn) closeAddBtn.addEventListener('click', function() { addOverlay.classList.add('hidden'); });
    addOverlay.addEventListener('click', function(e) { if (e.target === addOverlay) addOverlay.classList.add('hidden'); });
  }
})();

// ===== Add Shortcut Search =====
(function() {
  var inp = document.getElementById('shortcutSearch');
  var results = document.getElementById('shortcutResults');
  var hint = document.getElementById('shortcutHint');
  var timer = null;
  if (!inp || !results) return;

  inp.addEventListener('input', function() {
    clearTimeout(timer);
    var q = inp.value.trim();
    if (q.length < 2) { results.innerHTML = ''; hint.style.display = ''; return; }
    timer = setTimeout(async function() {
      try {
        var data = await chrome.history.search({ text: q, maxResults: 20, startTime: 0 });
        hint.style.display = 'none';
        results.innerHTML = '';
        data.forEach(function(item) {
          var url = item.url || '';
          var title = item.title || url;
          if (pinnedUrls.has(url)) return;
          var hostname = url.replace(/https?:\/\//, '').split('/')[0];
          var path = url.replace(/https?:\/\/[^\/]+/, '') || '/';
          var row = document.createElement('div');
          row.className = 'shortcut-result-item';
          row.innerHTML =
            '<span class="shortcut-result-fav"><img src="' + faviconUrl(hostname) + '" onerror="this.style.display=\'none\'"><span class="shortcut-result-letter">' + (title[0] || hostname[0]).toUpperCase() + '</span></span>' +
            '<div class="shortcut-result-info">' +
              '<span class="shortcut-result-title">' + title.slice(0, 120) + '</span>' +
              '<span class="shortcut-result-url">' + hostname + path + '</span>' +
            '</div>' +
            '<button class="shortcut-result-pin"><svg class="icon-sm" viewBox="0 -960 960 960" fill="currentColor"><path d="m640-480 80 80v80H520v240l-40 40-40-40v-240H240v-80l80-80v-280h-40v-80h400v80h-40v280Zm-286 80h252l-46-46v-314H400v314l-46 46Zm126 0Z"/></svg></button>';
          row.querySelector('.shortcut-result-pin').addEventListener('click', function(e) {
            e.stopPropagation();
            togglePin({ url: url, title: title, hostname: hostname, favicon: '', visitCount: 1, bestPath: '/', displayTitle: '' });
            row.querySelector('.shortcut-result-pin').textContent = '已固定';
            row.querySelector('.shortcut-result-pin').style.color = 'var(--accent)';
          });
          results.appendChild(row);
        });
        if (data.length === 0) results.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">无结果</div>';
      } catch(e) {}
    }, 300);
  });
})();

// ===== Settings =====
async function loadSettings() {
  const result = await chrome.storage.local.get(['engine', 'pinned', 'ignoredUrls']);
  if (result.ignoredUrls) ignoredUrls = result.ignoredUrls;

  if (result.engine && typeof getAllEngines === 'function') {
    const all = getAllEngines();
    if (all.find(e => e.id === result.engine)) currentEngine = result.engine;
  }

  if (result.pinned && Array.isArray(result.pinned)) {
    pinnedData.clear();
    pinnedUrls.clear();
    for (const item of result.pinned) {
      pinnedUrls.add(item.url);
      // Backfill displayTitle/bestPath for older stored items
      if (!item.bestPath) {
        try { item.bestPath = new URL(item.url).pathname; } catch(e) { item.bestPath = '/'; }
      }
      if (!item.displayTitle && item.title) {
        // Compute displayTitle using qualifedTitle
        const allEngines = getAllEngines();
        const base = item.hostname.replace(/^www\./, '');
        const seg = item.bestPath.replace(/\/$/, '').split('/').pop() || '';
        const hasPath = seg && seg.length > 0 && !/\.(html?|php|jsp)$/.test(seg);
        const isGeneric = !item.title || item.title === item.hostname || item.title === base ||
          (item.hostname && item.hostname.startsWith(item.title + '.')) ||
          (item.title && item.title.toLowerCase() === base.split('.')[0]);
        if (isGeneric && !hasPath) item.displayTitle = base;
        else if (isGeneric && hasPath) item.displayTitle = base + '/' + seg;
        else {
          let t = item.title.replace(/\s*[-–|].*$/, '').trim();
          if (hasPath && t.length > 22) t = t.slice(0, 20) + '…';
          item.displayTitle = hasPath ? t + ' /' + seg : t;
        }
      }
      pinnedData.set(item.url, item);
    }
  }

  updateEngineUI();
}
async function savePinned() {
  const arr = Array.from(pinnedData.values());
  await chrome.storage.local.set({ pinned: arr });
}

// ===== Search =====
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    searchInput.blur();
    return;
  }
  if (e.key === 'Enter') {
    const query = searchInput.value.trim();
    if (!query) return;

    // If a suggestion is selected, navigate to its URL
    if (sugUrl && sugIdx >= 0) {
      window.location.href = sugUrl;
      return;
    }

    if (/^(https?:\/\/)?[\w.-]+\.\w{2,}(\/\S*)?$/.test(query)) {
      const url = query.startsWith('http') ? query : 'https://' + query;
      window.location.href = url;
    } else {
      const allEngines = getAllEngines();
      const eng = allEngines.find(e => e.id === currentEngine) || allEngines[0];
      if (eng) window.location.href = eng.url + encodeURIComponent(query);
    }
  }
});

// Search suggestions — from browser history
const suggestDropdown = document.createElement('div');
suggestDropdown.className = 'suggest-dropdown hidden';
document.querySelector('.search-wrapper').appendChild(suggestDropdown);

let suggestTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(suggestTimer);
  suggestDropdown.classList.add('hidden');
  sugUrl = '';
  const q = searchInput.value.trim();
  if (q.length < 2) return;
  suggestTimer = setTimeout(async () => {
    try {
      let items = [];
      // Bing suggestion API — accessible in China, works for all engines
      try {
        const resp = await fetch('https://api.bing.com/osjson.aspx?query=' + encodeURIComponent(q));
        const data = await resp.json();
        items = (data[1] || []).map(s => ({
          title: s,
          url: (() => {
            const allEngines = getAllEngines();
            const eng = allEngines.find(e => e.id === currentEngine) || allEngines[0];
            return eng ? eng.url + encodeURIComponent(s) : 'https://www.bing.com/search?q=' + encodeURIComponent(s);
          })(),
        }));
      } catch(e) { /* fall through */ }
      
      // Fallback to local history
      if (items.length === 0) {
        const results = await chrome.history.search({ text: q, maxResults: 6, startTime: 0 });
        items = results.filter(it => it.title || it.url).map(it => ({
          title: it.title || it.url,
          url: it.url,
        }));
      }
      
      suggestDropdown.innerHTML = '';
      for (const item of items) {
        if (!item.title) continue;
        const div = document.createElement('div');
        div.className = 'suggest-item';
        div.dataset.url = item.url;
        div.innerHTML = '<span class="suggest-title">' + escapeHtml(item.title.slice(0, 80)) + '</span><span class="suggest-url">' + escapeHtml((item.url || '').slice(0, 60)) + '</span>';
        div.addEventListener('mousedown', (e) => { e.preventDefault(); window.location.href = item.url; });
        suggestDropdown.appendChild(div);
      }
      
      if (suggestDropdown.children.length > 0) suggestDropdown.classList.remove('hidden');
    } catch(e) { /* ignore */ }
  }, 150);
});
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); moveSugg(1); }
  if (e.key === 'ArrowUp') { e.preventDefault(); moveSugg(-1); }
  if (e.key === 'Escape') suggestDropdown.classList.add('hidden');
});
searchInput.addEventListener('blur', () => setTimeout(() => suggestDropdown.classList.add('hidden'), 0));

let sugIdx = -1, sugUrl = '';
function moveSugg(dir) {
  const items = suggestDropdown.children;
  if (items.length === 0) return;
  // 让旧项先开始淡出
  if (sugIdx >= 0) items[sugIdx].classList.remove('active');
  sugIdx = Math.max(0, Math.min(items.length - 1, sugIdx + dir));
  // 隔一帧再添加 active，给淡出动画留时间
  requestAnimationFrame(() => requestAnimationFrame(() => {
    items[sugIdx].classList.add('active');
  }));
  sugUrl = items[sugIdx].dataset.url || '';
  const txt = items[sugIdx].querySelector('.suggest-title')?.textContent || '';
  searchInput.value = txt;
  // Update placeholder span since input text is transparent
  const ph = document.getElementById('searchPlaceholder');
  if (ph) { ph.textContent = txt; ph.classList.add('has-text'); }
}
function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ===== Render =====
async function renderAll() {
  const historyItems = await getTopHistory();
  renderPinned();
  renderHistory(historyItems);
}

// ===== History API =====
async function getTopHistory() {
  try {
    const startTime = historyRange > 0 ? Date.now() - historyRange * 24 * 60 * 60 * 1000 : 0;
    const results = await chrome.history.search({
      text: '',
      maxResults: 500,
      startTime,
    });

    const siteMap = new Map();

    for (const item of results) {
      try {
        const urlObj = new URL(item.url);
        // Group by origin + pathname (different pages = different entries)
        const key = urlObj.origin + urlObj.pathname;

        if (!siteMap.has(key)) {
          siteMap.set(key, {
            url: urlObj.origin + urlObj.pathname,
            title: item.title || urlObj.hostname,
            visitCount: 0,
            hostname: urlObj.hostname,
            favicon: faviconUrl(urlObj.hostname),
            bestPath: urlObj.pathname,
          });
        }
        const entry = siteMap.get(key);
        entry.visitCount += (item.visitCount || 1);
        if (item.title && item.title.length > entry.title.length) {
          entry.title = item.title;
        }
      } catch (e) { /* skip */ }
    }

    const sorted = Array.from(siteMap.values())
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, 100); // cache for gap filling

    // Duplicate detection + cache
    const nameCount = new Map();
    for (const item of sorted) {
      const base = simpleTitle(item.title, item.hostname);
      nameCount.set(base, (nameCount.get(base) || 0) + 1);
    }
    for (const item of sorted) {
      const base = simpleTitle(item.title, item.hostname);
      if (nameCount.get(base) > 1) {
        item.displayTitle = qualifedTitle(item.title, item.hostname, item.bestPath);
      } else {
        item.displayTitle = base;
      }
    }

    cachedHistory = sorted;
    return sorted;
  } catch (err) {
    console.error('Failed to get history:', err);
    return [];
  }
}

// ===== Render Pinned =====
function renderPinned() {
  pinnedGrid.innerHTML = '';
  const items = Array.from(pinnedData.values());
  const section = document.getElementById('shortcuts');
  const emptyEl = document.getElementById('pinnedEmpty');

  if (items.length === 0) {
    emptyEl.classList.remove('hidden-empty');
    section.classList.add('is-empty');
    return;
  }

  emptyEl.classList.add('hidden-empty');
  section.classList.remove('is-empty');
  for (const item of items) {
    pinnedGrid.appendChild(createTile(item, true));
  }
}

// ===== Render History =====
function renderHistory(historyItems) {
  historyGrid.innerHTML = '';

  if (historyItems.length === 0) {
    historyGrid.innerHTML = '<div class="empty">暂无历史记录</div>';
    return;
  }

  // Limit visible items and filter ignored
  const maxItems = gridRows >= 6 ? Infinity : gridCols * gridRows;
  let shown = 0;

  for (const item of historyItems) {
    if (pinnedUrls.has(item.url)) continue;
    if (ignoredUrls.some(u => item.url.startsWith(u) || item.hostname === u)) continue;
    if (shown >= maxItems) break;
    historyGrid.appendChild(createTile(item, false));
    shown++;
  }
}

// ===== Create Tile =====
function createTile(item, isPinned) {
  const tile = document.createElement('a');
  tile.className = 'tile' + (isPinned ? ' pinned' : '');
  tile.href = item.url;
  tile.title = (item.title || '') + '\n' + item.url + (item.visitCount ? `\n访问 ${formatCount(item.visitCount)} 次` : '');
  tile.dataset.visits = item.visitCount || 0;

  const iconDiv = document.createElement('div');
  iconDiv.className = 'tile-icon';

  // Try cached favicon first; fall back to live resolution
  const hostname = item.hostname;

  function tryWebFallback() {
    const img = document.createElement('img');
    var urls = [];
    urls.push(item.favicon || faviconUrl(hostname));
    urls.push.apply(urls, faviconFallbackChain(hostname));
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      urls.push(chrome.runtime.getURL('_favicon/') + '?pageUrl=' + encodeURIComponent('https://' + hostname + '/') + '&size=32');
    }
    var tried = 0;
    img.src = urls[0];
    img.onerror = function() {
      tried++;
      if (tried < urls.length) {
        img.src = urls[tried];
        return;
      }
      img.style.display = 'none';
      const fallback = document.createElement('div');
      fallback.className = 'fallback';
      fallback.textContent = (hostname || item.title || '?')[0].toUpperCase();
      iconDiv.appendChild(fallback);
    };
    iconDiv.appendChild(img);
  }

  if (window.FaviconCache) {
    window.FaviconCache.resolveFavicon(hostname, item.url).then(url => {
      if (url) {
        const img = document.createElement('img');
        img.src = url;
        img.onerror = () => {
          img.style.display = 'none';
          const fallback = document.createElement('div');
          fallback.className = 'fallback';
          fallback.textContent = (hostname || item.title || '?')[0].toUpperCase();
          iconDiv.appendChild(fallback);
        };
        iconDiv.appendChild(img);
      } else {
        tryWebFallback();
      }
    });
  } else {
    tryWebFallback();
  }

  const label = document.createElement('span');
  label.className = 'tile-label';
  label.textContent = item.displayTitle || qualifedTitle(item.title, item.hostname, item.bestPath || '/') || simplifyTitle(item.title, item.hostname, item.bestPath || '/');

  const pinBtn = document.createElement('button');
  pinBtn.className = 'tile-pin';
  pinBtn.innerHTML = I.pushPin;
  pinBtn.title = isPinned ? '取消固定' : '固定到首页';
  pinBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePin(item);
  });

  // Hide button (ignore list)
  const hideBtn = document.createElement('button');
  hideBtn.className = 'tile-hide';
  hideBtn.innerHTML = I.close;
  hideBtn.title = '不在主页显示';
  hideBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    ignoreSite(item);
  });

  tile.appendChild(iconDiv);
  tile.appendChild(label);
  tile.appendChild(pinBtn);
  tile.appendChild(hideBtn);

  return tile;
}

// ===== Pin / Unpin =====
async function togglePin(item) {
  const maxItems = gridRows >= 6 ? Infinity : gridCols * gridRows;

  if (pinnedUrls.has(item.url)) {
    // Unpin: move tile from pinned to history
    pinnedUrls.delete(item.url);
    pinnedData.delete(item.url);

    const tile = document.querySelector(`#pinnedGrid .tile[href="${item.url}"]`);
    if (tile) {
      // Convert from pinned to normal
      const pinBtn = tile.querySelector('.tile-pin');
      if (pinBtn) { pinBtn.innerHTML = I.pushPin; pinBtn.title = '固定到首页'; }
      tile.classList.remove('pinned');
      const historyTiles = historyGrid.querySelectorAll('.tile');
      const historyCount = historyTiles.length;
      if (historyCount >= maxItems && historyCount > 0) {
        historyTiles[historyTiles.length - 1].remove();
      }
      insertSorted(historyGrid, tile);
    }
  } else {
    // Pin: move tile from history to pinned
    pinnedUrls.add(item.url);
    pinnedData.set(item.url, {
      url: item.url, title: item.title, hostname: item.hostname, favicon: item.favicon,
      visitCount: item.visitCount || 0,
      bestPath: item.bestPath || '/',
      displayTitle: item.displayTitle || '',
    });

    const tile = document.querySelector(`#historyGrid .tile[href="${item.url}"]`);
    if (tile) {
      const pinBtn = tile.querySelector('.tile-pin');
      if (pinBtn) { pinBtn.innerHTML = I.pushPin; pinBtn.title = '取消固定'; }
      tile.classList.add('pinned');
      pinnedGrid.appendChild(tile);
      fillHistoryGap();
    }
  }

  updatePinnedEmpty();
  await savePinned();
}

function fillHistoryGap() {
  const maxItems = gridRows >= 6 ? Infinity : gridCols * gridRows;
  const currentUrls = new Set(
    Array.from(historyGrid.querySelectorAll('.tile')).map(t => t.getAttribute('href'))
  );
  const needed = maxItems - currentUrls.size;
  if (needed <= 0) return;

  let added = 0;
  for (const it of cachedHistory) {
    if (added >= needed) break;
    if (pinnedUrls.has(it.url) || currentUrls.has(it.url)) continue;
    if (ignoredUrls.some(u => it.url.startsWith(u) || it.hostname === u)) continue;
    historyGrid.appendChild(createTile(it, false));
    currentUrls.add(it.url);
    added++;
  }
}

function updatePinnedEmpty() {
  const emptyEl = document.getElementById('pinnedEmpty');
  const section = document.getElementById('shortcuts');
  if (pinnedUrls.size === 0) {
    emptyEl.classList.remove('hidden-empty');
    section.classList.add('is-empty');
  } else {
    emptyEl.classList.add('hidden-empty');
    section.classList.remove('is-empty');
  }
}

async function ignoreSite(item) {
  let pattern;
  try {
    pattern = item.hostname || new URL(item.url).hostname;
  } catch(e) { return; }
  if (!pattern) return;
  if (!ignoredUrls.includes(pattern)) {
    ignoredUrls.push(pattern);
    await chrome.storage.local.set({ ignoredUrls });
    if (pinnedUrls.has(item.url)) {
      pinnedUrls.delete(item.url);
      pinnedData.delete(item.url);
      await savePinned();
    }
  }
  const tile = document.querySelector(`.tile[href="${item.url}"]`);
  if (tile) tile.remove();
  updatePinnedEmpty();
  fillHistoryGap();
}

let ctxItem = null;

function showCtxMenu(x, y, tileEl) {
  const menu = document.getElementById('ctxMenu');
  if (!menu) return;
  ctxItem = { url: tileEl.href, title: tileEl.querySelector('.tile-label')?.textContent, element: tileEl };
  const isPinned = tileEl.closest('#pinnedGrid') !== null;
  const hostname = new URL(tileEl.href).hostname;
  menu.innerHTML = '';
  addCtxItem(menu, isPinned ? '取消固定' : '固定', () => {
    togglePin({ url: tileEl.href, title: ctxItem.title, hostname, favicon: '', visitCount: parseInt(tileEl.dataset.visits) || 0 });
  });
  addCtxItem(menu, '在新标签页打开', () => window.open(tileEl.href));
  addCtxItem(menu, '复制链接', () => navigator.clipboard.writeText(tileEl.href));
  addCtxDivider(menu);
  addCtxItem(menu, '屏蔽此站点', () => ignoreSite({ url: tileEl.href, hostname }), true);
  const maxX = window.innerWidth - menu.offsetWidth;
  const maxY = window.innerHeight - menu.offsetHeight;
  menu.style.left = Math.min(x, maxX - 10) + 'px';
  menu.style.top = Math.min(y, maxY - 10) + 'px';
  menu.classList.remove('hidden');
}

function addCtxItem(menu, text, onClick, danger) {
  const item = document.createElement('div');
  item.className = 'ctx-item' + (danger ? ' ctx-danger' : '');
  item.textContent = text;
  item.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.add('hidden'); onClick(); });
  menu.appendChild(item);
}
function addCtxDivider(menu) {
  const div = document.createElement('div');
  div.className = 'ctx-divider';
  menu.appendChild(div);
}

// ===== Helpers =====
function insertSorted(grid, newTile) {
  const visits = parseInt(newTile.dataset.visits) || 0;
  const tiles = grid.querySelectorAll('.tile');
  for (const tile of tiles) {
    const v = parseInt(tile.dataset.visits) || 0;
    if (visits >= v) {
      grid.insertBefore(newTile, tile);
      return;
    }
  }
  grid.appendChild(newTile);
}

function simpleTitle(title, hostname) {
  // Clean page title or fall back to hostname
  if (!title || title === hostname) return hostname.replace(/^www\./, '');
  let t = title.replace(/\s*[-–|].*$/, '').trim();
  if (t.length > 28) t = t.slice(0, 26) + '…';
  return t;
}

function qualifedTitle(title, hostname, pathname) {
  const base = hostname.replace(/^www\./, '');
  const seg = (pathname || '/').replace(/\/$/, '').split('/').pop() || '';
  const hasPath = seg && seg.length > 0 && !/\.(html?|php|jsp)$/.test(seg);
  // If title is already descriptive, append path as suffix
  if (title && title !== hostname && title !== base) {
    let t = title.replace(/\s*[-–|].*$/, '').trim();
    if (t.length > 22) t = t.slice(0, 20) + '…';
    return hasPath ? t + ' /' + seg : t;
  }
  // Generic title → hostname/path
  return hasPath ? base + '/' + seg : base;
}

function simplifyTitle(title, hostname, pathname) {
  // Kept for backward compat; prefer item.displayTitle
  return qualifedTitle(title, hostname, pathname);
}

function formatCount(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000)  return (n / 1000).toFixed(1) + 'k';
  return String(n);
}
