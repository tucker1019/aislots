export function visibleGameBounds(canvas: HTMLCanvasElement) {
    // Creator preview can render a fixed-size device larger than the browser window.
    const rect = canvas.getBoundingClientRect();
    const left = Math.max(rect.left, 0);
    const top = Math.max(rect.top, 0);
    const width = Math.max(0, Math.min(rect.right, document.documentElement.clientWidth) - left);
    const height = Math.max(0, Math.min(rect.bottom, document.documentElement.clientHeight) - top);
    const scale = Math.min(width / 750, height / 1334);
    return {
        left: left + (width - 750 * scale) / 2,
        top: top + (height - 1334 * scale) / 2,
        width: 750 * scale,
        height: 1334 * scale,
    };
}

/** HTML overlays use a stable design space, then scale with the visible portrait game. */
export function fitGameOverlay(root: HTMLElement, canvas: HTMLCanvasElement, designWidth = 540) {
    const update = () => {
        const box = visibleGameBounds(canvas);
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
