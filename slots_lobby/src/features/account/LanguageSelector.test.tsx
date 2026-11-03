import {afterEach,expect,it} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {LanguageSelector} from './LanguageSelector';
import {Providers} from '../../app/Providers';
import {useLanguageStore,t} from '../../i18n';
afterEach(()=>{useLanguageStore.getState().setLocale('zh-CN');localStorage.removeItem('aislots-language');});
function Content(){useLanguageStore(state=>state.locale);return <><LanguageSelector/><h1>{t('copy.walletBalance')}</h1></>;}
it('语言入口切换英文再切回中文，显示和持久化同步变化',async()=>{
 render(<Providers><Content/></Providers>);fireEvent.click(screen.getByRole('button',{name:'选择语言'}));fireEvent.click(screen.getByRole('radio',{name:'English'}));
 expect(await screen.findByRole('heading',{name:'Wallet balance'})).toBeInTheDocument();expect(localStorage.getItem('aislots-language')).toBe('en-US');
 fireEvent.click(screen.getByRole('button',{name:'Select language'}));fireEvent.click(screen.getByRole('radio',{name:'Simplified Chinese'}));expect(await screen.findByRole('heading',{name:'钱包余额'})).toBeInTheDocument();
});
