/** Keep the button label in layout while an async action owns the control. */
export function busyButton(button: HTMLButtonElement, busy: boolean) {
    button.disabled = busy;
    if (!busy) { button.removeAttribute('aria-busy'); return; }
    if (!button.querySelector('.ag5-async-label')) {
        const label = document.createElement('span');
        label.className = 'ag5-async-label';
        label.append(...button.childNodes);
        const spinner = document.createElement('span');
        spinner.className = 'ag5-async-spinner';
        spinner.setAttribute('aria-hidden', 'true');
        button.append(label, spinner);
    }
    if (!document.getElementById('ag5-async-style')) {
        const style = document.createElement('style');
        style.id = 'ag5-async-style';
        style.textContent = `
            .ag5-async-spinner{display:none}
            button[aria-busy=true]:has(>.ag5-async-spinner){position:relative}
            button[aria-busy=true]>.ag5-async-label{visibility:hidden}
            button[aria-busy=true]>.ag5-async-spinner{display:block;position:absolute;left:50%;top:50%;width:1em;height:1em;margin:-.5em;box-sizing:border-box;border:.13em solid currentColor;border-right-color:transparent;border-radius:50%;animation:ag5-async-spin .7s linear infinite}
            @keyframes ag5-async-spin{to{transform:rotate(360deg)}}
        `;
        document.head.append(style);
    }
    if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', button.textContent);
    button.setAttribute('aria-busy', 'true');
}
