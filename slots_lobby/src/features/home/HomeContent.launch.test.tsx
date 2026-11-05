import { expect,it,vi } from 'vitest';
import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {HomeContent} from './HomeContent';
import {launchGame} from '../../services/game-entry';
vi.mock('../../services/game-entry',()=>({launchGame:vi.fn()}));
it('遊戲卡片先進入詳情路由，由詳情容器負責加載遊戲',async()=>{
 window.history.replaceState(null,'','/');render(<HomeContent/>);await userEvent.setup().click(screen.getByRole('button',{name:'進入麻將胡了'}));expect(window.location.pathname).toBe('/game/AG1');expect(launchGame).not.toHaveBeenCalled();
});
