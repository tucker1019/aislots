import {expect,it} from 'vitest';
import {parseRecentWins,recentWinMoney} from './recent-wins';
const row={id:'1',betId:'ORDER1',betAmount:'2500000',avatarId:3,gameId:'AG2',gameName:'Game',gameNameEn:'Game',cover:'/assets/test.png',nickname:'ra***8',winAmount:'100000000',multiplier:'50',occurredAt:'2026-11-21T10:00:00Z',isSelf:false};
it('validates unique server records, safe covers and the 50-record limit',()=>{
 const data={items:[row],updatedAt:row.occurredAt};
 expect(parseRecentWins(data).items[0]).toEqual(row);
 for(const items of [[row,row],Array.from({length:51},(_,i)=>({...row,id:String(i+1)})),[{...row,cover:'javascript:alert(1)'}],[{...row,id:1}],[{...row,winAmount:'1e8'}],[{...row,isSelf:'true'}],[{...row,betAmount:'1e5'}],[{...row,betId:''}],[{...row,avatarId:16}]]){
  expect(()=>parseRecentWins({...data,items})).toThrow();
 }
 expect(parseRecentWins({...data,items:[]}).items).toEqual([]);
});
it('uses integer cents, truncates one decimal and never loses large integer precision',()=>{
 expect(recentWinMoney('99999')).toBe('Rp999');
 expect(recentWinMoney('100000')).toBe('Rp1.0 k');
 expect(recentWinMoney('125999')).toBe('Rp1.2 k');
 expect(recentWinMoney('125000000')).toBe('Rp1250.0 k');
 expect(recentWinMoney('999999999999999999')).toBe('Rp9999999999999.9 k');
});
