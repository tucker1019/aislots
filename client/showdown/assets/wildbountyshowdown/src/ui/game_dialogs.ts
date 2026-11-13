import { fitGameOverlay } from './game_overlay';
export interface GameDialogOptions {
    title: string; message: string; variant?: 'notice'|'failure';
    actions: {label:string;run?:()=>void}[];
}
const openDialogs = new Set<() => void>();
/** AG1 HTML notice / failure styles, fitted to the visible AG3 portrait canvas. */
export function showGameDialog(options:GameDialogOptions): () => void {
    const root=document.createElement('div');root.className='ag3-game-dialog';
    root.setAttribute('role','alertdialog');root.setAttribute('aria-label',options.title);root.setAttribute('aria-modal','true');
    root.style.cssText='position:fixed;z-index:2147483647;container-type:size;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;';
    const card=document.createElement('div'),title=document.createElement('h2'),message=document.createElement('p');
    const failure=options.variant==='failure';
    card.style.cssText=failure?'box-sizing:border-box;width:84%;background:#fff;color:#202124;border:1px solid #d9dce1;border-radius:1%;padding:0;text-align:center;overflow:hidden;':'box-sizing:border-box;width:70%;background:rgba(40,40,52,.96);color:#fff;border-radius:1em;padding:5% 5% 4%;text-align:center;overflow:hidden;';
    title.textContent=options.title;message.textContent=options.message;
    title.style.cssText=failure?'margin:0;padding:4% 4% 2%;font-size:clamp(14px,4.8cqw,24px);font-weight:700;':'margin:0 0 5%;font-size:clamp(16px,4.8cqw,24px);font-weight:500;';
    message.style.cssText=failure?'margin:0;padding:0 6% 4%;line-height:1.6;font-size:clamp(11px,3.2cqw,16px);color:#5f6368;':'margin:0;line-height:1.55;font-size:clamp(12px,3.4cqw,17px);color:#bdbbc3;';
    card.append(title,message);let closed=false,cleanup:(()=>void)|undefined;
    const close=()=>{if(closed)return;closed=true;root.remove();cleanup?.();openDialogs.delete(close);};
    for(const action of options.actions){const button=document.createElement('button');button.type='button';button.textContent=action.label;
        button.style.cssText=failure?'display:block;box-sizing:border-box;width:100%;border:0;border-top:1px solid #e5e7eb;background:#fff;color:#c88719;padding:4%;font-size:clamp(12px,3.6cqw,18px);font-weight:600;cursor:pointer;':'display:block;box-sizing:border-box;width:70%;margin:6% auto 0;border:0;border-radius:2em;background:#c8874f;color:#202124;padding:3%;font-size:clamp(13px,3.6cqw,18px);cursor:pointer;';
        button.addEventListener('click',()=>{if(closed)return;button.disabled=true;close();action.run?.();});card.append(button);
    }
    root.append(card);document.body.append(root);openDialogs.add(close);
    const canvas=document.getElementById('GameCanvas') as HTMLCanvasElement;
    if(canvas)cleanup=fitGameOverlay(root,canvas);
    return close;
}
let removeToast:(()=>void)|undefined;
export function showGameToast(message:string) {
    removeToast?.();
    const root=document.createElement('div');root.setAttribute('role','status');root.style.cssText='position:fixed;z-index:2147483647;display:flex;align-items:center;justify-content:center;pointer-events:none;font-family:Arial,sans-serif;';
    const content=document.createElement('div');content.textContent=message;content.style.cssText='max-width:75%;padding:3% 5%;border:1px solid #80654c;border-radius:.6em;background:rgba(40,40,52,.96);color:#fff;font-size:clamp(12px,3.4cqw,17px);text-align:center;';root.append(content);document.body.append(root);
    const cleanup=fitGameOverlay(root,document.getElementById('GameCanvas') as HTMLCanvasElement);
    const close=()=>{root.remove();cleanup();if(removeToast===close)removeToast=undefined;};removeToast=close;window.setTimeout(close,2000);
}
export function closeGameDialogs(){for(const close of Array.from(openDialogs))close();removeToast?.();}
