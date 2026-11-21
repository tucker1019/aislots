import {expect,it} from 'vitest';
import {parseGameRtp,parseLeaderboard,statisticsMoney} from './game-statistics';
it('RTP允許超過100%，無投注不會偽裝為0%結果',()=>{const data={percent:'123.45',rounds:50,hasData:true,from:'2026-11-03T00:00:00Z',to:'2026-11-03T01:00:00Z',updatedAt:'2026-11-03T01:00:00Z',statisticsSince:'2026-11-03T00:00:00Z'};expect(parseGameRtp(data).percent).toBe('123.45');expect(parseGameRtp({...data,hasData:false,rounds:0}).hasData).toBe(false);expect(()=>parseGameRtp({...data,percent:'NaN'})).toThrow();});
it('排行榜驗證用戶和金額，大整數顯示整數且不損失整數精度',()=>{expect(statisticsMoney('9007199254740993')).toBe('Rp90.071.992.547.409');expect(()=>parseLeaderboard({items:[{avatarId:99}],updatedAt:'2026-11-03',statisticsSince:'2026-11-03',timezone:'UTC'})).toThrow();});

it('rejects leaderboard payloads exceeding the top ten contract',()=>{
 const row={rank:1,platformOrderId:'1',userId:'public',nickname:'Player',anonymous:false,avatarId:1,betId:'bet',betAmount:'100',winAmount:'200',multiplier:'2',occurredAt:'2026-11-21T00:00:00Z'};
 const data={items:Array.from({length:10},(_,i)=>({...row,rank:i+1,platformOrderId:String(i+1)})),updatedAt:'2026-11-21T00:00:00Z',statisticsSince:'2026-11-20T00:00:00Z',timezone:'UTC'};
 expect(parseLeaderboard(data).items).toHaveLength(10);expect(()=>parseLeaderboard({...data,items:[...data.items,{...row,rank:11}]})).toThrow();
});
