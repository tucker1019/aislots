import { el } from '../history/history_dom';
const disposers = new WeakMap<HTMLElement, () => void>();

/** 原生滚动负责内容；自绘滑动条绝对定位覆盖右侧，不占内容宽度。 */
export function floatingScroll(scroll: HTMLElement): HTMLElement {
    const viewport = el('div', 'history-scroll-viewport');
    const content = el('div', 'history-scroll-content');
    content.append(...Array.from(scroll.childNodes));
    scroll.append(content);
    const track = el('div', 'history-scroll-track');
    const thumb = el('div', 'history-scroll-thumb');
    track.setAttribute('aria-hidden', 'true');
    track.append(thumb);
    viewport.append(scroll, track);
    let thumbHeight = 0;
    function update() {
        const height = scroll.clientHeight;
        track.hidden = scroll.scrollHeight <= height + 1;
        thumbHeight = Math.min(height, Math.max(24, height * height / scroll.scrollHeight));
        thumb.style.height = thumbHeight + 'px';
        const range = scroll.scrollHeight - height;
        const top = range > 0 ? scroll.scrollTop / range * (height - thumbHeight) : 0;
        thumb.style.transform = 'translateY(' + top + 'px)';
    }
    let drag: { y: number; top: number } = null;
    thumb.addEventListener('pointerdown', event => {
        event.preventDefault();
        drag = { y: event.clientY, top: scroll.scrollTop };
        thumb.setPointerCapture(event.pointerId);
    });
    thumb.addEventListener('pointermove', event => {
        if (!drag) return;
        const travel = scroll.clientHeight - thumbHeight;
        if (travel > 0) scroll.scrollTop = drag.top + (event.clientY - drag.y) *
            (scroll.scrollHeight - scroll.clientHeight) / travel;
    });
    thumb.addEventListener('lostpointercapture', () => drag = null);
    scroll.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroll);
    observer.observe(content);
    disposers.set(viewport, () => observer.disconnect());
    return viewport;
}
export function disposeFloatingScroll(host: HTMLElement) {
    host.querySelectorAll<HTMLElement>('.history-scroll-viewport').forEach(viewport => {
        disposers.get(viewport)?.();
        disposers.delete(viewport);
    });
}
