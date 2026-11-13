(function () {
      var opening = document.getElementById('AGOpening');
      var logo = opening.querySelector('svg');
      var cover = document.getElementById('AG3LoadingCover');
      var ready = false, minimumElapsed = false, removed = false;
      var observer;
      function fit() {
        var rect = cover.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        logo.style.width = Math.min(rect.width * .58, rect.height * .4) + 'px';
        logo.style.left = rect.left + rect.width / 2 + 'px';
        logo.style.top = rect.top + rect.height / 2 + 'px';
      }
      function finish() {
        if (removed || !ready || !minimumElapsed) return;
        removed = true;
        opening.style.opacity = '0';
        setTimeout(function () { opening.remove(); }, 300);
        window.removeEventListener('resize', fit);
        window.removeEventListener('aislots-scene-rendered', sceneRendered);
        if (observer) observer.disconnect();
      }
      function sceneRendered() { ready = true; finish(); }
      window.addEventListener('aislots-scene-rendered', sceneRendered, { once: true });
      fit();
      window.addEventListener('resize', fit);
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(fit);
        observer.observe(cover);
      }
      // 从首帧开始计时，不能把首次绘制前的脚本耗时算入这一秒。
      requestAnimationFrame(function () {
        setTimeout(function () { minimumElapsed = true; finish(); }, 1000);
      });
    }());
