/*
 * Game analytics hooks for play.buildquietly.com.
 *
 * Fires two Minilytics goals per game page:
 *   play   — the visitor actually interacted with the game (first pointer/key/touch)
 *   finish — the game's end screen became visible
 *
 * Usage, after the Minilytics tracker tag:
 *   <script src="../_track.js" data-game="paperfolk" data-end="#endcard"></script>
 *
 * data-end is optional; without it only `play` is sent.
 */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var game = s.getAttribute('data-game') || 'unknown';
  var played = false;
  var finished = false;
  var obs = null;

  function goal(name) {
    try {
      if (window.minilytics) window.minilytics('goal', name, { game: game });
    } catch (e) { /* analytics must never break a game */ }
  }

  function stop() {
    window.removeEventListener('pointerdown', start, true);
    window.removeEventListener('keydown', start, true);
    window.removeEventListener('touchstart', start, true);
  }

  function start() {
    if (played) return;
    played = true;
    stop();
    goal('play');
  }

  window.addEventListener('pointerdown', start, true);
  window.addEventListener('keydown', start, true);
  window.addEventListener('touchstart', start, true);

  function visible(el) {
    if (el.hidden || el.classList.contains('hidden')) return false;
    var st = window.getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden';
  }

  function watchEnd(sel) {
    var el = document.querySelector(sel);
    if (!el) return;
    function check() {
      if (finished) return;
      if (!visible(el)) return;
      finished = true;
      goal('finish');
      if (obs) obs.disconnect();
    }
    obs = new MutationObserver(check);
    obs.observe(el, { attributes: true, attributeFilter: ['class', 'hidden', 'style', 'aria-hidden'] });
    check();
  }

  var end = s.getAttribute('data-end');
  if (end) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { watchEnd(end); });
    } else {
      watchEnd(end);
    }
  }
})();
