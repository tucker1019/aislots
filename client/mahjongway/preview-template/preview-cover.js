/* HTML封面先于Cocos启动；场景完成首帧绘制后移除，避免显示空画布。 */
(function () {
    var cover = document.getElementById('PreviewCover');
    if (!cover) return;
    var closed = false;
    var boardReady = false;
    var engineReady = null;
    var started = false;
    var progress = document.querySelector ? document.querySelector('.preview-loading') : null;
    var fill = document.querySelector ? document.querySelector('.preview-loading-fill') : null;
    var startButton = document.getElementById('PreviewStartButton');
    function setProgress(value) {
        var current = progress ? Number(progress.getAttribute('aria-valuenow') || 0) : 0;
        var percent = Math.max(current, Math.max(0, Math.min(100, value)));
        if (fill) fill.style.width = percent + '%';
        if (progress) progress.setAttribute('aria-valuenow', String(percent));
    }
    setProgress(8);
    function revealAfterDraw() {
        if (!closed && started && boardReady && engineReady)
            engineReady.director.once(engineReady.Director.EVENT_AFTER_DRAW, close);
    }
    window.addEventListener('aislots-board-ready', function () {
        boardReady = true;
        setProgress(100);
        if (startButton) startButton.hidden = false;
        revealAfterDraw();
    }, { once: true });
    window.addEventListener('aislots-loading-progress', function (event) {
        setProgress(event.detail && event.detail.progress || 0);
    });
    function close() {
        if (closed) return;
        closed = true;
        cover.remove();
        window.removeEventListener('error', close, true);
        window.removeEventListener('unhandledrejection', close);
    }
    // 加载失败时露出编辑器原有错误面板，不能被封面遮住。
    window.addEventListener('error', close, true);
    window.addEventListener('unhandledrejection', close);
    window.addEventListener('load', function () {
        System.import('cc').then(function (engine) {
            if (closed) return;
            engineReady = engine;
            setProgress(22);
            revealAfterDraw();
        }).catch(function (error) {
            close();
            console.error(error);
        });
    }, { once: true });
    if (startButton) startButton.addEventListener('click', function () {
        started = true;
        window.dispatchEvent(new Event('aislots-started'));
        revealAfterDraw();
    }, { once: true });
}());
