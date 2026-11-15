import { button, el } from './history_dom';

/** 只复制公开回放参数，绝不把平台身份或登录 token 带入分享链接。 */
export function replayShareURL(href: string, betId: string, shareToken: string): string {
    const current = new URL(href);
    const url = new URL(current.pathname, current.origin);
    url.searchParams.set('replay', betId);
    url.searchParams.set('share', shareToken);
    if (['localhost','127.0.0.1'].includes(current.hostname) && current.searchParams.has('api'))
        url.searchParams.set('api', current.searchParams.get('api'));
    return url.href;
}
export function defaultApiBase(href: string): string {
    const url = new URL(href);
    return ['localhost','127.0.0.1'].includes(url.hostname) ? 'http://127.0.0.1:8080' : url.origin;
}

function clipboardAllowed() {
    const policy = (document as Document & { permissionsPolicy?: {allowsFeature(name:string):boolean}; featurePolicy?: {allowsFeature(name:string):boolean} });
    return (policy.permissionsPolicy || policy.featurePolicy)?.allowsFeature('clipboard-write') !== false && !!navigator.clipboard?.writeText;
}
/** 优先复制；浏览器不允许剪贴板时提供可选择的链接和第二次点击复制。 */
export async function copyReplayLink(url: string, host: HTMLElement): Promise<boolean> {
    try {
        if (!clipboardAllowed()) throw new Error('clipboard unavailable');
        await navigator.clipboard.writeText(url);
        return true;
    } catch { /* 用户仍可手动选择链接，不能只提示失败。 */ }
    const overlay = el('div', 'replay-copy-overlay');
    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:auto;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;';
    const panel = el('div');
    panel.style.cssText = 'width:88%;box-sizing:border-box;background:#30303e;padding:1.2em;border:1px solid #bb7c4b;border-radius:.5em;';
    const input = el('input'); input.readOnly = true; input.value = url;
    input.setAttribute('aria-label','分享链接');
    input.style.cssText = 'box-sizing:border-box;width:100%;margin:1em 0;padding:.7em;background:#24242e;color:#fff;border:1px solid #7c6b5c;font:inherit;font-size:.8em;';
    const copy = button('复制链接', () => {
        input.select();
        if (clipboardAllowed()) void navigator.clipboard.writeText(url).then(() => {copy.textContent='已复制';}).catch(() => {
            copy.textContent = document.execCommand('copy') ? '已复制' : '请长按链接复制';
        });
        if (!clipboardAllowed()) copy.textContent = document.execCommand('copy') ? '已复制' : '请长按链接复制';
    });
    const close = button('关闭',()=>overlay.remove());
    for (const control of [copy,close]) control.style.cssText='border:1px solid #bb7c4b;border-radius:1.5em;background:none;color:#e4c29d;padding:.6em 1em;margin-right:.5em;font:inherit;font-size:.8em;cursor:pointer;';
    panel.append(el('div','','分享回放'),input,copy,close);overlay.append(panel);host.append(overlay);input.select();
    return false;
}

/** 分享与“已复制”使用同一节点；尺寸由调用方固定，状态变化不参与布局。 */
export function replayShareButton(getURL: () => Promise<string>, host: () => HTMLElement, className = '') {
    const label = el('span', 'ag3-share-label', '分享');
    const spinner = el('span', 'ag3-share-spinner'); spinner.setAttribute('aria-hidden','true');
    const control = button('分享', () => {
        control.disabled = true; control.dataset.loading = 'true'; control.setAttribute('aria-busy','true');
        void getURL().then(url => {
            control.title = url;
            return copyReplayLink(url, host());
        }).then(copied => {
            label.textContent = copied ? '已复制' : '分享';
        }).catch(reason => {
            label.textContent = '重试';
            control.title = reason instanceof Error ? reason.message : '分享失败';
        }).finally(() => { control.disabled = false; delete control.dataset.loading; control.removeAttribute('aria-busy'); });
    }, className);
    control.classList.add('ag3-replay-share'); control.replaceChildren(label,spinner);
    if (!document.getElementById('ag3-share-loading-style')) {
        const style = el('style');style.id='ag3-share-loading-style';
        style.textContent='.ag3-replay-share{position:relative}.ag3-share-spinner{display:none;position:absolute;left:50%;top:50%;box-sizing:border-box;width:1em;height:1em;margin:-.5em;border:.13em solid currentColor;border-right-color:transparent;border-radius:50%;animation:ag3-share-spin .7s linear infinite}.ag3-replay-share[data-loading="true"] .ag3-share-label{visibility:hidden}.ag3-replay-share[data-loading="true"] .ag3-share-spinner{display:block}@keyframes ag3-share-spin{to{transform:rotate(360deg)}}';document.head.append(style);
    }
    return control;
}
