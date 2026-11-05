import { expect, it } from 'vitest';
import { parseBetRecords } from './bet-records';
it('保留服務端廠商與幣種，驗證金額和日期', () => {
 const row = {betId:'b1',gameId:'AG1',gameName:'麻將胡了',provider:'服務端廠商',createdAt:'2026-11-03T01:00:00Z',betAmount:100,validBet:100,profit:-50};
 const data = {items:[row],count:1,betAmount:100,profit:-50,hasMore:false,currency:'IDR',providers:['AG']};
 expect(parseBetRecords(data).items[0]?.provider).toBe('服務端廠商');
 for (const bad of [{...row,profit:'50'},{...row,betAmount:-1},{...row,createdAt:'bad'}]) expect(() => parseBetRecords({...data,items:[bad]})).toThrow();
});
