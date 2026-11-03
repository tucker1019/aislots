import { expect, it } from 'vitest';
import { parseCheckin, parseVip } from './benefits';
it('签到以服务端领取状态为准，拒绝错误金额', () => {
 expect(parseCheckin({currentDay:2,claimed:true,canClaim:false,current:{reward:100}})).toEqual({day:2,claimed:true,canClaim:false,reward:100});
 expect(() => parseCheckin({currentDay:1,claimed:false,canClaim:true,current:{reward:'100'}})).toThrow();
});
it('展示真实等级、待领奖励、预估工资和下一级双条件', () => {
 const data = {state:{level:6,upgradeBet:25300,upgradeRecharge:100,status:'normal'},levels:[{level:7,upgradeBet:10000000,upgradeRecharge:200,upgradeReward:9900}],upgradeClaimableTotal:8800,weeklyPreview:{amount:1200},monthlyPreview:{amount:2800}};
 expect(parseVip(data)).toMatchObject({level:6,upgradeReward:8800,weeklyReward:1200,monthlyReward:2800,nextBet:10000000,nextRecharge:200,nextUpgradeReward:9900});
 expect(parseVip({...data,levels:[]})).toMatchObject({nextBet:null,nextRecharge:null});
 expect(() => parseVip({...data,upgradeClaimableTotal:-1})).toThrow();
});
