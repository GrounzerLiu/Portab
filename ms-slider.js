// ===== Portab - Custom MD3 Slider =====
// Self-implemented slider matching MD3 visually-refreshed spec.
// Replaces native <input type="range"> for full control over rendering.

(function() {
  /**
   * Initialize all .ms sliders in the document.
   * Each slider is a <div class="ms" data-min data-max data-steps data-value>
   * containing <div class="ms-track-inactive">, <div class="ms-track-active">, <div class="ms-handle">.
   * Stops are rendered dynamically by paint().
   *
   * Coordinate system:
   *   - handle left px range: [4, w - 8]  (4dp from each edge)
   *   - handle width: 4dp
   *   - active track: left=0, right = handleLeft - 6 (6dp gap)
   *   - inactive track: left = handleLeft + 4 + 6
   *   - stops: continuous → only end stop; discrete (steps >= 2) → all stops
   *   - stop colors: on-active (dark) / on-inactive (light) / on-handle (handle color, hidden)
   */
  function paint(slider) {
    const w = slider.offsetWidth;
    const min = parseFloat(slider.dataset.min);
    const max = parseFloat(slider.dataset.max);
    let value = parseFloat(slider.dataset.value);
    const steps = parseInt(slider.dataset.steps) || 0;
    const range = max - min;
    const valuePct = (value - min) / range;

    const handleW = 4;
    const handleLeftPx = 4 + valuePct * (w - 12);
    const handle = slider.querySelector('.ms-handle');
    handle.style.left = handleLeftPx + 'px';

    const active = slider.querySelector('.ms-track-active');
    const activeW = Math.max(0, handleLeftPx - 6);
    active.style.width = activeW + 'px';
    active.style.display = (value <= min || activeW <= 0) ? 'none' : '';

    const inactive = slider.querySelector('.ms-track-inactive');
    const inactiveLeft = Math.min(w, handleLeftPx + handleW + 6);
    inactive.style.left = inactiveLeft + 'px';
    inactive.style.right = '0';
    inactive.style.display = (value >= max) ? 'none' : '';

    // Stops
    slider.classList.toggle('ms-continuous', steps < 2);
    let stops = slider.querySelectorAll('.ms-stop');
    stops.forEach(s => s.remove());
    const fragment = document.createDocumentFragment();
    if (steps >= 2) {
      for (let i = 0; i < steps; i++) {
        const pct = i / (steps - 1);
        const leftPx = 4 + pct * (w - 12);
        const stopCenter = leftPx + 2;
        const handleCenter = handleLeftPx + handleW / 2;
        const onHandle = Math.abs(stopCenter - handleCenter) < handleW / 2 + 0.5;
        const onActive = stopCenter < handleLeftPx;
        const stop = document.createElement('div');
        let cls = 'ms-stop';
        if (onHandle) cls += ' ms-stop-on-handle';
        else if (onActive) cls += ' ms-stop-on-active';
        else cls += ' ms-stop-on-inactive';
        stop.className = cls;
        stop.style.left = leftPx + 'px';
        fragment.appendChild(stop);
      }
    } else {
      const endStop = document.createElement('div');
      endStop.className = 'ms-stop ms-stop-on-inactive';
      endStop.style.right = '4px';
      fragment.appendChild(endStop);
    }
    slider.appendChild(fragment);
  }

  function attachInteraction(slider) {
    const min = parseFloat(slider.dataset.min);
    const max = parseFloat(slider.dataset.max);
    const steps = parseInt(slider.dataset.steps) || 0;
    const range = max - min;

    // Skip interaction if disabled
    if (slider.classList.contains('ms-disabled')) return;

    function setFromX(xPx) {
      const w = slider.offsetWidth;
      let pct = (xPx - 4) / (w - 12);
      pct = Math.max(0, Math.min(1, pct));

      if (steps >= 2) {
        const step = 1 / (steps - 1);
        const idx = Math.round(pct / step);
        pct = idx * step;
      }

      const value = min + pct * range;
      slider.dataset.value = value;
      paint(slider);
      // Fire change event for app to update
      slider.dispatchEvent(new CustomEvent('ms-change', { detail: { value }, bubbles: true }));
    }

    let dragging = false;
    function onDown(e) {
      if (slider.classList.contains('ms-disabled')) return;
      e.preventDefault();
      dragging = true;
      slider.classList.add('ms-dragging');
      const rect = slider.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      setFromX(x);
    }
    function onMove(e) {
      if (!dragging) return;
      const rect = slider.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      setFromX(x);
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      slider.classList.remove('ms-dragging');
      // Fire final event for expensive operations (like grid re-render)
      const v = parseFloat(slider.dataset.value);
      slider.dispatchEvent(new CustomEvent('ms-change-final', { detail: { value: v }, bubbles: true }));
    }
    function onKey(e) {
      if (slider.classList.contains('ms-disabled')) return;
      let v = parseFloat(slider.dataset.value);
      const big = (e.shiftKey ? (max - min) / 10 : (max - min) / 20);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v -= big;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v += big;
      else if (e.key === 'Home') v = min;
      else if (e.key === 'End') v = max;
      else return;
      v = Math.max(min, Math.min(max, v));
      slider.dataset.value = v;
      paint(slider);
      slider.dispatchEvent(new CustomEvent('ms-change', { detail: { value: v }, bubbles: true }));
      slider.dispatchEvent(new CustomEvent('ms-change-final', { detail: { value: v }, bubbles: true }));
    }

    slider.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    slider.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    slider.addEventListener('keydown', onKey);
    slider.tabIndex = 0;
  }

  function setValue(slider, value) {
    const min = parseFloat(slider.dataset.min);
    const max = parseFloat(slider.dataset.max);
    value = Math.max(min, Math.min(max, value));
    slider.dataset.value = value;
    paint(slider);
    // Trigger change event so hidden input gets updated
    slider.dispatchEvent(new CustomEvent('ms-change', { detail: { value }, bubbles: true }));
  }

  function getValue(slider) {
    return parseFloat(slider.dataset.value);
  }

  function repaint(slider) {
    paint(slider);
  }

  window.MSSlider = {
    init: function() {
      document.querySelectorAll('.ms').forEach(s => {
        paint(s);
        attachInteraction(s);
      });
    },
    setValue,
    getValue,
    repaint,
  };
})();
