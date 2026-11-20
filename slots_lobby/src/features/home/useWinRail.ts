import {useEffect,useRef} from 'react';
import {flushSync} from 'react-dom';

// Read-only automatic motion. Advance the stream one card at a time without
// resetting the whole row; the queue alone decides when a new batch begins.
export function useWinRail(active:boolean,count:number,onNext:()=>void) {
 const rail=useRef<HTMLDivElement>(null);
 const offset=useRef(0);
 useEffect(()=>{
  const node=rail.current;
  if(!node||!active||!count)return;
  let frame=0,previous=0;
  const tick=(now:number)=>{
   const dt=previous?Math.min(now-previous,80):0;previous=now;
   const card=node.querySelector<HTMLElement>('.recent-win');
   const stride=card&&card.offsetWidth>0?card.offsetWidth+8:0;
   if(!document.hidden&&stride>0){
    offset.current+=dt*.04;
    if(offset.current>=stride){
     offset.current-=stride;
     // Removing the leading card and rebasing scrollLeft must finish in the
     // same animation frame. An asynchronous commit briefly exposes the old
     // leading card at the new offset, causing a flash on every boundary.
     flushSync(onNext);
    }
    node.scrollLeft=offset.current;
   }
   frame=window.requestAnimationFrame(tick);
  };
  frame=window.requestAnimationFrame(tick);
  return ()=>window.cancelAnimationFrame(frame);
 },[active,count,onNext]);
 return rail;
}
