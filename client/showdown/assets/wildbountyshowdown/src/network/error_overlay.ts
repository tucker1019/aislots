/** Failure UI is independent of the game canvas and keeps the same request alive. */
export function retryRequest(error: unknown, retry: () => void, exit: () => void): () => void {
    const shade = document.createElement('div');
    shade.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#0009;display:grid;place-items:center;padding:20px;font:16px sans-serif';
    const card = document.createElement('div');
    card.style.cssText = 'width:min(300px,100%);padding:24px;border:1px solid #80654c;border-radius:16px;background:#26242c;color:white;box-sizing:border-box;text-align:center';
    const text = document.createElement('p');
    text.textContent = error instanceof Error ? error.message : 'Connection failed';
    card.append(text);
    const remove = () => shade.remove();
    for (const [label, action] of [['Retry', retry], ['Back to lobby', exit]] as const) {
        const button = document.createElement('button');
        button.textContent = label;
        button.style.cssText = 'height:42px;width:100%;margin-top:10px;border:0;border-radius:22px;background:#b8814c;color:white;font:inherit';
        button.onclick = () => { remove(); action(); };
        card.append(button);
    }
    shade.append(card);
    document.body.append(shade);
    return remove;
}
