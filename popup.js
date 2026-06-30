// ===== Portab Popup =====

let currentTab = null;

const _msg = (key, subs) => {
  try { return chrome.i18n.getMessage(key, subs); }
  catch { return key; }
};

// SVG icons (inline to avoid loading icons.js dependency issues)
const ICON = {
  pushPin: '<svg class="icon" viewBox="0 -960 960 960" fill="currentColor"><path d="m640-480 80 80v80H520v240l-40 40-40-40v-240H240v-80l80-80v-280h-40v-80h400v80h-40v280Zm-286 80h252l-46-46v-314H400v314l-46 46Zm126 0Z"/></svg>',
  close: '<svg class="icon-sm" viewBox="0 -960 960 960" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>',
  openInNew: '<svg class="icon-sm" viewBox="0 -960 960 960" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z"/></svg>',
};

function faviconUrl(domain) {
  return 'https://' + domain + '/favicon.ico';
}

function faviconFallbacks(domain) {
  return [
    'https://icons.duckduckgo.com/ip3/' + domain + '.ico',
    'https://www.google.com/s2/favicons?domain=' + domain + '&sz=32',
  ];
}

function displayTitle(item) {
  if (item.displayTitle) return item.displayTitle;
  const base = (item.hostname || '').replace(/^www\./, '');
  const seg = (item.bestPath || '/').replace(/\/$/, '').split('/').pop() || '';
  if (item.title && item.title !== item.hostname && item.title !== base) {
    let t = item.title.replace(/\s*[-–|].*$/, '').trim();
    if (t.length > 22) t = t.slice(0, 20) + '…';
    return seg ? t + ' /' + seg : t;
  }
  return seg ? base + '/' + seg : base;
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  currentTab = tab;

  const currentUrl = tab.url || '';
  const currentHostname = currentUrl.replace(/https?:\/\//, '').split('/')[0] || '';
  const currentTitle = tab.title || currentHostname;

  // Load pinned data
  const { pinned = [] } = await chrome.storage.local.get('pinned');
  function isPinned(url) {
    const normalized = url.replace(/\/+$/, '');
    const hostname = url.replace(/https?:\/\//, '').split('/')[0];
    return pinned.some(p => {
      const pn = p.url.replace(/\/+$/, '');
      const ph = (p.hostname || p.url.replace(/https?:\/\//, '').split('/')[0]);
      return p.url === url || pn === normalized || (hostname && ph === hostname);
    });
  }

  // Setup current site section
  const favicon = document.getElementById('currentFavicon');
  if (currentHostname) {
    favicon.src = faviconUrl(currentHostname);
    favicon.onerror = function() {
      const fallbacks = faviconFallbacks(currentHostname);
      let i = 0;
      const tryNext = () => {
        if (i < fallbacks.length) { favicon.src = fallbacks[i++]; }
      };
      favicon.onerror = tryNext;
      tryNext();
    };
  }

  document.getElementById('currentTitle').textContent = currentTitle;

  const pinBtn = document.getElementById('pinBtn');
  const pinBtnText = document.getElementById('pinBtnText');
  const pinSection = document.getElementById('pinSection');

  // Hide pin button on newtab page
  if (currentUrl === 'chrome://newtab/' || currentUrl === 'chrome://newtab') {
    pinSection.style.display = 'none';
  } else {
  const isCurrentPinned = isPinned(currentUrl);

  function updatePinButton(pinned) {
    pinBtn.dataset.pinned = pinned ? 'true' : 'false';
    pinBtnText.textContent = pinned ? _msg('tileUnpin') : _msg('ctxPin');
  }
  updatePinButton(isCurrentPinned);

  // Pin/Unpin current page
  pinBtn.addEventListener('click', async () => {
    const { pinned: latestPinned = [] } = await chrome.storage.local.get('pinned');
    const normalized = currentUrl.replace(/\/+$/, '');
    const isCurrentlyPinned = latestPinned.some(p => p.url === currentUrl || p.url.replace(/\/+$/, '') === normalized);

    if (isCurrentlyPinned) {
      // Unpin
      const updated = latestPinned.filter(p => p.url !== currentUrl && p.url.replace(/\/+$/, '') !== normalized);
      await chrome.storage.local.set({ pinned: updated });
      updatePinButton(false);
      renderPinnedList(updated);
    } else {
      // Pin
      const hostname = currentUrl.replace(/https?:\/\//, '').split('/')[0] || '';
      let bestPath = '/';
      try { bestPath = new URL(currentUrl).pathname; } catch(e) {}
      const newItem = {
        url: currentUrl,
        title: tab.title || '',
        hostname: hostname,
        favicon: '',
        visitCount: 0,
        bestPath: bestPath,
        displayTitle: '',
      };
      latestPinned.push(newItem);
      await chrome.storage.local.set({ pinned: latestPinned });
      updatePinButton(true);
      renderPinnedList(latestPinned);
    }
  });
  } // end else (not newtab)

  // Render pinned list
  renderPinnedList(pinned);

  // Open new tab
  document.getElementById('openNewTab').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://newtab' });
    window.close();
  });
}

function renderPinnedList(pinned) {
  const list = document.getElementById('pinnedList');
  const empty = document.getElementById('emptyState');
  const count = document.getElementById('pinnedCount');

  // Clear previous items (keep empty state)
  list.querySelectorAll('.pinned-item').forEach(el => el.remove());

  count.textContent = pinned.length || '';

  if (pinned.length === 0) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  pinned.forEach((item) => {
    const hostname = item.hostname || (item.url || '').replace(/https?:\/\//, '').split('/')[0];
    if (!hostname) return;
    const el = document.createElement('a');
    el.className = 'pinned-item';
    el.href = item.url;
    el.title = (item.title || item.url || '') + '\n' + (item.url || '');

    el.innerHTML =
      '<img class="pinned-favicon" src="' + faviconUrl(hostname) + '">' +
      '<div class="pinned-info">' +
        '<span class="pinned-name">' + (displayTitle(item) || hostname) + '</span>' +
        '<span class="pinned-url">' + hostname + '</span>' +
      '</div>' +
      '<div class="pinned-actions">' +
        '<button class="pinned-action-btn open-btn" title="' + _msg('ctxOpenNewTab') + '">' + ICON.openInNew + '</button>' +
        '<button class="pinned-action-btn unpin-btn" title="' + _msg('tileUnpin') + '">' + ICON.close + '</button>' +
      '</div>';

    // Favicon fallback
    const favImg = el.querySelector('.pinned-favicon');
    let favIdx = 0;
    const favFallbacks = faviconFallbacks(hostname);
    favImg.onerror = function() {
      if (favIdx < favFallbacks.length) {
        favImg.src = favFallbacks[favIdx++];
      }
    };

    // Open in new tab
    el.querySelector('.open-btn').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      chrome.tabs.create({ url: item.url });
    });

    // Unpin
    el.querySelector('.unpin-btn').addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const { pinned: latest = [] } = await chrome.storage.local.get('pinned');
      const normalizedItem = item.url.replace(/\/+$/, '');
      const updated = latest.filter(p => p.url !== item.url && p.url.replace(/\/+$/, '') !== normalizedItem);
      await chrome.storage.local.set({ pinned: updated });

      // Update pin button if this was the current page
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url === item.url) {
        document.getElementById('pinBtn').dataset.pinned = 'false';
        document.getElementById('pinBtnText').textContent = _msg('ctxPin');
      }
      renderPinnedList(updated);
    });

    // Navigate on click (not on action buttons)
    el.addEventListener('click', (e) => {
      if (e.target.closest('.pinned-action-btn')) return;
      e.preventDefault();
      chrome.tabs.update(currentTab?.id, { url: item.url });
      window.close();
    });

    list.appendChild(el);
  });
}

document.addEventListener('DOMContentLoaded', init);
