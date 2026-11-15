export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className = '',
    text?: string,
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}
export function button(text: string, action: () => void, className = '') {
    const node = el('button', className, text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
}
export function notice(host: HTMLElement, message: string, retry?: () => void) {
    const box = el('div', 'history-notice');
    box.append(el('p', '', message));
    if (retry) box.append(button('重试', retry, 'history-pill'));
    host.append(box);
}
export function errorText(error: unknown) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 401)
        return '登录已失效，请关闭记录页后重新进入游戏';
    return error instanceof Error ? error.message : '加载失败，请重试';
}

/** 将键盘焦点保留在记录弹层内。 */
export function trapTab(root: HTMLElement, event: KeyboardEvent) {
    const controls = Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled),select,summary'))
        .filter(n => n.getClientRects().length);
    if (!controls.length) return;
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) {
        event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
    }
}

export function placeOverlay(root: HTMLElement, box: {left: number; top: number; width: number; height: number}) {
    Object.assign(root.style, {
        left: box.left + 'px', top: box.top + 'px', width: box.width + 'px',
        height: box.height + 'px', fontSize: box.width / 540 * 18 + 'px',
    });
}
