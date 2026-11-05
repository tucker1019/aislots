import {ledgerLabel,reportLabel,gameLabel} from './server-labels';
import {afterEach,expect,it,vi} from 'vitest';
import {t,useLanguageStore,getLocale} from './index';
import {languages,isLocale,resolveLocale} from './config';
afterEach(()=>{useLanguageStore.getState().setLocale('zh-TW');localStorage.removeItem('aislots-language');});
it('語言文件的key和插值參數完全一致',()=>{
 const base=languages[0].messages;
 for(const key of Object.keys(base))expect(key).toMatch(/^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)*$/);
 for(const language of languages){expect(Object.keys(language.messages).sort()).toEqual(Object.keys(base).sort());for(const [key,text] of Object.entries(base)){
  const translated=language.messages[key as keyof typeof base];expect(translated.trim()).not.toBe('');expect([...translated.matchAll(/\{(\w+)\}/g)].map(row=>row[1]).sort()).toEqual([...text.matchAll(/\{(\w+)\}/g)].map(row=>row[1]).sort());
 }}
});
it('英文選擇持久化，支持插值和已知服務端標籤，業務內容原樣保留',()=>{
 useLanguageStore.getState().setLocale('en-US');expect(getLocale()).toBe('en-US');expect(localStorage.getItem('aislots-language')).toBe('en-US');expect(document.documentElement.lang).toBe('en-US');
 expect(t('copy.walletBalance')).toBe('Wallet balance');expect(t('checkin.dayLabel',{day:3})).toBe('Day 3');expect(ledgerLabel('bonus','ignored')).toBe('Deposit bonus');expect(ledgerLabel('bet:AG','ignored')).toBe('AG Bet');expect(gameLabel('unknown','player_10000001')).toBe('player_10000001');
 useLanguageStore.getState().setLocale('zh-TW');expect(t('copy.walletBalance')).toBe('錢包餘額');
});

it('個人報表全部服務端指標都有英文文案',()=>{
 useLanguageStore.getState().setLocale('en-US');
 const ids=['recharge','withdrawal','withdrawalBonus','betAmount','validBet','gameProfit','rebate','checkin','vipUpgrade','vipWeekly','vipMonthly','loserReturn','rechargeBonus','newbieReward','commission','adjustment','inviteReward','netProfit'];
 for(const id of ids)expect(reportLabel(id,'unmapped')).not.toBe('unmapped');
 expect(reportLabel('new-metric','Custom metric')).toBe('Custom metric');
 expect(ledgerLabel('future-category','原始備注')).toBe('原始備注');
 expect(gameLabel('AG1','服務端名稱變化')).toBe('Mahjong Ways');
});

it('only Traditional Chinese and English are selectable; previous Simplified preference migrates',async()=>{
 expect(languages.map(item=>item.id)).toEqual(['zh-TW','en-US']);
 expect(isLocale('zh-CN')).toBe(false);expect(resolveLocale('zh-CN')).toBe('zh-TW');
 expect(resolveLocale('en-US')).toBe('en-US');
 localStorage.setItem('aislots-language','zh-CN');vi.resetModules();
 const fresh=await import('./index');
 expect(fresh.getLocale()).toBe('zh-TW');expect(localStorage.getItem('aislots-language')).toBe('zh-TW');
});
