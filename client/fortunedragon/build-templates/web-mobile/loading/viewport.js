// Cocos asserts when an iframe briefly reports a zero-sized viewport.
// Defer only those resize events, then notify the engine once dimensions return.
(function () {
  var pending = 0;
  function validSize() {
    return Number.isFinite(window.innerWidth) && window.innerWidth > 0 &&
      Number.isFinite(window.innerHeight) && window.innerHeight > 0;
  }
  function resume() {
    pending = 0;
    if (!validSize()) { pending = requestAnimationFrame(resume); return; }
    window.dispatchEvent(new Event('resize'));
  }
  window.addEventListener('resize', function (event) {
    if (validSize()) {
      if (pending) { cancelAnimationFrame(pending); pending = 0; }
      return;
    }
    event.stopImmediatePropagation();
    if (!pending) pending = requestAnimationFrame(resume);
  }, true);
  window.addEventListener('pagehide', function () {
    if (pending) { cancelAnimationFrame(pending); pending = 0; }
  });
}());
