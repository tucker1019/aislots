import {expect,it} from 'vitest';
import {parseGameRtp,parseLeaderboard,statisticsMoney} from './game-statistics';
it('RTP允许超过100%，无投注不会伪装为0%结果',()=>{const data={percent:'123.45',rounds:50,hasData:true,from:'2026-11-03T00:00:00Z',to:'2026-11-03T01:00:00Z',updatedAt:'2026-11-03T01:00:00Z',statisticsSince:'2026-11-03T00:00:00Z'};expect(parseGameRtp(data).percent).toBe('123.45');expect(parseGameRtp({...data,hasData:false,rounds:0}).hasData).toBe(false);expect(()=>parseGameRtp({...data,percent:'NaN'})).toThrow();});
it('排行榜验证用户和金额，大整数显示不损失分位',()=>{expect(statisticsMoney('9007199254740993')).toBe('90,071,992,547,409.93');expect(()=>parseLeaderboard({items:[{avatarId:99}],updatedAt:'2026-11-03',statisticsSince:'2026-11-03',timezone:'UTC'})).toThrow();});
