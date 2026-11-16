import { historyReplayResponse } from './history_response';
import type { HistoryReplay } from './history_types';
import { replayMessage } from './replay_message';
export function receiveNativeReplay(channel: string): Promise<HistoryReplay> {
    if (window.parent === window || !channel) return Promise.reject(Error("Tautan rekaman tidak valid."));
    return new Promise((resolve,reject)=>{
        const timeout=window.setTimeout(()=>{window.removeEventListener('message',message);reject(Error("Waktu pemuatan rekaman habis. Silakan buka kembali."));},20000);
        const message=(event:MessageEvent)=>{
            if(!replayMessage(event,window.parent,location.origin,channel,'ag4-replay-data'))return;
            clearTimeout(timeout);window.removeEventListener('message',message);
            try{resolve(historyReplayResponse(event.data.data));}catch(error){reject(error);}
        };
        window.addEventListener('message',message);
        window.parent.postMessage({type:'ag4-replay-ready',channel},location.origin);
    });
}
export function shareFromParent(channel: string): Promise<string> {
    return new Promise((resolve,reject)=>{
        const id=crypto.randomUUID();
        const timeout=window.setTimeout(()=>{window.removeEventListener('message',message);reject(Error("Waktu berbagi habis. Silakan coba lagi."));},15000);
        const message=(event:MessageEvent)=>{
            if(!replayMessage(event,window.parent,location.origin,channel,'ag4-replay-share-result')||event.data.id!==id)return;
            clearTimeout(timeout);window.removeEventListener('message',message);
            if(typeof event.data.url==='string')resolve(event.data.url);else reject(Error("Gagal berbagi. Silakan coba lagi."));
        };
        window.addEventListener('message',message);window.parent.postMessage({type:'ag4-replay-share',channel,id},location.origin);
    });
}
