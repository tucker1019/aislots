import type {RecentWin} from '../../services/recent-wins';
export interface WinQueue {items:RecentWin[];latest:RecentWin[];cursor:number;visible:RecentWin[];cycle:number}
export type WinQueueAction={type:'received';items:RecentWin[]}|{type:'next'};
export const emptyWinQueue:WinQueue={items:[],latest:[],cursor:0,visible:[],cycle:0};
function fill(state:WinQueue):WinQueue {
 let {items,cursor}=state;
 const visible=[...state.visible];
 // Five slots: four visible plus the next card entering from the right.
 while(visible.length<5&&items.length){
  if(cursor>=items.length){items=state.latest;cursor=0;}
  if(!items.length)break;
  visible.push(items[cursor++]);
 }
 return {...state,items,cursor,visible};
}
export function recentWinsQueue(state:WinQueue,action:WinQueueAction):WinQueue {
 if(action.type==='received'){
  const updated={...state,latest:action.items};
  // Refreshes never replace a card already on screen or entering it.
  return state.visible.length?updated:fill({...updated,items:action.items,cursor:0});
 }
 return fill({...state,visible:state.visible.slice(1),cycle:state.cycle+1});
}
