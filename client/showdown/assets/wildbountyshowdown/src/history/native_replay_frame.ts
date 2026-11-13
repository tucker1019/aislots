import type { HistoryReplay } from './history_types';
import { fitGameOverlay } from '../ui/game_overlay';
import { replayMessage } from './replay_message';
/** Keep the live Cocos scene untouched: a disposable read-only native instance owns playback. */
export class NativeReplayFrame {
    private root = document.createElement('section');
    private frame = document.createElement('iframe');
    private channel = crypto.randomUUID();
    private loadingClose = document.createElement('button');
    private fit: () => void;
    private disposed = false;
    private message = (event: MessageEvent) => {
        const source = this.frame.contentWindow, origin = location.origin;
        if (replayMessage(event,source,origin,this.channel,'ag3-replay-ready')) {
            // Replay does not need balances; do not send the player's historical wallet to child frames.
            source.postMessage({type:'ag3-replay-data',channel:this.channel,data:{...this.data,frames:this.data.frames.map(frame=>({...frame,balance:0}))}},origin);
        } else if (replayMessage(event,source,origin,this.channel,'ag3-replay-playing')) this.loadingClose.remove();
        else if (replayMessage(event,source,origin,this.channel,'ag3-replay-exit')) this.close();
        else if (replayMessage(event,source,origin,this.channel,'ag3-replay-share')) {
            const id = event.data.id;
            if (typeof id !== 'string') return;
            void this.share().then(url=>{if(!this.disposed)source.postMessage({type:'ag3-replay-share-result',channel:this.channel,id,url},origin);}).catch(()=>{if(!this.disposed)source.postMessage({type:'ag3-replay-share-result',channel:this.channel,id,error:'分享失败，请重试'},origin);});
        }
    };
    constructor(private data: HistoryReplay, private onClose: () => void, private share: () => Promise<string>) {
        this.root.setAttribute('role','dialog');this.root.setAttribute('aria-label','AG3 动画回放');this.root.setAttribute('aria-modal','true');
        this.root.style.cssText='position:fixed;z-index:14000;background:#000;overflow:hidden';
        const url = new URL(location.pathname,location.origin);url.searchParams.set('nativeReplay',this.channel);
        if (['localhost','127.0.0.1'].includes(location.hostname) && new URL(location.href).searchParams.has('api')) url.searchParams.set('api',new URL(location.href).searchParams.get('api'));
        this.frame.src=url.href;this.frame.title='AG3 动画回放';this.frame.allow='autoplay; clipboard-write';this.frame.style.cssText='display:block;width:100%;height:100%;border:0';
        window.addEventListener('message',this.message);
        this.loadingClose.textContent='关闭回放';this.loadingClose.style.cssText='position:absolute;right:12px;top:12px;z-index:1;width:130px;height:54px;font:20px Arial;border:1px solid #bb7c4b;border-radius:27px;background:#30303e;color:#e4c29d';this.loadingClose.onclick=()=>this.close();
        this.root.append(this.frame,this.loadingClose);document.body.append(this.root);
        this.fit=fitGameOverlay(this.root,document.getElementById('GameCanvas') as HTMLCanvasElement,750);
    }
    close() { if(this.disposed)return;this.destroy();this.onClose(); }
    destroy() { if(this.disposed)return;this.disposed=true;window.removeEventListener('message',this.message);this.root.remove();this.fit?.(); }
}
