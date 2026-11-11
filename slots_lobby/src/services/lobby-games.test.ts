import { expect, it } from 'vitest';
import { parseLobbyGames } from './lobby-games';
const game={id:'AG2',name:'麻將胡了2',nameEn:'Mahjong Ways 2',provider:'AG',cover:'/assets/lobby/games/1024.png',enabled:false,sort:20};
it('keeps server order and coming-soon entries, supports an empty visible catalog',()=>{
 expect(parseLobbyGames({games:[game,{...game,id:'AG1',enabled:true}]}).map(g=>g.id)).toEqual(['AG2','AG1']);
 expect(parseLobbyGames({games:[] })).toEqual([]);
});
it('rejects duplicate identifiers, invalid covers and malformed states',()=>{
 for(const games of [[game,game],[{...game,cover:'javascript:alert(1)'}],[{...game,cover:'/assets/../a.png'}],[{...game,enabled:'true'}],[{...game,sort:-1}],[{...game,id:'../AG1'}]]) expect(()=>parseLobbyGames({games})).toThrow();
});
