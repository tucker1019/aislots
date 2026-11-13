import {afterEach,expect,it} from 'vitest';
import {getLocale,t,useLanguageStore} from './index';
import {getLanguage,isLocale,resolveLocale} from './config';
import {coinsLabel} from '../features/account/formatCoins';
import {statisticsMoney} from '../services/game-statistics';
import {gameDisplay} from '../app/games';
afterEach(()=>{useLanguageStore.getState().setLocale('zh-TW');localStorage.removeItem('aislots-language');});
it('印尼語可選且覆盖主要業務與插值',()=>{
 expect(isLocale('id-ID')).toBe(true);expect(resolveLocale('id-ID')).toBe('id-ID');
 useLanguageStore.getState().setLocale('id-ID');
 expect(getLocale()).toBe('id-ID');expect(document.documentElement.lang).toBe('id-ID');
 expect(t('copy.home')).toBe('Beranda');expect(t('withdrawal.submit')).toBe('Ajukan penarikan');
 expect(t('checkin.dayLabel',{day:3})).toBe('Hari 3');
 expect(t('gamePreview.rankingPending',{name:'AG2'})).toBe('Peringkat AG2 segera hadir');
 expect(getLanguage('id-ID').antd.locale).toBe('id');
 expect(gameDisplay('AG2',{id:'AG2',name:'麻將胡了2',nameEn:'Mahjong Ways 2',provider:'AG',cover:'/assets/x.png',enabled:true,sort:2,theoreticalRtp:97,volatility:'medium',maxWin:-1}).title).toBe('Mahjong Ways 2');
});
it('金額使用印尼分隔符且排行榜保留超大整數精度',()=>{
 useLanguageStore.getState().setLocale('id-ID');
 expect(coinsLabel(100050)).toBe('1.000,50');
 expect(statisticsMoney('100050')).toBe('1.000,50');
 expect(statisticsMoney('-50')).toBe('-0,50');
 expect(statisticsMoney('900719925474099199')).toBe('9.007.199.254.740.991,99');
});
