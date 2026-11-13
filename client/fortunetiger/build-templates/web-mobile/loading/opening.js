(function () {
      var opening = document.getElementById('AGOpening');
      if (!opening) return;
      var logo = opening.querySelector('svg');
      var layout = document.getElementById('AG4LoadingLayout');
      var ready = false, minimumElapsed = false, removed = false;
      var observer;
      function fit() {
        var rect = layout.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        logo.style.width = Math.min(rect.width * .58, rect.height * .4) + 'px';
        logo.style.left = rect.left + rect.width / 2 + 'px';
        logo.style.top = rect.top + rect.height / 2 + 'px';
      }
      function finish() {
        if (removed || !ready || !minimumElapsed) return;
        removed = true;
        opening.style.opacity = '0';
        setTimeout(function () {
          opening.remove();
          window.dispatchEvent(new Event('aislots-opening-ended'));
        }, 300);
        window.removeEventListener('resize', fit);

        if (observer) observer.disconnect();
      }
      function sceneRendered() { ready = true; finish(); }
      window.addEventListener('aislots-scene-rendered', sceneRendered, { once: true });
      fit();
      window.addEventListener('resize', fit);
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(fit);
        observer.observe(layout);
      }
      // 从首帧开始计时，不能把首次绘制前的脚本耗时算入这一秒。
      requestAnimationFrame(function () {
        setTimeout(function () { minimumElapsed = true; finish(); }, 1000);
      });
    }());
