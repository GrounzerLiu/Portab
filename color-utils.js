// ===== Portab - Color Utilities (Material Color Utilities wrapper) =====
import { themeFromSourceColor, argbFromHex, hexFromArgb, sourceColorFromImage } from './mcu.js';

export const PRESETS = [
  { name: '蓝', hex: '#4c9aff' },
  { name: '靛', hex: '#5c6bc0' },
  { name: '紫', hex: '#7c4dff' },
  { name: '粉', hex: '#e91e63' },
  { name: '红', hex: '#e53935' },
  { name: '橙', hex: '#ff9100' },
  { name: '绿', hex: '#4caf50' },
  { name: '青', hex: '#009688' },
];

// Map Material scheme colors to our CSS custom properties
function schemeToVars(scheme, suffix = '') {
  const s = (name) => hexFromArgb(scheme.toJSON()[name]);
  const sfx = suffix;
  return {
    [`--accent${sfx}`]: s('primary'),
    [`--accent-hover${sfx}`]: s('primary'),
    [`--accent-bg${sfx}`]: s('primaryContainer'),
    [`--on-primary${sfx}`]: s('onPrimary'),
    [`--on-secondary-container${sfx}`]: s('onSecondaryContainer'),
    [`--bg${sfx}`]: s('surface'),
    [`--surface${sfx}`]: s('surface'),
    [`--surface2${sfx}`]: s('surfaceVariant'),
    [`--surface-hover${sfx}`]: s('surfaceVariant'),
    [`--card-bg${sfx}`]: s('surfaceVariant'),   // fill card surface
    [`--border${sfx}`]: s('outlineVariant'),
    [`--text${sfx}`]: s('onSurface'),
    [`--text-muted${sfx}`]: s('onSurfaceVariant'),
    [`--text-title${sfx}`]: s('onSurface'),
    [`--red${sfx}`]: s('error'),
    [`--red-bg${sfx}`]: s('errorContainer'),
    [`--shadow${sfx}`]: s('shadow'),
    [`--shadow-lg${sfx}`]: s('shadow'),
  };
}

export function applySeedColorBoth(hex) {
  const argb = argbFromHex(hex);
  const theme = themeFromSourceColor(argb);
  const light = theme.schemes.light;
  const dark = theme.schemes.dark;

  const lightVars = schemeToVars(light);
  const darkVars = schemeToVars(dark);

  let styleEl = document.getElementById('mc-theme-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'mc-theme-style';
    document.head.appendChild(styleEl);
  }

  // Generate CSS with proper selectors
  let css = '';

  // Light theme
  css += 'html[data-theme="light"] {';
  for (const [k, v] of Object.entries(lightVars)) css += `${k}: ${v}; `;
  css += '}';

  // Auto-light (when system prefers light)
  css += 'html[data-theme="auto"] {';
  for (const [k, v] of Object.entries(lightVars)) css += `${k}: ${v}; `;
  css += '}';

  // Dark theme
  css += 'html[data-theme="dark"] {';
  for (const [k, v] of Object.entries(darkVars)) css += `${k}: ${v}; `;
  css += '}';

  // Auto-dark (when system prefers dark)
  css += '@media (prefers-color-scheme: dark) {';
  css += 'html[data-theme="auto"] {';
  for (const [k, v] of Object.entries(darkVars)) css += `${k}: ${v}; `;
  css += '}}';

  styleEl.textContent = css;

  // Also apply light as default on :root for the initial state (dark attr may not be on html yet)
  // But we need to NOT override dark. Use :root:not([data-theme="dark"]) for fallback
  // Actually just keep theme.css as fallback — remove the body inline setting
  document.body.style.removeProperty('--accent');
  document.body.style.removeProperty('--bg');
  document.body.style.removeProperty('--surface');
  document.body.style.removeProperty('--text');
  // (full cleanup of all possible inline vars)
  const allKeys = Object.keys(lightVars);
  allKeys.forEach(k => document.body.style.removeProperty(k));
}

export async function extractFromWallpaper(imgUrl) {
  return new Promise(async (resolve, reject) => {
    try {
      // Fetch as blob to avoid CORS issues (extension has host permissions)
      const resp = await fetch(imgUrl);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const img = new Image();
      img.onload = async () => {
        URL.revokeObjectURL(blobUrl);
        try {
          const argb = await sourceColorFromImage(img);
          resolve(hexFromArgb(argb));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Image load failed'));
      };
      img.src = blobUrl;
    } catch (e) {
      reject(e);
    }
  });
}
