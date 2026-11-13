import {afterEach,expect,it} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {LanguageSelector} from './LanguageSelector';
import {Providers} from '../../app/Providers';
import {useLanguageStore,t} from '../../i18n';
afterEach(()=>{useLanguageStore.getState().setLocale('zh-TW');localStorage.removeItem('aislots-language');});
function Content(){useLanguageStore(state=>state.locale);return <><LanguageSelector/><h1>{t('copy.walletBalance')}</h1></>;}
it('語言入口切換英文再切回中文，顯示和持久化同步變化',async()=>{
 render(<Providers><Content/></Providers>);expect(screen.queryByText('简体中文')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'選擇語言'}));fireEvent.click(screen.getByRole('radio',{name:'English'}));
 expect(await screen.findByRole('heading',{name:'Wallet balance'})).toBeInTheDocument();expect(localStorage.getItem('aislots-language')).toBe('en-US');
 fireEvent.click(screen.getByRole('button',{name:'Select language'}));fireEvent.click(screen.getByRole('radio',{name:'Traditional Chinese'}));expect(await screen.findByRole('heading',{name:'錢包餘額'})).toBeInTheDocument();
});
it('切換印尼語後即時更新文案並保存偏好',async()=>{
 render(<Providers><Content/></Providers>);
 fireEvent.click(screen.getByRole('button',{name:'選擇語言'}));
 fireEvent.click(screen.getByRole('radio',{name:'Bahasa Indonesia'}));
 expect(await screen.findByRole('heading',{name:'Saldo dompet'})).toBeInTheDocument();
 expect(localStorage.getItem('aislots-language')).toBe('id-ID');
 expect(document.documentElement.lang).toBe('id-ID');
 fireEvent.click(screen.getByRole('button',{name:'Pilih bahasa'}));
 expect(screen.getByRole('radio',{name:'Bahasa Indonesia'})).toBeChecked();
});
