import {t} from './index';
import type {MessageKey} from './config';
const reportKeys:Record<string,MessageKey>={
 recharge:'copy.depositAmount',withdrawal:'server.withdrawal',withdrawalBonus:'server.withdrawalBonus',
 betAmount:'server.betAmount',validBet:'copy.eligibleBets',gameProfit:'server.gameProfit',rebate:'server.rebate',
 checkin:'server.checkin',vipUpgrade:'server.vipUpgrade',vipWeekly:'server.vipWeekly',vipMonthly:'server.vipMonthly',
 loserReturn:'server.lossReturn',rechargeBonus:'server.depositBonus',newbieReward:'server.newPlayer',
 commission:'server.commission',adjustment:'server.adjustment',inviteReward:'server.inviteReward',netProfit:'copy.netProfit',interest:'server.interest',
};
const ledgerKeys:Record<string,MessageKey>={
 withdrawal:'server.withdrawalDebit','withdrawal-refund':'server.withdrawalRefund','withdrawal-bonus':'server.withdrawalBonus',
 commission:'server.commission',invite:'server.inviteReward',recharge:'server.memberDeposit',bonus:'server.depositBonus',
 fee:'server.depositFee',checkin:'server.checkin',weekly:'copy.weeklyGift',monthly:'copy.monthlyGift',upgrade:'copy.levelUpReward',
 rebate:'server.rebateReward',loss:'server.lossReturn',newbie:'server.newPlayerDeposit',other:'server.other',
};
export function reportLabel(id:string,fallback:string):string{const key=reportKeys[id];return typeof key==='string'?t(key):fallback;}
export function ledgerLabel(id:string|undefined,fallback:string):string {
 if(!id)return fallback;
 if(typeof ledgerKeys[id]==='string')return t(ledgerKeys[id]);
 const match=/^(bet|win):(.+)$/.exec(id);
 return match?`${match[2]} ${t(match[1]==='bet'?'server.bet':'server.payout')}`:fallback;
}
export function gameLabel(id:string,fallback:string):string{return id==='AG1'?t('copy.mahjongWays'):fallback;}
