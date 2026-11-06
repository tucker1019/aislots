import {expect,it,vi} from 'vitest';
import {QueryClient} from '@tanstack/react-query';
import {aggregateIndicators,indicatorKey,rewardClaimed} from './claimIndicators';
it('签到和VIP可领时聚合到我的，逐项领取后父红点才消失',async()=>{
 const client=new QueryClient();vi.spyOn(client,'invalidateQueries').mockResolvedValue();
 client.setQueryData(indicatorKey(7,'checkin'),{checkin:1});client.setQueryData(indicatorKey(7,'vip'),{upgrade:1});
 const state=()=>aggregateIndicators([client.getQueryData(indicatorKey(7,'checkin'))??{},client.getQueryData(indicatorKey(7,'vip'))??{}]);
 expect(state().my).toBe(true);expect(state().vip).toBe(true);expect(state().active('checkin')).toBe(true);
 await rewardClaimed(client,7,'vip',300,{kind:'upgrade',rewardId:'1'});
 expect(state().vip).toBe(false);expect(state().my).toBe(true);expect(state().active('checkin')).toBe(true);
 await rewardClaimed(client,7,'checkin',188,undefined);expect(state().my).toBe(false);
});
it('多笔VIP和邀请奖励只消除本次领取项',async()=>{
 const client=new QueryClient();vi.spyOn(client,'invalidateQueries').mockResolvedValue();client.setQueryData(indicatorKey(7,'vip'),{upgrade:2,weekly:1});client.setQueryData(indicatorKey(7,'invite'),{invite:40000});
 await rewardClaimed(client,7,'vip',300,{kind:'upgrade',rewardId:'1'});expect(client.getQueryData(indicatorKey(7,'vip'))).toEqual({upgrade:1,weekly:1});
 await rewardClaimed(client,7,'invite',20000,'reward-1');expect(client.getQueryData(indicatorKey(7,'invite'))).toEqual({invite:20000});
 await rewardClaimed(client,7,'vip',200,{},'weekly');expect(client.getQueryData(indicatorKey(7,'vip'))).toEqual({upgrade:1,weekly:0});
});
it('零金额与未知状态不制造可领取红点',()=>{const state=aggregateIndicators([{checkin:0,weekly:0,rebate:0},{}]);expect(state.my).toBe(false);expect(state.earn).toBe(false);expect(state.vip).toBe(false);});
it('赚钱归集返水、亏损返还、代理佣金和邀请奖励',()=>{for(const key of ['rebate','loss','agent','invite'])expect(aggregateIndicators([{[key]:1}]).earn).toBe(true);});
