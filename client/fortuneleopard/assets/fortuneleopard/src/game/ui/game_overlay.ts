function gameBounds(rect: DOMRect, width: number, height: number) {
    const scale = Math.min(rect.width / width, rect.height / height);
    return {
        left: rect.left + (rect.width - width * scale) / 2,
        top: rect.top + (rect.height - height * scale) / 2,
        width: width * scale,
        height: height * scale,
    };
}

/** HTML overlays use a stable design space, then scale with the visible portrait game. */
export function fitGameOverlay(root: HTMLElement, canvas: HTMLCanvasElement, designWidth = 540) {
    const update = () => {
        const box = gameBounds(canvas.getBoundingClientRect(), 750, 1334);
        if (box.width <= 0 || box.height <= 0) return;
        const scale = box.width / designWidth;
        Object.assign(root.style, {
            position: 'fixed', left: `${box.left}px`, top: `${box.top}px`, right: 'auto', bottom: 'auto',
            width: `${designWidth}px`, height: `${box.height / scale}px`,
            transformOrigin: '0 0', transform: `scale(${scale})`, fontSize: '18px',
        });
    };
    update();
    window.addEventListener('resize', update);
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    resize?.observe(canvas);
    const cleanup = () => { window.removeEventListener('resize', update); resize?.disconnect(); removal.disconnect(); };
    // Roots may be removed by close handlers or by scene destruction.
    const removal = new MutationObserver(() => { if (!root.isConnected) cleanup(); });
    removal.observe(document.documentElement, { childList: true, subtree: true });
    return cleanup;
}
