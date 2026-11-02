import { describe, expect, it } from 'vitest';
import { filterGames } from './filterGames';
import type { Game } from './types';
const games: Game[] = [
  { id:'AG1', title:'麻将胡了', subtitle:'Mahjong Ways', category:'cascade', art:'mahjong', status:'available', featured:true, isNew:false, description:'', tags:['东方麻将'] },
  { id:'candy', title:'糖果星球', subtitle:'Candy Planet', category:'cascade', art:'candy', status:'upcoming', featured:false, isNew:true, description:'', tags:['糖果'] },
  { id:'seven', title:'幸运七号', subtitle:'Lucky Seven', category:'lines', art:'seven', status:'upcoming', featured:false, isNew:false, description:'', tags:['经典'] },
];
const base = { view:'discover' as const, category:'all' as const, query:'', favoriteIds:[], recentIds:[] };
describe('目录组合筛选', () => {
  it('中文、英文及主题搜索不区分大小写和前后空格', () => {
    expect(filterGames(games,{...base,query:'  MAHJONG  '}).map(game=>game.id)).toEqual(['AG1']);
    expect(filterGames(games,{...base,query:'东方'}).map(game=>game.id)).toEqual(['AG1']);
    expect(filterGames(games,{...base,query:'不存在'})).toEqual([]);
  });
  it('玩法与收藏筛选取交集，不修改原目录', () => {
    expect(filterGames(games,{...base,view:'favorites',favoriteIds:['AG1','seven'],category:'lines'}).map(game=>game.id)).toEqual(['seven']);
    expect(games.map(game=>game.id)).toEqual(['AG1','candy','seven']);
  });
  it('最近玩过按真实进入顺序排序，并忽略已下架ID', () => {
    expect(filterGames(games,{...base,view:'recent',recentIds:['missing','seven','AG1']}).map(game=>game.id)).toEqual(['seven','AG1']);
  });
});
