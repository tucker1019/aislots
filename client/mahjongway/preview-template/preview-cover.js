/* HTML封面先于Cocos启动；场景完成首帧绘制后移除，避免显示空画布。 */
(function () {
    var cover = document.getElementById('PreviewCover');
    if (!cover) return;
    var closed = false;
    var boardReady = false;
    var engineReady = null;
    function revealAfterDraw() {
        if (!closed && boardReady && engineReady)
            engineReady.director.once(engineReady.Director.EVENT_AFTER_DRAW, close);
    }
    window.addEventListener('aislots-board-ready', function () {
        boardReady = true;
        revealAfterDraw();
    }, { once: true });
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
            revealAfterDraw();
        }).catch(function (error) {
            close();
            console.error(error);
        });
    }, { once: true });
}());
