import {expect,it} from 'vitest';
import type {RecentWin} from '../../services/recent-wins';
import {emptyWinQueue,recentWinsQueue} from './recentWinsQueue';
const row=(id:string):RecentWin=>({id,betId:'ORDER1',betAmount:'2500000',avatarId:3,gameId:'AG1',gameName:'G',gameNameEn:'G',cover:'/assets/g.png',nickname:'a***',winAmount:'10000',multiplier:'50',occurredAt:'2026-11-21T00:00:00Z',isSelf:false});
const batch=(prefix:string,count=50)=>Array.from({length:count},(_,i)=>row(prefix+(i+1)));
it('continues 49,50,1,2 then 3,4 rather than resetting the whole row',()=>{
 let s=recentWinsQueue(emptyWinQueue,{type:'received',items:batch('a')});
 for(let i=0;i<48;i++)s=recentWinsQueue(s,{type:'next'});
 expect(s.visible.map(x=>x.id)).toEqual(['a49','a50','a1','a2','a3']);
 for(let i=0;i<4;i++)s=recentWinsQueue(s,{type:'next'});
 expect(s.visible.slice(0,4).map(x=>x.id)).toEqual(['a3','a4','a5','a6']);
});
it('keeps the current stream stable and joins only the latest cached response at its end',()=>{
 let s=recentWinsQueue(emptyWinQueue,{type:'received',items:batch('a')});
 s=recentWinsQueue(s,{type:'received',items:batch('b')});
 expect(s.visible.map(x=>x.id)).toEqual(['a1','a2','a3','a4','a5']);
 s=recentWinsQueue(s,{type:'received',items:batch('c')});
 for(let i=0;i<48;i++)s=recentWinsQueue(s,{type:'next'});
 expect(s.visible.map(x=>x.id)).toEqual(['a49','a50','c1','c2','c3']);
 s=recentWinsQueue(s,{type:'received',items:batch('d')});
 for(let i=0;i<4;i++)s=recentWinsQueue(s,{type:'next'});
 expect(s.visible.slice(0,4).map(x=>x.id)).toEqual(['c3','c4','c5','c6']);
});
it('fills small batches and drains existing cards before accepting an empty response',()=>{
 let s=recentWinsQueue(emptyWinQueue,{type:'received',items:batch('b',2)});
 expect(s.visible.map(x=>x.id)).toEqual(['b1','b2','b1','b2','b1']);
 s=recentWinsQueue(s,{type:'received',items:[]});
 expect(s.visible).toHaveLength(5);
 for(let i=0;i<8;i++)s=recentWinsQueue(s,{type:'next'});
 expect(s.visible).toEqual([]);
});
