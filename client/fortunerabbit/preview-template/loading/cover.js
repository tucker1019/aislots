/* The DOM cover is available before Cocos and stays until the first game draw. */
(function () {
  var cover = document.getElementById('AG5LoadingCover');
  var layout = document.getElementById('AG5LoadingLayout');
  var launch = document.getElementById('AG5Launch');
  var bar = document.getElementById('AG5LoadingProgress');
  var fill = document.getElementById('AG5LoadingFill');
  var button = document.getElementById('AG5StartButton');
  var nativeReplay = new URLSearchParams(location.search).has('nativeReplay');
  var ready = false, started = false, percent = 0;
  function progress(event) {
    var value = event.detail && event.detail.progress;
    if (typeof value !== 'number' || !isFinite(value)) return;
    percent = Math.max(percent, Math.min(ready ? 100 : 99, Math.max(0, value)));
    bar.setAttribute('aria-valuenow', String(percent));
    fill.style.setProperty('--progress', percent + '%');
  }
  function present() {
    if (!ready || document.getElementById('AGOpening')) return;
    bar.hidden = true;
    if (nativeReplay) start(); else button.hidden = false;
  }
  function boardReady() {
    ready = true;
    progress({detail:{progress:100}});
    present();
  }
  function start() {
    if (!ready || started) return;
    started = true;
    button.disabled = true;
    launch.hidden = false;
    layout.hidden = true;
    window.dispatchEvent(new Event('aislots-started'));
  }
  function revealed() {
    if (!started) return;
    cover.remove();
    window.removeEventListener('aislots-loading-progress', progress);
  }
  function failed() { bar.hidden = true; }
  button.addEventListener('click', start);
  window.addEventListener('aislots-loading-progress', progress);
  window.addEventListener('aislots-opening-ended', present, {once:true});
  window.addEventListener('aislots-board-ready', boardReady, {once:true});
  window.addEventListener('aislots-game-revealed', revealed, {once:true});
  window.addEventListener('aislots-loading-failed', failed, {once:true});
}());
