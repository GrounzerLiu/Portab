// Prevent theme flash + preload wallpaper
(function() {
  var t = localStorage.getItem('portab_theme');
  if (t === 'dark' || t === 'light' || t === 'auto') {
    document.documentElement.setAttribute('data-theme', t);
  }
  var w = localStorage.getItem('portab_wallpaper');
  var m = localStorage.getItem('portab_wallpaper_mode');
  if (w && m && m !== 'none') {
    document.documentElement.style.setProperty('--wp-url', 'url(' + w + ')');
    document.documentElement.setAttribute('data-wallpaper', '1');
  }
})();
