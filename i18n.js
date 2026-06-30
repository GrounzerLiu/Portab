// ===== Portab - i18n Runtime Override =====
// Chrome's __MSG_*__ is fixed at load time. This module provides runtime
// language switching by fetching the messages.json and overriding the DOM.

(function () {
  'use strict';

  var STORAGE_KEY = 'language';
  var _cache = {};   // key → translated string
  var _ready = false;

  // ── Global _msg(key, [subs]) ──────────────────────────────
  // Before the override loads, falls back to Chrome built-in i18n.
  window._msg = function (key, subs) {
    if (_cache[key]) return _cache[key];
    try { return chrome.i18n.getMessage(key, subs); }
    catch { return key; }
  };

  // ── Apply data-i18n / data-i18n-title / data-i18n-placeholder ──
  function applyOverrides() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var k = el.getAttribute('data-i18n');
      if (_cache[k]) el.textContent = _cache[k];
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-title');
      if (_cache[k]) el.title = _cache[k];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-placeholder');
      if (_cache[k]) el.placeholder = _cache[k];
    });
  }

  // ── Fetch & cache messages for a locale ───────────────────
  function loadLocale(lang, cb) {
    if (lang === 'auto') { _cache = {}; _ready = false; cb && cb(); return; }
    fetch(chrome.runtime.getURL('_locales/' + lang + '/messages.json'))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        _cache = {};
        for (var k in data) {
          if (data[k] && data[k].message) _cache[k] = data[k].message;
        }
        _ready = true;
        cb && cb();
      })
      .catch(function () { _cache = {}; _ready = false; cb && cb(); });
  }

  // ── Public API ────────────────────────────────────────────
  // Called by settings.js when user picks a language
  window.changeLanguage = function (lang, cb) {
    chrome.storage.local.set({ [STORAGE_KEY]: lang }, function () {
      loadLocale(lang, function () {
        document.documentElement.lang = lang === 'zh_CN' ? 'zh-CN' : (lang === 'auto' ? (navigator.language || 'zh-CN') : lang);
        applyOverrides();
        cb && cb();
      });
    });
  };

  // ── Apply auto mode overrides using chrome.i18n.getMessage ──
  function applyAutoOverrides() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var k = el.getAttribute('data-i18n');
      var msg = chrome.i18n.getMessage(k);
      if (msg) el.textContent = msg;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-title');
      var msg = chrome.i18n.getMessage(k);
      if (msg) el.title = msg;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-placeholder');
      var msg = chrome.i18n.getMessage(k);
      if (msg) el.placeholder = msg;
    });
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    chrome.storage.local.get(STORAGE_KEY, function (r) {
      var lang = r[STORAGE_KEY] || 'auto';
      document.documentElement.lang = lang === 'auto' ? (navigator.language || 'zh-CN') : (lang === 'zh_CN' ? 'zh-CN' : lang);
      if (lang === 'auto') {
        applyAutoOverrides();
        return;
      }
      loadLocale(lang, function () {
        applyOverrides();
      });
    });
  }

  // Set lang attribute immediately from storage (sync read from cached value)
  try {
    chrome.storage.local.get(STORAGE_KEY, function (r) {
      var lang = r[STORAGE_KEY] || 'auto';
      if (lang !== 'auto') {
        document.documentElement.lang = lang === 'zh_CN' ? 'zh-CN' : lang;
      }
    });
  } catch (e) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
