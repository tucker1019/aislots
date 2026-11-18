import {expect,it} from 'vitest';
import {parseLossReturn} from './loss-return';
const data={activityDate:'2026-11-04',timezone:'Asia/Shanghai',claimableTotal:100,daily:{preview:{lossAmount:20000,reward:2000,rateBps:1000}}};
it('reads loss return amounts and configured rate from the server',()=>{expect(parseLossReturn(data)).toMatchObject({claimable:100,loss:20000,reward:2000,rateBps:1000});});
it('rejects missing, negative and fractional financial data',()=>{for(const claimableTotal of [undefined,-1,1.5,'100'])expect(()=>parseLossReturn({...data,claimableTotal})).toThrow();expect(()=>parseLossReturn({...data,daily:{preview:{...data.daily.preview,rateBps:10001}}})).toThrow();});
it('validates effective platform fee and enabled reward categories, accepting zero and empty selection',()=>{
 expect(parseLossReturn({...data,platformFeeRateBps:1000,rewardCategories:['checkin','agentCommission']})).toMatchObject({platformFeeRateBps:1000,rewardCategories:['checkin','agentCommission']});
 expect(parseLossReturn({...data,platformFeeRateBps:0,rewardCategories:[]})).toMatchObject({platformFeeRateBps:0,rewardCategories:[]});
 for(const platformFeeRateBps of [-1,10001,0.5,'1000'])expect(()=>parseLossReturn({...data,platformFeeRateBps})).toThrow();
 for(const rewardCategories of ['checkin',[1],{}])expect(()=>parseLossReturn({...data,rewardCategories})).toThrow();
});
