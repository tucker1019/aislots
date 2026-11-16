import { closeGameDialogs, showGameDialog, type GameDialogOptions } from '../ui/game_dialogs';

export function exitGame() {
    if (window.parent !== window) window.parent.postMessage({type:'aislots:exit', gameId:'AG8'}, '*');
    else if (history.length > 1) history.back();
    else location.assign('/');
}

export function toast(message: string) {
    document.getElementById('ag8-toast')?.remove();
    const node = document.createElement('div');
    node.id = 'ag8-toast';
    node.setAttribute('role', 'status');
    node.style.cssText = 'position:fixed;z-index:15000;top:18px;left:50%;transform:translateX(-50%);width:min(90vw,480px);box-sizing:border-box;padding:14px 18px;border-radius:12px;background:#25242c;color:white;font:15px system-ui;text-align:center;pointer-events:none';
    node.textContent = message;
    document.body.append(node);
    window.setTimeout(() => node.remove(), 2700);
}

export function promptGame(title: string, message: string, actions: GameDialogOptions['actions'], variant?: GameDialogOptions['variant']) {
    closeGameDialogs();
    return showGameDialog({title, message, actions, variant});
}

export function alertGame(message: string, confirm?: () => void, cancel?: () => void) {
    const actions = [{label: "Konfirmasi", run: confirm}];
    if (cancel) actions.push({label: "Batal", run: cancel});
    return promptGame("Pemberitahuan", message, actions);
}
