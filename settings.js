// ===== Portab - Settings & Theme =====

let currentTheme = 'dark';
let gridCols = 6;
let gridRows = 6;  // 6 means "auto" (max)
let gridGap = 10;
let currentWallpaper = 'none';
let historyRange = 0; // 0=all, 7=7d, 30=30d, 90=90d
let ignoredUrls = [];
let seedColor = '#4c9aff';
let customWallpaperUrl = '';
let bingImageUrl = '';
let picsumUrl = '';

// Wallpaper advanced
let overlayEnabled = true;
let overlayColor = '#000000';
let overlayOpacity = 55;
let blurEnabled = false;
let blurAmount = 0;

let settingsBtn, settingsOverlay, closeDialog;
let themeBtns, wallpaperBtns;
let gridColsInp, gridColsVal, gridRowsInp, gridRowsVal, gridGapInp, gridGapVal;
let customUrlWrap, customUrlInput, customFileInput;
let wallpaperAdvanced, overlayToggle, overlayColorInp, overlayOpacityInp, overlayOpacityVal;
let blurToggle, blurAmountInp, blurAmountVal;
let colorPresets, customSeedColor, autoExtractToggle;
let rangeBtns;
let wallpaperBg;

// ===== DOM init (called from newtab.js) =====
function initSettings() {
  settingsBtn       = document.getElementById('settingsBtn');
  settingsOverlay   = document.getElementById('settingsOverlay');
  closeDialog       = document.getElementById('closeDialog');
  themeBtns         = document.querySelectorAll('.seg-btn[data-theme-opt]');
  rangeBtns         = document.querySelectorAll('.seg-btn[data-range]');
  wallpaperBtns     = document.querySelectorAll('.seg-btn[data-wallpaper]');
  gridColsInp       = document.getElementById('gridColsSlider');
  gridColsVal       = document.getElementById('gridColsVal');
  gridRowsInp       = document.getElementById('gridRowsSlider');
  gridRowsVal       = document.getElementById('gridRowsVal');
  gridGapInp        = document.getElementById('gridGapSlider');
  gridGapVal        = document.getElementById('gridGapVal');
  customUrlWrap     = document.getElementById('customUrlWrap');
  customUrlInput    = document.getElementById('customWallpaperUrl');
  customFileInput   = document.getElementById('customWallpaperFile');
  wallpaperAdvanced = document.getElementById('wallpaperAdvanced');
  wallpaperBg       = document.getElementById('wallpaperBg');

  overlayToggle     = document.getElementById('overlayToggle');
  overlayColorInp   = document.getElementById('overlayColor');
  overlayOpacityInp = document.getElementById('overlayOpacitySlider');
  overlayOpacityVal = document.getElementById('overlayOpacityVal');
  blurToggle        = document.getElementById('blurToggle');
  blurAmountInp     = document.getElementById('blurAmountSlider');
  blurAmountVal     = document.getElementById('blurAmountVal');

  settingsBtn.addEventListener('click', openSettings);
  closeDialog.addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) closeSettings();
  });

  // Refresh wallpaper button
  const refreshBtn = document.getElementById('refreshWallpaperBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      if (currentWallpaper !== 'picsum') return;
      refreshBtn.classList.add('spinning');

      // Fade out → swap URL → wait for image load → fade in
      const wpBg = document.getElementById('wallpaperBg');
      if (wpBg) wpBg.style.opacity = '0';

      await new Promise(r => setTimeout(r, 220));

      currentPicsumSeed = Date.now().toString(36) + Math.floor(Math.random() * 1000);
      picsumUrl = generatePicsumUrl();

      // Preload new image before applying
      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // proceed even on error
        img.src = picsumUrl;
      });

      applyWallpaper();

      // Force reflow then fade in
      if (wpBg) {
        void wpBg.offsetHeight;
        wpBg.style.opacity = '';
      }

      await saveAll();
      watchWallpaperAndExtract();
      setTimeout(() => refreshBtn.classList.remove('spinning'), 800);
    });
    // Set initial visibility
    refreshBtn.style.display = currentWallpaper === 'picsum' ? 'flex' : 'none';
  }

  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => setTheme(btn.dataset.themeOpt));
  });

  wallpaperBtns.forEach(btn => {
    btn.addEventListener('click', () => setWallpaper(btn.dataset.wallpaper));
  });

  rangeBtns.forEach(btn => {
    btn.addEventListener('click', () => setHistoryRange(parseInt(btn.dataset.range)));
  });

  // Grid columns
  gridColsInp.addEventListener('ms-change', (e) => {
    gridCols = Math.round(e.detail.value);
    gridColsVal.textContent = gridCols;
  });
  gridColsInp.addEventListener('ms-change-final', (e) => {
    gridCols = Math.round(e.detail.value);
    applyGrid();
    if (typeof renderAll === 'function') renderAll();
    saveGrid();
  });

  // Grid rows
  gridRowsInp.addEventListener('ms-change', (e) => {
    gridRows = Math.round(e.detail.value);
    gridRowsVal.textContent = gridRows >= 6 ? '自动' : gridRows;
  });
  gridRowsInp.addEventListener('ms-change-final', (e) => {
    gridRows = Math.round(e.detail.value);
    applyGrid();
    if (typeof renderAll === 'function') renderAll();
    saveGrid();
  });

  // Grid gap
  gridGapInp.addEventListener('ms-change', (e) => {
    gridGap = Math.round(e.detail.value);
    gridGapVal.textContent = gridGap + 'px';
  });
  gridGapInp.addEventListener('ms-change-final', (e) => {
    gridGap = Math.round(e.detail.value);
    applyGrid();
    saveGrid();
  });

  customUrlInput.addEventListener('blur', async () => {
    customWallpaperUrl = customUrlInput.value.trim();
    await saveAll();
    if (currentWallpaper === 'custom') applyWallpaper();
  });

  customFileInput.addEventListener('change', async () => {
    const file = customFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      customWallpaperUrl = reader.result;
      await saveAll();
      applyWallpaper();
    };
    reader.readAsDataURL(file);
  });

  // Overlay toggle
  overlayToggle.addEventListener('change', () => {
    overlayEnabled = overlayToggle.checked;
    overlayColorInp.disabled = !overlayEnabled;
    overlayOpacityInp.disabled = !overlayEnabled;
    applyWallpaper();
    saveAll();
  });

  // Overlay color
  overlayColorInp.addEventListener('input', () => {
    overlayColor = overlayColorInp.value;
    applyWallpaper();
    saveAll();
  });

  // Overlay opacity
  overlayOpacityInp.addEventListener('ms-change', (e) => {
    overlayOpacity = Math.round(e.detail.value);
    overlayOpacityVal.textContent = overlayOpacity + '%';
  });
  overlayOpacityInp.addEventListener('ms-change-final', () => {
    applyWallpaper();
    saveAll();
  });

  // Blur toggle
  blurToggle.addEventListener('change', () => {
    blurEnabled = blurToggle.checked;
    blurAmountInp.disabled = !blurEnabled;
    applyWallpaper();
    saveAll();
  });

  // Blur amount
  blurAmountInp.addEventListener('ms-change', (e) => {
    blurAmount = Math.round(e.detail.value);
    blurAmountVal.textContent = blurAmount + 'px';
  });
  blurAmountInp.addEventListener('ms-change-final', () => {
    applyWallpaper();
    saveAll();
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentTheme === 'auto') applyTheme('auto');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !settingsOverlay.classList.contains('hidden')) {
      closeSettings();
    }
  });

  // Apply track fill to all sliders on load and input
  // Initialize custom .ms sliders
  if (window.MSSlider) MSSlider.init();
  // Forward .ms change to hidden input (so storage save logic picks it up)
  document.querySelectorAll('.ms').forEach(s => {
    s.addEventListener('ms-change', (e) => {
      const id = s.id.replace('Slider', '');
      const hidden = document.getElementById(id);
      if (hidden) {
        hidden.value = e.detail.value;
        // Don't trigger 'change' to avoid cascading .ms repaints
      }
    });
  });
  colorPresets = document.getElementById('colorPresets');
  customSeedColor = document.getElementById('customSeedColor');
  autoExtractToggle = document.getElementById('autoExtractColor');
  buildColorPresets();
  customSeedColor.addEventListener('input', () => setSeedColor(customSeedColor.value));
  autoExtractToggle.addEventListener('change', () => {
    chrome.storage.local.set({ autoExtractColor: autoExtractToggle.checked });
    if (autoExtractToggle.checked && currentWallpaper !== 'none') tryAutoExtract();
  });

  // Engine manager
  const addEngineBtn = document.getElementById('addEngineBtn');
  const customEngineName = document.getElementById('customEngineName');
  const customEngineUrl = document.getElementById('customEngineUrl');
  if (addEngineBtn) {
    addEngineBtn.addEventListener('click', () => {
      const name = customEngineName?.value?.trim();
      const url = customEngineUrl?.value?.trim();
      if (!name || !url || !url.includes('{q}')) return;
      customEngines.push({ name, url });
      customEngineName.value = '';
      customEngineUrl.value = '';
      saveEngines();
      buildEngineCheckList();
      rebuildEngineDropdown();
    });
  }
}

function updateSliderTrack(slider) {
  const min = parseFloat(slider.min) || 0;
  const max = parseFloat(slider.max) || 100;
  const val = parseFloat(slider.value) || 0;
  const pct = ((val - min) / (max - min)) * 100;
  slider.style.setProperty('--slider-fill', pct.toFixed(3));
  const wrap = slider.closest('.md-slider-wrap');
  if (!wrap) return;
  wrap.style.setProperty('--slider-fill', pct.toFixed(3));

  // Read the auto-detected native padding from the wrap (set by initSliderMeasure)
  const pad = parseFloat(wrap.dataset.pad) || 8;
  const w = wrap.offsetWidth;
  const HANDLE_W = 4;
  const GAP = 6;
  // Native handle moves within [pad, w - pad] in px
  // handle center = pad + (pct/100) * (w - 2*pad)
  const handleCenter = pad + (pct / 100) * (w - 2 * pad);
  const activeEnd = handleCenter - HANDLE_W / 2 - GAP;
  const inactiveStart = handleCenter + HANDLE_W / 2 + GAP;

  const active = wrap.querySelector('.md-track-active');
  const inactive = wrap.querySelector('.md-track-inactive');
  if (active) {
    active.style.width = Math.max(0, activeEnd) + 'px';
  }
  if (inactive) {
    inactive.style.left = Math.min(w, inactiveStart) + 'px';
  }
}

// Auto-measure native handle padding by setting value to 0/100 and reading position
function initSliderMeasure() {
  document.querySelectorAll('.md-slider').forEach(slider => {
    const wrap = slider.closest('.md-slider-wrap');
    if (!wrap) return;
    // Use a probe: set value to 0, find handle position by inferring from track
    // Actually webkit doesn't expose handle position. We just use empirical padding.
    // Save original value first
    const orig = slider.value;
    // Set to min
    slider.value = slider.min;
    // After paint, we can't read handle, but we know chrome range input has
    // a default internal padding that we discovered empirically.
    // Use 8 (Chrome's webkit range input default thumb offset from edge).
    wrap.dataset.pad = '8';
    slider.value = orig;
  });
}

// ===== Theme =====
function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  themeBtns.forEach(btn => {
    btn.setAttribute('aria-checked', btn.dataset.themeOpt === theme ? 'true' : 'false');
  });

  // ==== Clock settings ====
  const clockFontSizeInp = document.getElementById('clockFontSizeSlider');
  const clockFontSizeVal = document.getElementById('clockFontSizeVal');
  const clockFormatBtns = document.querySelectorAll('.seg-btn[data-clock-format]');
  
  if (clockFontSizeInp) {
    clockFontSizeInp.addEventListener('ms-change', (e) => {
      const v = Math.round(e.detail.value);
      clockFontSizeVal.textContent = v + 'px';
      document.querySelector('.clock-time').style.setProperty('--clock-font-size', v + 'px');
      chrome.storage.local.set({ clockFontSize: v });
    });
  }
  if (clockFormatBtns) {
    clockFormatBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        clockFormatBtns.forEach(b => b.setAttribute('aria-checked', 'false'));
        btn.setAttribute('aria-checked', 'true');
        updateClockFormat();
        chrome.storage.local.set({ clockFormat: btn.dataset.clockFormat });
      });
    });
  }

  // ==== Clock font ====
  const clockFontFamily = document.getElementById('clockFontFamily');
  const clockWeightBtns = document.querySelectorAll('.seg-btn[data-clock-weight]');
  
  if (clockFontFamily) {
    clockFontFamily.addEventListener('change', () => {
      document.querySelector('.clock-time').style.setProperty('--clock-font', clockFontFamily.value === 'inherit' ? '' : clockFontFamily.value);
      chrome.storage.local.set({ clockFontFamily: clockFontFamily.value });
    });
  }
  if (clockWeightBtns) {
    clockWeightBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        clockWeightBtns.forEach(b => b.setAttribute('aria-checked', 'false'));
        btn.setAttribute('aria-checked', 'true');
        const w = btn.dataset.clockWeight;
        document.querySelector('.clock-time').style.setProperty('--clock-weight', w);
        chrome.storage.local.set({ clockWeight: parseInt(w) });
      });
    });
  }
  
  // Clock margins
  const clockMarginTopInp = document.getElementById('clockMarginTopSlider');
  const clockMarginTopVal = document.getElementById('clockMarginTopVal');
  const clockMarginBottomInp = document.getElementById('clockMarginBottomSlider');
  const clockMarginBottomVal = document.getElementById('clockMarginBottomVal');

  if (clockMarginTopInp) {
    clockMarginTopInp.addEventListener('ms-change', (e) => {
      const v = Math.round(e.detail.value);
      clockMarginTopVal.textContent = v + 'px';
      document.querySelector('.clock').style.setProperty('--clock-mt', v + 'px');
      chrome.storage.local.set({ clockMarginTop: v });
    });
  }
  if (clockMarginBottomInp) {
    clockMarginBottomInp.addEventListener('ms-change', (e) => {
      const v = Math.round(e.detail.value);
      clockMarginBottomVal.textContent = v + 'px';
      document.querySelector('.clock').style.setProperty('--clock-mb', v + 'px');
      chrome.storage.local.set({ clockMarginBottom: v });
    });
  }
}

async function loadClock() {
  const r = await chrome.storage.local.get(['clockFontSize', 'clockFormat', 'clockFontFamily', 'clockWeight', 'clockMarginTop', 'clockMarginBottom']);
  if (r.clockFontSize) {
    const v = r.clockFontSize;
    document.querySelector('.clock-time').style.setProperty('--clock-font-size', v + 'px');
    const inp = document.getElementById('clockFontSizeSlider');
    const val = document.getElementById('clockFontSizeVal');
    if (inp) {
      if (window.MSSlider) MSSlider.setValue(inp, v);
      else inp.value = v;
    }
    if (val) val.textContent = v + 'px';
  }
  if (r.clockFormat) {
    document.querySelectorAll('.seg-btn[data-clock-format]').forEach(b => {
      b.setAttribute('aria-checked', b.dataset.clockFormat === r.clockFormat ? 'true' : 'false');
    });
    updateClockFormat();
  }
  if (r.clockFontFamily && r.clockFontFamily !== 'inherit') {
    document.querySelector('.clock-time').style.setProperty('--clock-font', r.clockFontFamily);
    const sel = document.getElementById('clockFontFamily');
    if (sel) sel.value = r.clockFontFamily;
  }
  if (r.clockWeight) {
    document.querySelector('.clock-time').style.setProperty('--clock-weight', r.clockWeight);
    document.querySelectorAll('.seg-btn[data-clock-weight]').forEach(b => {
      b.setAttribute('aria-checked', b.dataset.clockWeight == r.clockWeight ? 'true' : 'false');
    });
  }
  if (r.clockMarginTop) {
    document.querySelector('.clock').style.setProperty('--clock-mt', r.clockMarginTop + 'px');
    const inp = document.getElementById('clockMarginTopSlider');
    const val = document.getElementById('clockMarginTopVal');
    if (inp) {
      if (window.MSSlider) MSSlider.setValue(inp, r.clockMarginTop);
      else inp.value = r.clockMarginTop;
    }
    if (val) val.textContent = r.clockMarginTop + 'px';
  }
  if (r.clockMarginBottom) {
    document.querySelector('.clock').style.setProperty('--clock-mb', r.clockMarginBottom + 'px');
    const inp = document.getElementById('clockMarginBottomSlider');
    const val = document.getElementById('clockMarginBottomVal');
    if (inp) {
      if (window.MSSlider) MSSlider.setValue(inp, r.clockMarginBottom);
      else inp.value = r.clockMarginBottom;
    }
    if (val) val.textContent = r.clockMarginBottom + 'px';
  }
}

function updateClockFormat() {
  const act = document.querySelector('.seg-btn[data-clock-format][aria-checked="true"]');
  const is24h = !act || act.dataset.clockFormat === '24h';
  window._clock24h = is24h;
  // Force re-render
  if (typeof updateClockDisplay === 'function') updateClockDisplay();
}

async function setTheme(theme) {
  applyTheme(theme);
  localStorage.setItem('portab_theme', theme);
  await chrome.storage.local.set({ theme });
}

async function loadTheme() {
  const result = await chrome.storage.local.get(['theme']);
  if (result.theme && ['dark', 'light', 'auto'].includes(result.theme)) {
    currentTheme = result.theme;
  }
  localStorage.setItem('portab_theme', currentTheme);
  applyTheme(currentTheme);
}

// ===== Grid =====
function applyGrid() {
  document.body.style.setProperty('--grid-cols', gridCols);
  document.body.style.setProperty('--grid-gap', gridGap + 'px');
}

async function saveGrid() {
  await chrome.storage.local.set({ gridCols, gridRows, gridGap });
}

async function loadGrid() {
  const result = await chrome.storage.local.get(['gridCols', 'gridRows', 'gridGap']);
  if (result.gridCols) {
    gridCols = result.gridCols;
    if (window.MSSlider) MSSlider.setValue(gridColsInp, gridCols);
    else gridColsInp.value = gridCols;
    gridColsVal.textContent = gridCols;
  }
  if (result.gridRows) {
    gridRows = result.gridRows;
    if (window.MSSlider) MSSlider.setValue(gridRowsInp, gridRows);
    else gridRowsInp.value = gridRows;
    gridRowsVal.textContent = gridRows >= 6 ? '自动' : gridRows;
  }
  if (result.gridGap) {
    gridGap = result.gridGap;
    if (window.MSSlider) MSSlider.setValue(gridGapInp, gridGap);
    else gridGapInp.value = gridGap;
    gridGapVal.textContent = gridGap + 'px';
  }
  applyGrid();
  if (window.MSSlider) {
    [gridColsInp, gridRowsInp, gridGapInp].forEach(s => s && MSSlider.repaint(s));
  }
}

// ===== History Range =====
function setHistoryRange(days) {
  historyRange = days;
  rangeBtns.forEach(btn => {
    btn.setAttribute('aria-checked', parseInt(btn.dataset.range) === days ? 'true' : 'false');
  });
  chrome.storage.local.set({ historyRange });
  if (typeof renderAll === 'function') renderAll();
}

async function loadHistoryRange() {
  const result = await chrome.storage.local.get(['historyRange']);
  if (result.historyRange !== undefined) historyRange = parseInt(result.historyRange);
  rangeBtns.forEach(btn => {
    btn.setAttribute('aria-checked', parseInt(btn.dataset.range) === historyRange ? 'true' : 'false');
  });
}

// ===== Wallpaper =====
function applyWallpaper() {
  if (currentWallpaper === 'none') {
    wallpaperBg.classList.remove('active');
    wallpaperBg.style.backgroundImage = '';
    document.body.classList.remove('has-wallpaper');
    document.documentElement.removeAttribute('data-wallpaper');
    document.documentElement.style.removeProperty('--wp-url');
    localStorage.removeItem('portab_wallpaper');
    localStorage.removeItem('portab_wallpaper_mode');
    localStorage.removeItem('portab_wallpaper_overlay');
    return;
  }

  const url = currentWallpaper === 'bing' ? bingImageUrl :
              currentWallpaper === 'picsum' ? picsumUrl :
              customWallpaperUrl;
  if (!url) return;

  wallpaperBg.style.backgroundImage = `url(${url})`;

  // Overlay
  let olValue = 'transparent';
  if (overlayEnabled) {
    const hex = overlayColor;
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    olValue = `rgba(${r},${g},${b},${overlayOpacity / 100})`;
  }
  wallpaperBg.style.setProperty('--wallpaper-overlay', olValue);

  // Blur
  wallpaperBg.style.setProperty('--wallpaper-blur', blurEnabled ? `${blurAmount}px` : '0px');

  wallpaperBg.classList.add('active');
  document.body.classList.add('has-wallpaper');

  // Set theme-preload attribute so wallpaper persists across reloads
  document.documentElement.setAttribute('data-wallpaper', '1');

  // Cache for next page load (sync localStorage)
  localStorage.setItem('portab_wallpaper', url);
  localStorage.setItem('portab_wallpaper_mode', currentWallpaper);
  localStorage.setItem('portab_wallpaper_overlay', olValue);
}

async function tryAutoExtract() {
  if (!autoExtractToggle?.checked) return;
  const url = currentWallpaper === 'bing' ? bingImageUrl :
              currentWallpaper === 'picsum' ? picsumUrl :
              customWallpaperUrl;
  if (!url) return;
  try {
    const { extractFromWallpaper } = await import('./color-utils.js');
    const hex = await extractFromWallpaper(url);
    if (hex) await setSeedColor(hex);
  } catch(e) { /* silent */ }
}

// Watch for wallpaper URL updates and auto-extract once ready
async function watchWallpaperAndExtract() {
  if (!autoExtractToggle?.checked) return;
  if (currentWallpaper === 'none') return;
  const startTime = Date.now();
  const timer = setInterval(async () => {
    const url = currentWallpaper === 'bing' ? bingImageUrl :
                currentWallpaper === 'picsum' ? picsumUrl :
                customWallpaperUrl;
    if (url) {
      clearInterval(timer);
      tryAutoExtract();
    } else if (Date.now() - startTime > 10000) {
      clearInterval(timer); // give up after 10s
    }
  }, 200);
}

async function setWallpaper(mode) {
  currentWallpaper = mode;

  wallpaperBtns.forEach(btn => {
    btn.setAttribute('aria-checked', btn.dataset.wallpaper === mode ? 'true' : 'false');
  });

  // Show/hide refresh button based on mode
  const refreshBtn = document.getElementById('refreshWallpaperBtn');
  if (refreshBtn) refreshBtn.style.display = mode === 'picsum' ? 'flex' : 'none';

  customUrlWrap.classList.toggle('hidden', mode !== 'custom');
  wallpaperAdvanced.classList.toggle('hidden', mode === 'none');

  if (mode === 'custom') setTimeout(() => customUrlInput.focus(), 100);

  // Fetch wallpaper in background if needed, don't block UI
  if (mode === 'bing' && !bingImageUrl) {
    fetchBingWallpaper().then(() => { saveAll(); applyWallpaper(); });
  }
  if (mode === 'picsum' && !picsumUrl) {
    currentPicsumSeed = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    picsumUrl = generatePicsumUrl();
  }

  await saveAll();
  applyWallpaper();
  if (currentWallpaper !== 'none') watchWallpaperAndExtract();
}

function generatePicsumUrl() {
  // Use random seed for refresh; allow daily stable when not refreshing
  const seed = 'portab' + (currentPicsumSeed || Date.now().toString(36));
  return `https://picsum.photos/seed/${seed}/1920/1080`;
}
let currentPicsumSeed = '';

async function fetchBingWallpaper() {
  // Check if we already have today's wallpaper
  const today = new Date().toISOString().slice(0, 10);
  const meta = await chrome.storage.local.get('bingFetchDate');
  if (bingImageUrl && meta.bingFetchDate === today) return;

  // Sources tried in order. First is a China-friendly mirror that 307-redirects
  // to cn.bing.com (works without VPN). Others are fallbacks.
  const sources = [
    { url: 'https://api.paugram.com/bing/', isImage: true },
    { url: 'https://bing.biturl.top/?resolution=UHD&format=json&index=0&mkt=zh-CN',
      parse: (data) => data.url || null },
    { url: 'https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN',
      parse: (data) => data.images?.[0] ? ('https://cn.bing.com' + data.images[0].url) : null },
  ];

  for (const src of sources) {
    try {
      if (src.isImage) {
        // Resolve the 307 redirect to the actual image URL
        const resp = await fetch(src.url, { redirect: 'follow' });
        bingImageUrl = resp.url;
        if (bingImageUrl && bingImageUrl !== src.url) {
          await chrome.storage.local.set({ bingImageUrl, bingFetchDate: today });
          return;
        }
      } else {
        const resp = await fetch(src.url);
        const data = await resp.json();
        const url = src.parse(data);
        if (url) {
          bingImageUrl = url;
          await chrome.storage.local.set({ bingImageUrl, bingFetchDate: today });
          return;
        }
      }
    } catch (e) { /* try next */ }
  }
  console.error('Failed to fetch Bing wallpaper from all sources');
}

async function saveAll() {
  await chrome.storage.local.set({
    wallpaper: currentWallpaper,
    customWallpaperUrl,
    bingImageUrl,
    picsumUrl,
    overlayEnabled,
    overlayColor,
    overlayOpacity,
    blurEnabled,
    blurAmount,
  });
}

async function loadWallpaper() {
  await loadWallpaperCached();
  // Bing update is called separately for faster initial paint
}
async function loadWallpaperCached() {
  const result = await chrome.storage.local.get([
    'wallpaper', 'customWallpaperUrl', 'bingImageUrl', 'picsumUrl',
    'overlayEnabled', 'overlayColor', 'overlayOpacity',
    'blurEnabled', 'blurAmount', 'autoExtractColor',
  ]);

  if (result.wallpaper && ['none', 'bing', 'picsum', 'custom'].includes(result.wallpaper)) {
    currentWallpaper = result.wallpaper;
  }
  if (result.customWallpaperUrl) customWallpaperUrl = result.customWallpaperUrl;
  if (result.bingImageUrl) bingImageUrl = result.bingImageUrl;
  if (result.picsumUrl) picsumUrl = result.picsumUrl;

  if (result.overlayEnabled !== undefined) overlayEnabled = result.overlayEnabled;
  if (result.overlayColor) overlayColor = result.overlayColor;
  if (result.overlayOpacity !== undefined) overlayOpacity = result.overlayOpacity;
  if (result.blurEnabled !== undefined) blurEnabled = result.blurEnabled;
  if (result.blurAmount !== undefined) blurAmount = result.blurAmount;

  // Sync controls
  overlayToggle.checked = overlayEnabled;
  overlayColorInp.value = overlayColor;
  overlayColorInp.disabled = !overlayEnabled;
  if (window.MSSlider) MSSlider.setValue(overlayOpacityInp, overlayOpacity); else overlayOpacityInp.value = overlayOpacity;
  overlayOpacityInp.disabled = !overlayEnabled;
  overlayOpacityVal.textContent = overlayOpacity + '%';

  blurToggle.checked = blurEnabled;
  if (window.MSSlider) MSSlider.setValue(blurAmountInp, blurAmount); else blurAmountInp.value = blurAmount;
  blurAmountInp.disabled = !blurEnabled;
  blurAmountVal.textContent = blurAmount + 'px';

  applyWallpaper();

  // Sync segmented buttons & advanced visibility
  wallpaperBtns.forEach(btn => {
    btn.setAttribute('aria-checked', btn.dataset.wallpaper === currentWallpaper ? 'true' : 'false');
  });
  rangeBtns.forEach(btn => {
    btn.setAttribute('aria-checked', parseInt(btn.dataset.range) === historyRange ? 'true' : 'false');
  });
  customUrlWrap.classList.toggle('hidden', currentWallpaper !== 'custom');
  wallpaperAdvanced.classList.toggle('hidden', currentWallpaper === 'none');
  if (currentWallpaper === 'custom') customUrlInput.value = customWallpaperUrl;

  // Show/hide refresh button
  const refreshBtn = document.getElementById('refreshWallpaperBtn');
  if (refreshBtn) refreshBtn.style.display = currentWallpaper === 'picsum' ? 'flex' : 'none';

  // Auto-extract toggle
  if (result.autoExtractColor && autoExtractToggle) {
    autoExtractToggle.checked = true;
  }

  if (currentWallpaper !== 'none' && autoExtractToggle?.checked) {
    setTimeout(watchWallpaperAndExtract, 500);
  }
}

async function loadWallpaperBingUpdate() {
  if (currentWallpaper !== 'bing') return;
  await fetchBingWallpaper();
  await saveAll();
  applyWallpaper();
  if (autoExtractToggle?.checked) watchWallpaperAndExtract();
}

// ===== Dialog =====
async function openSettings() {
  settingsOverlay.classList.remove('hidden');

  themeBtns.forEach(btn => {
    btn.setAttribute('aria-checked', btn.dataset.themeOpt === currentTheme ? 'true' : 'false');
  });

  wallpaperBtns.forEach(btn => {
    btn.setAttribute('aria-checked', btn.dataset.wallpaper === currentWallpaper ? 'true' : 'false');
  });
  rangeBtns.forEach(btn => {
    btn.setAttribute('aria-checked', parseInt(btn.dataset.range) === historyRange ? 'true' : 'false');
  });
  customUrlWrap.classList.toggle('hidden', currentWallpaper !== 'custom');
  if (currentWallpaper === 'custom') customUrlInput.value = customWallpaperUrl;

  wallpaperAdvanced.classList.toggle('hidden', currentWallpaper === 'none');

  // Sync advanced controls
  overlayToggle.checked = overlayEnabled;
  overlayColorInp.value = overlayColor;
  overlayColorInp.disabled = !overlayEnabled;
  if (window.MSSlider) MSSlider.setValue(overlayOpacityInp, overlayOpacity); else overlayOpacityInp.value = overlayOpacity;
  overlayOpacityInp.disabled = !overlayEnabled;
  overlayOpacityVal.textContent = overlayOpacity + '%';

  blurToggle.checked = blurEnabled;
  if (window.MSSlider) MSSlider.setValue(blurAmountInp, blurAmount); else blurAmountInp.value = blurAmount;
  blurAmountInp.disabled = !blurEnabled;
  blurAmountVal.textContent = blurAmount + 'px';

  // Sync color
  customSeedColor.value = seedColor;
  updateColorPresetActive(seedColor);
  if (autoExtractToggle) autoExtractToggle.checked = !!(await chrome.storage.local.get('autoExtractColor')).autoExtractColor;

  buildIgnoreList();
  buildEngineCheckList();

  // Sync custom slider tracks
  if (window.MSSlider) document.querySelectorAll('.ms').forEach(MSSlider.repaint);
}

function closeSettings() {
  settingsOverlay.classList.add('hidden');
}

// ===== Search Engines =====
const DEFAULT_ENGINES = {
  google:   { name: 'Google',   url: 'https://www.google.com/search?q=', icon: 'google.com', suggest: 'https://suggestqueries.google.com/complete/search?client=chrome&q=' },
  bing:     { name: 'Bing',     url: 'https://www.bing.com/search?q=', icon: 'bing.com', suggest: 'https://api.bing.com/osjson.aspx?query=' },
  baidu:    { name: '百度',     url: 'https://www.baidu.com/s?wd=', icon: 'baidu.com', suggest: 'https://suggestion.baidu.com/s?wd=' },
  duckduckgo:{ name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=', icon: 'duckduckgo.com', suggest: 'https://duckduckgo.com/ac/?q=' },
  yahoo:    { name: 'Yahoo',    url: 'https://search.yahoo.com/search?p=', icon: 'search.yahoo.com', suggest: '' },
  searxng:  { name: 'SearXNG',  url: 'https://search.sapti.me/search?q=', icon: 'search.sapti.me', suggest: '' },
  ecosia:   { name: 'Ecosia',   url: 'https://www.ecosia.org/search?q=', icon: 'ecosia.org', suggest: '' },
  brave:    { name: 'Brave',    url: 'https://search.brave.com/search?q=', icon: 'search.brave.com', suggest: '' },
};

let currentEngine = 'google';
let enabledEngines = Object.keys(DEFAULT_ENGINES);
let customEngines = [];

function getAllEngines() {
  const list = [];
  for (const key of enabledEngines) {
    if (DEFAULT_ENGINES[key]) list.push({ id: key, ...DEFAULT_ENGINES[key], builtin: true });
  }
  for (const c of customEngines) {
    if (!c.id) c.id = 'custom_' + Date.now();
    list.push({ ...c, builtin: false });
  }
  return list;
}

async function loadEngines() {
  const result = await chrome.storage.local.get(['enabledEngines', 'customEngines', 'engine']);
  if (result.enabledEngines) enabledEngines = result.enabledEngines;
  if (result.customEngines) customEngines = result.customEngines;
  if (result.engine) {
    const all = getAllEngines();
    if (all.find(e => e.id === result.engine)) currentEngine = result.engine;
  }
  updateEngineUI();
  rebuildEngineDropdown();
  buildEngineCheckList();
}

async function saveEngines() {
  await chrome.storage.local.set({ enabledEngines, customEngines });
}

function buildEngineCheckList() {
  const list = document.getElementById('engineCheckList');
  if (!list) return;
  list.innerHTML = '';

  for (const [key, eng] of Object.entries(DEFAULT_ENGINES)) {
    const row = document.createElement('div');
    row.className = 'engine-check-row';
    row.innerHTML =
      '<label class="checkbox-wrap"><input type="checkbox" value="' + key + '" ' + (enabledEngines.includes(key) ? 'checked' : '') + '><span class="checkbox-box"></span></label>' +
      '<span class="eng-icon-wrap"><img src="' + faviconUrl(eng.icon) + '" onerror="this.style.display=\'none\';this.parentElement.querySelector(\'.eng-icon-fallback\').style.display=\'flex\'"><span class="eng-icon-fallback">' + eng.name[0] + '</span></span>' +
      '<span class="eng-name">' + eng.name + '</span>';
    row.querySelector('input').addEventListener('change', () => {
      if (enabledEngines.includes(key)) enabledEngines = enabledEngines.filter(e => e !== key);
      else enabledEngines.push(key);
      saveEngines();
      rebuildEngineDropdown();
    });
    list.appendChild(row);
  }

  for (let i = 0; i < customEngines.length; i++) {
    const c = customEngines[i];
    const domain = c.url.replace(/https?:\/\//, '').split('/')[0];
    const row = document.createElement('div');
    row.className = 'engine-check-row';
    row.innerHTML =
      '<label class="checkbox-wrap"><input type="checkbox" checked disabled><span class="checkbox-box"></span></label>' +
      '<span class="eng-icon-wrap"><img src="' + faviconUrl(domain) + '" onerror="this.style.display=\'none\';this.parentElement.querySelector(\'.eng-icon-fallback\').style.display=\'flex\'"><span class="eng-icon-fallback">' + c.name[0] + '</span></span>' +
      '<span class="eng-name">' + c.name + '</span>' +
      '<button class="del-engine" data-idx="' + i + '" title="删除">✕</button>';
    row.querySelector('.del-engine').addEventListener('click', () => {
      customEngines.splice(i, 1);
      saveEngines();
      buildEngineCheckList();
      rebuildEngineDropdown();
    });
    list.appendChild(row);
  }
}

function rebuildEngineDropdown() {
  const list = document.getElementById('engineList');
  if (!list) return;
  list.innerHTML = '';
  const all = getAllEngines();
  for (const eng of all) {
    const item = document.createElement('div');
    item.className = 'engine-item' + (eng.id === currentEngine ? ' active' : '');
    const domain = eng.icon || eng.url.replace(/https?:\/\//, '').split('/')[0];
    item.innerHTML = '<span class="eng-icon-wrap"><img src="' + faviconUrl(domain) + '" onerror="this.style.display=\'none\';this.parentElement.querySelector(\'.eng-icon-fallback\').style.display=\'flex\'"><span class="eng-icon-fallback">' + eng.name[0] + '</span></span> ' + eng.name;
    item.addEventListener('click', () => selectEngine(eng.id));
    list.appendChild(item);
  }
}

function selectEngine(id) {
  currentEngine = id;
  updateEngineUI();
  const dd = document.getElementById('engineDropdown');
  if (dd) dd.classList.add('hidden');
  const inp = document.getElementById('searchInput');
  if (inp) inp.focus();
  chrome.storage.local.set({ engine: id });
}

function updateEngineUI() {
  const all = getAllEngines();
  const eng = all.find(e => e.id === currentEngine) || all[0];
  if (!eng) return;
  const icon = document.getElementById('engineIcon');
  const fallback = document.getElementById('engineIconFallback');
  const domain = eng.icon || eng.url.replace(/https?:\/\//, '').split('/')[0];
  if (icon) {
    icon.style.display = 'none';
    icon.onerror = () => { icon.style.display = 'none'; if(fallback) { fallback.style.display = 'flex'; fallback.textContent = eng.name[0]; }};
    icon.onload = () => { icon.style.display = ''; if(fallback) fallback.style.display = 'none'; };
    icon.src = faviconUrl(domain);
  }
  const label = document.getElementById('engineLabel');
  if (label) label.innerHTML = I.search + ' ' + eng.name;
  currentEngine = eng.id;
}

// ===== Color =====
const COLOR_PRESETS = [
  { name: '蓝', hex: '#4c9aff' },
  { name: '靛', hex: '#5c6bc0' },
  { name: '紫', hex: '#7c4dff' },
  { name: '粉', hex: '#e91e63' },
  { name: '红', hex: '#e53935' },
  { name: '橙', hex: '#ff9100' },
  { name: '绿', hex: '#4caf50' },
  { name: '青', hex: '#009688' },
];

function buildColorPresets() {
  colorPresets.innerHTML = '';
  COLOR_PRESETS.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'color-preset';
    btn.dataset.hex = p.hex;
    btn.style.backgroundColor = p.hex;
    btn.title = p.name;
    btn.addEventListener('click', () => setSeedColor(p.hex));
    if (p.hex === seedColor) btn.classList.add('active');
    colorPresets.appendChild(btn);
  });
}

function updateColorPresetActive(hex) {
  colorPresets.querySelectorAll('.color-preset').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.hex === hex);
  });
}

async function setSeedColor(hex) {
  seedColor = hex;
  customSeedColor.value = hex;
  updateColorPresetActive(hex);
  const { applySeedColorBoth } = await import('./color-utils.js');
  applySeedColorBoth(hex);
  await chrome.storage.local.set({ seedColor: hex });
}

async function loadSeedColor() {
  const result = await chrome.storage.local.get(['seedColor']);
  if (result.seedColor) {
    seedColor = result.seedColor;
  }
  customSeedColor.value = seedColor;
  const { applySeedColorBoth } = await import('./color-utils.js');
  applySeedColorBoth(seedColor);
}

function buildIgnoreList() {
  const list = document.getElementById('ignoreList');
  if (!list) return;
  list.innerHTML = '';
  if (!ignoredUrls || ignoredUrls.length === 0) {
    list.innerHTML = '<div class="empty">还没有屏蔽任何站点</div>';
    return;
  }
  ignoredUrls.forEach((url, i) => {
    const row = document.createElement('div');
    row.className = 'engine-check-row';
    row.innerHTML = '<span class="eng-name">' + url + '</span><button class="del-engine" data-idx="' + i + '" title="恢复显示">✕</button>';
    row.querySelector('.del-engine').addEventListener('click', () => {
      ignoredUrls.splice(i, 1);
      chrome.storage.local.set({ ignoredUrls });
      buildIgnoreList();
      if (typeof renderAll === 'function') renderAll();
    });
    list.appendChild(row);
  });
}
