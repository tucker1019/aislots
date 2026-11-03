import {afterEach,expect,it} from 'vitest';
import {t,serverText,useLanguageStore,getLocale} from './index';
import {languages} from './config';
afterEach(()=>{useLanguageStore.getState().setLocale('zh-CN');localStorage.removeItem('aislots-language');});
it('语言文件的key和插值参数完全一致',()=>{
 const base=languages[0].messages;
 for(const language of languages){expect(Object.keys(language.messages).sort()).toEqual(Object.keys(base).sort());for(const [key,text] of Object.entries(base)){
  const translated=language.messages[key as keyof typeof base];expect(translated.trim()).not.toBe('');expect([...translated.matchAll(/\{(\w+)\}/g)].map(row=>row[1]).sort()).toEqual([...text.matchAll(/\{(\w+)\}/g)].map(row=>row[1]).sort());
 }}
});
it('英文选择持久化，支持插值和已知服务端标签，业务内容原样保留',()=>{
 useLanguageStore.getState().setLocale('en-US');expect(getLocale()).toBe('en-US');expect(localStorage.getItem('aislots-language')).toBe('en-US');expect(document.documentElement.lang).toBe('en-US');
 expect(t('copy.walletBalance')).toBe('Wallet balance');expect(t('checkin.dayLabel',{day:3})).toBe('Day 3');expect(serverText('充值赠送')).toBe('Deposit bonus');expect(serverText('AG 投注')).toBe('AG Bet');expect(serverText('player_10000001')).toBe('player_10000001');
 useLanguageStore.getState().setLocale('zh-CN');expect(t('copy.walletBalance')).toBe('钱包余额');
});

it('个人报表全部服务端指标都有英文文案',()=>{
 useLanguageStore.getState().setLocale('en-US');
 const labels=['充值金额','取款金额','投注额','有效投注','游戏输赢','游戏返水','签到奖励','VIP晋级奖励','VIP周礼金','VIP月礼金','亏损返还','充值赠送','新手奖励','代理佣金','利息宝收益','账户调整','净输赢'];
 for(const label of labels)expect(serverText(label)).not.toMatch(/\p{Script=Han}/u);
});
