/* Runs before the engine; completion comes from the first initialized game draw. */
(function () {
  var cover = document.getElementById('AG3LoadingCover');
  if (!cover) return;
  var bar = document.getElementById('AG3LoadingProgress');
  var fill = document.getElementById('AG3LoadingFill');
  var button = document.getElementById('AG3StartButton');
  var ready = false, started = false, percent = 0;
  var params = new URLSearchParams(window.location.search);
  var replay = params.has('nativeReplay') || (params.has('replay') && params.has('share'));
  function progress(event) {
    var value = event.detail && event.detail.progress;
    if (typeof value !== 'number' || !isFinite(value)) return;
    percent = Math.max(percent, Math.min(ready ? 100 : 99, Math.max(0, value)));
    bar.setAttribute('aria-valuenow', String(percent)); fill.style.width = percent + '%';
  }
  function start() {
    if (!ready || started) return;
    started = true; button.disabled = true;
    // Start native introduction synchronously in the trusted click to unlock audio.
    window.dispatchEvent(new Event('aislots-started'));

  }
  function revealed() {
    if (!started) return;
    cover.remove();
    window.removeEventListener('aislots-board-ready', boardReady);
    window.removeEventListener('aislots-loading-progress', progress);
    window.removeEventListener('aislots-game-revealed', revealed);
  }
  window.addEventListener('aislots-game-revealed', revealed);
  function boardReady() {
    ready = true; progress({detail:{progress:100}});
    if (replay) start(); else button.hidden = false;
  }
  button.addEventListener('click', start);
  window.addEventListener('aislots-loading-progress', progress);
  window.addEventListener('aislots-board-ready', boardReady);
  progress({detail:{progress:2}});
}());
