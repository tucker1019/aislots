import {afterEach,expect,it} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {Providers} from '../../app/Providers';
import {ThemeSelector} from './ThemeSelector';
import {useThemeStore} from '../../stores/theme';
afterEach(()=>{useThemeStore.getState().setTheme('light');localStorage.removeItem('aislots-theme');});
it('切换主题即时生效并保存，切回浅色同步恢复',async()=>{
 render(<Providers><ThemeSelector/></Providers>);
 fireEvent.click(screen.getByRole('button',{name:'切換主題'}));fireEvent.click(screen.getByRole('radio',{name:'深色'}));
 expect(document.documentElement.dataset.theme).toBe('dark');expect(localStorage.getItem('aislots-theme')).toBe('dark');
 expect(screen.getByRole('button',{name:'切換主題'})).toHaveTextContent('深色');
 fireEvent.click(screen.getByRole('button',{name:'切換主題'}));fireEvent.click(screen.getByRole('radio',{name:'淺色'}));
 expect(document.documentElement.dataset.theme).toBe('light');expect(localStorage.getItem('aislots-theme')).toBe('light');
});
