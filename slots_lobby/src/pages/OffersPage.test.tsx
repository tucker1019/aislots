import {afterEach,expect,it} from 'vitest';
import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {OffersPage} from './OffersPage';
import {useLanguageStore} from '../i18n';
afterEach(()=>useLanguageStore.getState().setLocale('zh-TW'));
it('shows seven inert posters with fixed dimensions and filters by category',async()=>{
 render(<OffersPage/>);expect(screen.getAllByRole('img')).toHaveLength(7);
 for(const image of screen.getAllByRole('img')){expect(image.getAttribute('src')).toMatch(/-zh-tw.webp$/);expect(image).toHaveAttribute('width','960');expect(image).toHaveAttribute('height','320');expect(image.closest('button,a')).toBeNull();}
 await userEvent.setup().click(screen.getByRole('button',{name:'VIP禮金'}));expect(screen.getAllByRole('img')).toHaveLength(2);
});
it('uses English poster assets for English',()=>{
 useLanguageStore.getState().setLocale('en-US');render(<OffersPage/>);
 for(const image of screen.getAllByRole('img'))expect(image.getAttribute('src')).toMatch(/-en.webp$/);
 expect(screen.getByRole('heading',{name:'Offers'})).toBeInTheDocument();
});
