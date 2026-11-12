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
it('parses game metrics and supplies legacy defaults',()=>{
 expect(parseLobbyGames({games:[game]})[0]).toMatchObject({theoreticalRtp:97,volatility:'medium',maxWin:-1});
 expect(parseLobbyGames({games:[{...game,theoreticalRtp:96.5,volatility:'extreme',maxWin:'5000'}]})[0]).toMatchObject({theoreticalRtp:96.5,volatility:'extreme',maxWin:5000});
 for(const patch of [{theoreticalRtp:101},{theoreticalRtp:'97'},{volatility:'unknown'},{maxWin:0},{maxWin:-2},{maxWin:1.5}])expect(()=>parseLobbyGames({games:[{...game,...patch}]})).toThrow();
});
